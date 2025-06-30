import { PrismaService } from '../database/prisma.service';
import { ScalingEventType, ScalingEventStatus, Prisma } from '@prisma/client';
export interface CreateScalingEventDto {
    eventType: ScalingEventType;
    nodeId?: string;
    triggerReason: string;
    queueSize?: number;
    activeNodes: number;
    targetNodes?: number;
    metadata?: Record<string, any>;
}
export interface UpdateScalingEventDto {
    status?: ScalingEventStatus;
    duration?: number;
    errorMessage?: string;
    activeNodes?: number;
    metadata?: Record<string, any>;
}
export declare class ScalingEventService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    /**
     * Create a new scaling event
     */
    createScalingEvent(data: CreateScalingEventDto): Promise<{
        id: string;
        eventType: import(".prisma/client").$Enums.ScalingEventType;
        nodeId: string | null;
        triggerReason: string;
        queueSize: number | null;
        activeNodes: number;
        targetNodes: number | null;
        metadata: Prisma.JsonValue | null;
        timestamp: Date;
        duration: number | null;
        status: import(".prisma/client").$Enums.ScalingEventStatus;
        errorMessage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Update an existing scaling event
     */
    updateScalingEvent(eventId: string, data: UpdateScalingEventDto): Promise<{
        id: string;
        eventType: import(".prisma/client").$Enums.ScalingEventType;
        nodeId: string | null;
        triggerReason: string;
        queueSize: number | null;
        activeNodes: number;
        targetNodes: number | null;
        metadata: Prisma.JsonValue | null;
        timestamp: Date;
        duration: number | null;
        status: import(".prisma/client").$Enums.ScalingEventStatus;
        errorMessage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Log a node startup event
     */
    logNodeStart(nodeId: string, activeNodes: number, metadata?: Record<string, any>): Promise<{
        id: string;
        eventType: import(".prisma/client").$Enums.ScalingEventType;
        nodeId: string | null;
        triggerReason: string;
        queueSize: number | null;
        activeNodes: number;
        targetNodes: number | null;
        metadata: Prisma.JsonValue | null;
        timestamp: Date;
        duration: number | null;
        status: import(".prisma/client").$Enums.ScalingEventStatus;
        errorMessage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Log a node shutdown event
     */
    logNodeStop(nodeId: string, activeNodes: number, reason?: string, metadata?: Record<string, any>): Promise<{
        id: string;
        eventType: import(".prisma/client").$Enums.ScalingEventType;
        nodeId: string | null;
        triggerReason: string;
        queueSize: number | null;
        activeNodes: number;
        targetNodes: number | null;
        metadata: Prisma.JsonValue | null;
        timestamp: Date;
        duration: number | null;
        status: import(".prisma/client").$Enums.ScalingEventStatus;
        errorMessage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Log an auto-scaling event
     */
    logAutoScale(eventType: 'AUTO_SCALE_UP' | 'AUTO_SCALE_DOWN', triggerReason: string, currentNodes: number, targetNodes: number, queueSize: number, metadata?: Record<string, any>): Promise<{
        id: string;
        eventType: import(".prisma/client").$Enums.ScalingEventType;
        nodeId: string | null;
        triggerReason: string;
        queueSize: number | null;
        activeNodes: number;
        targetNodes: number | null;
        metadata: Prisma.JsonValue | null;
        timestamp: Date;
        duration: number | null;
        status: import(".prisma/client").$Enums.ScalingEventStatus;
        errorMessage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Log a manual scaling event
     */
    logManualScale(triggerReason: string, currentNodes: number, targetNodes: number, initiatedBy?: string, metadata?: Record<string, any>): Promise<{
        id: string;
        eventType: import(".prisma/client").$Enums.ScalingEventType;
        nodeId: string | null;
        triggerReason: string;
        queueSize: number | null;
        activeNodes: number;
        targetNodes: number | null;
        metadata: Prisma.JsonValue | null;
        timestamp: Date;
        duration: number | null;
        status: import(".prisma/client").$Enums.ScalingEventStatus;
        errorMessage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Get recent scaling events
     */
    getRecentScalingEvents(limit?: number): Promise<{
        id: string;
        eventType: import(".prisma/client").$Enums.ScalingEventType;
        nodeId: string | null;
        triggerReason: string;
        queueSize: number | null;
        activeNodes: number;
        targetNodes: number | null;
        metadata: Prisma.JsonValue | null;
        timestamp: Date;
        duration: number | null;
        status: import(".prisma/client").$Enums.ScalingEventStatus;
        errorMessage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    /**
     * Get scaling events by type
     */
    getScalingEventsByType(eventType: ScalingEventType, limit?: number): Promise<{
        id: string;
        eventType: import(".prisma/client").$Enums.ScalingEventType;
        nodeId: string | null;
        triggerReason: string;
        queueSize: number | null;
        activeNodes: number;
        targetNodes: number | null;
        metadata: Prisma.JsonValue | null;
        timestamp: Date;
        duration: number | null;
        status: import(".prisma/client").$Enums.ScalingEventStatus;
        errorMessage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    /**
     * Get scaling events for a specific node
     */
    getNodeScalingEvents(nodeId: string, limit?: number): Promise<{
        id: string;
        eventType: import(".prisma/client").$Enums.ScalingEventType;
        nodeId: string | null;
        triggerReason: string;
        queueSize: number | null;
        activeNodes: number;
        targetNodes: number | null;
        metadata: Prisma.JsonValue | null;
        timestamp: Date;
        duration: number | null;
        status: import(".prisma/client").$Enums.ScalingEventStatus;
        errorMessage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    /**
     * Get scaling statistics
     */
    getScalingStatistics(fromDate?: Date, toDate?: Date): Promise<{
        totalEvents: number;
        eventsByType: Record<string, number>;
        eventsByStatus: Record<string, number>;
    }>;
    /**
     * Clean up old scaling events (keep only recent ones)
     */
    cleanupOldEvents(keepDays?: number): Promise<number>;
}
