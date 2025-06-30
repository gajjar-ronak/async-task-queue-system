import { Controller, Get } from '@nestjs/common';
import { CoordinatorService } from '../coordinator/coordinator.service';
import { DeadLetterQueueService } from '../core/dead-letter-queue.service';
import {
  PrismaService,
  ScalingEventService,
} from '@distributed-async-task-worker/shared';

@Controller('health')
export class HealthController {
  constructor(
    private coordinatorService: CoordinatorService,
    private deadLetterQueueService: DeadLetterQueueService,
    private prismaService: PrismaService,
    private scalingEventService: ScalingEventService,
  ) {}

  @Get()
  async getHealth() {
    try {
      // Check database connectivity
      await this.prismaService.$queryRaw`SELECT 1`;

      return {
        status: 'healthy',
        service: 'app-service',
        timestamp: new Date(),
        database: 'connected',
        environment: {
          nodeEnv: process.env.NODE_ENV || 'unknown',
          hostname: process.env.HOSTNAME || 'unknown',
          port: process.env.APP_SERVICE_PORT || '3002',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'app-service',
        timestamp: new Date(),
        database: 'disconnected',
        error: error.message,
        environment: {
          nodeEnv: process.env.NODE_ENV || 'unknown',
          hostname: process.env.HOSTNAME || 'unknown',
          port: process.env.APP_SERVICE_PORT || '3002',
        },
      };
    }
  }

  @Get('ready')
  async getReadiness() {
    try {
      // Check if service is ready to accept requests
      await this.prismaService.$queryRaw`SELECT 1`;

      return {
        ready: true,
        timestamp: new Date(),
        service: 'app-service',
      };
    } catch (error) {
      return {
        ready: false,
        timestamp: new Date(),
        service: 'app-service',
        error: error.message,
      };
    }
  }

  @Get('stats')
  async getStats() {
    return await this.coordinatorService.getCoordinatorStats();
  }

  @Get('queue')
  async getQueueStats() {
    try {
      // Get queue-like stats from database tasks
      const [pending, processing, completed, failed] = await Promise.all([
        this.prismaService.task.count({ where: { status: 'PENDING' } }),
        this.prismaService.task.count({ where: { status: 'PROCESSING' } }),
        this.prismaService.task.count({ where: { status: 'COMPLETED' } }),
        this.prismaService.task.count({ where: { status: 'FAILED' } }),
      ]);

      return {
        success: true,
        data: {
          waiting: pending,
          active: processing,
          completed: completed,
          failed: failed,
          delayed: 0, // We don't track delayed tasks in this implementation
        },
      };
    } catch (error) {
      return {
        success: true,
        data: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        },
      };
    }
  }

  @Get('dlq')
  async getDlqStats() {
    try {
      const dlqStats = await this.deadLetterQueueService.getDlqStats();
      return {
        success: true,
        data: dlqStats,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get DLQ statistics',
      };
    }
  }

  @Get('scaling-events')
  async getScalingEvents() {
    try {
      const recentEvents =
        await this.scalingEventService.getRecentScalingEvents(10);
      return {
        success: true,
        data: recentEvents,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get scaling events',
        message: error.message,
      };
    }
  }

  @Get('scaling-stats')
  async getScalingStats() {
    try {
      const stats = await this.scalingEventService.getScalingStatistics();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get scaling statistics',
        message: error.message,
      };
    }
  }
}
