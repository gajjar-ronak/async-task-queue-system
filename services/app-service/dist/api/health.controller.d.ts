import { CoordinatorService } from '../coordinator/coordinator.service';
import { DeadLetterQueueService } from '../core/dead-letter-queue.service';
import { PrismaService, ScalingEventService } from '@distributed-async-task-worker/shared';
export declare class HealthController {
    private coordinatorService;
    private deadLetterQueueService;
    private prismaService;
    private scalingEventService;
    constructor(coordinatorService: CoordinatorService, deadLetterQueueService: DeadLetterQueueService, prismaService: PrismaService, scalingEventService: ScalingEventService);
    getHealth(): Promise<{
        status: string;
        service: string;
        timestamp: Date;
        database: string;
        environment: {
            nodeEnv: string;
            hostname: string;
            port: string;
        };
        error?: undefined;
    } | {
        status: string;
        service: string;
        timestamp: Date;
        database: string;
        error: any;
        environment: {
            nodeEnv: string;
            hostname: string;
            port: string;
        };
    }>;
    getReadiness(): Promise<{
        ready: boolean;
        timestamp: Date;
        service: string;
        error?: undefined;
    } | {
        ready: boolean;
        timestamp: Date;
        service: string;
        error: any;
    }>;
    getStats(): Promise<{
        tasks: {
            total: number;
            pending: number;
            processing: number;
            completed: number;
            failed: number;
        };
        workflows: {
            total: number;
            active: number;
        };
        timestamp: Date;
    }>;
    getQueueStats(): Promise<{
        success: boolean;
        data: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
        };
    }>;
    getDlqStats(): Promise<{
        success: boolean;
        data: import("@distributed-async-task-worker/shared").DlqStats;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        data?: undefined;
    }>;
    getScalingEvents(): Promise<{
        success: boolean;
        data: {
            id: string;
            eventType: import(".prisma/client").$Enums.ScalingEventType;
            nodeId: string | null;
            triggerReason: string;
            queueSize: number | null;
            activeNodes: number;
            targetNodes: number | null;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            timestamp: Date;
            duration: number | null;
            status: import(".prisma/client").$Enums.ScalingEventStatus;
            errorMessage: string | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        error?: undefined;
        message?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        data?: undefined;
    }>;
    getScalingStats(): Promise<{
        success: boolean;
        data: {
            totalEvents: number;
            eventsByType: Record<string, number>;
            eventsByStatus: Record<string, number>;
        };
        error?: undefined;
        message?: undefined;
    } | {
        success: boolean;
        error: string;
        message: any;
        data?: undefined;
    }>;
}
