import { OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '@distributed-async-task-worker/shared';
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
export declare class CronJobManagerService implements OnModuleInit {
    private prismaService;
    private schedulerRegistry;
    private readonly logger;
    private cronJobs;
    private executions;
    constructor(prismaService: PrismaService, schedulerRegistry: SchedulerRegistry);
    onModuleInit(): Promise<void>;
    private initializeCronJobs;
    private scheduleCronJob;
    private executeCronJob;
    getCronJobs(): Promise<CronJobDefinition[]>;
    getCronJob(jobId: string): Promise<CronJobDefinition | undefined>;
    getExecutions(jobId?: string): Promise<CronJobExecution[]>;
    enableCronJob(jobId: string): Promise<void>;
    disableCronJob(jobId: string): Promise<void>;
    getCronJobStats(): Promise<{
        totalJobs: number;
        enabledJobs: number;
        totalExecutions: number;
        successfulExecutions: number;
        failedExecutions: number;
        runningExecutions: number;
        jobs: {
            id: string;
            name: string;
            enabled: boolean;
            runCount: number;
            successCount: number;
            failureCount: number;
            lastRun: Date;
        }[];
    }>;
}
