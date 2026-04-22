import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  issueAdminSessionToken,
  verifyAdminSessionToken,
} from './utils/admin-session-token.util';

type Tx = Prisma.TransactionClient;

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async login(
    usernameInput: string,
    passwordInput: string,
    rememberMe = false,
  ) {
    const adminUsername =
      this.config.get<string>('adminAuth.username') ?? 'admin';
    const adminPassword =
      this.config.get<string>('adminAuth.password') ?? 'admin12345';

    if (!this.matchCredential(usernameInput, adminUsername)) {
      throw this.invalidCredentialError();
    }

    if (!this.matchCredential(passwordInput, adminPassword)) {
      throw this.invalidCredentialError();
    }

    const issued = issueAdminSessionToken({
      username: adminUsername,
      secret: this.sessionSecret(),
      ttlMinutes: this.resolveSessionTtlMinutes(rememberMe),
    });

    await this.prisma.$transaction(async (tx) => {
      await this.acquireAdminLoginLock(tx, adminUsername);

      await tx.adminSession.create({
        data: {
          username: adminUsername,
          sessionTokenHash: this.hashSessionToken(issued.sessionToken),
          expiresAt: issued.expiresAt,
        },
        select: {
          id: true,
        },
      });
    });

    return issued;
  }

  async verifySessionToken(token: string) {
    const parsed = verifyAdminSessionToken({
      token,
      secret: this.sessionSecret(),
    });

    if (!parsed) {
      return null;
    }

    const now = new Date();
    const session = await this.prisma.adminSession.findFirst({
      where: {
        username: parsed.username,
        sessionTokenHash: this.hashSessionToken(token),
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      select: {
        username: true,
        expiresAt: true,
      },
    });

    if (!session) {
      return null;
    }

    return {
      username: session.username,
      expiresAt: session.expiresAt,
    };
  }

  async logout(token: string) {
    const parsed = verifyAdminSessionToken({
      token,
      secret: this.sessionSecret(),
    });

    if (!parsed) {
      return { ok: true };
    }

    await this.prisma.adminSession.updateMany({
      where: {
        username: parsed.username,
        sessionTokenHash: this.hashSessionToken(token),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { ok: true };
  }

  private async acquireAdminLoginLock(tx: Tx, username: string) {
    const lockKey = `admin_login:${username.trim().toLowerCase()}`;

    await tx.$queryRaw`
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      )
      SELECT true AS "acquired"
    `;
  }

  private hashSessionToken(token: string) {
    return createHash('sha256')
      .update(`${this.sessionSecret()}:${token}`)
      .digest('hex');
  }

  private matchCredential(input: string, expected: string) {
    const inputBuffer = Buffer.from(input.trim(), 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (inputBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(inputBuffer, expectedBuffer);
  }

  private sessionSecret() {
    return (
      this.config.get<string>('adminAuth.sessionSecret') ??
      'dev-only-change-this-admin-session-secret'
    );
  }

  private sessionTtlMinutes() {
    return this.config.get<number>('adminAuth.sessionTtlMinutes') ?? 480;
  }

  private rememberSessionTtlMinutes() {
    return (
      this.config.get<number>('adminAuth.rememberSessionTtlMinutes') ?? 10080
    );
  }

  private resolveSessionTtlMinutes(rememberMe: boolean) {
    return rememberMe
      ? this.rememberSessionTtlMinutes()
      : this.sessionTtlMinutes();
  }

  private invalidCredentialError() {
    return new UnauthorizedException({
      code: 'INVALID_ADMIN_CREDENTIALS',
      message: 'Invalid admin credentials',
    });
  }
}
