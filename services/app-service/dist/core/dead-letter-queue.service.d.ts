import { PrismaService, DlqStatus, DlqTaskData, DlqStats } from '@distributed-async-task-worker/shared';
export interface ReprocessResult {
    success: boolean;
    taskId?: string;
    error?: string;
}
export declare class DeadLetterQueueService {
    private prismaService;
    private readonly logger;
    constructor(prismaService: PrismaService);
    moveTaskToDlq(taskData: DlqTaskData): Promise<string>;
    getDlqStats(): Promise<DlqStats>;
    getDlqTasks(options?: {
        page?: number;
        limit?: number;
        status?: DlqStatus;
        type?: string;
        failureReason?: string;
        sortBy?: 'movedToDlqAt' | 'originalCreatedAt' | 'attempts';
        sortOrder?: 'asc' | 'desc';
    }): Promise<{
        tasks: {
            name: string;
            id: string;
            workflowId: string | null;
            type: string;
            payload: import("@prisma/client/runtime/library").JsonValue | null;
            status: import(".prisma/client").$Enums.DlqStatus;
            priority: number;
            attempts: number;
            maxAttempts: number;
            createdAt: Date;
            updatedAt: Date;
            originalTaskId: string;
            lastError: string;
            lastErrorStack: string | null;
            failureReason: string | null;
            originalCreatedAt: Date;
            firstFailedAt: Date;
            movedToDlqAt: Date;
            retryHistory: import("@prisma/client/runtime/library").JsonValue | null;
            processingMetadata: import("@prisma/client/runtime/library").JsonValue | null;
            reprocessedAt: Date | null;
            reprocessedBy: string | null;
            notes: string | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getDlqTask(dlqTaskId: string): Promise<{
        name: string;
        id: string;
        workflowId: string | null;
        type: string;
        payload: import("@prisma/client/runtime/library").JsonValue | null;
        status: import(".prisma/client").$Enums.DlqStatus;
        priority: number;
        attempts: number;
        maxAttempts: number;
        createdAt: Date;
        updatedAt: Date;
        originalTaskId: string;
        lastError: string;
        lastErrorStack: string | null;
        failureReason: string | null;
        originalCreatedAt: Date;
        firstFailedAt: Date;
        movedToDlqAt: Date;
        retryHistory: import("@prisma/client/runtime/library").JsonValue | null;
        processingMetadata: import("@prisma/client/runtime/library").JsonValue | null;
        reprocessedAt: Date | null;
        reprocessedBy: string | null;
        notes: string | null;
    }>;
    reprocessDlqTask(dlqTaskId: string, reprocessedBy?: string): Promise<ReprocessResult>;
    reprocessDlqTasks(dlqTaskIds: string[], reprocessedBy?: string): Promise<ReprocessResult[]>;
    archiveDlqTask(dlqTaskId: string, notes?: string): Promise<void>;
    cleanupArchivedTasks(olderThanDays?: number): Promise<number>;
    updateDlqTaskNotes(dlqTaskId: string, notes: string): Promise<void>;
    getDlqTaskByOriginalId(originalTaskId: string): Promise<{
        name: string;
        id: string;
        workflowId: string | null;
        type: string;
        payload: import("@prisma/client/runtime/library").JsonValue | null;
        status: import(".prisma/client").$Enums.DlqStatus;
        priority: number;
        attempts: number;
        maxAttempts: number;
        createdAt: Date;
        updatedAt: Date;
        originalTaskId: string;
        lastError: string;
        lastErrorStack: string | null;
        failureReason: string | null;
        originalCreatedAt: Date;
        firstFailedAt: Date;
        movedToDlqAt: Date;
        retryHistory: import("@prisma/client/runtime/library").JsonValue | null;
        processingMetadata: import("@prisma/client/runtime/library").JsonValue | null;
        reprocessedAt: Date | null;
        reprocessedBy: string | null;
        notes: string | null;
    }>;
}
