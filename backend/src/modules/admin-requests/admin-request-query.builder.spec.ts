import { RequestStatus, RequestType } from '@prisma/client';
import { buildAdminRequestWhere } from './admin-request-query.builder';

describe('buildAdminRequestWhere', () => {
  it('maps simple enum filters', () => {
    const where = buildAdminRequestWhere({
      type: RequestType.BUILDING,
      status: RequestStatus.NEW,
    });

    expect(where).toEqual({
      type: RequestType.BUILDING,
      status: RequestStatus.NEW,
    });
  });

  it('adds full-day date range and search query', () => {
    const where = buildAdminRequestWhere({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-03',
      q: '  john  ',
    });

    expect(where.createdAt).toBeDefined();
    expect(where.OR).toEqual([
      { requestNo: { contains: 'john', mode: 'insensitive' } },
      { phone: { contains: 'john' } },
      { employeeName: { contains: 'john', mode: 'insensitive' } },
    ]);

    const createdAt = where.createdAt as { gte: Date; lte: Date };
    expect(createdAt.gte.toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(createdAt.lte.getHours()).toBe(23);
    expect(createdAt.lte.getMinutes()).toBe(59);
    expect(createdAt.lte.getSeconds()).toBe(59);
  });
});
