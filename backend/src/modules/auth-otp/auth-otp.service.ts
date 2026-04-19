import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpDeliveryService } from './delivery/otp-delivery.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {
  generateOtpCode,
  generateSessionToken,
  hashWithSecret,
} from './utils/crypto.util';

type Tx = Prisma.TransactionClient;

@Injectable()
export class AuthOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly otpDeliveryService: OtpDeliveryService,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);

    const issued = await this.prisma.$transaction(async (tx) => {
      await this.acquireOtpSendLock(tx, dto.phone, normalizedEmail);

      const now = new Date();
      await this.assertVerifyLockNotActive(tx, dto.phone, normalizedEmail, now);
      await this.assertSendCooldown(tx, dto.phone, normalizedEmail, now);
      await this.assertSendRateLimit(tx, dto.phone, normalizedEmail, now);

      const otpCode = generateOtpCode(6);
      const otpCodeHash = this.hash(otpCode);
      const expiresAt = this.minutesFromNow(this.otpTtlMinutes());

      const otpSession = await tx.otpSession.create({
        data: {
          phone: dto.phone,
          email: normalizedEmail,
          otpCodeHash,
          expiresAt,
        },
        select: {
          id: true,
        },
      });

      return {
        otpSessionId: otpSession.id,
        otpCode,
        expiresAt,
      };
    });

    try {
      await this.otpDeliveryService.getProvider().sendOtp({
        phone: dto.phone,
        email: normalizedEmail,
        otpCode: issued.otpCode,
        expiresAt: issued.expiresAt,
      });
    } catch (error) {
      await this.prisma.otpSession
        .delete({ where: { id: issued.otpSessionId } })
        .catch(() => undefined);
      throw error;
    }

    return {
      expiresAt: issued.expiresAt,
      otpTtlSeconds: this.otpTtlMinutes() * 60,
      resendAfterSeconds: this.otpSendCooldownSeconds(),
      ...(this.shouldExposeDevOtp() ? { devOtp: issued.otpCode } : {}),
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const inputHash = this.hash(dto.otpCode);

    const otpSession = await this.prisma.otpSession.findFirst({
      where: {
        phone: dto.phone,
        email: normalizedEmail,
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phone: true,
        email: true,
        otpCodeHash: true,
        expiresAt: true,
        verifiedAt: true,
        attemptCount: true,
        blockedUntil: true,
        createdAt: true,
      },
    });

    if (!otpSession) {
      throw new NotFoundException({
        code: 'OTP_SESSION_NOT_FOUND',
        message: 'OTP session not found',
      });
    }

    const now = new Date();

    if (otpSession.blockedUntil && otpSession.blockedUntil > now) {
      throw new BadRequestException({
        code: 'OTP_TEMPORARILY_LOCKED',
        message: 'OTP verification is temporarily locked',
        retryAfterSeconds: this.secondsUntil(otpSession.blockedUntil, now),
      });
    }

    let currentAttemptCount = otpSession.attemptCount;
    if (
      currentAttemptCount >= this.maxAttempts() &&
      (!otpSession.blockedUntil || otpSession.blockedUntil <= now)
    ) {
      await this.prisma.otpSession.updateMany({
        where: {
          id: otpSession.id,
          verifiedAt: null,
        },
        data: {
          attemptCount: 0,
          blockedUntil: null,
        },
      });
      currentAttemptCount = 0;
    }

    if (otpSession.expiresAt <= now) {
      throw new BadRequestException({
        code: 'OTP_EXPIRED',
        message: 'OTP is expired',
      });
    }

    if (inputHash !== otpSession.otpCodeHash) {
      const nextAttemptCount = currentAttemptCount + 1;

      if (nextAttemptCount >= this.maxAttempts()) {
        const blockedUntil = this.minutesFromNow(this.attemptLockMinutes());

        await this.prisma.otpSession.updateMany({
          where: {
            id: otpSession.id,
            verifiedAt: null,
          },
          data: {
            attemptCount: nextAttemptCount,
            blockedUntil,
          },
        });

        throw new BadRequestException({
          code: 'OTP_TEMPORARILY_LOCKED',
          message: 'OTP verification is temporarily locked',
          retryAfterSeconds: this.secondsUntil(blockedUntil, now),
        });
      }

      await this.prisma.otpSession.updateMany({
        where: {
          id: otpSession.id,
          verifiedAt: null,
        },
        data: { attemptCount: { increment: 1 } },
      });

      throw new BadRequestException({
        code: 'INVALID_OTP_CODE',
        message: 'Invalid OTP code',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const verifyResult = await tx.otpSession.updateMany({
        where: {
          id: otpSession.id,
          verifiedAt: null,
          expiresAt: { gt: now },
          otpCodeHash: inputHash,
        },
        data: {
          verifiedAt: now,
          attemptCount: { increment: 1 },
        },
      });

      if (verifyResult.count !== 1) {
        throw new BadRequestException({
          code: 'OTP_ALREADY_USED',
          message: 'OTP session has already been verified',
        });
      }

      const sessionToken = generateSessionToken();
      const sessionTokenHash = this.hash(sessionToken);
      const expiresAt = this.minutesFromNow(this.sessionTtlMinutes());

      await tx.employeeAccessSession.create({
        data: {
          phone: dto.phone,
          email: normalizedEmail,
          sessionTokenHash,
          expiresAt,
        },
      });

      return {
        sessionToken,
        expiresAt,
      };
    });
  }

  async validateSessionToken(token: string) {
    return this.prisma.employeeAccessSession.findFirst({
      where: {
        sessionTokenHash: this.hash(token),
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phone: true,
        email: true,
        expiresAt: true,
      },
    });
  }

  private async assertSendCooldown(
    tx: Tx,
    phone: string,
    email: string,
    now: Date,
  ) {
    const cooldownSeconds = this.otpSendCooldownSeconds();

    if (cooldownSeconds <= 0) {
      return;
    }

    const latestSession = await tx.otpSession.findFirst({
      where: {
        phone,
        email,
        createdAt: {
          gte: new Date(now.getTime() - cooldownSeconds * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
      },
    });

    if (!latestSession) {
      return;
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (latestSession.createdAt.getTime() +
          cooldownSeconds * 1000 -
          now.getTime()) /
          1000,
      ),
    );

    throw new BadRequestException({
      code: 'OTP_COOLDOWN_ACTIVE',
      message: 'OTP was recently sent. Please wait before requesting again.',
      retryAfterSeconds,
    });
  }

  private async assertVerifyLockNotActive(
    tx: Tx,
    phone: string,
    email: string,
    now: Date,
  ) {
    const lockedSession = await tx.otpSession.findFirst({
      where: {
        phone,
        email,
        verifiedAt: null,
        blockedUntil: { gt: now },
      },
      orderBy: { blockedUntil: 'desc' },
      select: {
        blockedUntil: true,
      },
    });

    if (!lockedSession?.blockedUntil) {
      return;
    }

    throw new BadRequestException({
      code: 'OTP_TEMPORARILY_LOCKED',
      message: 'OTP verification is temporarily locked',
      retryAfterSeconds: this.secondsUntil(lockedSession.blockedUntil, now),
    });
  }

  private async assertSendRateLimit(
    tx: Tx,
    phone: string,
    email: string,
    now: Date,
  ) {
    const limitPerHour = this.otpMaxSendPerHour();

    const lastHourCount = await tx.otpSession.count({
      where: {
        phone,
        email,
        createdAt: {
          gte: new Date(now.getTime() - 60 * 60 * 1000),
        },
      },
    });

    if (lastHourCount >= limitPerHour) {
      throw new BadRequestException({
        code: 'OTP_RATE_LIMITED',
        message: 'Too many OTP requests. Please try again later.',
      });
    }
  }

  private async acquireOtpSendLock(tx: Tx, phone: string, email: string) {
    const lockKey = this.otpSendLockKey(phone, email);

    await tx.$queryRaw`
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      )
      SELECT true AS "acquired"
    `;
  }

  private otpSendLockKey(phone: string, email: string) {
    return `otp_send:${phone.trim()}:${email.trim().toLowerCase()}`;
  }
  private hash(raw: string) {
    const secret = this.config.get<string>('otpHashSecret') ?? 'dev-otp-secret';
    return hashWithSecret(raw, secret);
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private minutesFromNow(minutes: number) {
    return new Date(Date.now() + minutes * 60_000);
  }

  private otpTtlMinutes() {
    return this.config.get<number>('otp.codeTtlMinutes') ?? 5;
  }

  private sessionTtlMinutes() {
    return this.config.get<number>('otp.sessionTtlMinutes') ?? 30;
  }

  private maxAttempts() {
    return this.config.get<number>('otp.maxAttempts') ?? 5;
  }

  private attemptLockMinutes() {
    return this.config.get<number>('otp.attemptLockMinutes') ?? 5;
  }

  private otpSendCooldownSeconds() {
    return this.config.get<number>('otp.sendCooldownSeconds') ?? 60;
  }

  private otpMaxSendPerHour() {
    return this.config.get<number>('otp.maxSendPerHour') ?? 6;
  }

  private secondsUntil(target: Date, now = new Date()) {
    return Math.max(1, Math.ceil((target.getTime() - now.getTime()) / 1000));
  }

  private shouldExposeDevOtp() {
    const runtimeEnv = (
      this.config.get<string>('runtimeEnv') ??
      this.config.get<string>('nodeEnv') ??
      process.env.NODE_ENV ??
      ''
    )
      .trim()
      .toLowerCase();

    return (
      runtimeEnv !== 'production' && this.otpDeliveryService.isConsoleProvider()
    );
  }
}
