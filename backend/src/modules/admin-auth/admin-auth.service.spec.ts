import { UnauthorizedException } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';

describe('AdminAuthService', () => {
  const configValues: Record<string, unknown> = {
    'adminAuth.username': 'admin',
    'adminAuth.password': 'super-secure-password',
    'adminAuth.sessionSecret': 'super-secure-admin-session-secret-12345',
    'adminAuth.sessionTtlMinutes': 480,
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  };

  const tx = {
    $queryRaw: jest.fn(),
    adminSession: {
      create: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (txArg: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
    adminSession: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  let service: AdminAuthService;

  beforeEach(() => {
    jest.clearAllMocks();

    tx.$queryRaw.mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    tx.adminSession.create.mockResolvedValue({ id: 'admin-session-1' });
    prisma.adminSession.findFirst.mockResolvedValue({
      username: 'admin',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    prisma.adminSession.updateMany.mockResolvedValue({ count: 1 });

    service = new AdminAuthService(config as never, prisma as never);
  });

  it('creates a persisted admin session on login', async () => {
    const result = await service.login('admin', 'super-secure-password');

    expect(result).toHaveProperty('sessionToken');
    expect(result).toHaveProperty('expiresAt');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);

    expect(tx.adminSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        username: 'admin',
        sessionTokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
      select: {
        id: true,
      },
    });
  });

  it('keeps previous sessions active when logging in again', async () => {
    await service.login('admin', 'super-secure-password');
    await service.login('admin', 'super-secure-password');

    expect(tx.adminSession.create).toHaveBeenCalledTimes(2);
  });

  it('verifies session only when token exists in active admin_sessions row', async () => {
    const login = await service.login('admin', 'super-secure-password');
    const session = await service.verifySessionToken(login.sessionToken);

    expect(prisma.adminSession.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        username: 'admin',
        sessionTokenHash: expect.any(String),
        revokedAt: null,
        expiresAt: {
          gt: expect.any(Date),
        },
      }),
      select: {
        username: true,
        expiresAt: true,
      },
    });

    expect(session).toEqual({
      username: 'admin',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
  });

  it('returns null when token signature is valid but session row is revoked or missing', async () => {
    const login = await service.login('admin', 'super-secure-password');
    prisma.adminSession.findFirst.mockResolvedValueOnce(null);

    const session = await service.verifySessionToken(login.sessionToken);

    expect(session).toBeNull();
  });

  it('revokes current session on logout', async () => {
    const login = await service.login('admin', 'super-secure-password');
    const result = await service.logout(login.sessionToken);

    expect(result).toEqual({ ok: true });
    expect(prisma.adminSession.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        username: 'admin',
        sessionTokenHash: expect.any(String),
        revokedAt: null,
      }),
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('rejects login when credential is invalid', async () => {
    await expect(
      service.login('admin', 'wrong-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});