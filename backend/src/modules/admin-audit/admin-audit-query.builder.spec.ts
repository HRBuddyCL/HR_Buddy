import { buildAdminAuditWhere } from './admin-audit-query.builder';

describe('buildAdminAuditWhere', () => {
  it('builds date range with end-of-day for dateTo', () => {
    const where = buildAdminAuditWhere({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-08',
    });

    const expectedDateTo = new Date('2026-03-08');
    expectedDateTo.setHours(23, 59, 59, 999);

    expect(where.createdAt).toBeDefined();
    expect((where.createdAt as { gte?: Date }).gte?.toISOString()).toBe(
      '2026-03-01T00:00:00.000Z',
    );
    expect((where.createdAt as { lte?: Date }).lte?.toISOString()).toBe(
      expectedDateTo.toISOString(),
    );
  });

  it('adds OR search clauses when query is present', () => {
    const where = buildAdminAuditWhere({ q: 'hrb-0001' });

    expect(where.OR).toBeDefined();
    expect(where.OR).toHaveLength(5);
  });

  it('maps request urgency filter into nested request where clause', () => {
    const where = buildAdminAuditWhere({ requestUrgency: 'CRITICAL' });

    expect(where.request).toEqual({
      urgency: 'CRITICAL',
    });
  });
});
