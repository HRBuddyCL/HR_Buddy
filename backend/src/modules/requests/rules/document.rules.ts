import { BadRequestException } from '@nestjs/common';
import { DeliveryMethod } from '@prisma/client';
import { CreateDocumentRequestDto } from '../dto/create-document-request.dto';

export function assertDocumentCreateRule(dto: CreateDocumentRequestDto) {
  if (dto.neededDate) {
    const needed = new Date(dto.neededDate).getTime();
    if (Number.isNaN(needed)) {
      throw new BadRequestException({
        code: 'INVALID_NEEDED_DATE',
        message: 'neededDate is invalid',
        field: 'neededDate',
      });
    }
  }

  // POSTAL ต้องมี address
  if (dto.deliveryMethod === DeliveryMethod.POSTAL && !dto.deliveryAddress) {
    throw new BadRequestException({
      code: 'DELIVERY_ADDRESS_REQUIRED',
      message: 'deliveryAddress is required when deliveryMethod is POSTAL',
      field: 'deliveryAddress',
    });
  }

  // DIGITAL / PICKUP ห้ามส่ง address มา (กันคนส่งมั่ว)
  if (dto.deliveryMethod !== DeliveryMethod.POSTAL && dto.deliveryAddress) {
    throw new BadRequestException({
      code: 'DELIVERY_ADDRESS_NOT_ALLOWED',
      message: 'deliveryAddress is only allowed when deliveryMethod is POSTAL',
      field: 'deliveryAddress',
    });
  }
}
