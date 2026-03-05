import { Body, Controller, Post } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { Get, Query } from '@nestjs/common';
import { Param } from '@nestjs/common';

import { CreateBuildingRequestDto } from './dto/create-building-request.dto';
import { CreateVehicleRequestDto } from './dto/create-vehicle-request.dto';
import { CreateMessengerRequestDto } from './dto/create-messenger-request.dto';
import { CreateDocumentRequestDto } from './dto/create-document-request.dto';
import { MyRequestsQueryDto } from './dto/my-requests.query.dto';
import { RequestDetailQueryDto } from './dto/request-detail.query.dto';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post('building')
  createBuilding(@Body() dto: CreateBuildingRequestDto) {
    return this.requestsService.createBuilding(dto);
  }

  @Post('vehicle')
  createVehicle(@Body() dto: CreateVehicleRequestDto) {
    return this.requestsService.createVehicle(dto);
  }

  @Post('messenger')
  createMessenger(@Body() dto: CreateMessengerRequestDto) {
    return this.requestsService.createMessenger(dto);
  }

  @Post('document')
  createDocument(@Body() dto: CreateDocumentRequestDto) {
    return this.requestsService.createDocument(dto);
  }

  @Get('my')
  myRequests(@Query() q: MyRequestsQueryDto) {
    return this.requestsService.getMyRequests(q.phone);
  }

  @Get(':id')
  detail(@Param('id') id: string, @Query() q: RequestDetailQueryDto) {
    return this.requestsService.getRequestDetail(id, q.phone);
  }
}
