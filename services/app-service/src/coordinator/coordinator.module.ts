import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CoordinatorService } from './coordinator.service';
import { WorkflowService } from './workflow.service';
import { TaskOrchestrationService } from './task-orchestration.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule],
  providers: [CoordinatorService, WorkflowService, TaskOrchestrationService],
  exports: [CoordinatorService, WorkflowService, TaskOrchestrationService],
})
export class CoordinatorModule {}
