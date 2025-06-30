import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { WorkerModule } from '../worker/worker.module';
import { QueueModule } from '../queue/queue.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [WorkerModule, QueueModule, DatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
