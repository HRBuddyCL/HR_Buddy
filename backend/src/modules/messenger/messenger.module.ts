import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessengerController } from './messenger.controller';
import { MessengerService } from './messenger.service';

@Module({
  imports: [PrismaModule, NotificationsModule, AttachmentsModule],
  controllers: [MessengerController],
  providers: [MessengerService],
  exports: [MessengerService],
})
export class MessengerModule {}
