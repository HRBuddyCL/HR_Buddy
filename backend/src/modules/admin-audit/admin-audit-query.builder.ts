import {
  ActivityAction,
  ActorRole,
  Prisma,
  RequestStatus,
  RequestType,
  Urgency,
} from '@prisma/client';

export type AdminAuditFilter = {
  requestType?: RequestType;
  requestStatus?: RequestStatus;
  requestUrgency?: Urgency;
  action?: ActivityAction;
  actorRole?: ActorRole;
  operatorId?: string;
  departmentId?: string;
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
  const request: Prisma.RequestWhereInput = {};

  if (filter.requestType) {
    request.type = filter.requestType;
  }

  if (filter.requestStatus) {
    request.status = filter.requestStatus;
  }

  if (filter.requestUrgency) {
    request.urgency = filter.requestUrgency;
  }

  if (filter.action) {
    where.action = filter.action;
  }

  if (filter.actorRole) {
    where.actorRole = filter.actorRole;
  }

  if (filter.operatorId) {
    where.operatorId = filter.operatorId;
  }

  if (filter.departmentId) {
    request.departmentId = filter.departmentId;
  }

  if (filter.requestId) {
    where.requestId = filter.requestId;
  }

  if (filter.requestNo?.trim()) {
    request.requestNo = {
      contains: filter.requestNo.trim(),
      mode: 'insensitive',
    };
  }

  if (Object.keys(request).length > 0) {
    where.request = request;
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
      {
        request: {
          requestNo: { contains: query, mode: 'insensitive' },
        },
      },
      {
        actorDisplayName: { contains: query, mode: 'insensitive' },
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
