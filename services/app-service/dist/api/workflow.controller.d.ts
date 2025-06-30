import { WorkflowService, CreateWorkflowDto } from '../coordinator/workflow.service';
export declare class WorkflowController {
    private workflowService;
    constructor(workflowService: WorkflowService);
    createWorkflow(dto: CreateWorkflowDto): Promise<any>;
    listWorkflows(page?: string, limit?: string): Promise<any>;
    getWorkflow(id: string): Promise<any>;
    getWorkflowStatus(id: string): Promise<any>;
    pauseWorkflow(id: string): Promise<{
        message: string;
    }>;
    resumeWorkflow(id: string): Promise<{
        message: string;
    }>;
    retryFailedTasks(id: string): Promise<{
        message: string;
    }>;
    deleteWorkflow(id: string): Promise<{
        message: string;
    }>;
}
