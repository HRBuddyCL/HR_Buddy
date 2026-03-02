import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateVehicleRequestDto } from '../dto/create-vehicle-request.dto';

type Tx = Prisma.TransactionClient;

export async function assertVehicleRefsExist(
  tx: Tx,
  dto: CreateVehicleRequestDto,
) {
  const cat = await tx.vehicleIssueCategory.findUnique({
    where: { id: dto.issueCategoryId },
    select: { id: true },
  });

  if (!cat) {
    throw new BadRequestException({
      code: 'INVALID_VEHICLE_ISSUE_CATEGORY_ID',
      message: 'Invalid issueCategoryId',
    });
  }
}

export function assertVehicleOtherRule(dto: CreateVehicleRequestDto) {
  if (dto.issueCategoryId === 'vic_other' && !dto.issueCategoryOther?.trim()) {
    throw new BadRequestException({
      code: 'VEHICLE_ISSUE_CATEGORY_OTHER_REQUIRED',
      message:
        'issueCategoryOther is required when issueCategoryId is vic_other',
      field: 'issueCategoryOther',
    });
  }
}
