import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TaskProcessingService } from './task-processing.service';
import { PerformanceMetricsService } from './performance-metrics.service';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    DatabaseModule,
    ScheduleModule.forRoot(),
    forwardRef(() => QueueModule),
  ],
  providers: [
    TaskProcessingService,
    PerformanceMetricsService,
    DeadLetterQueueService,
  ],
  controllers: [],
  exports: [
    TaskProcessingService,
    PerformanceMetricsService,
    DeadLetterQueueService,
  ],
})
export class CoreModule {}
