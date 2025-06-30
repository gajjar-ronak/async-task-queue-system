import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for inter-service communication
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = process.env.WORKER_SERVICE_PORT || 3003;

  await app.listen(port);
  Logger.log(
    `🔧 Worker Service is running on: http://localhost:${port}`,
    'Bootstrap',
  );
  Logger.log(
    `⚡ Ready to process tasks from queue`,
    'Bootstrap',
  );
}
bootstrap();
