import { BadRequestException } from '@nestjs/common';
import { CreateMessengerRequestDto } from '../dto/create-messenger-request.dto';

export function assertMessengerDeliveryRule(dto: CreateMessengerRequestDto) {
  if (dto.outsideBkkMetro && !dto.deliveryService) {
    throw new BadRequestException({
      code: 'DELIVERY_SERVICE_REQUIRED',
      message: 'deliveryService is required when outsideBkkMetro is true',
    });
  }

  if (dto.deliveryService === 'OTHER' && !dto.deliveryServiceOther?.trim()) {
    throw new BadRequestException({
      code: 'DELIVERY_SERVICE_OTHER_REQUIRED',
      field: 'deliveryServiceOther',
    });
  }
}
