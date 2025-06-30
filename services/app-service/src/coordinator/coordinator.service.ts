import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService, TaskStatus } from '@distributed-async-task-worker/shared';

@Injectable()
export class CoordinatorService implements OnModuleInit {
  private readonly logger = new Logger(CoordinatorService.name);

  constructor(private prismaService: PrismaService) {}

  async onModuleInit() {
    this.logger.log('App Service Coordinator initializing...');
    await this.initializeCoordinator();
  }

  private async initializeCoordinator(): Promise<void> {
    try {
      // Reset any stuck processing tasks on startup
      await this.resetStuckTasks();
      this.logger.log('App Service Coordinator initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize coordinator:', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async monitorSystemHealth(): Promise<void> {
    try {
      const stats = await this.getCoordinatorStats();
      this.logger.debug(`System stats: ${JSON.stringify(stats)}`);
    } catch (error) {
      this.logger.error('Failed to monitor system health:', error);
    }
  }

  private async resetStuckTasks(): Promise<void> {
    try {
      const stuckTasks = await this.prismaService.task.findMany({
        where: {
          status: TaskStatus.PROCESSING,
          updatedAt: {
            lt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
          },
        },
      });

      if (stuckTasks.length > 0) {
        await this.prismaService.task.updateMany({
          where: {
            id: {
              in: stuckTasks.map(task => task.id),
            },
          },
          data: {
            status: TaskStatus.PENDING,
            updatedAt: new Date(),
          },
        });

        this.logger.log(`Reset ${stuckTasks.length} stuck tasks to PENDING`);
      }
    } catch (error) {
      this.logger.error('Failed to reset stuck tasks:', error);
    }
  }

  async getCoordinatorStats() {
    try {
      const [
        totalTasks,
        pendingTasks,
        processingTasks,
        completedTasks,
        failedTasks,
        totalWorkflows,
        activeWorkflows,
      ] = await Promise.all([
        this.prismaService.task.count(),
        this.prismaService.task.count({ where: { status: TaskStatus.PENDING } }),
        this.prismaService.task.count({ where: { status: TaskStatus.PROCESSING } }),
        this.prismaService.task.count({ where: { status: TaskStatus.COMPLETED } }),
        this.prismaService.task.count({ where: { status: TaskStatus.FAILED } }),
        this.prismaService.workflow.count(),
        this.prismaService.workflow.count({ where: { isActive: true } }),
      ]);

      return {
        tasks: {
          total: totalTasks,
          pending: pendingTasks,
          processing: processingTasks,
          completed: completedTasks,
          failed: failedTasks,
        },
        workflows: {
          total: totalWorkflows,
          active: activeWorkflows,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get coordinator stats:', error);
      throw error;
    }
  }
}
