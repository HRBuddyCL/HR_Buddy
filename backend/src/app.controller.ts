import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('health/db')
  async healthDb() {
    // Query เบาสุดเพื่อเช็คต่อ DB จริง
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, db: true };
  }
}
