import {
  issueAdminSessionToken,
  verifyAdminSessionToken,
} from './admin-session-token.util';

describe('admin-session-token util', () => {
  const secret = 'test-admin-session-secret';

  it('issues and verifies token', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');

    const issued = issueAdminSessionToken({
      username: 'admin',
      secret,
      ttlMinutes: 60,
      now,
    });

    const verified = verifyAdminSessionToken({
      token: issued.sessionToken,
      secret,
      now: new Date('2026-01-01T00:30:00.000Z'),
    });

    expect(verified).toEqual({
      username: 'admin',
      expiresAt: new Date('2026-01-01T01:00:00.000Z'),
    });
  });

  it('rejects token with invalid signature', () => {
    const issued = issueAdminSessionToken({
      username: 'admin',
      secret,
      ttlMinutes: 60,
    });

    const badToken = `${issued.sessionToken}corrupted`;

    const verified = verifyAdminSessionToken({
      token: badToken,
      secret,
    });

    expect(verified).toBeNull();
  });

  it('rejects expired token', () => {
    const issued = issueAdminSessionToken({
      username: 'admin',
      secret,
      ttlMinutes: 1,
      now: new Date('2026-01-01T00:00:00.000Z'),
    });

    const verified = verifyAdminSessionToken({
      token: issued.sessionToken,
      secret,
      now: new Date('2026-01-01T00:01:00.000Z'),
    });

    expect(verified).toBeNull();
  });
});
