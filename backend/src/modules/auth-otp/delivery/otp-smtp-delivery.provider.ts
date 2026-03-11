import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  OtpDeliveryPayload,
  OtpDeliveryProvider,
} from './otp-delivery.interface';

@Injectable()
export class OtpSmtpDeliveryProvider implements OtpDeliveryProvider {
  private readonly logger = new Logger(OtpSmtpDeliveryProvider.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(payload: OtpDeliveryPayload): Promise<void> {
    const host = this.config.get<string>('otp.smtp.host') ?? 'smtp.gmail.com';
    const port = this.config.get<number>('otp.smtp.port') ?? 465;
    const secure = this.config.get<boolean>('otp.smtp.secure') ?? true;
    const username = this.config.get<string>('otp.smtp.username')?.trim() ?? '';
    const appPassword =
      this.config.get<string>('otp.smtp.appPassword')?.trim() ?? '';
    const fromEmail =
      this.config.get<string>('otp.smtp.fromEmail')?.trim() ?? '';
    const timeoutMs = this.config.get<number>('otp.smtp.timeoutMs') ?? 8000;

    if (!username || !appPassword || !fromEmail) {
      throw new ServiceUnavailableException({
        code: 'OTP_SMTP_NOT_CONFIGURED',
        message:
          'SMTP provider is not fully configured (username/app password/from email)',
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: username,
        pass: appPassword,
      },
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
    });

    try {
      await transporter.sendMail({
        from: fromEmail,
        to: payload.email,
        subject: 'Your HR-Buddy OTP Code',
        text: this.buildText(payload.otpCode, payload.expiresAt),
        html: this.buildHtml(payload.otpCode, payload.expiresAt),
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'otp_smtp_delivery_failed',
          host,
          port,
          secure,
          username: this.maskEmail(username),
          fromEmail: this.maskEmail(fromEmail),
          toEmail: this.maskEmail(payload.email),
          reason: this.normalizeSmtpError(error),
        }),
      );

      throw new ServiceUnavailableException({
        code: 'OTP_DELIVERY_FAILED',
        message: 'Failed to deliver OTP via SMTP provider',
      });
    }
  }

  private normalizeSmtpError(error: unknown) {
    if (!(error instanceof Error)) {
      return { name: 'UnknownError', message: 'Unknown SMTP failure' };
    }

    const smtpLike = error as Error & {
      code?: string;
      command?: string;
      responseCode?: number;
      response?: string;
      errno?: string | number;
      syscall?: string;
      address?: string;
      port?: number;
    };

    return {
      name: error.name,
      message: error.message,
      code: smtpLike.code ?? null,
      command: smtpLike.command ?? null,
      responseCode: smtpLike.responseCode ?? null,
      response: smtpLike.response ?? null,
      errno: smtpLike.errno ?? null,
      syscall: smtpLike.syscall ?? null,
      address: smtpLike.address ?? null,
      port: smtpLike.port ?? null,
    };
  }

  private maskEmail(email: string) {
    const trimmed = email.trim();

    if (!trimmed || !trimmed.includes('@')) {
      return '[invalid-email]';
    }

    const [local, domain] = trimmed.split('@');

    if (!local || !domain) {
      return '[invalid-email]';
    }

    const visiblePrefix = local.slice(0, 2);

    return `${visiblePrefix}***@${domain}`;
  }

  private buildText(otpCode: string, expiresAt: Date) {
    return [
      `Your one-time password (OTP) is: ${otpCode}`,
      `This code expires at: ${expiresAt.toISOString()}`,
      'If you did not request this code, please ignore this email.',
    ].join('\n');
  }

  private buildHtml(otpCode: string, expiresAt: Date) {
    const safeOtp = this.escapeHtml(otpCode);
    const safeExpiry = this.escapeHtml(expiresAt.toISOString());

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>HR-Buddy OTP</h2>
        <p>Your one-time password is:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 2px;">${safeOtp}</p>
        <p>This code expires at: ${safeExpiry}</p>
        <p>If you did not request this code, please ignore this email.</p>
      </div>
    `.trim();
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
