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
var AutoScalingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoScalingService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const shared_1 = require("@distributed-async-task-worker/shared");
const node_manager_service_1 = require("./node-manager.service");
let AutoScalingService = AutoScalingService_1 = class AutoScalingService {
    prismaService;
    nodeManagerService;
    logger = new common_1.Logger(AutoScalingService_1.name);
    lastScalingAction = null;
    scalingEvents = [];
    config = {
        scaleUpThreshold: 50,
        scaleDownThreshold: 10,
        minNodes: 1,
        maxNodes: 10,
        cooldownPeriod: 30,
        checkInterval: 10,
    };
    constructor(prismaService, nodeManagerService) {
        this.prismaService = prismaService;
        this.nodeManagerService = nodeManagerService;
    }
    async checkAndScale() {
        try {
            const [pendingTasks, activeTasks] = await Promise.all([
                this.prismaService.task.count({ where: { status: 'PENDING' } }),
                this.prismaService.task.count({ where: { status: 'PROCESSING' } }),
            ]);
            const currentNodes = await this.nodeManagerService.getActiveNodesCount();
            this.logger.debug(`Auto-scaling check: ${pendingTasks} pending, ${activeTasks} active, ${currentNodes} nodes`);
            if (this.isInCooldown()) {
                this.logger.debug('Auto-scaling in cooldown period, skipping check');
                return;
            }
            const scalingDecision = this.determineScalingAction(pendingTasks, activeTasks, currentNodes);
            if (scalingDecision) {
                await this.executeScalingAction(scalingDecision, pendingTasks, activeTasks, currentNodes);
            }
        }
        catch (error) {
            this.logger.error('Error in auto-scaling check:', error);
        }
    }
    isInCooldown() {
        if (!this.lastScalingAction) {
            return false;
        }
        const cooldownEnd = new Date(this.lastScalingAction.getTime() + this.config.cooldownPeriod * 1000);
        return new Date() < cooldownEnd;
    }
    determineScalingAction(pendingTasks, activeTasks, currentNodes) {
        const optimalNodes = Math.max(1, Math.ceil(pendingTasks / this.config.scaleUpThreshold));
        const cappedOptimalNodes = Math.min(optimalNodes, this.config.maxNodes);
        this.logger.debug(`Scaling calculation: ${pendingTasks} pending tasks → optimal: ${optimalNodes} nodes → capped: ${cappedOptimalNodes} nodes (current: ${currentNodes})`);
        if (cappedOptimalNodes > currentNodes) {
            return 'scale_up';
        }
        if (cappedOptimalNodes < currentNodes &&
            activeTasks <= this.config.scaleDownThreshold) {
            return 'scale_down';
        }
        return null;
    }
    async executeScalingAction(action, pendingTasks, activeTasks, currentNodes) {
        const nodesBefore = currentNodes;
        let nodesAfter = nodesBefore;
        let reason = '';
        let success = false;
        const optimalNodes = Math.max(1, Math.ceil(pendingTasks / this.config.scaleUpThreshold));
        const targetNodes = Math.min(optimalNodes, this.config.maxNodes);
        try {
            if (action === 'scale_up') {
                const nodesToAdd = Math.min(targetNodes - currentNodes, this.config.maxNodes - currentNodes);
                reason = `High load detected: ${pendingTasks} pending tasks require ${targetNodes} nodes`;
                for (let i = 0; i < nodesToAdd; i++) {
                    const newNodeId = await this.nodeManagerService.addWorkerNode();
                    this.logger.log(`🚀 Added worker node ${newNodeId}`);
                }
                nodesAfter = currentNodes + nodesToAdd;
                success = true;
                this.logger.log(`🚀 SCALING UP: Added ${nodesToAdd} worker node(s) (${nodesBefore} → ${nodesAfter})`);
            }
            else if (action === 'scale_down') {
                const nodesToRemove = Math.min(currentNodes - targetNodes, currentNodes - this.config.minNodes);
                reason = `Low load detected: ${pendingTasks} pending tasks require only ${targetNodes} nodes`;
                let actuallyRemoved = 0;
                for (let i = 0; i < nodesToRemove; i++) {
                    const removedNodeId = await this.nodeManagerService.removeWorkerNode();
                    if (removedNodeId) {
                        actuallyRemoved++;
                        this.logger.log(`📉 Removed worker node ${removedNodeId}`);
                    }
                    else {
                        this.logger.warn('No more worker nodes available to remove');
                        break;
                    }
                }
                nodesAfter = currentNodes - actuallyRemoved;
                success = actuallyRemoved > 0;
                if (success) {
                    this.logger.log(`📉 SCALING DOWN: Removed ${actuallyRemoved} worker node(s) (${nodesBefore} → ${nodesAfter})`);
                }
                else {
                    this.logger.warn('No worker nodes were removed');
                    nodesAfter = nodesBefore;
                }
            }
        }
        catch (error) {
            this.logger.error(`Failed to execute scaling action ${action}:`, error);
            nodesAfter = nodesBefore;
            reason += ` (Failed: ${error.message})`;
        }
        if (success) {
            const actualNodesAfter = await this.nodeManagerService.getActiveNodesCount();
            const scalingEvent = {
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
            if (this.scalingEvents.length > 50) {
                this.scalingEvents = this.scalingEvents.slice(-50);
            }
            this.lastScalingAction = new Date();
            this.logger.log(`Auto-scaling executed: ${action} - ${reason}`);
        }
        else {
            this.logger.warn(`Auto-scaling failed: ${action} - ${reason}`);
        }
    }
    async getAutoScalingStats() {
        const cooldownRemaining = this.lastScalingAction
            ? Math.max(0, this.config.cooldownPeriod -
                Math.floor((Date.now() - this.lastScalingAction.getTime()) / 1000))
            : 0;
        const currentNodes = await this.nodeManagerService.getActiveNodesCount();
        return {
            currentNodes,
            config: this.config,
            lastScalingAction: this.lastScalingAction,
            recentEvents: this.scalingEvents.slice(-10),
            isInCooldown: this.isInCooldown(),
            cooldownRemaining,
        };
    }
    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.log('Auto-scaling configuration updated:', this.config);
        return this.config;
    }
    async manualScaleUp() {
        const currentNodes = await this.nodeManagerService.getActiveNodesCount();
        if (currentNodes < this.config.maxNodes) {
            await this.executeScalingAction('scale_up', 0, 0, currentNodes);
        }
    }
    async manualScaleDown() {
        const currentNodes = await this.nodeManagerService.getActiveNodesCount();
        if (currentNodes > this.config.minNodes) {
            await this.executeScalingAction('scale_down', 0, 0, currentNodes);
        }
    }
    async getCurrentNodeCount() {
        return await this.nodeManagerService.getActiveNodesCount();
    }
    async cleanupOldEvents() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        this.scalingEvents = this.scalingEvents.filter((event) => event.timestamp > oneHourAgo);
        this.logger.debug(`Cleaned up old scaling events, ${this.scalingEvents.length} events remaining`);
    }
};
exports.AutoScalingService = AutoScalingService;
__decorate([
    (0, schedule_1.Cron)('*/10 * * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AutoScalingService.prototype, "checkAndScale", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AutoScalingService.prototype, "cleanupOldEvents", null);
exports.AutoScalingService = AutoScalingService = AutoScalingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_1.PrismaService,
        node_manager_service_1.NodeManagerService])
], AutoScalingService);
//# sourceMappingURL=auto-scaling.service.js.map