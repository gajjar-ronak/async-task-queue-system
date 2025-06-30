import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for dashboard
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Serve static files (dashboard)
  app.useStaticAssets(join(__dirname, '..', '..', '..'), {
    index: false,
    prefix: '/',
  });

  const port = process.env.APP_SERVICE_PORT || 3002;

  await app.listen(port);
  Logger.log(
    `🚀 App Service is running on: http://localhost:${port}`,
    'Bootstrap',
  );
  Logger.log(
    `📊 Dashboard available at: http://localhost:${port}/dashboard.html`,
    'Bootstrap',
  );
}
bootstrap();
