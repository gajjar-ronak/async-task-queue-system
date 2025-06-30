import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService, TaskStatus } from '@distributed-async-task-worker/shared';
import { CronJob } from 'cron';

export interface CronJobDefinition {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  taskType: string;
  payload?: any;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
  averageExecutionTime: number;
}

export interface CronJobExecution {
  id: string;
  cronJobId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  executionTime?: number;
  error?: string;
  result?: any;
}

@Injectable()
export class CronJobManagerService implements OnModuleInit {
  private readonly logger = new Logger(CronJobManagerService.name);
  private cronJobs: Map<string, CronJobDefinition> = new Map();
  private executions: Map<string, CronJobExecution> = new Map();

  constructor(
    private prismaService: PrismaService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    await this.initializeCronJobs();
  }

  private async initializeCronJobs() {
    this.logger.log('Initializing CRON jobs...');

    // Define default CRON jobs for the app service
    const defaultJobs: Omit<CronJobDefinition, 'id' | 'runCount' | 'successCount' | 'failureCount' | 'averageExecutionTime'>[] = [
      {
        name: 'System Health Check',
        description: 'Periodic system health monitoring',
        schedule: '*/5 * * * *', // Every 5 minutes
        enabled: true,
        taskType: 'health-check',
        payload: { type: 'system-health' },
      },
      {
        name: 'Database Cleanup',
        description: 'Clean up old completed tasks and logs',
        schedule: '0 2 * * *', // Daily at 2 AM
        enabled: true,
        taskType: 'data-cleanup',
        payload: { type: 'database-cleanup', retentionDays: 30 },
      },
    ];

    for (const jobDef of defaultJobs) {
      const jobId = `cron-${jobDef.name.toLowerCase().replace(/\s+/g, '-')}`;
      const cronJob: CronJobDefinition = {
        ...jobDef,
        id: jobId,
        runCount: 0,
        successCount: 0,
        failureCount: 0,
        averageExecutionTime: 0,
      };

      this.cronJobs.set(jobId, cronJob);
      await this.scheduleCronJob(cronJob);
    }

    this.logger.log(`Initialized ${this.cronJobs.size} CRON jobs`);
  }

  private async scheduleCronJob(jobDef: CronJobDefinition) {
    if (!jobDef.enabled) {
      return;
    }

    try {
      const job = new CronJob(jobDef.schedule, async () => {
        await this.executeCronJob(jobDef.id);
      });

      this.schedulerRegistry.addCronJob(jobDef.id, job);
      job.start();

      this.logger.log(`Scheduled CRON job: ${jobDef.name} (${jobDef.schedule})`);
    } catch (error) {
      this.logger.error(`Failed to schedule CRON job ${jobDef.name}:`, error);
    }
  }

  private async executeCronJob(jobId: string) {
    const jobDef = this.cronJobs.get(jobId);
    if (!jobDef) {
      this.logger.error(`CRON job ${jobId} not found`);
      return;
    }

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const execution: CronJobExecution = {
      id: executionId,
      cronJobId: jobId,
      startTime: new Date(),
      status: 'running',
    };

    this.executions.set(executionId, execution);

    try {
      this.logger.log(`Executing CRON job: ${jobDef.name}`);

      // Create a task in the database for the worker service to pick up
      const task = await this.prismaService.task.create({
        data: {
          name: `CRON: ${jobDef.name}`,
          type: jobDef.taskType,
          payload: jobDef.payload || {},
          priority: 1, // High priority for CRON jobs
          status: TaskStatus.PENDING,
        },
      });

      // Update execution status
      execution.endTime = new Date();
      execution.status = 'completed';
      execution.executionTime = execution.endTime.getTime() - execution.startTime.getTime();
      execution.result = { taskId: task.id };

      // Update job statistics
      jobDef.runCount++;
      jobDef.successCount++;
      jobDef.lastRun = execution.startTime;
      jobDef.averageExecutionTime = 
        (jobDef.averageExecutionTime * (jobDef.runCount - 1) + execution.executionTime) / jobDef.runCount;

      this.logger.log(`CRON job ${jobDef.name} completed successfully. Created task: ${task.id}`);
    } catch (error) {
      execution.endTime = new Date();
      execution.status = 'failed';
      execution.error = error.message;
      execution.executionTime = execution.endTime.getTime() - execution.startTime.getTime();

      jobDef.runCount++;
      jobDef.failureCount++;

      this.logger.error(`CRON job ${jobDef.name} failed:`, error);
    }

    this.executions.set(executionId, execution);
  }

  // API methods for managing CRON jobs
  async getCronJobs(): Promise<CronJobDefinition[]> {
    return Array.from(this.cronJobs.values());
  }

  async getCronJob(jobId: string): Promise<CronJobDefinition | undefined> {
    return this.cronJobs.get(jobId);
  }

  async getExecutions(jobId?: string): Promise<CronJobExecution[]> {
    const executions = Array.from(this.executions.values());
    return jobId ? executions.filter(e => e.cronJobId === jobId) : executions;
  }

  async enableCronJob(jobId: string): Promise<void> {
    const jobDef = this.cronJobs.get(jobId);
    if (!jobDef) {
      throw new Error(`CRON job ${jobId} not found`);
    }

    jobDef.enabled = true;
    await this.scheduleCronJob(jobDef);
    this.logger.log(`Enabled CRON job: ${jobDef.name}`);
  }

  async disableCronJob(jobId: string): Promise<void> {
    const jobDef = this.cronJobs.get(jobId);
    if (!jobDef) {
      throw new Error(`CRON job ${jobId} not found`);
    }

    jobDef.enabled = false;
    
    try {
      this.schedulerRegistry.deleteCronJob(jobId);
    } catch (error) {
      // Job might not be scheduled
    }

    this.logger.log(`Disabled CRON job: ${jobDef.name}`);
  }

  async getCronJobStats() {
    const jobs = Array.from(this.cronJobs.values());
    const executions = Array.from(this.executions.values());

    return {
      totalJobs: jobs.length,
      enabledJobs: jobs.filter(j => j.enabled).length,
      totalExecutions: executions.length,
      successfulExecutions: executions.filter(e => e.status === 'completed').length,
      failedExecutions: executions.filter(e => e.status === 'failed').length,
      runningExecutions: executions.filter(e => e.status === 'running').length,
      jobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        enabled: job.enabled,
        runCount: job.runCount,
        successCount: job.successCount,
        failureCount: job.failureCount,
        lastRun: job.lastRun,
      })),
    };
  }
}
