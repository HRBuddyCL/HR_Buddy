import { Prisma, RequestStatus, RequestType, Urgency } from '@prisma/client';

export type AdminRequestFilter = {
  type?: RequestType;
  status?: RequestStatus;
  urgency?: Urgency;
  departmentId?: string;
  createdDateFrom?: string;
  createdDateTo?: string;
  closedDateFrom?: string;
  closedDateTo?: string;
  // Legacy fields kept for backward compatibility.
  dateFrom?: string;
  dateTo?: string;
  q?: string;
};

function endOfDay(value: string) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

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

  if (filter.urgency) {
    where.urgency = filter.urgency;
  }

  if (filter.departmentId) {
    where.departmentId = filter.departmentId;
  }

  const createdDateFrom = filter.createdDateFrom ?? filter.dateFrom;
  const createdDateTo = filter.createdDateTo ?? filter.dateTo;

  if (createdDateFrom || createdDateTo) {
    const createdAt: Prisma.DateTimeFilter = {};

    if (createdDateFrom) {
      createdAt.gte = new Date(createdDateFrom);
    }

    if (createdDateTo) {
      createdAt.lte = endOfDay(createdDateTo);
    }

    where.createdAt = createdAt;
  }

  if (filter.closedDateFrom || filter.closedDateTo) {
    const closedAt: Prisma.DateTimeNullableFilter = { not: null };

    if (filter.closedDateFrom) {
      closedAt.gte = new Date(filter.closedDateFrom);
    }

    if (filter.closedDateTo) {
      closedAt.lte = endOfDay(filter.closedDateTo);
    }

    where.closedAt = closedAt;
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
