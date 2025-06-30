import { TaskOrchestrationService } from "../coordinator/task-orchestration.service";
import { WorkflowService } from "../coordinator/workflow.service";
import { StressTestConfig } from "./stress-test.controller";
export interface StressTestSession {
    id: string;
    config: StressTestConfig;
    startTime: Date;
    endTime?: Date;
    status: "running" | "completed" | "stopped" | "failed";
    tasksCreated: number;
    tasksCompleted: number;
    tasksFailed: number;
    priorityStats: {
        high: number;
        medium: number;
        low: number;
    };
    taskTypeStats: Record<string, number>;
    branchingStats: {
        branchingTasks: number;
        dependentTasks: number;
        workflowTasks: number;
        regularTasks: number;
    };
    createdTaskIds: string[];
    createdWorkflowIds: string[];
}
export declare class StressTestService {
    private taskOrchestrationService;
    private workflowService;
    private readonly logger;
    private activeSessions;
    private intervals;
    private readonly TASK_TYPES;
    private readonly BRANCHING_TASK_TYPES;
    constructor(taskOrchestrationService: TaskOrchestrationService, workflowService: WorkflowService);
    startStressTest(config: StressTestConfig): Promise<{
        testId: string;
        message: string;
    }>;
    private startTaskCreation;
    private determinePriority;
    private generateTaskPayload;
    private generateTestId;
    private createAdvancedTask;
    private createBranchingWorkflow;
    private createDependentTaskChain;
    private createConditionalBranch;
    private createParallelExecution;
    getStressTestStatus(testId: string): Promise<StressTestSession | null>;
    getStressTestResults(testId: string): Promise<any>;
    stopStressTest(testId: string): Promise<{
        message: string;
    }>;
    private getTaskStatsForTest;
}
