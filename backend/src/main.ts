import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertRuntimeConfig } from './config/runtime-config.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);
  assertRuntimeConfig(config);

  const trustProxy = config.get<boolean | number | string>('server.trustProxy');
  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (setting: string, value: boolean | number | string) => void;
  };
  expressApp.set('trust proxy', trustProxy ?? false);

  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    credentials: config.get<boolean>('corsAllowCredentials') ?? true,
  });

  await app.listen(config.get<number>('port') ?? 3001);
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
