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
var CoordinatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoordinatorService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const shared_1 = require("@distributed-async-task-worker/shared");
let CoordinatorService = CoordinatorService_1 = class CoordinatorService {
    prismaService;
    logger = new common_1.Logger(CoordinatorService_1.name);
    constructor(prismaService) {
        this.prismaService = prismaService;
    }
    async onModuleInit() {
        this.logger.log('App Service Coordinator initializing...');
        await this.initializeCoordinator();
    }
    async initializeCoordinator() {
        try {
            await this.resetStuckTasks();
            this.logger.log('App Service Coordinator initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize coordinator:', error);
        }
    }
    async monitorSystemHealth() {
        try {
            const stats = await this.getCoordinatorStats();
            this.logger.debug(`System stats: ${JSON.stringify(stats)}`);
        }
        catch (error) {
            this.logger.error('Failed to monitor system health:', error);
        }
    }
    async resetStuckTasks() {
        try {
            const stuckTasks = await this.prismaService.task.findMany({
                where: {
                    status: shared_1.TaskStatus.PROCESSING,
                    updatedAt: {
                        lt: new Date(Date.now() - 10 * 60 * 1000),
                    },
                },
            });
            if (stuckTasks.length > 0) {
                await this.prismaService.task.updateMany({
                    where: {
                        id: {
                            in: stuckTasks.map(task => task.id),
                        },
                    },
                    data: {
                        status: shared_1.TaskStatus.PENDING,
                        updatedAt: new Date(),
                    },
                });
                this.logger.log(`Reset ${stuckTasks.length} stuck tasks to PENDING`);
            }
        }
        catch (error) {
            this.logger.error('Failed to reset stuck tasks:', error);
        }
    }
    async getCoordinatorStats() {
        try {
            const [totalTasks, pendingTasks, processingTasks, completedTasks, failedTasks, totalWorkflows, activeWorkflows,] = await Promise.all([
                this.prismaService.task.count(),
                this.prismaService.task.count({ where: { status: shared_1.TaskStatus.PENDING } }),
                this.prismaService.task.count({ where: { status: shared_1.TaskStatus.PROCESSING } }),
                this.prismaService.task.count({ where: { status: shared_1.TaskStatus.COMPLETED } }),
                this.prismaService.task.count({ where: { status: shared_1.TaskStatus.FAILED } }),
                this.prismaService.workflow.count(),
                this.prismaService.workflow.count({ where: { isActive: true } }),
            ]);
            return {
                tasks: {
                    total: totalTasks,
                    pending: pendingTasks,
                    processing: processingTasks,
                    completed: completedTasks,
                    failed: failedTasks,
                },
                workflows: {
                    total: totalWorkflows,
                    active: activeWorkflows,
                },
                timestamp: new Date(),
            };
        }
        catch (error) {
            this.logger.error('Failed to get coordinator stats:', error);
            throw error;
        }
    }
};
exports.CoordinatorService = CoordinatorService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_5_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CoordinatorService.prototype, "monitorSystemHealth", null);
exports.CoordinatorService = CoordinatorService = CoordinatorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_1.PrismaService])
], CoordinatorService);
//# sourceMappingURL=coordinator.service.js.map