import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@distributed-async-task-worker/shared';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as os from 'os';

export interface NodeInfo {
  id: string;
  hostname: string;
  ipAddress: string;
  port: number;
  status: 'active' | 'inactive' | 'maintenance';
  cpuUsage: number;
  memoryUsage: number;
  taskCount: number;
  lastHeartbeat: Date;
  version: string;
  capabilities: string[];
}

@Injectable()
export class NodeManagerService implements OnModuleInit {
  private readonly logger = new Logger(NodeManagerService.name);
  private currentNodeId: string;
  private readonly heartbeatInterval = 30000; // 30 seconds
  private heartbeatTimer: NodeJS.Timeout;

  constructor(private prismaService: PrismaService) {
    this.currentNodeId = this.generateNodeId();
  }

  async onModuleInit() {
    await this.registerCurrentNode();
    this.startHeartbeat();
  }

  private generateNodeId(): string {
    const hostname = os.hostname();
    const timestamp = Date.now();
    return `node-${hostname}-${timestamp}`;
  }

  private async registerCurrentNode(): Promise<void> {
    try {
      const nodeInfo = await this.getCurrentNodeInfo();

      // Check if node already exists
      const existingNode = await this.prismaService.node.findUnique({
        where: { id: this.currentNodeId },
      });

      if (existingNode) {
        // Update existing node
        await this.prismaService.node.update({
          where: { id: this.currentNodeId },
          data: {
            status: 'active',
            lastHeartbeat: new Date(),
            cpuUsage: nodeInfo.cpuUsage,
            memoryUsage: nodeInfo.memoryUsage,
          },
        });
      } else {
        // Create new node
        await this.prismaService.node.create({
          data: {
            id: this.currentNodeId,
            hostname: nodeInfo.hostname,
            ipAddress: nodeInfo.ipAddress,
            port: nodeInfo.port,
            status: 'active',
            cpuUsage: nodeInfo.cpuUsage,
            memoryUsage: nodeInfo.memoryUsage,
            taskCount: 0,
            lastHeartbeat: new Date(),
            version: nodeInfo.version,
            capabilities: nodeInfo.capabilities,
          },
        });
      }

      this.logger.log(`Node ${this.currentNodeId} registered successfully`);
    } catch (error) {
      this.logger.error('Failed to register node:', error);
    }
  }

  private async getCurrentNodeInfo(): Promise<NodeInfo> {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      id: this.currentNodeId,
      hostname: os.hostname(),
      ipAddress: this.getLocalIPAddress(),
      port: parseInt(process.env.PORT || '3002'),
      status: 'active',
      cpuUsage: await this.getCPUUsage(),
      memoryUsage: (usedMem / totalMem) * 100,
      taskCount: 0, // Will be updated separately
      lastHeartbeat: new Date(),
      version: process.env.npm_package_version || '1.0.0',
      capabilities: ['task-processing', 'queue-management', 'stress-testing'],
    };
  }

  private getLocalIPAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const ifaceList = interfaces[name];
      if (ifaceList) {
        for (const iface of ifaceList) {
          if (iface.family === 'IPv4' && !iface.internal) {
            return iface.address;
          }
        }
      }
    }
    return '127.0.0.1';
  }

  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalUsage = endUsage.user + endUsage.system;
        const percentage = (totalUsage / 1000000) * 100; // Convert to percentage
        resolve(Math.min(percentage, 100));
      }, 100);
    });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      await this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      const nodeInfo = await this.getCurrentNodeInfo();

      await this.prismaService.node.update({
        where: { id: this.currentNodeId },
        data: {
          status: 'active',
          lastHeartbeat: new Date(),
          cpuUsage: nodeInfo.cpuUsage,
          memoryUsage: nodeInfo.memoryUsage,
          taskCount: await this.getCurrentTaskCount(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to send heartbeat:', error);
    }
  }

  private async getCurrentTaskCount(): Promise<number> {
    try {
      const count = await this.prismaService.task.count({
        where: {
          status: 'PROCESSING',
          // Add node-specific filtering if needed
        },
      });
      return count;
    } catch (error) {
      this.logger.error('Failed to get current task count:', error);
      return 0;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupInactiveNodes(): Promise<void> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const inactiveNodes = await this.prismaService.node.findMany({
        where: {
          lastHeartbeat: {
            lt: fiveMinutesAgo,
          },
          status: 'active',
        },
      });

      for (const node of inactiveNodes) {
        await this.prismaService.node.update({
          where: { id: node.id },
          data: { status: 'inactive' },
        });

        this.logger.warn(
          `Marked node ${node.id} as inactive due to missed heartbeat`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to cleanup inactive nodes:', error);
    }
  }

  async getAllNodes(): Promise<NodeInfo[]> {
    try {
      const nodes = await this.prismaService.node.findMany({
        orderBy: { lastHeartbeat: 'desc' },
      });

      return nodes.map((node) => ({
        id: node.id,
        hostname: node.hostname,
        ipAddress: node.ipAddress,
        port: node.port,
        status: node.status as 'active' | 'inactive' | 'maintenance',
        cpuUsage: node.cpuUsage,
        memoryUsage: node.memoryUsage,
        taskCount: node.taskCount,
        lastHeartbeat: node.lastHeartbeat,
        version: node.version,
        capabilities: Array.isArray(node.capabilities)
          ? (node.capabilities as string[])
          : [],
      }));
    } catch (error) {
      this.logger.error('Failed to get all nodes:', error);
      return [];
    }
  }

  async getActiveNodesCount(): Promise<number> {
    try {
      return await this.prismaService.node.count({
        where: { status: 'active' },
      });
    } catch (error) {
      this.logger.error('Failed to get active nodes count:', error);
      return 0;
    }
  }

  getCurrentNodeId(): string {
    return this.currentNodeId;
  }

  // Auto-scaling methods
  async addWorkerNode(): Promise<string> {
    try {
      const newNodeId = this.generateNodeId();
      const baseNodeInfo = await this.getCurrentNodeInfo();

      // Create a new simulated worker node
      await this.prismaService.node.create({
        data: {
          id: newNodeId,
          hostname: `${baseNodeInfo.hostname}-worker`,
          ipAddress: baseNodeInfo.ipAddress,
          port: baseNodeInfo.port + Math.floor(Math.random() * 1000) + 1000, // Random port offset
          status: 'active',
          cpuUsage: Math.random() * 20, // Low initial CPU usage
          memoryUsage: Math.random() * 30 + 20, // 20-50% memory usage
          taskCount: 0,
          lastHeartbeat: new Date(),
          version: baseNodeInfo.version,
          capabilities: ['task-processing', 'auto-scaled'],
        },
      });

      this.logger.log(`🚀 Added new worker node: ${newNodeId}`);
      return newNodeId;
    } catch (error) {
      this.logger.error('Failed to add worker node:', error);
      throw error;
    }
  }

  async removeWorkerNode(): Promise<string | null> {
    try {
      // Find a worker node that can be removed (not the current node)
      const workerNodes = await this.prismaService.node.findMany({
        where: {
          status: 'active',
          id: { not: this.currentNodeId }, // Don't remove the current node
        },
        orderBy: { taskCount: 'asc' }, // Remove node with least tasks first
        take: 1,
      });

      if (workerNodes.length === 0) {
        this.logger.warn('No worker nodes available to remove');
        return null;
      }

      const nodeToRemove = workerNodes[0];

      // Mark the node as inactive (simulating graceful shutdown)
      await this.prismaService.node.update({
        where: { id: nodeToRemove.id },
        data: { status: 'inactive' },
      });

      this.logger.log(`📉 Removed worker node: ${nodeToRemove.id}`);
      return nodeToRemove.id;
    } catch (error) {
      this.logger.error('Failed to remove worker node:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    try {
      await this.prismaService.node.update({
        where: { id: this.currentNodeId },
        data: { status: 'inactive' },
      });

      this.logger.log(`Node ${this.currentNodeId} shutdown gracefully`);
    } catch (error) {
      this.logger.error('Failed to update node status on shutdown:', error);
    }
  }
}
