import { PrismaService } from '@distributed-async-task-worker/shared';
import { NodeManagerService } from './node-manager.service';
export interface AutoScalingConfig {
    scaleUpThreshold: number;
    scaleDownThreshold: number;
    minNodes: number;
    maxNodes: number;
    cooldownPeriod: number;
    checkInterval: number;
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
export declare class AutoScalingService {
    private prismaService;
    private nodeManagerService;
    private readonly logger;
    private lastScalingAction;
    private scalingEvents;
    private config;
    constructor(prismaService: PrismaService, nodeManagerService: NodeManagerService);
    checkAndScale(): Promise<void>;
    private isInCooldown;
    private determineScalingAction;
    private executeScalingAction;
    getAutoScalingStats(): Promise<{
        currentNodes: number;
        config: AutoScalingConfig;
        lastScalingAction: Date | null;
        recentEvents: ScalingEvent[];
        isInCooldown: boolean;
        cooldownRemaining: number;
    }>;
    updateConfig(newConfig: Partial<AutoScalingConfig>): Promise<AutoScalingConfig>;
    manualScaleUp(): Promise<void>;
    manualScaleDown(): Promise<void>;
    getCurrentNodeCount(): Promise<number>;
    cleanupOldEvents(): Promise<void>;
}
