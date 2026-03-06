import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AppController } from './app.controller';
import { GeoModule } from './geo/geo.module';
import { AdminRequestsModule } from './modules/admin-requests/admin-requests.module';
import { AuthOtpModule } from './modules/auth-otp/auth-otp.module';
import { MessengerModule } from './modules/messenger/messenger.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { RequestsModule } from './modules/requests/requests.module';
import { SlaModule } from './modules/sla/sla.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    GeoModule,
    PrismaModule,
    RequestsModule,
    AdminRequestsModule,
    ReferenceModule,
    AuthOtpModule,
    MessengerModule,
    NotificationsModule,
    SlaModule,
  ],
  controllers: [AppController],
})
export class AppModule {}