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
var QueueManagerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueManagerService = void 0;
const common_1 = require("@nestjs/common");
const bull_1 = require("@nestjs/bull");
const config_1 = require("@nestjs/config");
let QueueManagerService = QueueManagerService_1 = class QueueManagerService {
    taskQueue;
    configService;
    logger = new common_1.Logger(QueueManagerService_1.name);
    constructor(taskQueue, configService) {
        this.taskQueue = taskQueue;
        this.configService = configService;
    }
    async addTask(payload) {
        try {
            const job = await this.taskQueue.add('process-task', payload, {
                priority: payload.priority || 0,
                delay: payload.delay || 0,
                attempts: payload.attempts || 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: this.configService.get('QUEUE_REMOVE_ON_COMPLETE', 100),
                removeOnFail: this.configService.get('QUEUE_REMOVE_ON_FAIL', 50),
            });
            this.logger.log(`Task ${payload.taskId} added to queue with job ID: ${job.id}`);
            return job;
        }
        catch (error) {
            this.logger.error(`Failed to add task ${payload.taskId} to queue:`, error);
            throw error;
        }
    }
    async addBulkTasks(payloads) {
        try {
            const jobs = await this.taskQueue.addBulk(payloads.map((payload) => ({
                name: 'process-task',
                data: payload,
                opts: {
                    priority: payload.priority || 0,
                    delay: payload.delay || 0,
                    attempts: payload.attempts || 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                },
            })));
            this.logger.log(`Added ${jobs.length} tasks to queue`);
            return jobs;
        }
        catch (error) {
            this.logger.error('Failed to add bulk tasks to queue:', error);
            throw error;
        }
    }
    async getQueueStats() {
        const waiting = await this.taskQueue.getWaiting();
        const active = await this.taskQueue.getActive();
        const completed = await this.taskQueue.getCompleted();
        const failed = await this.taskQueue.getFailed();
        const delayed = await this.taskQueue.getDelayed();
        return {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            delayed: delayed.length,
        };
    }
    async getQueueInfo() {
        try {
            const stats = await this.getQueueStats();
            const queueHealth = await this.taskQueue.getJobCounts();
            return {
                name: this.taskQueue.name,
                stats,
                health: queueHealth,
                isPaused: await this.taskQueue.isPaused(),
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            this.logger.error('Failed to get queue info:', error);
            throw error;
        }
    }
    async pauseQueue() {
        await this.taskQueue.pause();
        this.logger.log('Queue paused');
    }
    async resumeQueue() {
        await this.taskQueue.resume();
        this.logger.log('Queue resumed');
    }
    async cleanQueue() {
        await this.taskQueue.clean(5000, 'completed');
        await this.taskQueue.clean(5000, 'failed');
        this.logger.log('Queue cleaned');
    }
    async removeJob(jobId) {
        const job = await this.taskQueue.getJob(jobId);
        if (job) {
            await job.remove();
            this.logger.log(`Job ${jobId} removed from queue`);
        }
    }
    async retryFailedJobs() {
        const failedJobs = await this.taskQueue.getFailed();
        for (const job of failedJobs) {
            await job.retry();
        }
        this.logger.log(`Retried ${failedJobs.length} failed jobs`);
    }
};
exports.QueueManagerService = QueueManagerService;
exports.QueueManagerService = QueueManagerService = QueueManagerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bull_1.InjectQueue)('task-queue')),
    __metadata("design:paramtypes", [Object, config_1.ConfigService])
], QueueManagerService);
//# sourceMappingURL=queue-manager.service.js.map