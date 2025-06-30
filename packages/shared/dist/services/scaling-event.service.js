"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ScalingEventService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScalingEventService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
const client_1 = require("@prisma/client");
let ScalingEventService = ScalingEventService_1 = class ScalingEventService {
    prisma;
    logger = new common_1.Logger(ScalingEventService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Create a new scaling event
     */
    async createScalingEvent(data) {
        try {
            const scalingEvent = await this.prisma.scalingEvent.create({
                data: {
                    eventType: data.eventType,
                    nodeId: data.nodeId,
                    triggerReason: data.triggerReason,
                    queueSize: data.queueSize,
                    activeNodes: data.activeNodes,
                    targetNodes: data.targetNodes,
                    metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
                    status: client_1.ScalingEventStatus.INITIATED,
                },
            });
            this.logger.log(`Scaling event created: ${data.eventType} - ${data.triggerReason}`, {
                eventId: scalingEvent.id,
                eventType: data.eventType,
                nodeId: data.nodeId,
                activeNodes: data.activeNodes,
                targetNodes: data.targetNodes,
            });
            return scalingEvent;
        }
        catch (error) {
            this.logger.error('Failed to create scaling event', {
                error: error instanceof Error ? error.message : String(error),
                data,
            });
            throw error;
        }
    }
    /**
     * Update an existing scaling event
     */
    async updateScalingEvent(eventId, data) {
        try {
            const updateData = {
                ...data,
                metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
                updatedAt: new Date(),
            };
            // Calculate duration if status is being set to completed/failed
            if (data.status &&
                (data.status === client_1.ScalingEventStatus.COMPLETED ||
                    data.status === client_1.ScalingEventStatus.FAILED)) {
                const existingEvent = await this.prisma.scalingEvent.findUnique({
                    where: { id: eventId },
                    select: { timestamp: true },
                });
                if (existingEvent && !data.duration) {
                    updateData.duration = Date.now() - existingEvent.timestamp.getTime();
                }
            }
            const scalingEvent = await this.prisma.scalingEvent.update({
                where: { id: eventId },
                data: updateData,
            });
            this.logger.log(`Scaling event updated: ${eventId}`, {
                eventId,
                status: data.status,
                duration: updateData.duration,
            });
            return scalingEvent;
        }
        catch (error) {
            this.logger.error('Failed to update scaling event', {
                error: error instanceof Error ? error.message : String(error),
                eventId,
                data,
            });
            throw error;
        }
    }
    /**
     * Log a node startup event
     */
    async logNodeStart(nodeId, activeNodes, metadata) {
        return this.createScalingEvent({
            eventType: client_1.ScalingEventType.NODE_START,
            nodeId,
            triggerReason: 'Node startup',
            activeNodes,
            metadata: {
                ...metadata,
                hostname: process.env.HOSTNAME || 'unknown',
                timestamp: new Date().toISOString(),
            },
        });
    }
    /**
     * Log a node shutdown event
     */
    async logNodeStop(nodeId, activeNodes, reason = 'Normal shutdown', metadata) {
        return this.createScalingEvent({
            eventType: client_1.ScalingEventType.NODE_STOP,
            nodeId,
            triggerReason: reason,
            activeNodes,
            metadata: {
                ...metadata,
                hostname: process.env.HOSTNAME || 'unknown',
                timestamp: new Date().toISOString(),
            },
        });
    }
    /**
     * Log an auto-scaling event
     */
    async logAutoScale(eventType, triggerReason, currentNodes, targetNodes, queueSize, metadata) {
        return this.createScalingEvent({
            eventType,
            triggerReason,
            queueSize,
            activeNodes: currentNodes,
            targetNodes,
            metadata: {
                ...metadata,
                autoScaling: true,
                timestamp: new Date().toISOString(),
            },
        });
    }
    /**
     * Log a manual scaling event
     */
    async logManualScale(triggerReason, currentNodes, targetNodes, initiatedBy, metadata) {
        return this.createScalingEvent({
            eventType: client_1.ScalingEventType.MANUAL_SCALE,
            triggerReason,
            activeNodes: currentNodes,
            targetNodes,
            metadata: {
                ...metadata,
                initiatedBy,
                manual: true,
                timestamp: new Date().toISOString(),
            },
        });
    }
    /**
     * Get recent scaling events
     */
    async getRecentScalingEvents(limit = 10) {
        return this.prisma.scalingEvent.findMany({
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }
    /**
     * Get scaling events by type
     */
    async getScalingEventsByType(eventType, limit = 50) {
        return this.prisma.scalingEvent.findMany({
            where: { eventType },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }
    /**
     * Get scaling events for a specific node
     */
    async getNodeScalingEvents(nodeId, limit = 50) {
        return this.prisma.scalingEvent.findMany({
            where: { nodeId },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }
    /**
     * Get scaling statistics
     */
    async getScalingStatistics(fromDate, toDate) {
        const whereClause = {};
        if (fromDate || toDate) {
            whereClause.timestamp = {};
            if (fromDate)
                whereClause.timestamp.gte = fromDate;
            if (toDate)
                whereClause.timestamp.lte = toDate;
        }
        const [totalEvents, eventsByType, eventsByStatus] = await Promise.all([
            this.prisma.scalingEvent.count({ where: whereClause }),
            this.prisma.scalingEvent.groupBy({
                by: ['eventType'],
                where: whereClause,
                _count: { eventType: true },
            }),
            this.prisma.scalingEvent.groupBy({
                by: ['status'],
                where: whereClause,
                _count: { status: true },
            }),
        ]);
        return {
            totalEvents,
            eventsByType: eventsByType.reduce((acc, item) => {
                acc[item.eventType] = item._count.eventType;
                return acc;
            }, {}),
            eventsByStatus: eventsByStatus.reduce((acc, item) => {
                acc[item.status] = item._count.status;
                return acc;
            }, {}),
        };
    }
    /**
     * Clean up old scaling events (keep only recent ones)
     */
    async cleanupOldEvents(keepDays = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - keepDays);
        const deletedCount = await this.prisma.scalingEvent.deleteMany({
            where: {
                timestamp: {
                    lt: cutoffDate,
                },
            },
        });
        this.logger.log(`Cleaned up ${deletedCount.count} old scaling events older than ${keepDays} days`);
        return deletedCount.count;
    }
};
exports.ScalingEventService = ScalingEventService;
exports.ScalingEventService = ScalingEventService = ScalingEventService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ScalingEventService);
