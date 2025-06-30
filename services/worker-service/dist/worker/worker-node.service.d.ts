import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, ScalingEventService } from '@distributed-async-task-worker/shared';
import { QueueManagerService } from '../queue/queue-manager.service';
export declare class WorkerNodeService implements OnModuleInit, OnModuleDestroy {
    private prismaService;
    private queueManagerService;
    private configService;
    private scalingEventService;
    private readonly logger;
    private workerId;
    private isRunning;
    private processingTasks;
    constructor(prismaService: PrismaService, queueManagerService: QueueManagerService, configService: ConfigService, scalingEventService: ScalingEventService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    startWorker(): Promise<void>;
    stopWorker(): Promise<void>;
    private processPendingTasks;
    private processTask;
    markTaskCompleted(taskId: string, result?: any): Promise<void>;
    markTaskFailed(taskId: string, error: any): Promise<void>;
    private logTaskEvent;
    getWorkerStats(): {
        workerId: string;
        isRunning: boolean;
        processingTasks: number;
        currentTasks: string[];
    };
    private getActiveNodeCount;
}
