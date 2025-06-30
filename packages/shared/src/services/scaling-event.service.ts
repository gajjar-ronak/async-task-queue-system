import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class ScalingEventService {
  private readonly logger = new Logger(ScalingEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new scaling event
   */
  async createScalingEvent(data: CreateScalingEventDto) {
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
          status: ScalingEventStatus.INITIATED,
        },
      });

      this.logger.log(
        `Scaling event created: ${data.eventType} - ${data.triggerReason}`,
        {
          eventId: scalingEvent.id,
          eventType: data.eventType,
          nodeId: data.nodeId,
          activeNodes: data.activeNodes,
          targetNodes: data.targetNodes,
        },
      );

      return scalingEvent;
    } catch (error) {
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
  async updateScalingEvent(eventId: string, data: UpdateScalingEventDto) {
    try {
      const updateData: Prisma.ScalingEventUpdateInput = {
        ...data,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
        updatedAt: new Date(),
      };

      // Calculate duration if status is being set to completed/failed
      if (
        data.status &&
        (data.status === ScalingEventStatus.COMPLETED ||
          data.status === ScalingEventStatus.FAILED)
      ) {
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
    } catch (error) {
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
  async logNodeStart(
    nodeId: string,
    activeNodes: number,
    metadata?: Record<string, any>,
  ) {
    return this.createScalingEvent({
      eventType: ScalingEventType.NODE_START,
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
  async logNodeStop(
    nodeId: string,
    activeNodes: number,
    reason: string = 'Normal shutdown',
    metadata?: Record<string, any>,
  ) {
    return this.createScalingEvent({
      eventType: ScalingEventType.NODE_STOP,
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
  async logAutoScale(
    eventType: 'AUTO_SCALE_UP' | 'AUTO_SCALE_DOWN',
    triggerReason: string,
    currentNodes: number,
    targetNodes: number,
    queueSize: number,
    metadata?: Record<string, any>,
  ) {
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
  async logManualScale(
    triggerReason: string,
    currentNodes: number,
    targetNodes: number,
    initiatedBy?: string,
    metadata?: Record<string, any>,
  ) {
    return this.createScalingEvent({
      eventType: ScalingEventType.MANUAL_SCALE,
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
  async getRecentScalingEvents(limit: number = 10) {
    return this.prisma.scalingEvent.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Get scaling events by type
   */
  async getScalingEventsByType(
    eventType: ScalingEventType,
    limit: number = 50,
  ) {
    return this.prisma.scalingEvent.findMany({
      where: { eventType },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Get scaling events for a specific node
   */
  async getNodeScalingEvents(nodeId: string, limit: number = 50) {
    return this.prisma.scalingEvent.findMany({
      where: { nodeId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Get scaling statistics
   */
  async getScalingStatistics(fromDate?: Date, toDate?: Date) {
    const whereClause: Prisma.ScalingEventWhereInput = {};

    if (fromDate || toDate) {
      whereClause.timestamp = {};
      if (fromDate) whereClause.timestamp.gte = fromDate;
      if (toDate) whereClause.timestamp.lte = toDate;
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
      eventsByType: eventsByType.reduce(
        (acc, item) => {
          acc[item.eventType] = item._count.eventType;
          return acc;
        },
        {} as Record<string, number>,
      ),
      eventsByStatus: eventsByStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  /**
   * Clean up old scaling events (keep only recent ones)
   */
  async cleanupOldEvents(keepDays: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);

    const deletedCount = await this.prisma.scalingEvent.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(
      `Cleaned up ${deletedCount.count} old scaling events older than ${keepDays} days`,
    );
    return deletedCount.count;
  }
}
