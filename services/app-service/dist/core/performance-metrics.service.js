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
var PerformanceMetricsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceMetricsService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@distributed-async-task-worker/shared");
const schedule_1 = require("@nestjs/schedule");
const node_manager_service_1 = require("./node-manager.service");
let PerformanceMetricsService = PerformanceMetricsService_1 = class PerformanceMetricsService {
    prismaService;
    nodeManagerService;
    logger = new common_1.Logger(PerformanceMetricsService_1.name);
    taskStartTimes = new Map();
    constructor(prismaService, nodeManagerService) {
        this.prismaService = prismaService;
        this.nodeManagerService = nodeManagerService;
    }
    trackTaskStart(taskId) {
        this.taskStartTimes.set(taskId, Date.now());
    }
    async trackTaskCompletion(taskId, success) {
        const startTime = this.taskStartTimes.get(taskId);
        if (startTime) {
            const processingTime = Date.now() - startTime;
            this.taskStartTimes.delete(taskId);
            this.logger.debug(`Task ${taskId} completed in ${processingTime}ms, success: ${success}`);
        }
    }
    async calculateAndStoreMetrics() {
        try {
            const now = new Date();
            const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
            const completedTasks = await this.prismaService.task.findMany({
                where: {
                    OR: [
                        {
                            completedAt: {
                                gte: oneMinuteAgo,
                                lte: now,
                            },
                        },
                        {
                            failedAt: {
                                gte: oneMinuteAgo,
                                lte: now,
                            },
                        },
                    ],
                },
                select: {
                    id: true,
                    status: true,
                    startedAt: true,
                    completedAt: true,
                    failedAt: true,
                    attempts: true,
                    maxAttempts: true,
                },
            });
            if (completedTasks.length === 0) {
                return;
            }
            const processingTimes = [];
            let successfulTasks = 0;
            let failedTasks = 0;
            completedTasks.forEach((task) => {
                if (task.status === 'COMPLETED') {
                    successfulTasks++;
                    if (task.startedAt && task.completedAt) {
                        const processingTime = task.completedAt.getTime() - task.startedAt.getTime();
                        processingTimes.push(processingTime);
                    }
                }
                else if (task.status === 'FAILED') {
                    if (task.attempts >= task.maxAttempts) {
                        failedTasks++;
                    }
                    if (task.startedAt && task.failedAt) {
                        const processingTime = task.failedAt.getTime() - task.startedAt.getTime();
                        processingTimes.push(processingTime);
                    }
                }
            });
            const avgProcessingTime = processingTimes.length > 0
                ? processingTimes.reduce((sum, time) => sum + time, 0) /
                    processingTimes.length
                : 0;
            const tasksPerSecond = completedTasks.length / 60;
            await this.prismaService.performanceMetric.create({
                data: {
                    nodeId: this.nodeManagerService.getCurrentNodeId(),
                    avgProcessingTime,
                    tasksPerSecond,
                    totalTasks: completedTasks.length,
                    successfulTasks,
                    failedTasks,
                    periodStart: oneMinuteAgo,
                    periodEnd: now,
                },
            });
            this.logger.debug(`Stored performance metrics: ${avgProcessingTime.toFixed(2)}ms avg, ${tasksPerSecond.toFixed(2)} tasks/sec`);
        }
        catch (error) {
            this.logger.error('Failed to calculate and store performance metrics:', error);
        }
    }
    async getCurrentPerformanceMetrics() {
        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const metrics = await this.prismaService.performanceMetric.findMany({
                where: {
                    timestamp: {
                        gte: fiveMinutesAgo,
                    },
                },
                orderBy: {
                    timestamp: 'desc',
                },
            });
            if (metrics.length === 0) {
                return {
                    avgProcessingTime: 0,
                    tasksPerSecond: 0,
                    totalTasks: 0,
                    successfulTasks: 0,
                    failedTasks: 0,
                    timestamp: new Date(),
                };
            }
            const totalMetrics = metrics.length;
            const avgProcessingTime = metrics.reduce((sum, m) => sum + m.avgProcessingTime, 0) / totalMetrics;
            const avgTasksPerSecond = metrics.reduce((sum, m) => sum + m.tasksPerSecond, 0) / totalMetrics;
            const totalTasks = metrics.reduce((sum, m) => sum + m.totalTasks, 0);
            const successfulTasks = metrics.reduce((sum, m) => sum + m.successfulTasks, 0);
            const failedTasks = metrics.reduce((sum, m) => sum + m.failedTasks, 0);
            return {
                avgProcessingTime,
                tasksPerSecond: avgTasksPerSecond,
                totalTasks,
                successfulTasks,
                failedTasks,
                timestamp: new Date(),
            };
        }
        catch (error) {
            this.logger.error('Failed to get current performance metrics:', error);
            return {
                avgProcessingTime: 0,
                tasksPerSecond: 0,
                totalTasks: 0,
                successfulTasks: 0,
                failedTasks: 0,
                timestamp: new Date(),
            };
        }
    }
    async getHistoricalMetrics(hours = 24) {
        try {
            const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
            const metrics = await this.prismaService.performanceMetric.findMany({
                where: {
                    timestamp: {
                        gte: startTime,
                    },
                },
                orderBy: {
                    timestamp: 'asc',
                },
            });
            return metrics.map((metric) => ({
                avgProcessingTime: metric.avgProcessingTime,
                tasksPerSecond: metric.tasksPerSecond,
                totalTasks: metric.totalTasks,
                successfulTasks: metric.successfulTasks,
                failedTasks: metric.failedTasks,
                timestamp: metric.timestamp,
            }));
        }
        catch (error) {
            this.logger.error('Failed to get historical metrics:', error);
            return [];
        }
    }
    async cleanupOldMetrics() {
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const deleted = await this.prismaService.performanceMetric.deleteMany({
                where: {
                    timestamp: {
                        lt: sevenDaysAgo,
                    },
                },
            });
            this.logger.log(`Cleaned up ${deleted.count} old performance metrics`);
        }
        catch (error) {
            this.logger.error('Failed to cleanup old metrics:', error);
        }
    }
    async getSystemPerformanceSummary() {
        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const [activeNodes, metrics] = await Promise.all([
                this.nodeManagerService.getActiveNodesCount(),
                this.prismaService.performanceMetric.findMany({
                    where: {
                        timestamp: {
                            gte: oneHourAgo,
                        },
                    },
                }),
            ]);
            if (metrics.length === 0) {
                return {
                    activeNodes,
                    totalTasksLastHour: 0,
                    avgProcessingTime: 0,
                    tasksPerSecond: 0,
                    successRate: 0,
                };
            }
            const totalTasks = metrics.reduce((sum, m) => sum + m.totalTasks, 0);
            const successfulTasks = metrics.reduce((sum, m) => sum + m.successfulTasks, 0);
            const avgProcessingTime = metrics.reduce((sum, m) => sum + m.avgProcessingTime, 0) /
                metrics.length;
            const tasksPerSecond = metrics.reduce((sum, m) => sum + m.tasksPerSecond, 0) / metrics.length;
            const successRate = totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0;
            return {
                activeNodes,
                totalTasksLastHour: totalTasks,
                avgProcessingTime,
                tasksPerSecond,
                successRate,
            };
        }
        catch (error) {
            this.logger.error('Failed to get system performance summary:', error);
            return {
                activeNodes: 0,
                totalTasksLastHour: 0,
                avgProcessingTime: 0,
                tasksPerSecond: 0,
                successRate: 0,
            };
        }
    }
};
exports.PerformanceMetricsService = PerformanceMetricsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PerformanceMetricsService.prototype, "calculateAndStoreMetrics", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_MIDNIGHT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PerformanceMetricsService.prototype, "cleanupOldMetrics", null);
exports.PerformanceMetricsService = PerformanceMetricsService = PerformanceMetricsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_1.PrismaService,
        node_manager_service_1.NodeManagerService])
], PerformanceMetricsService);
//# sourceMappingURL=performance-metrics.service.js.map