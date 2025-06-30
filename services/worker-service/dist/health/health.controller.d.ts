import { PrismaService } from '@distributed-async-task-worker/shared';
import { WorkerHealthService } from '../worker/worker-health.service';
import { QueueManagerService } from '../queue/queue-manager.service';
export declare class HealthController {
    private readonly prismaService;
    private readonly workerHealthService;
    private readonly queueManagerService;
    constructor(prismaService: PrismaService, workerHealthService: WorkerHealthService, queueManagerService: QueueManagerService);
    getHealth(): Promise<{
        status: string;
        service: string;
        timestamp: Date;
        database: string;
        redis: string;
        worker: {
            status: string;
            details: any;
        };
        nodeId: string;
        hostname: string;
        error?: undefined;
    } | {
        status: string;
        service: string;
        timestamp: Date;
        database: string;
        error: any;
        nodeId: string;
        hostname: string;
        redis?: undefined;
        worker?: undefined;
    }>;
    getDetailedHealth(): Promise<{
        status: string;
        service: string;
        timestamp: Date;
        checks: {
            database: boolean;
            redis: boolean;
            worker: any;
            queue: {
                waiting: number;
                active: number;
                completed: number;
                failed: number;
                delayed: number;
            } | {
                error: string;
                message: any;
            };
        };
        environment: {
            nodeId: string;
            hostname: string;
            nodeEnv: string;
            workerConcurrency: string;
            scalingMode: boolean;
        };
        error?: undefined;
    } | {
        status: string;
        service: string;
        timestamp: Date;
        error: any;
        checks?: undefined;
        environment?: undefined;
    }>;
    getReadiness(): Promise<{
        ready: boolean;
        timestamp: Date;
        checks: {
            worker: boolean;
            redis: boolean;
        };
        error?: undefined;
    } | {
        ready: boolean;
        timestamp: Date;
        error: any;
        checks?: undefined;
    }>;
    private checkDatabaseHealth;
    private checkRedisHealth;
    private getQueueStats;
}
