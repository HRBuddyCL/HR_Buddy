import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GeoModule } from './geo/geo.module';

@Module({
  imports: [GeoModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
