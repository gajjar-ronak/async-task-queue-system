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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const coordinator_service_1 = require("../coordinator/coordinator.service");
const dead_letter_queue_service_1 = require("../core/dead-letter-queue.service");
const shared_1 = require("@distributed-async-task-worker/shared");
let HealthController = class HealthController {
    coordinatorService;
    deadLetterQueueService;
    prismaService;
    scalingEventService;
    constructor(coordinatorService, deadLetterQueueService, prismaService, scalingEventService) {
        this.coordinatorService = coordinatorService;
        this.deadLetterQueueService = deadLetterQueueService;
        this.prismaService = prismaService;
        this.scalingEventService = scalingEventService;
    }
    async getHealth() {
        try {
            await this.prismaService.$queryRaw `SELECT 1`;
            return {
                status: 'healthy',
                service: 'app-service',
                timestamp: new Date(),
                database: 'connected',
                environment: {
                    nodeEnv: process.env.NODE_ENV || 'unknown',
                    hostname: process.env.HOSTNAME || 'unknown',
                    port: process.env.APP_SERVICE_PORT || '3002',
                },
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                service: 'app-service',
                timestamp: new Date(),
                database: 'disconnected',
                error: error.message,
                environment: {
                    nodeEnv: process.env.NODE_ENV || 'unknown',
                    hostname: process.env.HOSTNAME || 'unknown',
                    port: process.env.APP_SERVICE_PORT || '3002',
                },
            };
        }
    }
    async getReadiness() {
        try {
            await this.prismaService.$queryRaw `SELECT 1`;
            return {
                ready: true,
                timestamp: new Date(),
                service: 'app-service',
            };
        }
        catch (error) {
            return {
                ready: false,
                timestamp: new Date(),
                service: 'app-service',
                error: error.message,
            };
        }
    }
    async getStats() {
        return await this.coordinatorService.getCoordinatorStats();
    }
    async getQueueStats() {
        try {
            const [pending, processing, completed, failed] = await Promise.all([
                this.prismaService.task.count({ where: { status: 'PENDING' } }),
                this.prismaService.task.count({ where: { status: 'PROCESSING' } }),
                this.prismaService.task.count({ where: { status: 'COMPLETED' } }),
                this.prismaService.task.count({ where: { status: 'FAILED' } }),
            ]);
            return {
                success: true,
                data: {
                    waiting: pending,
                    active: processing,
                    completed: completed,
                    failed: failed,
                    delayed: 0,
                },
            };
        }
        catch (error) {
            return {
                success: true,
                data: {
                    waiting: 0,
                    active: 0,
                    completed: 0,
                    failed: 0,
                    delayed: 0,
                },
            };
        }
    }
    async getDlqStats() {
        try {
            const dlqStats = await this.deadLetterQueueService.getDlqStats();
            return {
                success: true,
                data: dlqStats,
            };
        }
        catch (error) {
            return {
                success: false,
                error: 'Failed to get DLQ statistics',
            };
        }
    }
    async getScalingEvents() {
        try {
            const recentEvents = await this.scalingEventService.getRecentScalingEvents(10);
            return {
                success: true,
                data: recentEvents,
            };
        }
        catch (error) {
            return {
                success: false,
                error: 'Failed to get scaling events',
                message: error.message,
            };
        }
    }
    async getScalingStats() {
        try {
            const stats = await this.scalingEventService.getScalingStatistics();
            return {
                success: true,
                data: stats,
            };
        }
        catch (error) {
            return {
                success: false,
                error: 'Failed to get scaling statistics',
                message: error.message,
            };
        }
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getHealth", null);
__decorate([
    (0, common_1.Get)('ready'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getReadiness", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('queue'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getQueueStats", null);
__decorate([
    (0, common_1.Get)('dlq'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getDlqStats", null);
__decorate([
    (0, common_1.Get)('scaling-events'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getScalingEvents", null);
__decorate([
    (0, common_1.Get)('scaling-stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getScalingStats", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [coordinator_service_1.CoordinatorService,
        dead_letter_queue_service_1.DeadLetterQueueService,
        shared_1.PrismaService,
        shared_1.ScalingEventService])
], HealthController);
//# sourceMappingURL=health.controller.js.map