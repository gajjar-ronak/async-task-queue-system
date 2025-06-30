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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DeadLetterQueueController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeadLetterQueueController = void 0;
const common_1 = require("@nestjs/common");
const dead_letter_queue_service_1 = require("./dead-letter-queue.service");
let DeadLetterQueueController = DeadLetterQueueController_1 = class DeadLetterQueueController {
    deadLetterQueueService;
    logger = new common_1.Logger(DeadLetterQueueController_1.name);
    constructor(deadLetterQueueService) {
        this.deadLetterQueueService = deadLetterQueueService;
    }
    async getDlqStats() {
        try {
            const stats = await this.deadLetterQueueService.getDlqStats();
            return {
                success: true,
                data: stats,
            };
        }
        catch (error) {
            this.logger.error('Failed to get DLQ stats:', error);
            throw new common_1.HttpException('Failed to get DLQ statistics', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getDlqTasks(query) {
        try {
            const { page = 1, limit = 50, status, type, failureReason, sortBy = 'movedToDlqAt', sortOrder = 'desc', } = query;
            const result = await this.deadLetterQueueService.getDlqTasks({
                page: Number(page),
                limit: Number(limit),
                status,
                type,
                failureReason,
                sortBy,
                sortOrder,
            });
            return {
                success: true,
                data: result.tasks,
                pagination: result.pagination,
            };
        }
        catch (error) {
            this.logger.error('Failed to get DLQ tasks:', error);
            throw new common_1.HttpException('Failed to get DLQ tasks', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getDlqTask(dlqTaskId) {
        try {
            const task = await this.deadLetterQueueService.getDlqTask(dlqTaskId);
            return {
                success: true,
                data: task,
            };
        }
        catch (error) {
            this.logger.error(`Failed to get DLQ task ${dlqTaskId}:`, error);
            if (error.message.includes('not found')) {
                throw new common_1.HttpException('DLQ task not found', common_1.HttpStatus.NOT_FOUND);
            }
            throw new common_1.HttpException('Failed to get DLQ task', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async reprocessDlqTask(dlqTaskId, body = {}) {
        try {
            const result = await this.deadLetterQueueService.reprocessDlqTask(dlqTaskId, body.reprocessedBy);
            if (result.success) {
                return {
                    success: true,
                    message: 'DLQ task reprocessed successfully',
                    data: {
                        dlqTaskId,
                        newTaskId: result.taskId,
                    },
                };
            }
            else {
                throw new common_1.HttpException(result.error || 'Failed to reprocess DLQ task', common_1.HttpStatus.BAD_REQUEST);
            }
        }
        catch (error) {
            this.logger.error(`Failed to reprocess DLQ task ${dlqTaskId}:`, error);
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException('Failed to reprocess DLQ task', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async reprocessDlqTasks(body) {
        try {
            const { dlqTaskIds, reprocessedBy } = body;
            if (!dlqTaskIds || !Array.isArray(dlqTaskIds) || dlqTaskIds.length === 0) {
                throw new common_1.HttpException('dlqTaskIds must be a non-empty array', common_1.HttpStatus.BAD_REQUEST);
            }
            const results = await this.deadLetterQueueService.reprocessDlqTasks(dlqTaskIds, reprocessedBy);
            const successCount = results.filter((r) => r.success).length;
            const failureCount = results.length - successCount;
            return {
                success: true,
                message: `Bulk reprocessing completed: ${successCount} successful, ${failureCount} failed`,
                data: {
                    total: results.length,
                    successful: successCount,
                    failed: failureCount,
                    results,
                },
            };
        }
        catch (error) {
            this.logger.error('Failed to reprocess DLQ tasks in bulk:', error);
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException('Failed to reprocess DLQ tasks', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async archiveDlqTask(dlqTaskId, body = {}) {
        try {
            await this.deadLetterQueueService.archiveDlqTask(dlqTaskId, body.notes);
            return {
                success: true,
                message: 'DLQ task archived successfully',
            };
        }
        catch (error) {
            this.logger.error(`Failed to archive DLQ task ${dlqTaskId}:`, error);
            throw new common_1.HttpException('Failed to archive DLQ task', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updateDlqTaskNotes(dlqTaskId, body) {
        try {
            if (!body.notes) {
                throw new common_1.HttpException('Notes field is required', common_1.HttpStatus.BAD_REQUEST);
            }
            await this.deadLetterQueueService.updateDlqTaskNotes(dlqTaskId, body.notes);
            return {
                success: true,
                message: 'DLQ task notes updated successfully',
            };
        }
        catch (error) {
            this.logger.error(`Failed to update notes for DLQ task ${dlqTaskId}:`, error);
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException('Failed to update DLQ task notes', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async cleanupArchivedTasks(olderThanDays) {
        try {
            const days = olderThanDays ? parseInt(olderThanDays, 10) : 30;
            if (isNaN(days) || days < 1) {
                throw new common_1.HttpException('olderThanDays must be a positive number', common_1.HttpStatus.BAD_REQUEST);
            }
            const deletedCount = await this.deadLetterQueueService.cleanupArchivedTasks(days);
            return {
                success: true,
                message: `Cleaned up ${deletedCount} archived DLQ tasks`,
                data: {
                    deletedCount,
                    olderThanDays: days,
                },
            };
        }
        catch (error) {
            this.logger.error('Failed to cleanup archived DLQ tasks:', error);
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException('Failed to cleanup archived DLQ tasks', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getDlqTaskByOriginalId(originalTaskId) {
        try {
            const task = await this.deadLetterQueueService.getDlqTaskByOriginalId(originalTaskId);
            if (!task) {
                throw new common_1.HttpException('DLQ task not found for the given original task ID', common_1.HttpStatus.NOT_FOUND);
            }
            return {
                success: true,
                data: task,
            };
        }
        catch (error) {
            this.logger.error(`Failed to get DLQ task for original task ${originalTaskId}:`, error);
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException('Failed to get DLQ task', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.DeadLetterQueueController = DeadLetterQueueController;
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DeadLetterQueueController.prototype, "getDlqStats", null);
__decorate([
    (0, common_1.Get)('tasks'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DeadLetterQueueController.prototype, "getDlqTasks", null);
__decorate([
    (0, common_1.Get)('tasks/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DeadLetterQueueController.prototype, "getDlqTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/reprocess'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DeadLetterQueueController.prototype, "reprocessDlqTask", null);
__decorate([
    (0, common_1.Post)('tasks/reprocess-bulk'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DeadLetterQueueController.prototype, "reprocessDlqTasks", null);
__decorate([
    (0, common_1.Put)('tasks/:id/archive'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DeadLetterQueueController.prototype, "archiveDlqTask", null);
__decorate([
    (0, common_1.Put)('tasks/:id/notes'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DeadLetterQueueController.prototype, "updateDlqTaskNotes", null);
__decorate([
    (0, common_1.Delete)('cleanup'),
    __param(0, (0, common_1.Query)('olderThanDays')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DeadLetterQueueController.prototype, "cleanupArchivedTasks", null);
__decorate([
    (0, common_1.Get)('tasks/by-original/:originalTaskId'),
    __param(0, (0, common_1.Param)('originalTaskId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DeadLetterQueueController.prototype, "getDlqTaskByOriginalId", null);
exports.DeadLetterQueueController = DeadLetterQueueController = DeadLetterQueueController_1 = __decorate([
    (0, common_1.Controller)('api/dlq'),
    __metadata("design:paramtypes", [dead_letter_queue_service_1.DeadLetterQueueService])
], DeadLetterQueueController);
//# sourceMappingURL=dead-letter-queue.controller.js.map