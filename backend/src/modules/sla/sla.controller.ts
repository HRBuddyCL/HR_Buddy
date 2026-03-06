import { Controller, Get, Post } from '@nestjs/common';
import { SlaService } from './sla.service';

@Controller('admin/sla')
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