import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminSessionGuard } from '../admin-auth/admin-session.guard';
import { SlaService } from './sla.service';

@Controller('admin/sla')
@UseGuards(AdminSessionGuard)
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Post('recalculate')
  recalculateAllOpen() {
    return this.slaService.recalculateAllOpen();
  }

  @Get('summary')
  summary() {
    return this.slaService.summary();
  }
}
