import { TaskOrchestrationService } from '../coordinator/task-orchestration.service';
import { TaskStatus } from '@distributed-async-task-worker/shared';
export declare class TaskController {
    private taskOrchestrationService;
    constructor(taskOrchestrationService: TaskOrchestrationService);
    createTask(dto: {
        workflowId?: string;
        name: string;
        type: string;
        payload?: any;
        priority?: number;
        delay?: number;
        maxAttempts?: number;
    }): Promise<any>;
    listTasks(status?: TaskStatus, type?: string, workflowId?: string, page?: string, limit?: string): Promise<any>;
    getTaskStats(): Promise<any>;
    getRecentBranchingAndDependentTasks(page?: string, limit?: string): Promise<any>;
    getTask(id: string): Promise<any>;
    getTaskLogs(id: string, page?: string, limit?: string): Promise<any>;
    retryTask(id: string): Promise<{
        message: string;
    }>;
    cancelTask(id: string): Promise<{
        message: string;
    }>;
}
