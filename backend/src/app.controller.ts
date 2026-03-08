import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ReadinessService } from './health/readiness.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readinessService: ReadinessService,
  ) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('health/db')
  async healthDb() {
    // Lightweight query to verify active DB connection
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, db: true };
  }

  @Get('health/ready')
  async healthReady() {
    const report = await this.readinessService.getReport();

    if (!report.ok) {
      throw new ServiceUnavailableException(report);
    }

    return report;
  }
}
