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
var WorkerNodeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerNodeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const shared_1 = require("@distributed-async-task-worker/shared");
const queue_manager_service_1 = require("../queue/queue-manager.service");
let WorkerNodeService = WorkerNodeService_1 = class WorkerNodeService {
    prismaService;
    queueManagerService;
    configService;
    scalingEventService;
    logger = new common_1.Logger(WorkerNodeService_1.name);
    workerId;
    isRunning = false;
    processingTasks = new Map();
    constructor(prismaService, queueManagerService, configService, scalingEventService) {
        this.prismaService = prismaService;
        this.queueManagerService = queueManagerService;
        this.configService = configService;
        this.scalingEventService = scalingEventService;
        this.workerId =
            process.env.WORKER_NODE_ID ||
                `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    async onModuleInit() {
        this.logger.log(`Worker node ${this.workerId} initializing...`);
        await this.startWorker();
    }
    async onModuleDestroy() {
        this.logger.log(`Worker node ${this.workerId} shutting down...`);
        await this.stopWorker();
    }
    async startWorker() {
        if (this.isRunning) {
            this.logger.warn('Worker is already running');
            return;
        }
        this.isRunning = true;
        this.logger.log(`Worker node ${this.workerId} started`);
        try {
            const activeNodes = await this.getActiveNodeCount();
            await this.scalingEventService.logNodeStart(this.workerId, activeNodes, {
                hostname: process.env.HOSTNAME,
                scalingMode: process.env.SCALING_MODE === 'true',
                workerConcurrency: process.env.WORKER_CONCURRENCY || '5',
            });
        }
        catch (error) {
            this.logger.error('Failed to log node start event:', error);
        }
        this.processPendingTasks();
    }
    async stopWorker() {
        this.isRunning = false;
        while (this.processingTasks.size > 0) {
            this.logger.log(`Waiting for ${this.processingTasks.size} tasks to complete...`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        try {
            const activeNodes = await this.getActiveNodeCount();
            await this.scalingEventService.logNodeStop(this.workerId, activeNodes - 1, 'Normal shutdown', {
                hostname: process.env.HOSTNAME,
                gracefulShutdown: true,
                pendingTasks: this.processingTasks.size,
            });
        }
        catch (error) {
            this.logger.error('Failed to log node stop event:', error);
        }
        this.logger.log(`Worker node ${this.workerId} stopped`);
    }
    async processPendingTasks() {
        while (this.isRunning) {
            try {
                const pendingTasks = await this.prismaService.task.findMany({
                    where: {
                        status: shared_1.TaskStatus.PENDING,
                    },
                    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
                    take: 10,
                });
                if (pendingTasks.length === 0) {
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                    continue;
                }
                const taskPromises = pendingTasks.map((task) => this.processTask(task));
                await Promise.allSettled(taskPromises);
            }
            catch (error) {
                this.logger.error('Error in processPendingTasks:', error);
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        }
    }
    async processTask(task) {
        const taskId = task.id;
        if (this.processingTasks.has(taskId)) {
            return;
        }
        this.processingTasks.set(taskId, task);
        try {
            await this.prismaService.task.update({
                where: { id: taskId },
                data: {
                    status: shared_1.TaskStatus.QUEUED,
                    updatedAt: new Date(),
                },
            });
            await this.queueManagerService.addTask({
                taskId: task.id,
                type: task.type,
                data: task.payload,
                priority: task.priority,
                delay: task.delay,
                attempts: task.maxAttempts,
            });
            await this.prismaService.task.update({
                where: { id: taskId },
                data: {
                    status: shared_1.TaskStatus.PROCESSING,
                    startedAt: new Date(),
                    attempts: task.attempts + 1,
                    updatedAt: new Date(),
                },
            });
            await this.logTaskEvent(taskId, 'INFO', `Task queued by worker ${this.workerId}`);
        }
        catch (error) {
            this.logger.error(`Failed to process task ${taskId}:`, error);
            await this.prismaService.task.update({
                where: { id: taskId },
                data: {
                    status: shared_1.TaskStatus.FAILED,
                    updatedAt: new Date(),
                },
            });
            await this.logTaskEvent(taskId, 'ERROR', `Task failed: ${error.message}`);
        }
        finally {
            this.processingTasks.delete(taskId);
        }
    }
    async markTaskCompleted(taskId, result) {
        try {
            await this.prismaService.task.update({
                where: { id: taskId },
                data: {
                    status: shared_1.TaskStatus.COMPLETED,
                    completedAt: new Date(),
                    updatedAt: new Date(),
                },
            });
            await this.logTaskEvent(taskId, 'INFO', 'Task completed successfully', result);
            this.logger.log(`Task ${taskId} marked as completed`);
        }
        catch (error) {
            this.logger.error(`Failed to mark task ${taskId} as completed:`, error);
        }
    }
    async markTaskFailed(taskId, error) {
        try {
            const task = await this.prismaService.task.findUnique({
                where: { id: taskId },
            });
            if (!task) {
                this.logger.error(`Task ${taskId} not found`);
                return;
            }
            if (task.attempts < task.maxAttempts) {
                await this.prismaService.task.update({
                    where: { id: taskId },
                    data: {
                        status: shared_1.TaskStatus.RETRYING,
                        updatedAt: new Date(),
                    },
                });
                await this.logTaskEvent(taskId, 'WARN', `Task failed, retrying (attempt ${task.attempts + 1}/${task.maxAttempts})`, { error: error.message });
            }
            else {
                await this.prismaService.task.update({
                    where: { id: taskId },
                    data: {
                        status: shared_1.TaskStatus.FAILED,
                        updatedAt: new Date(),
                    },
                });
                await this.logTaskEvent(taskId, 'ERROR', 'Task failed after max attempts', { error: error.message });
            }
        }
        catch (err) {
            this.logger.error(`Failed to mark task ${taskId} as failed:`, err);
        }
    }
    async logTaskEvent(taskId, level, message, metadata) {
        try {
            await this.prismaService.taskLog.create({
                data: {
                    taskId,
                    level: level,
                    message,
                    metadata: metadata ? JSON.stringify(metadata) : undefined,
                },
            });
        }
        catch (error) {
            this.logger.error(`Failed to log task event for ${taskId}:`, error);
        }
    }
    getWorkerStats() {
        return {
            workerId: this.workerId,
            isRunning: this.isRunning,
            processingTasks: this.processingTasks.size,
            currentTasks: Array.from(this.processingTasks.keys()),
        };
    }
    async getActiveNodeCount() {
        try {
            const activeNodes = await this.prismaService.node.count({
                where: {
                    status: 'active',
                    lastHeartbeat: {
                        gte: new Date(Date.now() - 60000),
                    },
                },
            });
            return activeNodes;
        }
        catch (error) {
            this.logger.error('Failed to get active node count:', error);
            return 1;
        }
    }
};
exports.WorkerNodeService = WorkerNodeService;
exports.WorkerNodeService = WorkerNodeService = WorkerNodeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_1.PrismaService,
        queue_manager_service_1.QueueManagerService,
        config_1.ConfigService,
        shared_1.ScalingEventService])
], WorkerNodeService);
//# sourceMappingURL=worker-node.service.js.map