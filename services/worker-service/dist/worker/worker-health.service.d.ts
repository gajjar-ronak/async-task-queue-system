import { PrismaService } from '@distributed-async-task-worker/shared';
import { QueueManagerService } from '../queue/queue-manager.service';
export declare class WorkerHealthService {
    private prismaService;
    private queueManagerService;
    private readonly logger;
    constructor(prismaService: PrismaService, queueManagerService: QueueManagerService);
    checkWorkerHealth(): Promise<void>;
    private checkStuckTasks;
    private cleanupOldTasks;
    getSystemStats(): Promise<any>;
    getHealthStatus(): Promise<{
        status: string;
        details: any;
    }>;
    getDetailedHealthStatus(): Promise<any>;
    isReady(): Promise<boolean>;
}
