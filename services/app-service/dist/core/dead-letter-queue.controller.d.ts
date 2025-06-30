import { DeadLetterQueueService } from './dead-letter-queue.service';
import { DlqStatus } from '@prisma/client';
export interface DlqQueryParams {
    page?: number;
    limit?: number;
    status?: DlqStatus;
    type?: string;
    failureReason?: string;
    sortBy?: 'movedToDlqAt' | 'originalCreatedAt' | 'attempts';
    sortOrder?: 'asc' | 'desc';
}
export interface ReprocessRequest {
    dlqTaskIds: string[];
    reprocessedBy?: string;
}
export interface ArchiveRequest {
    notes?: string;
}
export interface UpdateNotesRequest {
    notes: string;
}
export declare class DeadLetterQueueController {
    private deadLetterQueueService;
    private readonly logger;
    constructor(deadLetterQueueService: DeadLetterQueueService);
    getDlqStats(): Promise<{
        success: boolean;
        data: import("@distributed-async-task-worker/shared").DlqStats;
    }>;
    getDlqTasks(query: DlqQueryParams): Promise<{
        success: boolean;
        data: {
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
        success: boolean;
        data: {
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
        };
    }>;
    reprocessDlqTask(dlqTaskId: string, body?: {
        reprocessedBy?: string;
    }): Promise<{
        success: boolean;
        message: string;
        data: {
            dlqTaskId: string;
            newTaskId: string;
        };
    }>;
    reprocessDlqTasks(body: ReprocessRequest): Promise<{
        success: boolean;
        message: string;
        data: {
            total: number;
            successful: number;
            failed: number;
            results: import("./dead-letter-queue.service").ReprocessResult[];
        };
    }>;
    archiveDlqTask(dlqTaskId: string, body?: ArchiveRequest): Promise<{
        success: boolean;
        message: string;
    }>;
    updateDlqTaskNotes(dlqTaskId: string, body: UpdateNotesRequest): Promise<{
        success: boolean;
        message: string;
    }>;
    cleanupArchivedTasks(olderThanDays?: string): Promise<{
        success: boolean;
        message: string;
        data: {
            deletedCount: number;
            olderThanDays: number;
        };
    }>;
    getDlqTaskByOriginalId(originalTaskId: string): Promise<{
        success: boolean;
        data: {
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
        };
    }>;
}
