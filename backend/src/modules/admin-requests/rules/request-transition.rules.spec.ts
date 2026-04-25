import { BadRequestException } from '@nestjs/common';
import { RequestStatus, RequestType } from '@prisma/client';
import { assertValidTransition } from './request-transition.rules';

describe('assertValidTransition', () => {
  it.each<[RequestType, RequestStatus, RequestStatus]>([
    ['BUILDING', 'NEW', 'APPROVED'],
    ['BUILDING', 'APPROVED', 'IN_PROGRESS'],
    ['VEHICLE', 'IN_PROGRESS', 'DONE'],
    ['MESSENGER', 'IN_TRANSIT', 'DONE'],
    ['DOCUMENT', 'APPROVED', 'DONE'],
  ])('allows %s transition %s -> %s', (type, from, to) => {
    expect(() => assertValidTransition(type, from, to)).not.toThrow();
  });

  it.each<[RequestType, RequestStatus, RequestStatus]>([
    ['BUILDING', 'APPROVED', 'IN_TRANSIT'],
    ['MESSENGER', 'APPROVED', 'IN_TRANSIT'],
    ['MESSENGER', 'APPROVED', 'DONE'],
    ['MESSENGER', 'IN_TRANSIT', 'CANCELED'],
    ['DOCUMENT', 'APPROVED', 'IN_PROGRESS'],
    ['BUILDING', 'DONE', 'CANCELED'],
    ['VEHICLE', 'NEW', 'NEW'],
  ])('rejects %s transition %s -> %s', (type, from, to) => {
    expect(() => assertValidTransition(type, from, to)).toThrow(
      BadRequestException,
    );
  });
});
