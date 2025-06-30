import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '@distributed-async-task-worker/shared';
import { WorkerHealthService } from '../worker/worker-health.service';
import { QueueManagerService } from '../queue/queue-manager.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly workerHealthService: WorkerHealthService,
    private readonly queueManagerService: QueueManagerService,
  ) {}

  @Get()
  async getHealth() {
    try {
      // Check database connectivity
      await this.prismaService.$queryRaw`SELECT 1`;

      // Check Redis connectivity through queue manager
      const redisHealthy = await this.checkRedisHealth();

      // Get worker node status
      const workerStatus = await this.workerHealthService.getHealthStatus();

      return {
        status: redisHealthy ? 'healthy' : 'degraded',
        service: 'worker-service',
        timestamp: new Date(),
        database: 'connected',
        redis: redisHealthy ? 'connected' : 'disconnected',
        worker: workerStatus,
        nodeId: process.env.WORKER_NODE_ID || 'unknown',
        hostname: process.env.HOSTNAME || 'unknown',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'worker-service',
        timestamp: new Date(),
        database: 'disconnected',
        error: error.message,
        nodeId: process.env.WORKER_NODE_ID || 'unknown',
        hostname: process.env.HOSTNAME || 'unknown',
      };
    }
  }

  @Get('detailed')
  async getDetailedHealth() {
    try {
      const [dbHealth, redisHealth, workerHealth, queueStats] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkRedisHealth(),
        this.workerHealthService.getDetailedHealthStatus(),
        this.getQueueStats(),
      ]);

      return {
        status: dbHealth && redisHealth ? 'healthy' : 'unhealthy',
        service: 'worker-service',
        timestamp: new Date(),
        checks: {
          database: dbHealth,
          redis: redisHealth,
          worker: workerHealth,
          queue: queueStats,
        },
        environment: {
          nodeId: process.env.WORKER_NODE_ID || 'unknown',
          hostname: process.env.HOSTNAME || 'unknown',
          nodeEnv: process.env.NODE_ENV || 'unknown',
          workerConcurrency: process.env.WORKER_CONCURRENCY || '5',
          scalingMode: process.env.SCALING_MODE === 'true',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'worker-service',
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  @Get('ready')
  async getReadiness() {
    try {
      // Check if worker is ready to process tasks
      const workerReady = await this.workerHealthService.isReady();
      const redisReady = await this.checkRedisHealth();

      return {
        ready: workerReady && redisReady,
        timestamp: new Date(),
        checks: {
          worker: workerReady,
          redis: redisReady,
        },
      };
    } catch (error) {
      return {
        ready: false,
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      // Try to get queue information to test Redis connectivity
      await this.queueManagerService.getQueueInfo();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getQueueStats() {
    try {
      return await this.queueManagerService.getQueueStats();
    } catch (error) {
      return {
        error: 'Failed to get queue stats',
        message: error.message,
      };
    }
  }
}
