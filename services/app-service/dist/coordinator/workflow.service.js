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
var WorkflowService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@distributed-async-task-worker/shared");
let WorkflowService = WorkflowService_1 = class WorkflowService {
    prismaService;
    logger = new common_1.Logger(WorkflowService_1.name);
    constructor(prismaService) {
        this.prismaService = prismaService;
    }
    async createWorkflow(dto) {
        try {
            const workflow = await this.prismaService.workflow.create({
                data: {
                    name: dto.name,
                    description: dto.description,
                    tasks: {
                        create: dto.tasks.map((task) => ({
                            name: task.name,
                            type: task.type,
                            payload: task.payload || {},
                            priority: task.priority || 0,
                            delay: task.delay || 0,
                            maxAttempts: task.maxAttempts || 3,
                            status: shared_1.TaskStatus.PENDING,
                        })),
                    },
                },
                include: {
                    tasks: true,
                },
            });
            this.logger.log(`Created workflow ${workflow.id} with ${workflow.tasks.length} tasks`);
            return workflow;
        }
        catch (error) {
            this.logger.error('Failed to create workflow:', error);
            throw error;
        }
    }
    async getWorkflow(workflowId) {
        return await this.prismaService.workflow.findUnique({
            where: { id: workflowId },
            include: {
                tasks: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
    }
    async listWorkflows(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [workflows, total] = await Promise.all([
            this.prismaService.workflow.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: { tasks: true },
                    },
                },
            }),
            this.prismaService.workflow.count(),
        ]);
        return {
            workflows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }
    async getWorkflowStatus(workflowId) {
        const workflow = await this.prismaService.workflow.findUnique({
            where: { id: workflowId },
            include: {
                tasks: true,
            },
        });
        if (!workflow) {
            throw new Error('Workflow not found');
        }
        const taskCounts = workflow.tasks.reduce((acc, task) => {
            acc[task.status] = (acc[task.status] || 0) + 1;
            return acc;
        }, {});
        const totalTasks = workflow.tasks.length;
        const completedTasks = taskCounts[shared_1.TaskStatus.COMPLETED] || 0;
        const failedTasks = taskCounts[shared_1.TaskStatus.FAILED] || 0;
        const processingTasks = taskCounts[shared_1.TaskStatus.PROCESSING] || 0;
        const pendingTasks = taskCounts[shared_1.TaskStatus.PENDING] || 0;
        let status = 'pending';
        if (completedTasks === totalTasks) {
            status = 'completed';
        }
        else if (failedTasks > 0 && completedTasks + failedTasks === totalTasks) {
            status = 'failed';
        }
        else if (processingTasks > 0 || pendingTasks < totalTasks) {
            status = 'running';
        }
        return {
            workflowId,
            status,
            progress: {
                total: totalTasks,
                completed: completedTasks,
                failed: failedTasks,
                processing: processingTasks,
                pending: pendingTasks,
                percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            },
            taskCounts,
            createdAt: workflow.createdAt,
            updatedAt: workflow.updatedAt,
        };
    }
    async pauseWorkflow(workflowId) {
        await this.prismaService.workflow.update({
            where: { id: workflowId },
            data: { isActive: false },
        });
        await this.prismaService.task.updateMany({
            where: {
                workflowId,
                status: shared_1.TaskStatus.PENDING,
            },
            data: {
                status: shared_1.TaskStatus.CANCELLED,
                updatedAt: new Date(),
            },
        });
        this.logger.log(`Workflow ${workflowId} paused`);
    }
    async resumeWorkflow(workflowId) {
        await this.prismaService.workflow.update({
            where: { id: workflowId },
            data: { isActive: true },
        });
        await this.prismaService.task.updateMany({
            where: {
                workflowId,
                status: shared_1.TaskStatus.CANCELLED,
            },
            data: {
                status: shared_1.TaskStatus.PENDING,
                updatedAt: new Date(),
            },
        });
        this.logger.log(`Workflow ${workflowId} resumed`);
    }
    async deleteWorkflow(workflowId) {
        await this.prismaService.workflow.delete({
            where: { id: workflowId },
        });
        this.logger.log(`Workflow ${workflowId} deleted`);
    }
    async retryFailedTasks(workflowId) {
        const updatedTasks = await this.prismaService.task.updateMany({
            where: {
                workflowId,
                status: shared_1.TaskStatus.FAILED,
                attempts: {
                    lt: this.prismaService.task.fields.maxAttempts,
                },
            },
            data: {
                status: shared_1.TaskStatus.PENDING,
                updatedAt: new Date(),
            },
        });
        this.logger.log(`Retried ${updatedTasks.count} failed tasks in workflow ${workflowId}`);
    }
};
exports.WorkflowService = WorkflowService;
exports.WorkflowService = WorkflowService = WorkflowService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_1.PrismaService])
], WorkflowService);
//# sourceMappingURL=workflow.service.js.map