import { Queue, Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { TaskPayload } from '@distributed-async-task-worker/shared';
export declare class QueueManagerService {
    private taskQueue;
    private configService;
    private readonly logger;
    constructor(taskQueue: Queue, configService: ConfigService);
    addTask(payload: TaskPayload): Promise<Job>;
    addBulkTasks(payloads: TaskPayload[]): Promise<Job[]>;
    getQueueStats(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }>;
    getQueueInfo(): Promise<{
        name: string;
        stats: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
        };
        health: import("bull").JobCounts;
        isPaused: boolean;
        timestamp: string;
    }>;
    pauseQueue(): Promise<void>;
    resumeQueue(): Promise<void>;
    cleanQueue(): Promise<void>;
    removeJob(jobId: string): Promise<void>;
    retryFailedJobs(): Promise<void>;
}
