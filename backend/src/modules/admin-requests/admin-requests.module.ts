import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminRequestsController } from './admin-requests.controller';
import { AdminRequestsService } from './admin-requests.service';
import { MessengerModule } from '../messenger/messenger.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, MessengerModule, NotificationsModule],
  controllers: [AdminRequestsController],
  providers: [AdminRequestsService],
})
export class AdminRequestsModule {}