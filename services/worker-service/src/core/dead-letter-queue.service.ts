import { Injectable, Logger } from '@nestjs/common';
import {
  PrismaService,
  DlqStatus,
  TaskStatus,
  DlqTaskData,
  DlqStats,
} from '@distributed-async-task-worker/shared';
import { QueueManagerService } from '../queue/queue-manager.service';

export interface ReprocessResult {
  success: boolean;
  taskId?: string;
  error?: string;
}

@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);

  constructor(
    private prismaService: PrismaService,
    private queueManagerService: QueueManagerService,
  ) {}

  /**
   * Move a failed task to the Dead Letter Queue
   */
  async moveTaskToDlq(taskData: DlqTaskData): Promise<string> {
    try {
      this.logger.log(
        `Moving task ${taskData.originalTaskId} to Dead Letter Queue after ${taskData.attempts} failed attempts`,
      );

      // Create DLQ entry
      const dlqTask = await this.prismaService.deadLetterTask.create({
        data: {
          originalTaskId: taskData.originalTaskId,
          workflowId: taskData.workflowId,
          name: taskData.name,
          type: taskData.type,
          payload: taskData.payload,
          priority: taskData.priority,
          attempts: taskData.attempts,
          maxAttempts: taskData.maxAttempts,
          lastError: taskData.lastError,
          lastErrorStack: taskData.lastErrorStack,
          failureReason: taskData.failureReason,
          originalCreatedAt: taskData.originalCreatedAt,
          firstFailedAt: taskData.firstFailedAt,
          retryHistory: taskData.retryHistory,
          processingMetadata: taskData.processingMetadata,
          status: DlqStatus.PENDING,
        },
      });

      this.logger.log(
        `Task ${taskData.originalTaskId} successfully moved to DLQ with ID ${dlqTask.id}`,
      );

      return dlqTask.id;
    } catch (error) {
      this.logger.error(
        `Failed to move task ${taskData.originalTaskId} to DLQ:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get DLQ statistics
   */
  async getDlqStats(): Promise<DlqStats> {
    try {
      const [
        total,
        pending,
        reprocessing,
        resolved,
        archived,
        tasksByType,
        tasksByFailureReason,
      ] = await Promise.all([
        this.prismaService.deadLetterTask.count(),
        this.prismaService.deadLetterTask.count({
          where: { status: DlqStatus.PENDING },
        }),
        this.prismaService.deadLetterTask.count({
          where: { status: DlqStatus.REPROCESSING },
        }),
        this.prismaService.deadLetterTask.count({
          where: { status: DlqStatus.RESOLVED },
        }),
        this.prismaService.deadLetterTask.count({
          where: { status: DlqStatus.ARCHIVED },
        }),
        this.prismaService.deadLetterTask.groupBy({
          by: ['type'],
          _count: { type: true },
        }),
        this.prismaService.deadLetterTask.groupBy({
          by: ['failureReason'],
          _count: { failureReason: true },
          where: { failureReason: { not: null } },
        }),
      ]);

      const byType: Record<string, number> = {};
      tasksByType.forEach((item) => {
        byType[item.type] = item._count.type;
      });

      const byFailureReason: Record<string, number> = {};
      tasksByFailureReason.forEach((item) => {
        if (item.failureReason) {
          byFailureReason[item.failureReason] = item._count.failureReason;
        }
      });

      return {
        total,
        pending,
        reprocessing,
        resolved,
        archived,
        byType,
        byFailureReason,
      };
    } catch (error) {
      this.logger.error('Failed to get DLQ statistics:', error);
      throw error;
    }
  }

  /**
   * Get DLQ tasks with pagination and filtering
   */
  async getDlqTasks(
    options: {
      page?: number;
      limit?: number;
      status?: DlqStatus;
      type?: string;
      failureReason?: string;
      sortBy?: 'movedToDlqAt' | 'originalCreatedAt' | 'attempts';
      sortOrder?: 'asc' | 'desc';
    } = {},
  ) {
    const {
      page = 1,
      limit = 50,
      status,
      type,
      failureReason,
      sortBy = 'movedToDlqAt',
      sortOrder = 'desc',
    } = options;

    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (failureReason) where.failureReason = failureReason;

    try {
      const [tasks, total] = await Promise.all([
        this.prismaService.deadLetterTask.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.prismaService.deadLetterTask.count({ where }),
      ]);

      return {
        tasks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to get DLQ tasks:', error);
      throw error;
    }
  }

  /**
   * Get a specific DLQ task by ID
   */
  async getDlqTask(dlqTaskId: string) {
    try {
      const task = await this.prismaService.deadLetterTask.findUnique({
        where: { id: dlqTaskId },
      });

      if (!task) {
        throw new Error(`DLQ task ${dlqTaskId} not found`);
      }

      return task;
    } catch (error) {
      this.logger.error(`Failed to get DLQ task ${dlqTaskId}:`, error);
      throw error;
    }
  }

  /**
   * Reprocess a single DLQ task
   */
  async reprocessDlqTask(
    dlqTaskId: string,
    reprocessedBy?: string,
  ): Promise<ReprocessResult> {
    try {
      // Get the DLQ task
      const dlqTask = await this.getDlqTask(dlqTaskId);

      if (dlqTask.status !== DlqStatus.PENDING) {
        throw new Error(
          `Cannot reprocess DLQ task ${dlqTaskId} with status ${dlqTask.status}`,
        );
      }

      // Mark as reprocessing
      await this.prismaService.deadLetterTask.update({
        where: { id: dlqTaskId },
        data: {
          status: DlqStatus.REPROCESSING,
          reprocessedAt: new Date(),
          reprocessedBy,
        },
      });

      this.logger.log(`Reprocessing DLQ task ${dlqTaskId}`);

      // Create a new task in the main task table
      const newTask = await this.prismaService.task.create({
        data: {
          workflowId: dlqTask.workflowId,
          name: `[REPROCESSED] ${dlqTask.name}`,
          type: dlqTask.type,
          payload: dlqTask.payload as any,
          priority: dlqTask.priority,
          attempts: 0, // Reset attempts for reprocessing
          maxAttempts: dlqTask.maxAttempts,
          status: TaskStatus.PENDING,
        },
      });

      // Add to queue for processing
      await this.queueManagerService.addTask({
        taskId: newTask.id,
        type: newTask.type,
        data: newTask.payload,
        priority: newTask.priority,
      });

      // Mark DLQ task as resolved
      await this.prismaService.deadLetterTask.update({
        where: { id: dlqTaskId },
        data: {
          status: DlqStatus.RESOLVED,
        },
      });

      this.logger.log(
        `DLQ task ${dlqTaskId} successfully reprocessed as new task ${newTask.id}`,
      );

      return {
        success: true,
        taskId: newTask.id,
      };
    } catch (error) {
      this.logger.error(`Failed to reprocess DLQ task ${dlqTaskId}:`, error);

      // Mark as pending again if reprocessing failed
      try {
        await this.prismaService.deadLetterTask.update({
          where: { id: dlqTaskId },
          data: {
            status: DlqStatus.PENDING,
            reprocessedAt: null,
            reprocessedBy: null,
          },
        });
      } catch (updateError) {
        this.logger.error(
          `Failed to reset DLQ task ${dlqTaskId} status after reprocessing failure:`,
          updateError,
        );
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Reprocess multiple DLQ tasks
   */
  async reprocessDlqTasks(
    dlqTaskIds: string[],
    reprocessedBy?: string,
  ): Promise<ReprocessResult[]> {
    const results: ReprocessResult[] = [];

    for (const dlqTaskId of dlqTaskIds) {
      const result = await this.reprocessDlqTask(dlqTaskId, reprocessedBy);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(
      `Bulk reprocessing completed: ${successCount}/${dlqTaskIds.length} tasks successfully reprocessed`,
    );

    return results;
  }

  /**
   * Archive a DLQ task (mark as permanently failed)
   */
  async archiveDlqTask(dlqTaskId: string, notes?: string): Promise<void> {
    try {
      await this.prismaService.deadLetterTask.update({
        where: { id: dlqTaskId },
        data: {
          status: DlqStatus.ARCHIVED,
          notes,
        },
      });

      this.logger.log(`DLQ task ${dlqTaskId} archived`);
    } catch (error) {
      this.logger.error(`Failed to archive DLQ task ${dlqTaskId}:`, error);
      throw error;
    }
  }

  /**
   * Delete old archived DLQ tasks
   */
  async cleanupArchivedTasks(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prismaService.deadLetterTask.deleteMany({
        where: {
          status: DlqStatus.ARCHIVED,
          movedToDlqAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(
        `Cleaned up ${result.count} archived DLQ tasks older than ${olderThanDays} days`,
      );

      return result.count;
    } catch (error) {
      this.logger.error('Failed to cleanup archived DLQ tasks:', error);
      throw error;
    }
  }

  /**
   * Update DLQ task notes
   */
  async updateDlqTaskNotes(dlqTaskId: string, notes: string): Promise<void> {
    try {
      await this.prismaService.deadLetterTask.update({
        where: { id: dlqTaskId },
        data: { notes },
      });

      this.logger.log(`Updated notes for DLQ task ${dlqTaskId}`);
    } catch (error) {
      this.logger.error(
        `Failed to update notes for DLQ task ${dlqTaskId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get DLQ tasks by original task ID
   */
  async getDlqTaskByOriginalId(originalTaskId: string) {
    try {
      return await this.prismaService.deadLetterTask.findUnique({
        where: { originalTaskId },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get DLQ task for original task ${originalTaskId}:`,
        error,
      );
      throw error;
    }
  }
}
