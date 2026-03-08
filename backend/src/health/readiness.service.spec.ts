import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ReadinessService } from './readiness.service';

describe('ReadinessService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  } as unknown as PrismaService;

  const makeConfig = (values: Record<string, unknown>) =>
    ({
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService;

  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  it('returns healthy readiness report in non-production when db is reachable', async () => {
    process.env.NODE_ENV = 'development';
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'console',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(true);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'database', ok: true }),
        expect.objectContaining({ name: 'otp-provider', ok: true }),
        expect.objectContaining({
          name: 'attachment-storage-provider',
          ok: true,
        }),
        expect.objectContaining({ name: 'abuse-protection-store', ok: true }),
        expect.objectContaining({
          name: 'production-runtime-config',
          ok: true,
          skipped: true,
        }),
      ]),
    );
  });

  it('returns not ready when database check fails', async () => {
    process.env.NODE_ENV = 'development';
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('db down'));

    const config = makeConfig({
      'otp.deliveryProvider': 'console',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'database',
          ok: false,
          message: 'database connection failed',
        }),
      ]),
    );
  });

  it('returns not ready when otp webhook provider is missing URL', async () => {
    process.env.NODE_ENV = 'development';
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'webhook',
      'otp.webhookUrl': '',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'otp-provider',
          ok: false,
        }),
      ]),
    );
  });

  it('returns not ready when strict providers mode requires otp webhook', async () => {
    process.env.NODE_ENV = 'development';
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'console',
      'attachments.storage.provider': 'webhook',
      'attachments.storage.webhookUrl': 'https://storage.example/webhook',
      'readiness.strictProviders': true,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'otp-provider',
          ok: false,
          message:
            'READINESS_STRICT_PROVIDERS=true requires OTP_DELIVERY_PROVIDER=webhook',
        }),
      ]),
    );
  });

  it('returns not ready when strict providers mode requires attachment webhook', async () => {
    process.env.NODE_ENV = 'development';
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'webhook',
      'otp.webhookUrl': 'https://otp.example/webhook',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': true,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'attachment-storage-provider',
          ok: false,
          message:
            'READINESS_STRICT_PROVIDERS=true requires ATTACHMENT_STORAGE_PROVIDER=webhook',
        }),
      ]),
    );
  });

  it('returns healthy report in strict providers mode when both providers are webhook', async () => {
    process.env.NODE_ENV = 'development';
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'webhook',
      'otp.webhookUrl': 'https://otp.example/webhook',
      'attachments.storage.provider': 'webhook',
      'attachments.storage.webhookUrl': 'https://storage.example/webhook',
      'readiness.strictProviders': true,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(true);
  });

  it('returns not ready when postgres abuse store table is missing', async () => {
    process.env.NODE_ENV = 'development';
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ tableExists: null }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'console',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'postgres',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'abuse-protection-store',
          ok: false,
          message:
            'ABUSE_PROTECTION_STORE=postgres but table abuse_rate_limit_counters is missing',
        }),
      ]),
    );
  });

  it('returns healthy when postgres abuse store table exists', async () => {
    process.env.NODE_ENV = 'development';
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ tableExists: 'abuse_rate_limit_counters' }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'console',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'postgres',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(true);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'abuse-protection-store',
          ok: true,
          message: 'abuse protection postgres store is ready',
        }),
      ]),
    );
  });

  it('returns not ready in production when runtime config is invalid', async () => {
    process.env.NODE_ENV = 'production';
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
      otpHashSecret: 'dev-only-change-this-otp-hash-secret',
      'attachments.uploadTicketSecret':
        'dev-only-change-this-attachment-upload-ticket-secret',
      messengerMagicLinkSecret:
        'dev-only-change-this-messenger-magic-link-secret',
      'adminAuth.sessionSecret': 'dev-only-change-this-admin-session-secret',
      'adminAuth.password': 'admin12345',
      'otp.deliveryProvider': 'console',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'production-runtime-config',
          ok: false,
        }),
      ]),
    );
  });
});
