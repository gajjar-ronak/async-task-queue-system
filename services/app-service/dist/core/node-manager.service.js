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
var NodeManagerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeManagerService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@distributed-async-task-worker/shared");
const schedule_1 = require("@nestjs/schedule");
const os = require("os");
let NodeManagerService = NodeManagerService_1 = class NodeManagerService {
    prismaService;
    logger = new common_1.Logger(NodeManagerService_1.name);
    currentNodeId;
    heartbeatInterval = 30000;
    heartbeatTimer;
    constructor(prismaService) {
        this.prismaService = prismaService;
        this.currentNodeId = this.generateNodeId();
    }
    async onModuleInit() {
        await this.registerCurrentNode();
        this.startHeartbeat();
    }
    generateNodeId() {
        const hostname = os.hostname();
        const timestamp = Date.now();
        return `node-${hostname}-${timestamp}`;
    }
    async registerCurrentNode() {
        try {
            const nodeInfo = await this.getCurrentNodeInfo();
            const existingNode = await this.prismaService.node.findUnique({
                where: { id: this.currentNodeId },
            });
            if (existingNode) {
                await this.prismaService.node.update({
                    where: { id: this.currentNodeId },
                    data: {
                        status: 'active',
                        lastHeartbeat: new Date(),
                        cpuUsage: nodeInfo.cpuUsage,
                        memoryUsage: nodeInfo.memoryUsage,
                    },
                });
            }
            else {
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
        }
        catch (error) {
            this.logger.error('Failed to register node:', error);
        }
    }
    async getCurrentNodeInfo() {
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
            taskCount: 0,
            lastHeartbeat: new Date(),
            version: process.env.npm_package_version || '1.0.0',
            capabilities: ['task-processing', 'queue-management', 'stress-testing'],
        };
    }
    getLocalIPAddress() {
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
    async getCPUUsage() {
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();
            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const totalUsage = endUsage.user + endUsage.system;
                const percentage = (totalUsage / 1000000) * 100;
                resolve(Math.min(percentage, 100));
            }, 100);
        });
    }
    startHeartbeat() {
        this.heartbeatTimer = setInterval(async () => {
            await this.sendHeartbeat();
        }, this.heartbeatInterval);
    }
    async sendHeartbeat() {
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
        }
        catch (error) {
            this.logger.error('Failed to send heartbeat:', error);
        }
    }
    async getCurrentTaskCount() {
        try {
            const count = await this.prismaService.task.count({
                where: {
                    status: 'PROCESSING',
                },
            });
            return count;
        }
        catch (error) {
            this.logger.error('Failed to get current task count:', error);
            return 0;
        }
    }
    async cleanupInactiveNodes() {
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
                this.logger.warn(`Marked node ${node.id} as inactive due to missed heartbeat`);
            }
        }
        catch (error) {
            this.logger.error('Failed to cleanup inactive nodes:', error);
        }
    }
    async getAllNodes() {
        try {
            const nodes = await this.prismaService.node.findMany({
                orderBy: { lastHeartbeat: 'desc' },
            });
            return nodes.map((node) => ({
                id: node.id,
                hostname: node.hostname,
                ipAddress: node.ipAddress,
                port: node.port,
                status: node.status,
                cpuUsage: node.cpuUsage,
                memoryUsage: node.memoryUsage,
                taskCount: node.taskCount,
                lastHeartbeat: node.lastHeartbeat,
                version: node.version,
                capabilities: Array.isArray(node.capabilities)
                    ? node.capabilities
                    : [],
            }));
        }
        catch (error) {
            this.logger.error('Failed to get all nodes:', error);
            return [];
        }
    }
    async getActiveNodesCount() {
        try {
            return await this.prismaService.node.count({
                where: { status: 'active' },
            });
        }
        catch (error) {
            this.logger.error('Failed to get active nodes count:', error);
            return 0;
        }
    }
    getCurrentNodeId() {
        return this.currentNodeId;
    }
    async addWorkerNode() {
        try {
            const newNodeId = this.generateNodeId();
            const baseNodeInfo = await this.getCurrentNodeInfo();
            await this.prismaService.node.create({
                data: {
                    id: newNodeId,
                    hostname: `${baseNodeInfo.hostname}-worker`,
                    ipAddress: baseNodeInfo.ipAddress,
                    port: baseNodeInfo.port + Math.floor(Math.random() * 1000) + 1000,
                    status: 'active',
                    cpuUsage: Math.random() * 20,
                    memoryUsage: Math.random() * 30 + 20,
                    taskCount: 0,
                    lastHeartbeat: new Date(),
                    version: baseNodeInfo.version,
                    capabilities: ['task-processing', 'auto-scaled'],
                },
            });
            this.logger.log(`🚀 Added new worker node: ${newNodeId}`);
            return newNodeId;
        }
        catch (error) {
            this.logger.error('Failed to add worker node:', error);
            throw error;
        }
    }
    async removeWorkerNode() {
        try {
            const workerNodes = await this.prismaService.node.findMany({
                where: {
                    status: 'active',
                    id: { not: this.currentNodeId },
                },
                orderBy: { taskCount: 'asc' },
                take: 1,
            });
            if (workerNodes.length === 0) {
                this.logger.warn('No worker nodes available to remove');
                return null;
            }
            const nodeToRemove = workerNodes[0];
            await this.prismaService.node.update({
                where: { id: nodeToRemove.id },
                data: { status: 'inactive' },
            });
            this.logger.log(`📉 Removed worker node: ${nodeToRemove.id}`);
            return nodeToRemove.id;
        }
        catch (error) {
            this.logger.error('Failed to remove worker node:', error);
            throw error;
        }
    }
    async shutdown() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        try {
            await this.prismaService.node.update({
                where: { id: this.currentNodeId },
                data: { status: 'inactive' },
            });
            this.logger.log(`Node ${this.currentNodeId} shutdown gracefully`);
        }
        catch (error) {
            this.logger.error('Failed to update node status on shutdown:', error);
        }
    }
};
exports.NodeManagerService = NodeManagerService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NodeManagerService.prototype, "cleanupInactiveNodes", null);
exports.NodeManagerService = NodeManagerService = NodeManagerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_1.PrismaService])
], NodeManagerService);
//# sourceMappingURL=node-manager.service.js.map