import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateBuildingRequestDto } from '../dto/create-building-request.dto';

type Tx = Prisma.TransactionClient;

export async function assertBuildingRefsExist(
  tx: Tx,
  dto: CreateBuildingRequestDto,
) {
  const exists = await tx.problemCategory.count({
    where: { id: dto.problemCategoryId },
  });

  if (!exists) {
    throw new BadRequestException({
      code: 'INVALID_PROBLEM_CATEGORY_ID',
      message: 'Invalid problemCategoryId',
    });
  }
}

export function assertBuildingOtherRule(dto: CreateBuildingRequestDto) {
  if (
    dto.problemCategoryId === 'pc_other' &&
    (!dto.problemCategoryOther || !dto.problemCategoryOther.trim())
  ) {
    throw new BadRequestException({
      code: 'PROBLEM_CATEGORY_OTHER_REQUIRED',
      message:
        'problemCategoryOther is required when problemCategoryId is pc_other',
      field: 'problemCategoryOther',
    });
  }
}
