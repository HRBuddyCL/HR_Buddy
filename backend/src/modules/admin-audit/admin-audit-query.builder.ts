import { ActivityAction, ActorRole, Prisma } from '@prisma/client';

export type AdminAuditFilter = {
  action?: ActivityAction;
  actorRole?: ActorRole;
  operatorId?: string;
  requestId?: string;
  requestNo?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
};

export function buildAdminAuditWhere(
  filter: AdminAuditFilter,
): Prisma.RequestActivityLogWhereInput {
  const where: Prisma.RequestActivityLogWhereInput = {};

  if (filter.action) {
    where.action = filter.action;
  }

  if (filter.actorRole) {
    where.actorRole = filter.actorRole;
  }

  if (filter.operatorId) {
    where.operatorId = filter.operatorId;
  }

  if (filter.requestId) {
    where.requestId = filter.requestId;
  }

  if (filter.requestNo?.trim()) {
    where.request = {
      requestNo: {
        contains: filter.requestNo.trim(),
        mode: 'insensitive',
      },
    };
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

  const query = filter.q?.trim();

  if (query) {
    where.OR = [
      { note: { contains: query, mode: 'insensitive' } },
      {
        request: {
          requestNo: { contains: query, mode: 'insensitive' },
        },
      },
      {
        request: {
          employeeName: { contains: query, mode: 'insensitive' },
        },
      },
      {
        request: {
          phone: { contains: query },
        },
      },
      {
        operator: {
          displayName: { contains: query, mode: 'insensitive' },
        },
      },
    ];
  }

  return where;
}
