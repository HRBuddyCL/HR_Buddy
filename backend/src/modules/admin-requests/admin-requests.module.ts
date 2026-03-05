import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminRequestsController } from './admin-requests.controller';
import { AdminRequestsService } from './admin-requests.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminRequestsController],
  providers: [AdminRequestsService],
})
export class AdminRequestsModule {}
