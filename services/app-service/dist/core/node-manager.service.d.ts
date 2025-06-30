import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@distributed-async-task-worker/shared';
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
export declare class NodeManagerService implements OnModuleInit {
    private prismaService;
    private readonly logger;
    private currentNodeId;
    private readonly heartbeatInterval;
    private heartbeatTimer;
    constructor(prismaService: PrismaService);
    onModuleInit(): Promise<void>;
    private generateNodeId;
    private registerCurrentNode;
    private getCurrentNodeInfo;
    private getLocalIPAddress;
    private getCPUUsage;
    private startHeartbeat;
    private sendHeartbeat;
    private getCurrentTaskCount;
    cleanupInactiveNodes(): Promise<void>;
    getAllNodes(): Promise<NodeInfo[]>;
    getActiveNodesCount(): Promise<number>;
    getCurrentNodeId(): string;
    addWorkerNode(): Promise<string>;
    removeWorkerNode(): Promise<string | null>;
    shutdown(): Promise<void>;
}
