import { Controller, Get } from '@nestjs/common';
import { NodeManagerService } from '../core/node-manager.service';
import { PerformanceMetricsService } from '../core/performance-metrics.service';
import {
  PrismaService,
  TaskStatus,
} from '@distributed-async-task-worker/shared';

@Controller('system')
export class SystemController {
  constructor(
    private nodeManagerService: NodeManagerService,
    private performanceMetricsService: PerformanceMetricsService,
  ) {}

  @Get('nodes')
  async getNodes() {
    return await this.nodeManagerService.getAllNodes();
  }

  @Get('nodes/active-count')
  async getActiveNodesCount() {
    const count = await this.nodeManagerService.getActiveNodesCount();
    return { activeNodes: count };
  }

  @Get('performance/current')
  async getCurrentPerformance() {
    return await this.performanceMetricsService.getCurrentPerformanceMetrics();
  }

  @Get('performance/summary')
  async getPerformanceSummary() {
    return await this.performanceMetricsService.getSystemPerformanceSummary();
  }

  @Get('performance/historical')
  async getHistoricalPerformance() {
    return await this.performanceMetricsService.getHistoricalMetrics(24);
  }
}
