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
var DeadLetterQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeadLetterQueueService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@distributed-async-task-worker/shared");
const queue_manager_service_1 = require("../queue/queue-manager.service");
let DeadLetterQueueService = DeadLetterQueueService_1 = class DeadLetterQueueService {
    prismaService;
    queueManagerService;
    logger = new common_1.Logger(DeadLetterQueueService_1.name);
    constructor(prismaService, queueManagerService) {
        this.prismaService = prismaService;
        this.queueManagerService = queueManagerService;
    }
    async moveTaskToDlq(taskData) {
        try {
            this.logger.log(`Moving task ${taskData.originalTaskId} to Dead Letter Queue after ${taskData.attempts} failed attempts`);
            const dlqTask = await this.prismaService.deadLetterTask.create({
                data: {
                    originalTaskId: taskData.originalTaskId,
                    workflowId: taskData.workflowId,
                    name: taskData.name,
                    type: taskData.type,
                    payload: taskData.payload,
                    priority: taskData.priority,
                    attempts: taskData.attempts,
                    maxAttempts: taskData.maxAttempts,
                    lastError: taskData.lastError,
                    lastErrorStack: taskData.lastErrorStack,
                    failureReason: taskData.failureReason,
                    originalCreatedAt: taskData.originalCreatedAt,
                    firstFailedAt: taskData.firstFailedAt,
                    retryHistory: taskData.retryHistory,
                    processingMetadata: taskData.processingMetadata,
                    status: shared_1.DlqStatus.PENDING,
                },
            });
            this.logger.log(`Task ${taskData.originalTaskId} successfully moved to DLQ with ID ${dlqTask.id}`);
            return dlqTask.id;
        }
        catch (error) {
            this.logger.error(`Failed to move task ${taskData.originalTaskId} to DLQ:`, error);
            throw error;
        }
    }
    async getDlqStats() {
        try {
            const [total, pending, reprocessing, resolved, archived, tasksByType, tasksByFailureReason,] = await Promise.all([
                this.prismaService.deadLetterTask.count(),
                this.prismaService.deadLetterTask.count({
                    where: { status: shared_1.DlqStatus.PENDING },
                }),
                this.prismaService.deadLetterTask.count({
                    where: { status: shared_1.DlqStatus.REPROCESSING },
                }),
                this.prismaService.deadLetterTask.count({
                    where: { status: shared_1.DlqStatus.RESOLVED },
                }),
                this.prismaService.deadLetterTask.count({
                    where: { status: shared_1.DlqStatus.ARCHIVED },
                }),
                this.prismaService.deadLetterTask.groupBy({
                    by: ['type'],
                    _count: { type: true },
                }),
                this.prismaService.deadLetterTask.groupBy({
                    by: ['failureReason'],
                    _count: { failureReason: true },
                    where: { failureReason: { not: null } },
                }),
            ]);
            const byType = {};
            tasksByType.forEach((item) => {
                byType[item.type] = item._count.type;
            });
            const byFailureReason = {};
            tasksByFailureReason.forEach((item) => {
                if (item.failureReason) {
                    byFailureReason[item.failureReason] = item._count.failureReason;
                }
            });
            return {
                total,
                pending,
                reprocessing,
                resolved,
                archived,
                byType,
                byFailureReason,
            };
        }
        catch (error) {
            this.logger.error('Failed to get DLQ statistics:', error);
            throw error;
        }
    }
    async getDlqTasks(options = {}) {
        const { page = 1, limit = 50, status, type, failureReason, sortBy = 'movedToDlqAt', sortOrder = 'desc', } = options;
        const skip = (page - 1) * limit;
        const where = {};
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        if (failureReason)
            where.failureReason = failureReason;
        try {
            const [tasks, total] = await Promise.all([
                this.prismaService.deadLetterTask.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortOrder },
                }),
                this.prismaService.deadLetterTask.count({ where }),
            ]);
            return {
                tasks,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }
        catch (error) {
            this.logger.error('Failed to get DLQ tasks:', error);
            throw error;
        }
    }
    async getDlqTask(dlqTaskId) {
        try {
            const task = await this.prismaService.deadLetterTask.findUnique({
                where: { id: dlqTaskId },
            });
            if (!task) {
                throw new Error(`DLQ task ${dlqTaskId} not found`);
            }
            return task;
        }
        catch (error) {
            this.logger.error(`Failed to get DLQ task ${dlqTaskId}:`, error);
            throw error;
        }
    }
    async reprocessDlqTask(dlqTaskId, reprocessedBy) {
        try {
            const dlqTask = await this.getDlqTask(dlqTaskId);
            if (dlqTask.status !== shared_1.DlqStatus.PENDING) {
                throw new Error(`Cannot reprocess DLQ task ${dlqTaskId} with status ${dlqTask.status}`);
            }
            await this.prismaService.deadLetterTask.update({
                where: { id: dlqTaskId },
                data: {
                    status: shared_1.DlqStatus.REPROCESSING,
                    reprocessedAt: new Date(),
                    reprocessedBy,
                },
            });
            this.logger.log(`Reprocessing DLQ task ${dlqTaskId}`);
            const newTask = await this.prismaService.task.create({
                data: {
                    workflowId: dlqTask.workflowId,
                    name: `[REPROCESSED] ${dlqTask.name}`,
                    type: dlqTask.type,
                    payload: dlqTask.payload,
                    priority: dlqTask.priority,
                    attempts: 0,
                    maxAttempts: dlqTask.maxAttempts,
                    status: shared_1.TaskStatus.PENDING,
                },
            });
            await this.queueManagerService.addTask({
                taskId: newTask.id,
                type: newTask.type,
                data: newTask.payload,
                priority: newTask.priority,
            });
            await this.prismaService.deadLetterTask.update({
                where: { id: dlqTaskId },
                data: {
                    status: shared_1.DlqStatus.RESOLVED,
                },
            });
            this.logger.log(`DLQ task ${dlqTaskId} successfully reprocessed as new task ${newTask.id}`);
            return {
                success: true,
                taskId: newTask.id,
            };
        }
        catch (error) {
            this.logger.error(`Failed to reprocess DLQ task ${dlqTaskId}:`, error);
            try {
                await this.prismaService.deadLetterTask.update({
                    where: { id: dlqTaskId },
                    data: {
                        status: shared_1.DlqStatus.PENDING,
                        reprocessedAt: null,
                        reprocessedBy: null,
                    },
                });
            }
            catch (updateError) {
                this.logger.error(`Failed to reset DLQ task ${dlqTaskId} status after reprocessing failure:`, updateError);
            }
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async reprocessDlqTasks(dlqTaskIds, reprocessedBy) {
        const results = [];
        for (const dlqTaskId of dlqTaskIds) {
            const result = await this.reprocessDlqTask(dlqTaskId, reprocessedBy);
            results.push(result);
        }
        const successCount = results.filter((r) => r.success).length;
        this.logger.log(`Bulk reprocessing completed: ${successCount}/${dlqTaskIds.length} tasks successfully reprocessed`);
        return results;
    }
    async archiveDlqTask(dlqTaskId, notes) {
        try {
            await this.prismaService.deadLetterTask.update({
                where: { id: dlqTaskId },
                data: {
                    status: shared_1.DlqStatus.ARCHIVED,
                    notes,
                },
            });
            this.logger.log(`DLQ task ${dlqTaskId} archived`);
        }
        catch (error) {
            this.logger.error(`Failed to archive DLQ task ${dlqTaskId}:`, error);
            throw error;
        }
    }
    async cleanupArchivedTasks(olderThanDays = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
            const result = await this.prismaService.deadLetterTask.deleteMany({
                where: {
                    status: shared_1.DlqStatus.ARCHIVED,
                    movedToDlqAt: {
                        lt: cutoffDate,
                    },
                },
            });
            this.logger.log(`Cleaned up ${result.count} archived DLQ tasks older than ${olderThanDays} days`);
            return result.count;
        }
        catch (error) {
            this.logger.error('Failed to cleanup archived DLQ tasks:', error);
            throw error;
        }
    }
    async updateDlqTaskNotes(dlqTaskId, notes) {
        try {
            await this.prismaService.deadLetterTask.update({
                where: { id: dlqTaskId },
                data: { notes },
            });
            this.logger.log(`Updated notes for DLQ task ${dlqTaskId}`);
        }
        catch (error) {
            this.logger.error(`Failed to update notes for DLQ task ${dlqTaskId}:`, error);
            throw error;
        }
    }
    async getDlqTaskByOriginalId(originalTaskId) {
        try {
            return await this.prismaService.deadLetterTask.findUnique({
                where: { originalTaskId },
            });
        }
        catch (error) {
            this.logger.error(`Failed to get DLQ task for original task ${originalTaskId}:`, error);
            throw error;
        }
    }
};
exports.DeadLetterQueueService = DeadLetterQueueService;
exports.DeadLetterQueueService = DeadLetterQueueService = DeadLetterQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_1.PrismaService,
        queue_manager_service_1.QueueManagerService])
], DeadLetterQueueService);
//# sourceMappingURL=dead-letter-queue.service.js.map