import { PrismaService, TaskStatus } from '@distributed-async-task-worker/shared';
export declare class TaskOrchestrationService {
    private prismaService;
    private readonly logger;
    constructor(prismaService: PrismaService);
    createTask(data: {
        workflowId?: string;
        name: string;
        type: string;
        payload?: any;
        priority?: number;
        delay?: number;
        maxAttempts?: number;
    }): Promise<any>;
    getTask(taskId: string): Promise<any>;
    listTasks(filters?: {
        status?: TaskStatus;
        type?: string;
        workflowId?: string;
        page?: number;
        limit?: number;
    }): Promise<any>;
    updateTaskStatus(taskId: string, status: TaskStatus, metadata?: any): Promise<void>;
    retryTask(taskId: string): Promise<void>;
    cancelTask(taskId: string): Promise<void>;
    getTaskLogs(taskId: string, page?: number, limit?: number): Promise<any>;
    getTaskStats(): Promise<any>;
    getTaskTypeStatistics(): Promise<any>;
    getRecentBranchingAndDependentTasks(page?: number, limit?: number): Promise<any>;
    private getBranchingType;
    private getBranchingDetails;
    private getDependencyInfo;
    private getDependencyDetails;
    private convertPriorityToNumber;
}
