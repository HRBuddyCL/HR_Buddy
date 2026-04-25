import { RequestStatus, RequestType, Urgency } from '@prisma/client';
import { buildAdminRequestWhere } from './admin-request-query.builder';

describe('buildAdminRequestWhere', () => {
  it('maps simple enum filters', () => {
    const where = buildAdminRequestWhere({
      type: RequestType.BUILDING,
      status: RequestStatus.NEW,
      urgency: Urgency.CRITICAL,
    });

    expect(where).toEqual({
      type: RequestType.BUILDING,
      status: RequestStatus.NEW,
      urgency: Urgency.CRITICAL,
    });
  });

  it('adds full-day created and closed date ranges', () => {
    const where = buildAdminRequestWhere({
      createdDateFrom: '2026-03-01',
      createdDateTo: '2026-03-03',
      closedDateFrom: '2026-03-10',
      closedDateTo: '2026-03-12',
    });

    expect(where.createdAt).toBeDefined();
    expect(where.closedAt).toBeDefined();

    const createdAt = where.createdAt as { gte: Date; lte: Date };
    expect(createdAt.gte.toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(createdAt.lte.getHours()).toBe(23);
    expect(createdAt.lte.getMinutes()).toBe(59);
    expect(createdAt.lte.getSeconds()).toBe(59);

    const closedAt = where.closedAt as {
      not: null;
      gte: Date;
      lte: Date;
    };
    expect(closedAt.not).toBeNull();
    expect(closedAt.gte.toISOString().slice(0, 10)).toBe('2026-03-10');
    expect(closedAt.lte.getHours()).toBe(23);
    expect(closedAt.lte.getMinutes()).toBe(59);
    expect(closedAt.lte.getSeconds()).toBe(59);
  });

  it('keeps legacy dateFrom/dateTo behavior for createdAt filter', () => {
    const where = buildAdminRequestWhere({
      dateFrom: '2026-04-01',
      dateTo: '2026-04-02',
      q: '  john  ',
    });

    expect(where.createdAt).toBeDefined();
    expect(where.OR).toEqual([
      { requestNo: { contains: 'john', mode: 'insensitive' } },
      { phone: { contains: 'john' } },
      { employeeName: { contains: 'john', mode: 'insensitive' } },
    ]);

    const createdAt = where.createdAt as { gte: Date; lte: Date };
    expect(createdAt.gte.toISOString().slice(0, 10)).toBe('2026-04-01');
    expect(createdAt.lte.getHours()).toBe(23);
  });
});
