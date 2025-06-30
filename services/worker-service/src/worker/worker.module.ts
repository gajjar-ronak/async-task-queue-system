import { Module } from '@nestjs/common';
import { WorkerNodeService } from './worker-node.service';
import { WorkerHealthService } from './worker-health.service';
import { QueueModule } from '../queue/queue.module';
import { DatabaseModule } from '../database/database.module';
import { ScalingEventService } from '@distributed-async-task-worker/shared';

@Module({
  imports: [QueueModule, DatabaseModule],
  providers: [WorkerNodeService, WorkerHealthService, ScalingEventService],
  exports: [WorkerNodeService, WorkerHealthService, ScalingEventService],
})
export class WorkerModule {}
