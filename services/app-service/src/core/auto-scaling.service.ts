import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@distributed-async-task-worker/shared';
import { NodeManagerService } from './node-manager.service';

export interface AutoScalingConfig {
  scaleUpThreshold: number; // Number of pending tasks to trigger scale up
  scaleDownThreshold: number; // Number of pending tasks to trigger scale down
  minNodes: number; // Minimum number of worker nodes
  maxNodes: number; // Maximum number of worker nodes
  cooldownPeriod: number; // Cooldown period in seconds between scaling actions
  checkInterval: number; // How often to check for scaling (seconds)
}

export interface ScalingEvent {
  id: string;
  timestamp: Date;
  action: 'scale_up' | 'scale_down';
  reason: string;
  nodesBefore: number;
  nodesAfter: number;
  pendingTasks: number;
  activeTasks: number;
}

@Injectable()
export class AutoScalingService {
  private readonly logger = new Logger(AutoScalingService.name);
  private lastScalingAction: Date | null = null;
  private scalingEvents: ScalingEvent[] = [];

  private config: AutoScalingConfig = {
    scaleUpThreshold: 50, // Scale up when 50+ pending tasks
    scaleDownThreshold: 10, // Scale down when 10 or fewer pending tasks
    minNodes: 1, // Always keep at least 1 node
    maxNodes: 10, // Maximum 10 nodes
    cooldownPeriod: 30, // 30 seconds cooldown
    checkInterval: 10, // Check every 10 seconds
  };

  constructor(
    private prismaService: PrismaService,
    private nodeManagerService: NodeManagerService,
  ) {}

  @Cron('*/10 * * * * *') // Check every 10 seconds
  async checkAndScale(): Promise<void> {
    try {
      // Get current task statistics from database (since queue is in worker service)
      const [pendingTasks, activeTasks] = await Promise.all([
        this.prismaService.task.count({ where: { status: 'PENDING' } }),
        this.prismaService.task.count({ where: { status: 'PROCESSING' } }),
      ]);
      const currentNodes = await this.nodeManagerService.getActiveNodesCount();

      this.logger.debug(
        `Auto-scaling check: ${pendingTasks} pending, ${activeTasks} active, ${currentNodes} nodes`,
      );

      // Check if we're in cooldown period
      if (this.isInCooldown()) {
        this.logger.debug('Auto-scaling in cooldown period, skipping check');
        return;
      }

      // Determine if scaling action is needed
      const scalingDecision = this.determineScalingAction(
        pendingTasks,
        activeTasks,
        currentNodes,
      );

      if (scalingDecision) {
        await this.executeScalingAction(
          scalingDecision,
          pendingTasks,
          activeTasks,
          currentNodes,
        );
      }
    } catch (error) {
      this.logger.error('Error in auto-scaling check:', error);
    }
  }

  private isInCooldown(): boolean {
    if (!this.lastScalingAction) {
      return false;
    }

    const cooldownEnd = new Date(
      this.lastScalingAction.getTime() + this.config.cooldownPeriod * 1000,
    );
    return new Date() < cooldownEnd;
  }

  private determineScalingAction(
    pendingTasks: number,
    activeTasks: number,
    currentNodes: number,
  ): 'scale_up' | 'scale_down' | null {
    // Calculate optimal number of nodes based on pending tasks
    // Formula: 1 worker for every 50 pending tasks, minimum 1 worker
    const optimalNodes = Math.max(
      1,
      Math.ceil(pendingTasks / this.config.scaleUpThreshold),
    );
    const cappedOptimalNodes = Math.min(optimalNodes, this.config.maxNodes);

    this.logger.debug(
      `Scaling calculation: ${pendingTasks} pending tasks → optimal: ${optimalNodes} nodes → capped: ${cappedOptimalNodes} nodes (current: ${currentNodes})`,
    );

    // Scale up if we need more nodes
    if (cappedOptimalNodes > currentNodes) {
      return 'scale_up';
    }

    // Scale down if we have too many nodes
    // Only scale down if active tasks are also manageable
    if (
      cappedOptimalNodes < currentNodes &&
      activeTasks <= this.config.scaleDownThreshold
    ) {
      return 'scale_down';
    }

    return null;
  }

  private async executeScalingAction(
    action: 'scale_up' | 'scale_down',
    pendingTasks: number,
    activeTasks: number,
    currentNodes: number,
  ): Promise<void> {
    const nodesBefore = currentNodes;
    let nodesAfter = nodesBefore;
    let reason = '';
    let success = false;

    // Calculate target number of nodes
    const optimalNodes = Math.max(
      1,
      Math.ceil(pendingTasks / this.config.scaleUpThreshold),
    );
    const targetNodes = Math.min(optimalNodes, this.config.maxNodes);

    try {
      if (action === 'scale_up') {
        // Scale up to target number of nodes
        const nodesToAdd = Math.min(
          targetNodes - currentNodes,
          this.config.maxNodes - currentNodes,
        );
        reason = `High load detected: ${pendingTasks} pending tasks require ${targetNodes} nodes`;

        for (let i = 0; i < nodesToAdd; i++) {
          const newNodeId = await this.nodeManagerService.addWorkerNode();
          this.logger.log(`🚀 Added worker node ${newNodeId}`);
        }

        nodesAfter = currentNodes + nodesToAdd;
        success = true;

        this.logger.log(
          `🚀 SCALING UP: Added ${nodesToAdd} worker node(s) (${nodesBefore} → ${nodesAfter})`,
        );
      } else if (action === 'scale_down') {
        // Scale down to target number of nodes
        const nodesToRemove = Math.min(
          currentNodes - targetNodes,
          currentNodes - this.config.minNodes,
        );
        reason = `Low load detected: ${pendingTasks} pending tasks require only ${targetNodes} nodes`;

        let actuallyRemoved = 0;
        for (let i = 0; i < nodesToRemove; i++) {
          const removedNodeId =
            await this.nodeManagerService.removeWorkerNode();
          if (removedNodeId) {
            actuallyRemoved++;
            this.logger.log(`📉 Removed worker node ${removedNodeId}`);
          } else {
            this.logger.warn('No more worker nodes available to remove');
            break;
          }
        }

        nodesAfter = currentNodes - actuallyRemoved;
        success = actuallyRemoved > 0;

        if (success) {
          this.logger.log(
            `📉 SCALING DOWN: Removed ${actuallyRemoved} worker node(s) (${nodesBefore} → ${nodesAfter})`,
          );
        } else {
          this.logger.warn('No worker nodes were removed');
          nodesAfter = nodesBefore;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to execute scaling action ${action}:`, error);
      nodesAfter = nodesBefore; // No change if scaling failed
      reason += ` (Failed: ${error.message})`;
    }

    // Only record scaling event if the action was successful
    if (success) {
      // Get the actual current node count after scaling
      const actualNodesAfter =
        await this.nodeManagerService.getActiveNodesCount();

      const scalingEvent: ScalingEvent = {
        id: `scaling-${Date.now()}`,
        timestamp: new Date(),
        action,
        reason,
        nodesBefore,
        nodesAfter: actualNodesAfter,
        pendingTasks,
        activeTasks,
      };

      this.scalingEvents.push(scalingEvent);

      // Keep only last 50 scaling events
      if (this.scalingEvents.length > 50) {
        this.scalingEvents = this.scalingEvents.slice(-50);
      }

      this.lastScalingAction = new Date();

      this.logger.log(`Auto-scaling executed: ${action} - ${reason}`);
    } else {
      this.logger.warn(`Auto-scaling failed: ${action} - ${reason}`);
    }
  }

  async getAutoScalingStats(): Promise<{
    currentNodes: number;
    config: AutoScalingConfig;
    lastScalingAction: Date | null;
    recentEvents: ScalingEvent[];
    isInCooldown: boolean;
    cooldownRemaining: number;
  }> {
    const cooldownRemaining = this.lastScalingAction
      ? Math.max(
          0,
          this.config.cooldownPeriod -
            Math.floor((Date.now() - this.lastScalingAction.getTime()) / 1000),
        )
      : 0;

    const currentNodes = await this.nodeManagerService.getActiveNodesCount();

    return {
      currentNodes,
      config: this.config,
      lastScalingAction: this.lastScalingAction,
      recentEvents: this.scalingEvents.slice(-10), // Last 10 events
      isInCooldown: this.isInCooldown(),
      cooldownRemaining,
    };
  }

  async updateConfig(
    newConfig: Partial<AutoScalingConfig>,
  ): Promise<AutoScalingConfig> {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Auto-scaling configuration updated:', this.config);
    return this.config;
  }

  // Manual scaling methods for testing
  async manualScaleUp(): Promise<void> {
    const currentNodes = await this.nodeManagerService.getActiveNodesCount();
    if (currentNodes < this.config.maxNodes) {
      await this.executeScalingAction('scale_up', 0, 0, currentNodes);
    }
  }

  async manualScaleDown(): Promise<void> {
    const currentNodes = await this.nodeManagerService.getActiveNodesCount();
    if (currentNodes > this.config.minNodes) {
      await this.executeScalingAction('scale_down', 0, 0, currentNodes);
    }
  }

  // Get current node count for dashboard
  async getCurrentNodeCount(): Promise<number> {
    return await this.nodeManagerService.getActiveNodesCount();
  }

  // Cleanup old scaling events
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldEvents(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.scalingEvents = this.scalingEvents.filter(
      (event) => event.timestamp > oneHourAgo,
    );
    this.logger.debug(
      `Cleaned up old scaling events, ${this.scalingEvents.length} events remaining`,
    );
  }
}
