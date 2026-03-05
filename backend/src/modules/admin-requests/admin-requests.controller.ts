import { Controller, Get, Param, Query } from '@nestjs/common';
import { AdminRequestsService } from './admin-requests.service';
import { AdminRequestsQueryDto } from './dto/admin-requests.query.dto';
import {
  AdminRequestDetailResponse,
  AdminRequestListResponse,
} from './admin-requests.types';

@Controller('admin/requests')
export class AdminRequestsController {
  constructor(private readonly svc: AdminRequestsService) {}

  @Get()
  list(@Query() q: AdminRequestsQueryDto): Promise<AdminRequestListResponse> {
    return this.svc.list(q);
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<AdminRequestDetailResponse> {
    return this.svc.detail(id);
  }
}
