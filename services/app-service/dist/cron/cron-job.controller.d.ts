import { CronJobManagerService, CronJobDefinition } from './cron-job-manager.service';
export declare class CreateCronJobDto {
    name: string;
    description: string;
    schedule: string;
    taskType: string;
    payload?: any;
    enabled?: boolean;
}
export declare class UpdateCronJobDto {
    name?: string;
    description?: string;
    schedule?: string;
    taskType?: string;
    payload?: any;
    enabled?: boolean;
}
export declare class CronJobController {
    private cronJobManagerService;
    constructor(cronJobManagerService: CronJobManagerService);
    getCronJobs(): Promise<{
        success: boolean;
        data: CronJobDefinition[];
        count: number;
    }>;
    getCronJobStats(): Promise<{
        success: boolean;
        data: {
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
        };
    }>;
    getCronJob(id: string): Promise<{
        success: boolean;
        data: CronJobDefinition;
    }>;
    getCronJobExecutions(id: string): Promise<{
        success: boolean;
        data: import("./cron-job-manager.service").CronJobExecution[];
        count: number;
    }>;
    enableCronJob(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    disableCronJob(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
