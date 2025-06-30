import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TaskPayload } from '@distributed-async-task-worker/shared';
import { TaskProcessingService } from '../core/task-processing.service';

@Processor('task-queue')
export class TaskProcessor {
  private readonly logger = new Logger(TaskProcessor.name);

  constructor(private taskProcessingService: TaskProcessingService) {}

  @Process({
    name: 'process-task',
    concurrency: 10, // High concurrency to avoid blocking
  })
  async handleTask(job: Job<TaskPayload>): Promise<any> {
    const { taskId, type, data } = job.data;

    try {
      this.logger.log(`Processing task ${taskId} of type ${type}`);

      // Update job progress
      await job.progress(10);

      // Use the core task processing service
      const result = await this.taskProcessingService.processTask(
        taskId,
        type,
        data,
      );

      await job.progress(100);
      this.logger.log(`Task ${taskId} completed successfully`);

      return result;
    } catch (error) {
      this.logger.error(`Task ${taskId} failed:`, error);
      throw error;
    }
  }
}
