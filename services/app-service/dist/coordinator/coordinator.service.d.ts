import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@distributed-async-task-worker/shared';
export declare class CoordinatorService implements OnModuleInit {
    private prismaService;
    private readonly logger;
    constructor(prismaService: PrismaService);
    onModuleInit(): Promise<void>;
    private initializeCoordinator;
    monitorSystemHealth(): Promise<void>;
    private resetStuckTasks;
    getCoordinatorStats(): Promise<{
        tasks: {
            total: number;
            pending: number;
            processing: number;
            completed: number;
            failed: number;
        };
        workflows: {
            total: number;
            active: number;
        };
        timestamp: Date;
    }>;
}
