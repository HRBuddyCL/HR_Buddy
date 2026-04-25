import { BadRequestException } from '@nestjs/common';
import { RequestStatus, RequestType } from '@prisma/client';

const TRANSITIONS_BY_TYPE: Record<
  RequestType,
  Record<RequestStatus, RequestStatus[]>
> = {
  BUILDING: {
    NEW: ['APPROVED', 'REJECTED', 'CANCELED'],
    APPROVED: ['IN_PROGRESS', 'DONE', 'CANCELED'],
    IN_PROGRESS: ['DONE', 'CANCELED'],
    IN_TRANSIT: [],
    DONE: [],
    REJECTED: [],
    CANCELED: [],
  },
  VEHICLE: {
    NEW: ['APPROVED', 'REJECTED', 'CANCELED'],
    APPROVED: ['IN_PROGRESS', 'DONE', 'CANCELED'],
    IN_PROGRESS: ['DONE', 'CANCELED'],
    IN_TRANSIT: [],
    DONE: [],
    REJECTED: [],
    CANCELED: [],
  },
  MESSENGER: {
    NEW: ['APPROVED', 'REJECTED', 'CANCELED'],
    APPROVED: [],
    IN_PROGRESS: [],
    IN_TRANSIT: ['DONE'],
    DONE: [],
    REJECTED: [],
    CANCELED: [],
  },
  DOCUMENT: {
    NEW: ['APPROVED', 'REJECTED', 'CANCELED'],
    APPROVED: ['DONE', 'CANCELED'],
    IN_PROGRESS: [],
    IN_TRANSIT: [],
    DONE: [],
    REJECTED: [],
    CANCELED: [],
  },
};

export function assertValidTransition(
  type: RequestType,
  from: RequestStatus,
  to: RequestStatus,
) {
  const allowed = TRANSITIONS_BY_TYPE[type]?.[from] ?? [];

  if (!allowed.includes(to)) {
    throw new BadRequestException({
      code: 'INVALID_STATUS_TRANSITION',
      message: `Cannot change status for ${type} from ${from} to ${to}`,
    });
  }
}
