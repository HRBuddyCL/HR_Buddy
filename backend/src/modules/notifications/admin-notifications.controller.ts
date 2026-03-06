import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { NotificationListQueryDto } from './dto/notification-list.query.dto';
import { NotificationsService } from './notifications.service';

@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Query() q: NotificationListQueryDto) {
    return this.notificationsService.listForAdmin(q);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markAsReadForAdmin(id);
  }

  @Patch('read-all')
  markReadAll() {
    return this.notificationsService.markAllAsReadForAdmin();
  }
}