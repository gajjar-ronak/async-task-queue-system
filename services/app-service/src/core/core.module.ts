import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { NodeManagerService } from './node-manager.service';
import { PerformanceMetricsService } from './performance-metrics.service';
import { AutoScalingService } from './auto-scaling.service';
import { AutoScalingController } from './auto-scaling.controller';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { DeadLetterQueueController } from './dead-letter-queue.controller';
import { ScalingEventService } from '@distributed-async-task-worker/shared';

@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot()],
  providers: [
    NodeManagerService,
    PerformanceMetricsService,
    AutoScalingService,
    DeadLetterQueueService,
    ScalingEventService,
  ],
  controllers: [AutoScalingController, DeadLetterQueueController],
  exports: [
    NodeManagerService,
    PerformanceMetricsService,
    AutoScalingService,
    DeadLetterQueueService,
    ScalingEventService,
  ],
})
export class CoreModule {}
