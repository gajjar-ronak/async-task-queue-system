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
var WorkerHealthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerHealthService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const shared_1 = require("@distributed-async-task-worker/shared");
const queue_manager_service_1 = require("../queue/queue-manager.service");
let WorkerHealthService = WorkerHealthService_1 = class WorkerHealthService {
    prismaService;
    queueManagerService;
    logger = new common_1.Logger(WorkerHealthService_1.name);
    constructor(prismaService, queueManagerService) {
        this.prismaService = prismaService;
        this.queueManagerService = queueManagerService;
    }
    async checkWorkerHealth() {
        try {
            const stats = await this.getSystemStats();
            this.logger.debug('System health check:', stats);
            await this.checkStuckTasks();
            await this.cleanupOldTasks();
        }
        catch (error) {
            this.logger.error('Health check failed:', error);
        }
    }
    async checkStuckTasks() {
        const stuckThreshold = 10 * 60 * 1000;
        const stuckTime = new Date(Date.now() - stuckThreshold);
        const stuckTasks = await this.prismaService.task.findMany({
            where: {
                status: shared_1.TaskStatus.PROCESSING,
                startedAt: {
                    lt: stuckTime,
                },
            },
        });
        if (stuckTasks.length > 0) {
            this.logger.warn(`Found ${stuckTasks.length} stuck tasks`);
            for (const task of stuckTasks) {
                await this.prismaService.task.update({
                    where: { id: task.id },
                    data: {
                        status: shared_1.TaskStatus.FAILED,
                        updatedAt: new Date(),
                    },
                });
                await this.prismaService.taskLog.create({
                    data: {
                        taskId: task.id,
                        level: 'ERROR',
                        message: 'Task marked as failed due to timeout',
                        metadata: JSON.stringify({ reason: 'stuck_task_timeout' }),
                    },
                });
            }
        }
    }
    async cleanupOldTasks() {
        const cleanupThreshold = 24 * 60 * 60 * 1000;
        const cleanupTime = new Date(Date.now() - cleanupThreshold);
        const deletedCompleted = await this.prismaService.task.deleteMany({
            where: {
                status: shared_1.TaskStatus.COMPLETED,
                completedAt: {
                    lt: cleanupTime,
                },
            },
        });
        const deletedFailed = await this.prismaService.task.deleteMany({
            where: {
                status: shared_1.TaskStatus.FAILED,
                updatedAt: {
                    lt: cleanupTime,
                },
            },
        });
        if (deletedCompleted.count > 0 || deletedFailed.count > 0) {
            this.logger.log(`Cleaned up ${deletedCompleted.count} completed and ${deletedFailed.count} failed tasks`);
        }
    }
    async getSystemStats() {
        const [totalTasks, pendingTasks, processingTasks, completedTasks, cancelledTasks, retryingTasks, queuedTasks, queueStats, permanentlyFailedTasks,] = await Promise.all([
            this.prismaService.task.count(),
            this.prismaService.task.count({ where: { status: shared_1.TaskStatus.PENDING } }),
            this.prismaService.task.count({
                where: { status: shared_1.TaskStatus.PROCESSING },
            }),
            this.prismaService.task.count({
                where: { status: shared_1.TaskStatus.COMPLETED },
            }),
            this.prismaService.task.count({
                where: { status: shared_1.TaskStatus.CANCELLED },
            }),
            this.prismaService.task.count({ where: { status: shared_1.TaskStatus.RETRYING } }),
            this.prismaService.task.count({ where: { status: shared_1.TaskStatus.QUEUED } }),
            this.queueManagerService.getQueueStats(),
            this.prismaService.task
                .findMany({
                where: {
                    status: shared_1.TaskStatus.FAILED,
                },
                select: {
                    attempts: true,
                    maxAttempts: true,
                },
            })
                .then((tasks) => tasks.filter((task) => task.attempts >= task.maxAttempts).length),
        ]);
        return {
            database: {
                totalTasks,
                pendingTasks,
                processingTasks,
                queuedTasks,
                retryingTasks,
                completedTasks,
                failedTasks: permanentlyFailedTasks,
                cancelledTasks,
            },
            queue: queueStats,
            timestamp: new Date().toISOString(),
        };
    }
    async getHealthStatus() {
        try {
            const stats = await this.getSystemStats();
            const isHealthy = stats.queue.active < 1000 && stats.database.processingTasks < 100;
            return {
                status: isHealthy ? 'healthy' : 'degraded',
                details: stats,
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error instanceof Error ? error.message : String(error),
                },
            };
        }
    }
    async getDetailedHealthStatus() {
        try {
            const stats = await this.getSystemStats();
            const memoryUsage = process.memoryUsage();
            const uptime = process.uptime();
            return {
                status: 'healthy',
                worker: {
                    nodeId: process.env.WORKER_NODE_ID || 'unknown',
                    uptime: uptime,
                    memory: {
                        rss: memoryUsage.rss,
                        heapTotal: memoryUsage.heapTotal,
                        heapUsed: memoryUsage.heapUsed,
                        external: memoryUsage.external,
                    },
                    cpu: process.cpuUsage(),
                },
                database: stats.database,
                queue: stats.queue,
                environment: {
                    nodeEnv: process.env.NODE_ENV,
                    workerConcurrency: process.env.WORKER_CONCURRENCY,
                    scalingMode: process.env.SCALING_MODE === 'true',
                },
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
            };
        }
    }
    async isReady() {
        try {
            await this.prismaService.$queryRaw `SELECT 1`;
            await this.queueManagerService.getQueueStats();
            return true;
        }
        catch (error) {
            this.logger.error('Readiness check failed:', error);
            return false;
        }
    }
};
exports.WorkerHealthService = WorkerHealthService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_30_SECONDS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WorkerHealthService.prototype, "checkWorkerHealth", null);
exports.WorkerHealthService = WorkerHealthService = WorkerHealthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_1.PrismaService,
        queue_manager_service_1.QueueManagerService])
], WorkerHealthService);
//# sourceMappingURL=worker-health.service.js.map