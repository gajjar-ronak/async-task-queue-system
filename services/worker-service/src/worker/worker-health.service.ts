import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PrismaService,
  TaskStatus,
} from '@distributed-async-task-worker/shared';
import { QueueManagerService } from '../queue/queue-manager.service';

@Injectable()
export class WorkerHealthService {
  private readonly logger = new Logger(WorkerHealthService.name);

  constructor(
    private prismaService: PrismaService,
    private queueManagerService: QueueManagerService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkWorkerHealth(): Promise<void> {
    try {
      const stats = await this.getSystemStats();
      this.logger.debug('System health check:', stats);

      // Check for stuck tasks
      await this.checkStuckTasks();

      // Clean up old completed tasks
      await this.cleanupOldTasks();
    } catch (error) {
      this.logger.error('Health check failed:', error);
    }
  }

  private async checkStuckTasks(): Promise<void> {
    const stuckThreshold = 10 * 60 * 1000; // 10 minutes
    const stuckTime = new Date(Date.now() - stuckThreshold);

    const stuckTasks = await this.prismaService.task.findMany({
      where: {
        status: TaskStatus.PROCESSING,
        startedAt: {
          lt: stuckTime,
        },
      },
    });

    if (stuckTasks.length > 0) {
      this.logger.warn(`Found ${stuckTasks.length} stuck tasks`);

      for (const task of stuckTasks) {
        await this.prismaService.task.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.FAILED,
            updatedAt: new Date(),
          },
        });

        await this.prismaService.taskLog.create({
          data: {
            taskId: task.id,
            level: 'ERROR',
            message: 'Task marked as failed due to timeout',
            metadata: JSON.stringify({ reason: 'stuck_task_timeout' }),
          },
        });
      }
    }
  }

  private async cleanupOldTasks(): Promise<void> {
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 hours
    const cleanupTime = new Date(Date.now() - cleanupThreshold);

    // Clean up old completed tasks
    const deletedCompleted = await this.prismaService.task.deleteMany({
      where: {
        status: TaskStatus.COMPLETED,
        completedAt: {
          lt: cleanupTime,
        },
      },
    });

    // Clean up old failed tasks
    const deletedFailed = await this.prismaService.task.deleteMany({
      where: {
        status: TaskStatus.FAILED,
        updatedAt: {
          lt: cleanupTime,
        },
      },
    });

    if (deletedCompleted.count > 0 || deletedFailed.count > 0) {
      this.logger.log(
        `Cleaned up ${deletedCompleted.count} completed and ${deletedFailed.count} failed tasks`,
      );
    }
  }

  async getSystemStats(): Promise<any> {
    const [
      totalTasks,
      pendingTasks,
      processingTasks,
      completedTasks,
      cancelledTasks,
      retryingTasks,
      queuedTasks,
      queueStats,
      // Get failed tasks that have exhausted all retry attempts
      permanentlyFailedTasks,
    ] = await Promise.all([
      this.prismaService.task.count(),
      this.prismaService.task.count({ where: { status: TaskStatus.PENDING } }),
      this.prismaService.task.count({
        where: { status: TaskStatus.PROCESSING },
      }),
      this.prismaService.task.count({
        where: { status: TaskStatus.COMPLETED },
      }),
      this.prismaService.task.count({
        where: { status: TaskStatus.CANCELLED },
      }),
      this.prismaService.task.count({ where: { status: TaskStatus.RETRYING } }),
      this.prismaService.task.count({ where: { status: TaskStatus.QUEUED } }),
      this.queueManagerService.getQueueStats(),
      // Get all failed tasks and filter by attempts >= maxAttempts
      this.prismaService.task
        .findMany({
          where: {
            status: TaskStatus.FAILED,
          },
          select: {
            attempts: true,
            maxAttempts: true,
          },
        })
        .then(
          (tasks) =>
            tasks.filter((task) => task.attempts >= task.maxAttempts).length,
        ),
    ]);

    return {
      database: {
        totalTasks,
        pendingTasks,
        processingTasks,
        queuedTasks,
        retryingTasks,
        completedTasks,
        failedTasks: permanentlyFailedTasks,
        cancelledTasks,
      },
      queue: queueStats,
      timestamp: new Date().toISOString(),
    };
  }

  async getHealthStatus(): Promise<{ status: string; details: any }> {
    try {
      const stats = await this.getSystemStats();

      // Simple health check logic
      const isHealthy =
        stats.queue.active < 1000 && stats.database.processingTasks < 100;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        details: stats,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  async getDetailedHealthStatus(): Promise<any> {
    try {
      const stats = await this.getSystemStats();
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      return {
        status: 'healthy',
        worker: {
          nodeId: process.env.WORKER_NODE_ID || 'unknown',
          uptime: uptime,
          memory: {
            rss: memoryUsage.rss,
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external,
          },
          cpu: process.cpuUsage(),
        },
        database: stats.database,
        queue: stats.queue,
        environment: {
          nodeEnv: process.env.NODE_ENV,
          workerConcurrency: process.env.WORKER_CONCURRENCY,
          scalingMode: process.env.SCALING_MODE === 'true',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  async isReady(): Promise<boolean> {
    try {
      // Check database connectivity
      await this.prismaService.$queryRaw`SELECT 1`;

      // Check queue connectivity
      await this.queueManagerService.getQueueStats();

      return true;
    } catch (error) {
      this.logger.error('Readiness check failed:', error);
      return false;
    }
  }
}
