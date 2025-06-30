import { PrismaService, TaskResult } from "@distributed-async-task-worker/shared";
import { QueueManagerService } from "../queue/queue-manager.service";
import { DeadLetterQueueService } from "./dead-letter-queue.service";
export declare class TaskProcessingService {
    private prismaService;
    private queueManagerService;
    private deadLetterQueueService;
    private readonly logger;
    constructor(prismaService: PrismaService, queueManagerService: QueueManagerService, deadLetterQueueService: DeadLetterQueueService);
    processTask(taskId: string, taskType: string, payload: any): Promise<TaskResult>;
    private handleTaskFailureWithRetry;
    private moveTaskToDeadLetterQueue;
    private executeTaskByType;
    private processApiCall;
    private processDatabaseOperation;
    private processFileOperation;
    private processEmailSend;
    private processDataTransformation;
    private processWebhookCall;
    private processReportGeneration;
    private processImageProcessing;
    private processNotification;
    private updateTaskStatus;
    private updateTaskStatusWithRetry;
    private logTaskEvent;
    private processDataCleanup;
    private processHealthCheck;
    private processDailyReport;
}
