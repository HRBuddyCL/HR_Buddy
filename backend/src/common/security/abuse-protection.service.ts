import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemoryRateLimitStore } from './memory-rate-limit.store';
import { PostgresRateLimitStore } from './postgres-rate-limit.store';
import {
  AbuseProtectionStoreName,
  RateLimitConsumeInput,
  RateLimitConsumeResult,
} from './rate-limit.types';

@Injectable()
export class AbuseProtectionService {
  private readonly logger = new Logger(AbuseProtectionService.name);
  private postgresDisabledUntilMs = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly memoryStore: MemoryRateLimitStore,
    private readonly postgresStore: PostgresRateLimitStore,
  ) {}

  async consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeResult> {
    const preferredStore = this.storeName();

    if (preferredStore === 'postgres') {
      const nowMs = Date.now();

      if (nowMs < this.postgresDisabledUntilMs) {
        return this.memoryStore.consume(input);
      }

      const maxAttempts = this.postgresTransientRetries() + 1;
      let lastError: unknown;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          return await this.postgresStore.consume(input);
        } catch (error) {
          lastError = error;

          const canRetry = attempt < maxAttempts;

          if (canRetry && this.isTransientPostgresError(error)) {
            const delayMs = this.postgresTransientRetryDelayMs();

            this.logger.warn(
              `Postgres abuse store transient failure (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms: ${this.errorMessage(error)}`,
            );

            await this.delay(delayMs);
            continue;
          }

          break;
        }
      }

      const retryAfterSeconds = this.postgresRetryAfterSeconds();
      const errorMessage = this.errorMessage(lastError);

      if (this.isProduction() && this.failClosedInProduction()) {
        this.logger.error(
          `Postgres abuse store failed in production; rejecting requests: ${errorMessage}`,
        );

        throw new ServiceUnavailableException({
          code: 'ABUSE_PROTECTION_UNAVAILABLE',
          message: 'Rate-limit store is temporarily unavailable',
        });
      }

      this.postgresDisabledUntilMs = nowMs + retryAfterSeconds * 1000;

      const message = `Postgres abuse store failed. Fallback to memory for ${retryAfterSeconds}s: ${errorMessage}`;

      if (this.isProduction()) {
        this.logger.error(
          `${message} (ABUSE_PROTECTION_POSTGRES_FAIL_CLOSED_IN_PRODUCTION=false)`,
        );
      } else {
        this.logger.warn(message);
      }

      return this.memoryStore.consume(input);
    }

    return this.memoryStore.consume(input);
  }

  private storeName(): AbuseProtectionStoreName {
    const configured = this.config.get<string>('abuseProtection.store');

    if (configured === 'postgres') {
      return 'postgres';
    }

    return 'memory';
  }

  private postgresRetryAfterSeconds() {
    return (
      this.config.get<number>('abuseProtection.postgres.retryAfterSeconds') ??
      30
    );
  }

  private failClosedInProduction() {
    return (
      this.config.get<boolean>(
        'abuseProtection.postgres.failClosedInProduction',
      ) ?? true
    );
  }

  private postgresTransientRetries() {
    return Math.max(
      0,
      this.config.get<number>('abuseProtection.postgres.transientRetries') ?? 2,
    );
  }

  private postgresTransientRetryDelayMs() {
    return Math.max(
      0,
      this.config.get<number>('abuseProtection.postgres.transientRetryDelayMs') ??
        120,
    );
  }

  private isTransientPostgresError(error: unknown) {
    const message = this.errorMessage(error).toLowerCase();

    return (
      message.includes('unable to start a transaction in the given time') ||
      message.includes('transaction api error') ||
      message.includes('timed out fetching a new connection') ||
      message.includes('timeout acquiring a connection') ||
      message.includes('connection pool') ||
      message.includes('too many clients')
    );
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error ?? 'unknown error');
  }

  private async delay(ms: number) {
    if (ms <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private isProduction() {
    return (
      (
        this.config.get<string>('runtimeEnv') ??
        this.config.get<string>('nodeEnv') ??
        ''
      ).toLowerCase() === 'production'
    );
  }
}

