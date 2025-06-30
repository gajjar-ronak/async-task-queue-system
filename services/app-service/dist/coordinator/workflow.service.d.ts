import { PrismaService, CreateWorkflowDto, CreateTaskDto } from '@distributed-async-task-worker/shared';
export { CreateWorkflowDto, CreateTaskDto };
export declare class WorkflowService {
    private prismaService;
    private readonly logger;
    constructor(prismaService: PrismaService);
    createWorkflow(dto: CreateWorkflowDto): Promise<any>;
    getWorkflow(workflowId: string): Promise<any>;
    listWorkflows(page?: number, limit?: number): Promise<any>;
    getWorkflowStatus(workflowId: string): Promise<any>;
    pauseWorkflow(workflowId: string): Promise<void>;
    resumeWorkflow(workflowId: string): Promise<void>;
    deleteWorkflow(workflowId: string): Promise<void>;
    retryFailedTasks(workflowId: string): Promise<void>;
}
