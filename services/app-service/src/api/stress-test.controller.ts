import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { StressTestService, StressTestSession } from './stress-test.service';

export interface StressTestConfig {
  totalTasks: number;
  durationMinutes: number;
  taskTypes: string[];
  priorityDistribution: {
    high: number; // percentage
    medium: number; // percentage
    low: number; // percentage
  };
}

@Controller('stress-test')
export class StressTestController {
  constructor(private stressTestService: StressTestService) {}

  @Post('start')
  async startStressTest(@Body() config: StressTestConfig) {
    return await this.stressTestService.startStressTest(config);
  }

  @Get('status/:testId')
  async getStressTestStatus(
    @Param('testId') testId: string,
  ): Promise<StressTestSession | null> {
    return await this.stressTestService.getStressTestStatus(testId);
  }

  @Get('results/:testId')
  async getStressTestResults(@Param('testId') testId: string) {
    return await this.stressTestService.getStressTestResults(testId);
  }

  @Post('stop/:testId')
  async stopStressTest(@Param('testId') testId: string) {
    return await this.stressTestService.stopStressTest(testId);
  }

  @Post('auto-scaling-test')
  async startAutoScalingTest() {
    // High-load test designed to trigger auto-scaling
    const config: StressTestConfig = {
      totalTasks: 200, // Create 200 tasks
      durationMinutes: 2, // Over 2 minutes
      taskTypes: ['api-call', 'database-operation', 'file-processing'],
      priorityDistribution: {
        high: 30,
        medium: 50,
        low: 20,
      },
    };

    return await this.stressTestService.startStressTest(config);
  }

  @Post('mega-stress-test')
  async startMegaStressTest() {
    // Very high-load test for extreme auto-scaling testing
    const config: StressTestConfig = {
      totalTasks: 500, // Create 500 tasks
      durationMinutes: 3, // Over 3 minutes
      taskTypes: [
        'api-call',
        'database-operation',
        'file-processing',
        'email-send',
        'data-transformation',
      ],
      priorityDistribution: {
        high: 40,
        medium: 40,
        low: 20,
      },
    };

    return await this.stressTestService.startStressTest(config);
  }

  @Post('advanced-branching-test')
  async startAdvancedBranchingTest() {
    // Advanced test with higher percentage of branching/dependent tasks for testing
    const config: StressTestConfig = {
      totalTasks: 100, // Create 100 tasks
      durationMinutes: 2, // Over 2 minutes
      taskTypes: [
        'api-call',
        'database-operation',
        'file-processing',
        'email-send',
        'data-transformation',
      ],
      priorityDistribution: {
        high: 30,
        medium: 50,
        low: 20,
      },
    };

    return await this.stressTestService.startStressTest(config);
  }
}
