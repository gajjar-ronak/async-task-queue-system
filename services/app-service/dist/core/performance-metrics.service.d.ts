import { PrismaService, PerformanceData } from '@distributed-async-task-worker/shared';
import { NodeManagerService } from './node-manager.service';
export declare class PerformanceMetricsService {
    private prismaService;
    private nodeManagerService;
    private readonly logger;
    private taskStartTimes;
    constructor(prismaService: PrismaService, nodeManagerService: NodeManagerService);
    trackTaskStart(taskId: string): void;
    trackTaskCompletion(taskId: string, success: boolean): Promise<void>;
    calculateAndStoreMetrics(): Promise<void>;
    getCurrentPerformanceMetrics(): Promise<PerformanceData>;
    getHistoricalMetrics(hours?: number): Promise<PerformanceData[]>;
    cleanupOldMetrics(): Promise<void>;
    getSystemPerformanceSummary(): Promise<{
        activeNodes: number;
        totalTasksLastHour: number;
        avgProcessingTime: number;
        tasksPerSecond: number;
        successRate: number;
    }>;
}
