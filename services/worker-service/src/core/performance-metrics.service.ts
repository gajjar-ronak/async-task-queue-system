import { Injectable, Logger } from '@nestjs/common';
import {
  PrismaService,
  PerformanceData,
} from '@distributed-async-task-worker/shared';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PerformanceMetricsService {
  private readonly logger = new Logger(PerformanceMetricsService.name);
  private taskStartTimes = new Map<string, number>();

  private workerId: string;

  constructor(private prismaService: PrismaService) {
    this.workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Track when a task starts processing
  trackTaskStart(taskId: string): void {
    this.taskStartTimes.set(taskId, Date.now());
  }

  // Track when a task completes and calculate processing time
  async trackTaskCompletion(taskId: string, success: boolean): Promise<void> {
    const startTime = this.taskStartTimes.get(taskId);
    if (startTime) {
      const processingTime = Date.now() - startTime;
      this.taskStartTimes.delete(taskId);

      // Store individual task performance data if needed
      this.logger.debug(
        `Task ${taskId} completed in ${processingTime}ms, success: ${success}`,
      );
    }
  }

  // Calculate and store performance metrics for a time period
  @Cron(CronExpression.EVERY_MINUTE)
  async calculateAndStoreMetrics(): Promise<void> {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      // Get tasks completed in the last minute
      const completedTasks = await this.prismaService.task.findMany({
        where: {
          OR: [
            {
              completedAt: {
                gte: oneMinuteAgo,
                lte: now,
              },
            },
            {
              failedAt: {
                gte: oneMinuteAgo,
                lte: now,
              },
            },
          ],
        },
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          failedAt: true,
          attempts: true,
          maxAttempts: true,
        },
      });

      if (completedTasks.length === 0) {
        return; // No tasks to analyze
      }

      // Calculate metrics
      const processingTimes: number[] = [];
      let successfulTasks = 0;
      let failedTasks = 0;

      completedTasks.forEach((task) => {
        if (task.status === 'COMPLETED') {
          successfulTasks++;
          if (task.startedAt && task.completedAt) {
            const processingTime =
              task.completedAt.getTime() - task.startedAt.getTime();
            processingTimes.push(processingTime);
          }
        } else if (task.status === 'FAILED') {
          // Only count as failed if attempts >= maxAttempts (truly failed after all retries)
          if (task.attempts >= task.maxAttempts) {
            failedTasks++;
          }
          if (task.startedAt && task.failedAt) {
            const processingTime =
              task.failedAt.getTime() - task.startedAt.getTime();
            processingTimes.push(processingTime);
          }
        }
      });

      const avgProcessingTime =
        processingTimes.length > 0
          ? processingTimes.reduce((sum, time) => sum + time, 0) /
            processingTimes.length
          : 0;

      const tasksPerSecond = completedTasks.length / 60; // tasks per second over the minute

      // Store metrics
      await this.prismaService.performanceMetric.create({
        data: {
          nodeId: this.workerId,
          avgProcessingTime,
          tasksPerSecond,
          totalTasks: completedTasks.length,
          successfulTasks,
          failedTasks,
          periodStart: oneMinuteAgo,
          periodEnd: now,
        },
      });

      this.logger.debug(
        `Stored performance metrics: ${avgProcessingTime.toFixed(2)}ms avg, ${tasksPerSecond.toFixed(2)} tasks/sec`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to calculate and store performance metrics:',
        error,
      );
    }
  }

  // Get current performance metrics (last 5 minutes average)
  async getCurrentPerformanceMetrics(): Promise<PerformanceData> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const metrics = await this.prismaService.performanceMetric.findMany({
        where: {
          timestamp: {
            gte: fiveMinutesAgo,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      if (metrics.length === 0) {
        return {
          avgProcessingTime: 0,
          tasksPerSecond: 0,
          totalTasks: 0,
          successfulTasks: 0,
          failedTasks: 0,
          timestamp: new Date(),
        };
      }

      // Calculate averages
      const totalMetrics = metrics.length;
      const avgProcessingTime =
        metrics.reduce((sum, m) => sum + m.avgProcessingTime, 0) / totalMetrics;
      const avgTasksPerSecond =
        metrics.reduce((sum, m) => sum + m.tasksPerSecond, 0) / totalMetrics;
      const totalTasks = metrics.reduce((sum, m) => sum + m.totalTasks, 0);
      const successfulTasks = metrics.reduce(
        (sum, m) => sum + m.successfulTasks,
        0,
      );
      const failedTasks = metrics.reduce((sum, m) => sum + m.failedTasks, 0);

      return {
        avgProcessingTime,
        tasksPerSecond: avgTasksPerSecond,
        totalTasks,
        successfulTasks,
        failedTasks,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get current performance metrics:', error);
      return {
        avgProcessingTime: 0,
        tasksPerSecond: 0,
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        timestamp: new Date(),
      };
    }
  }

  // Get historical performance data for charts
  async getHistoricalMetrics(hours: number = 24): Promise<PerformanceData[]> {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      const metrics = await this.prismaService.performanceMetric.findMany({
        where: {
          timestamp: {
            gte: startTime,
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      return metrics.map((metric) => ({
        avgProcessingTime: metric.avgProcessingTime,
        tasksPerSecond: metric.tasksPerSecond,
        totalTasks: metric.totalTasks,
        successfulTasks: metric.successfulTasks,
        failedTasks: metric.failedTasks,
        timestamp: metric.timestamp,
      }));
    } catch (error) {
      this.logger.error('Failed to get historical metrics:', error);
      return [];
    }
  }

  // Cleanup old metrics (keep only last 7 days)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldMetrics(): Promise<void> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const deleted = await this.prismaService.performanceMetric.deleteMany({
        where: {
          timestamp: {
            lt: sevenDaysAgo,
          },
        },
      });

      this.logger.log(`Cleaned up ${deleted.count} old performance metrics`);
    } catch (error) {
      this.logger.error('Failed to cleanup old metrics:', error);
    }
  }

  // Get system-wide performance summary
  async getSystemPerformanceSummary(): Promise<{
    activeNodes: number;
    totalTasksLastHour: number;
    avgProcessingTime: number;
    tasksPerSecond: number;
    successRate: number;
  }> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const [activeNodes, metrics] = await Promise.all([
        1, // Single worker node for now
        this.prismaService.performanceMetric.findMany({
          where: {
            timestamp: {
              gte: oneHourAgo,
            },
          },
        }),
      ]);

      if (metrics.length === 0) {
        return {
          activeNodes,
          totalTasksLastHour: 0,
          avgProcessingTime: 0,
          tasksPerSecond: 0,
          successRate: 0,
        };
      }

      const totalTasks = metrics.reduce((sum, m) => sum + m.totalTasks, 0);
      const successfulTasks = metrics.reduce(
        (sum, m) => sum + m.successfulTasks,
        0,
      );
      const avgProcessingTime =
        metrics.reduce((sum, m) => sum + m.avgProcessingTime, 0) /
        metrics.length;
      const tasksPerSecond =
        metrics.reduce((sum, m) => sum + m.tasksPerSecond, 0) / metrics.length;
      const successRate =
        totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0;

      return {
        activeNodes,
        totalTasksLastHour: totalTasks,
        avgProcessingTime,
        tasksPerSecond,
        successRate,
      };
    } catch (error) {
      this.logger.error('Failed to get system performance summary:', error);
      return {
        activeNodes: 0,
        totalTasksLastHour: 0,
        avgProcessingTime: 0,
        tasksPerSecond: 0,
        successRate: 0,
      };
    }
  }
}
