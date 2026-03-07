import { Prisma, RequestStatus, RequestType } from '@prisma/client';

export type AdminRequestFilter = {
  type?: RequestType;
  status?: RequestStatus;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
};

export function buildAdminRequestWhere(
  filter: AdminRequestFilter,
): Prisma.RequestWhereInput {
  const where: Prisma.RequestWhereInput = {};

  if (filter.type) {
    where.type = filter.type;
  }

  if (filter.status) {
    where.status = filter.status;
  }

  if (filter.dateFrom || filter.dateTo) {
    const createdAt: Prisma.DateTimeFilter = {};

    if (filter.dateFrom) {
      createdAt.gte = new Date(filter.dateFrom);
    }

    if (filter.dateTo) {
      const endOfDate = new Date(filter.dateTo);
      endOfDate.setHours(23, 59, 59, 999);
      createdAt.lte = endOfDate;
    }

    where.createdAt = createdAt;
  }

  const normalizedQuery = filter.q?.trim();

  if (normalizedQuery) {
    where.OR = [
      { requestNo: { contains: normalizedQuery, mode: 'insensitive' } },
      { phone: { contains: normalizedQuery } },
      { employeeName: { contains: normalizedQuery, mode: 'insensitive' } },
    ];
  }

  return where;
}
