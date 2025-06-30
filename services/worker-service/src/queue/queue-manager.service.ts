import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { TaskPayload } from '@distributed-async-task-worker/shared';

@Injectable()
export class QueueManagerService {
  private readonly logger = new Logger(QueueManagerService.name);

  constructor(
    @InjectQueue('task-queue') private taskQueue: Queue,
    private configService: ConfigService,
  ) {}

  async addTask(payload: TaskPayload): Promise<Job> {
    try {
      const job = await this.taskQueue.add('process-task', payload, {
        priority: payload.priority || 0,
        delay: payload.delay || 0,
        attempts: payload.attempts || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: this.configService.get(
          'QUEUE_REMOVE_ON_COMPLETE',
          100,
        ),
        removeOnFail: this.configService.get('QUEUE_REMOVE_ON_FAIL', 50),
      });

      this.logger.log(
        `Task ${payload.taskId} added to queue with job ID: ${job.id}`,
      );
      return job;
    } catch (error) {
      this.logger.error(
        `Failed to add task ${payload.taskId} to queue:`,
        error,
      );
      throw error;
    }
  }

  async addBulkTasks(payloads: TaskPayload[]): Promise<Job[]> {
    try {
      const jobs = await this.taskQueue.addBulk(
        payloads.map((payload) => ({
          name: 'process-task',
          data: payload,
          opts: {
            priority: payload.priority || 0,
            delay: payload.delay || 0,
            attempts: payload.attempts || 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        })),
      );

      this.logger.log(`Added ${jobs.length} tasks to queue`);
      return jobs;
    } catch (error) {
      this.logger.error('Failed to add bulk tasks to queue:', error);
      throw error;
    }
  }

  async getQueueStats() {
    const waiting = await this.taskQueue.getWaiting();
    const active = await this.taskQueue.getActive();
    const completed = await this.taskQueue.getCompleted();
    const failed = await this.taskQueue.getFailed();
    const delayed = await this.taskQueue.getDelayed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  async getQueueInfo() {
    try {
      const stats = await this.getQueueStats();
      const queueHealth = await this.taskQueue.getJobCounts();

      return {
        name: this.taskQueue.name,
        stats,
        health: queueHealth,
        isPaused: await this.taskQueue.isPaused(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get queue info:', error);
      throw error;
    }
  }

  async pauseQueue(): Promise<void> {
    await this.taskQueue.pause();
    this.logger.log('Queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.taskQueue.resume();
    this.logger.log('Queue resumed');
  }

  async cleanQueue(): Promise<void> {
    await this.taskQueue.clean(5000, 'completed');
    await this.taskQueue.clean(5000, 'failed');
    this.logger.log('Queue cleaned');
  }

  async removeJob(jobId: string): Promise<void> {
    const job = await this.taskQueue.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`Job ${jobId} removed from queue`);
    }
  }

  async retryFailedJobs(): Promise<void> {
    const failedJobs = await this.taskQueue.getFailed();
    for (const job of failedJobs) {
      await job.retry();
    }
    this.logger.log(`Retried ${failedJobs.length} failed jobs`);
  }
}
