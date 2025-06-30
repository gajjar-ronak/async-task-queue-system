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
const shared_1 = require("@distributed-async-task-worker/shared");
const worker_health_service_1 = require("../worker/worker-health.service");
const queue_manager_service_1 = require("../queue/queue-manager.service");
let HealthController = class HealthController {
    prismaService;
    workerHealthService;
    queueManagerService;
    constructor(prismaService, workerHealthService, queueManagerService) {
        this.prismaService = prismaService;
        this.workerHealthService = workerHealthService;
        this.queueManagerService = queueManagerService;
    }
    async getHealth() {
        try {
            await this.prismaService.$queryRaw `SELECT 1`;
            const redisHealthy = await this.checkRedisHealth();
            const workerStatus = await this.workerHealthService.getHealthStatus();
            return {
                status: redisHealthy ? 'healthy' : 'degraded',
                service: 'worker-service',
                timestamp: new Date(),
                database: 'connected',
                redis: redisHealthy ? 'connected' : 'disconnected',
                worker: workerStatus,
                nodeId: process.env.WORKER_NODE_ID || 'unknown',
                hostname: process.env.HOSTNAME || 'unknown',
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                service: 'worker-service',
                timestamp: new Date(),
                database: 'disconnected',
                error: error.message,
                nodeId: process.env.WORKER_NODE_ID || 'unknown',
                hostname: process.env.HOSTNAME || 'unknown',
            };
        }
    }
    async getDetailedHealth() {
        try {
            const [dbHealth, redisHealth, workerHealth, queueStats] = await Promise.all([
                this.checkDatabaseHealth(),
                this.checkRedisHealth(),
                this.workerHealthService.getDetailedHealthStatus(),
                this.getQueueStats(),
            ]);
            return {
                status: dbHealth && redisHealth ? 'healthy' : 'unhealthy',
                service: 'worker-service',
                timestamp: new Date(),
                checks: {
                    database: dbHealth,
                    redis: redisHealth,
                    worker: workerHealth,
                    queue: queueStats,
                },
                environment: {
                    nodeId: process.env.WORKER_NODE_ID || 'unknown',
                    hostname: process.env.HOSTNAME || 'unknown',
                    nodeEnv: process.env.NODE_ENV || 'unknown',
                    workerConcurrency: process.env.WORKER_CONCURRENCY || '5',
                    scalingMode: process.env.SCALING_MODE === 'true',
                },
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                service: 'worker-service',
                timestamp: new Date(),
                error: error.message,
            };
        }
    }
    async getReadiness() {
        try {
            const workerReady = await this.workerHealthService.isReady();
            const redisReady = await this.checkRedisHealth();
            return {
                ready: workerReady && redisReady,
                timestamp: new Date(),
                checks: {
                    worker: workerReady,
                    redis: redisReady,
                },
            };
        }
        catch (error) {
            return {
                ready: false,
                timestamp: new Date(),
                error: error.message,
            };
        }
    }
    async checkDatabaseHealth() {
        try {
            await this.prismaService.$queryRaw `SELECT 1`;
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async checkRedisHealth() {
        try {
            await this.queueManagerService.getQueueInfo();
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async getQueueStats() {
        try {
            return await this.queueManagerService.getQueueStats();
        }
        catch (error) {
            return {
                error: 'Failed to get queue stats',
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
    (0, common_1.Get)('detailed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getDetailedHealth", null);
__decorate([
    (0, common_1.Get)('ready'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getReadiness", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [shared_1.PrismaService,
        worker_health_service_1.WorkerHealthService,
        queue_manager_service_1.QueueManagerService])
], HealthController);
//# sourceMappingURL=health.controller.js.map