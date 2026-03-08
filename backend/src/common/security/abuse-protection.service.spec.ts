import { ConfigService } from '@nestjs/config';
import { AbuseProtectionService } from './abuse-protection.service';

describe('AbuseProtectionService', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'abuseProtection.maxEntries') {
        return 50000;
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  let service: AbuseProtectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AbuseProtectionService(config);
  });

  it('allows requests under policy limit', () => {
    const first = service.consume({
      scope: 'otpSend',
      key: 'ip=1.1.1.1',
      policy: { windowSeconds: 60, maxRequests: 2, blockSeconds: 120 },
      nowMs: 1_000,
    });

    const second = service.consume({
      scope: 'otpSend',
      key: 'ip=1.1.1.1',
      policy: { windowSeconds: 60, maxRequests: 2, blockSeconds: 120 },
      nowMs: 2_000,
    });

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it('blocks request after exceeding policy limit', () => {
    service.consume({
      scope: 'otpSend',
      key: 'ip=1.1.1.1',
      policy: { windowSeconds: 60, maxRequests: 1, blockSeconds: 120 },
      nowMs: 1_000,
    });

    const blocked = service.consume({
      scope: 'otpSend',
      key: 'ip=1.1.1.1',
      policy: { windowSeconds: 60, maxRequests: 1, blockSeconds: 120 },
      nowMs: 2_000,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets counter after window passes', () => {
    service.consume({
      scope: 'requestCreate',
      key: 'ip=1.1.1.1',
      policy: { windowSeconds: 10, maxRequests: 1, blockSeconds: 0 },
      nowMs: 1_000,
    });

    const blocked = service.consume({
      scope: 'requestCreate',
      key: 'ip=1.1.1.1',
      policy: { windowSeconds: 10, maxRequests: 1, blockSeconds: 0 },
      nowMs: 2_000,
    });

    const allowedAfterWindow = service.consume({
      scope: 'requestCreate',
      key: 'ip=1.1.1.1',
      policy: { windowSeconds: 10, maxRequests: 1, blockSeconds: 0 },
      nowMs: 12_000,
    });

    expect(blocked.allowed).toBe(false);
    expect(allowedAfterWindow.allowed).toBe(true);
  });
});
