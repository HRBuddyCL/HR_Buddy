import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { GeoModule } from './geo/geo.module';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RequestsModule } from './modules/requests/requests.module';

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
  ],
  controllers: [AppController],
})
export class AppModule {}
