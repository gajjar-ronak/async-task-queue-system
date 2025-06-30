import { NodeManagerService } from '../core/node-manager.service';
import { PerformanceMetricsService } from '../core/performance-metrics.service';
export declare class SystemController {
    private nodeManagerService;
    private performanceMetricsService;
    constructor(nodeManagerService: NodeManagerService, performanceMetricsService: PerformanceMetricsService);
    getNodes(): Promise<import("../core/node-manager.service").NodeInfo[]>;
    getActiveNodesCount(): Promise<{
        activeNodes: number;
    }>;
    getCurrentPerformance(): Promise<import("@distributed-async-task-worker/shared").PerformanceData>;
    getPerformanceSummary(): Promise<{
        activeNodes: number;
        totalTasksLastHour: number;
        avgProcessingTime: number;
        tasksPerSecond: number;
        successRate: number;
    }>;
    getHistoricalPerformance(): Promise<import("@distributed-async-task-worker/shared").PerformanceData[]>;
}
