import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { DlqStatus } from '@prisma/client';

export interface DlqQueryParams {
  page?: number;
  limit?: number;
  status?: DlqStatus;
  type?: string;
  failureReason?: string;
  sortBy?: 'movedToDlqAt' | 'originalCreatedAt' | 'attempts';
  sortOrder?: 'asc' | 'desc';
}

export interface ReprocessRequest {
  dlqTaskIds: string[];
  reprocessedBy?: string;
}

export interface ArchiveRequest {
  notes?: string;
}

export interface UpdateNotesRequest {
  notes: string;
}

@Controller('api/dlq')
export class DeadLetterQueueController {
  private readonly logger = new Logger(DeadLetterQueueController.name);

  constructor(private deadLetterQueueService: DeadLetterQueueService) {}

  /**
   * Get DLQ statistics
   */
  @Get('stats')
  async getDlqStats() {
    try {
      const stats = await this.deadLetterQueueService.getDlqStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Failed to get DLQ stats:', error);
      throw new HttpException(
        'Failed to get DLQ statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get DLQ tasks with pagination and filtering
   */
  @Get('tasks')
  async getDlqTasks(@Query() query: DlqQueryParams) {
    try {
      const {
        page = 1,
        limit = 50,
        status,
        type,
        failureReason,
        sortBy = 'movedToDlqAt',
        sortOrder = 'desc',
      } = query;

      const result = await this.deadLetterQueueService.getDlqTasks({
        page: Number(page),
        limit: Number(limit),
        status,
        type,
        failureReason,
        sortBy,
        sortOrder,
      });

      return {
        success: true,
        data: result.tasks,
        pagination: result.pagination,
      };
    } catch (error) {
      this.logger.error('Failed to get DLQ tasks:', error);
      throw new HttpException(
        'Failed to get DLQ tasks',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a specific DLQ task by ID
   */
  @Get('tasks/:id')
  async getDlqTask(@Param('id') dlqTaskId: string) {
    try {
      const task = await this.deadLetterQueueService.getDlqTask(dlqTaskId);
      return {
        success: true,
        data: task,
      };
    } catch (error) {
      this.logger.error(`Failed to get DLQ task ${dlqTaskId}:`, error);
      if (error.message.includes('not found')) {
        throw new HttpException('DLQ task not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to get DLQ task',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Reprocess a single DLQ task
   */
  @Post('tasks/:id/reprocess')
  async reprocessDlqTask(
    @Param('id') dlqTaskId: string,
    @Body() body: { reprocessedBy?: string } = {},
  ) {
    try {
      const result = await this.deadLetterQueueService.reprocessDlqTask(
        dlqTaskId,
        body.reprocessedBy,
      );

      if (result.success) {
        return {
          success: true,
          message: 'DLQ task reprocessed successfully',
          data: {
            dlqTaskId,
            newTaskId: result.taskId,
          },
        };
      } else {
        throw new HttpException(
          result.error || 'Failed to reprocess DLQ task',
          HttpStatus.BAD_REQUEST,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to reprocess DLQ task ${dlqTaskId}:`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to reprocess DLQ task',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Reprocess multiple DLQ tasks
   */
  @Post('tasks/reprocess-bulk')
  async reprocessDlqTasks(@Body() body: ReprocessRequest) {
    try {
      const { dlqTaskIds, reprocessedBy } = body;

      if (!dlqTaskIds || !Array.isArray(dlqTaskIds) || dlqTaskIds.length === 0) {
        throw new HttpException(
          'dlqTaskIds must be a non-empty array',
          HttpStatus.BAD_REQUEST,
        );
      }

      const results = await this.deadLetterQueueService.reprocessDlqTasks(
        dlqTaskIds,
        reprocessedBy,
      );

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      return {
        success: true,
        message: `Bulk reprocessing completed: ${successCount} successful, ${failureCount} failed`,
        data: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
          results,
        },
      };
    } catch (error) {
      this.logger.error('Failed to reprocess DLQ tasks in bulk:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to reprocess DLQ tasks',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Archive a DLQ task
   */
  @Put('tasks/:id/archive')
  async archiveDlqTask(
    @Param('id') dlqTaskId: string,
    @Body() body: ArchiveRequest = {},
  ) {
    try {
      await this.deadLetterQueueService.archiveDlqTask(dlqTaskId, body.notes);
      return {
        success: true,
        message: 'DLQ task archived successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to archive DLQ task ${dlqTaskId}:`, error);
      throw new HttpException(
        'Failed to archive DLQ task',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update DLQ task notes
   */
  @Put('tasks/:id/notes')
  async updateDlqTaskNotes(
    @Param('id') dlqTaskId: string,
    @Body() body: UpdateNotesRequest,
  ) {
    try {
      if (!body.notes) {
        throw new HttpException(
          'Notes field is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.deadLetterQueueService.updateDlqTaskNotes(
        dlqTaskId,
        body.notes,
      );
      return {
        success: true,
        message: 'DLQ task notes updated successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to update notes for DLQ task ${dlqTaskId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update DLQ task notes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Cleanup old archived DLQ tasks
   */
  @Delete('cleanup')
  async cleanupArchivedTasks(@Query('olderThanDays') olderThanDays?: string) {
    try {
      const days = olderThanDays ? parseInt(olderThanDays, 10) : 30;
      if (isNaN(days) || days < 1) {
        throw new HttpException(
          'olderThanDays must be a positive number',
          HttpStatus.BAD_REQUEST,
        );
      }

      const deletedCount =
        await this.deadLetterQueueService.cleanupArchivedTasks(days);
      return {
        success: true,
        message: `Cleaned up ${deletedCount} archived DLQ tasks`,
        data: {
          deletedCount,
          olderThanDays: days,
        },
      };
    } catch (error) {
      this.logger.error('Failed to cleanup archived DLQ tasks:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to cleanup archived DLQ tasks',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get DLQ task by original task ID
   */
  @Get('tasks/by-original/:originalTaskId')
  async getDlqTaskByOriginalId(@Param('originalTaskId') originalTaskId: string) {
    try {
      const task =
        await this.deadLetterQueueService.getDlqTaskByOriginalId(originalTaskId);
      
      if (!task) {
        throw new HttpException(
          'DLQ task not found for the given original task ID',
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: task,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get DLQ task for original task ${originalTaskId}:`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to get DLQ task',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
