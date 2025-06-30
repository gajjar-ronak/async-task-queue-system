import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SystemController } from './system.controller';
import { WorkflowController } from './workflow.controller';
import { TaskController } from './task.controller';
import { StressTestController } from './stress-test.controller';
import { StressTestService } from './stress-test.service';
import { CoordinatorModule } from '../coordinator/coordinator.module';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [CoordinatorModule, CoreModule],
  controllers: [
    HealthController,
    SystemController,
    WorkflowController,
    TaskController,
    StressTestController,
  ],
  providers: [StressTestService],
})
export class ApiModule {}
