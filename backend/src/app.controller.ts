import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ReadinessReport, ReadinessService } from './health/readiness.service';
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
    const response = this.formatReadinessResponse(report);

    if (!report.ok) {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }

  private formatReadinessResponse(report: ReadinessReport) {
    if (process.env.NODE_ENV !== 'production') {
      return report;
    }

    return {
      ok: report.ok,
      checkedAt: report.checkedAt,
      checks: report.checks.map((check) => ({
        name: check.name,
        ok: check.ok,
        skipped: check.skipped,
      })),
    };
  }
}
