import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PrismaService,
  TaskStatus,
  ScalingEventService,
} from '@distributed-async-task-worker/shared';
import { QueueManagerService } from '../queue/queue-manager.service';

@Injectable()
export class WorkerNodeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerNodeService.name);
  private workerId: string;
  private isRunning = false;
  private processingTasks = new Map<string, any>();

  constructor(
    private prismaService: PrismaService,
    private queueManagerService: QueueManagerService,
    private configService: ConfigService,
    private scalingEventService: ScalingEventService,
  ) {
    this.workerId =
      process.env.WORKER_NODE_ID ||
      `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async onModuleInit() {
    this.logger.log(`Worker node ${this.workerId} initializing...`);
    await this.startWorker();
  }

  async onModuleDestroy() {
    this.logger.log(`Worker node ${this.workerId} shutting down...`);
    await this.stopWorker();
  }

  async startWorker(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Worker is already running');
      return;
    }

    this.isRunning = true;
    this.logger.log(`Worker node ${this.workerId} started`);

    // Log node start event
    try {
      const activeNodes = await this.getActiveNodeCount();
      await this.scalingEventService.logNodeStart(this.workerId, activeNodes, {
        hostname: process.env.HOSTNAME,
        scalingMode: process.env.SCALING_MODE === 'true',
        workerConcurrency: process.env.WORKER_CONCURRENCY || '5',
      });
    } catch (error) {
      this.logger.error('Failed to log node start event:', error);
    }

    // Start processing pending tasks
    this.processPendingTasks();
  }

  async stopWorker(): Promise<void> {
    this.isRunning = false;

    // Wait for current tasks to complete
    while (this.processingTasks.size > 0) {
      this.logger.log(
        `Waiting for ${this.processingTasks.size} tasks to complete...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Log node stop event
    try {
      const activeNodes = await this.getActiveNodeCount();
      await this.scalingEventService.logNodeStop(
        this.workerId,
        activeNodes - 1,
        'Normal shutdown',
        {
          hostname: process.env.HOSTNAME,
          gracefulShutdown: true,
          pendingTasks: this.processingTasks.size,
        },
      );
    } catch (error) {
      this.logger.error('Failed to log node stop event:', error);
    }

    this.logger.log(`Worker node ${this.workerId} stopped`);
  }

  private async processPendingTasks(): Promise<void> {
    while (this.isRunning) {
      try {
        // Get pending tasks from database
        const pendingTasks = await this.prismaService.task.findMany({
          where: {
            status: TaskStatus.PENDING,
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
          take: 10, // Process in batches
        });

        if (pendingTasks.length === 0) {
          // No pending tasks, wait before checking again
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        // Process tasks concurrently
        const taskPromises = pendingTasks.map((task) => this.processTask(task));
        await Promise.allSettled(taskPromises);
      } catch (error) {
        this.logger.error('Error in processPendingTasks:', error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async processTask(task: any): Promise<void> {
    const taskId = task.id;

    if (this.processingTasks.has(taskId)) {
      return; // Task already being processed
    }

    this.processingTasks.set(taskId, task);

    try {
      // Update task status to QUEUED
      await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.QUEUED,
          updatedAt: new Date(),
        },
      });

      // Add task to queue for processing
      await this.queueManagerService.addTask({
        taskId: task.id,
        type: task.type,
        data: task.payload,
        priority: task.priority,
        delay: task.delay,
        attempts: task.maxAttempts,
      });

      // Update task status to PROCESSING
      await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.PROCESSING,
          startedAt: new Date(),
          attempts: task.attempts + 1,
          updatedAt: new Date(),
        },
      });

      await this.logTaskEvent(
        taskId,
        'INFO',
        `Task queued by worker ${this.workerId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to process task ${taskId}:`, error);

      // Update task status to FAILED
      await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.FAILED,
          updatedAt: new Date(),
        },
      });

      await this.logTaskEvent(taskId, 'ERROR', `Task failed: ${error.message}`);
    } finally {
      this.processingTasks.delete(taskId);
    }
  }

  async markTaskCompleted(taskId: string, result?: any): Promise<void> {
    try {
      await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await this.logTaskEvent(
        taskId,
        'INFO',
        'Task completed successfully',
        result,
      );
      this.logger.log(`Task ${taskId} marked as completed`);
    } catch (error) {
      this.logger.error(`Failed to mark task ${taskId} as completed:`, error);
    }
  }

  async markTaskFailed(taskId: string, error: any): Promise<void> {
    try {
      const task = await this.prismaService.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        this.logger.error(`Task ${taskId} not found`);
        return;
      }

      // Check if we should retry
      if (task.attempts < task.maxAttempts) {
        await this.prismaService.task.update({
          where: { id: taskId },
          data: {
            status: TaskStatus.RETRYING,
            updatedAt: new Date(),
          },
        });

        await this.logTaskEvent(
          taskId,
          'WARN',
          `Task failed, retrying (attempt ${task.attempts + 1}/${task.maxAttempts})`,
          { error: error.message },
        );
      } else {
        await this.prismaService.task.update({
          where: { id: taskId },
          data: {
            status: TaskStatus.FAILED,
            updatedAt: new Date(),
          },
        });

        await this.logTaskEvent(
          taskId,
          'ERROR',
          'Task failed after max attempts',
          { error: error.message },
        );
      }
    } catch (err) {
      this.logger.error(`Failed to mark task ${taskId} as failed:`, err);
    }
  }

  private async logTaskEvent(
    taskId: string,
    level: string,
    message: string,
    metadata?: any,
  ): Promise<void> {
    try {
      await this.prismaService.taskLog.create({
        data: {
          taskId,
          level: level as any,
          message,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log task event for ${taskId}:`, error);
    }
  }

  getWorkerStats() {
    return {
      workerId: this.workerId,
      isRunning: this.isRunning,
      processingTasks: this.processingTasks.size,
      currentTasks: Array.from(this.processingTasks.keys()),
    };
  }

  private async getActiveNodeCount(): Promise<number> {
    try {
      // Count active nodes from the database
      const activeNodes = await this.prismaService.node.count({
        where: {
          status: 'active',
          lastHeartbeat: {
            gte: new Date(Date.now() - 60000), // Active in last minute
          },
        },
      });
      return activeNodes;
    } catch (error) {
      this.logger.error('Failed to get active node count:', error);
      return 1; // Default to 1 if we can't determine
    }
  }
}
