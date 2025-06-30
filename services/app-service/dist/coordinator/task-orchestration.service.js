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
var TaskOrchestrationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskOrchestrationService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@distributed-async-task-worker/shared");
let TaskOrchestrationService = TaskOrchestrationService_1 = class TaskOrchestrationService {
    prismaService;
    logger = new common_1.Logger(TaskOrchestrationService_1.name);
    constructor(prismaService) {
        this.prismaService = prismaService;
    }
    async createTask(data) {
        try {
            const task = await this.prismaService.task.create({
                data: {
                    workflowId: data.workflowId,
                    name: data.name || `${data.type}-task-${Date.now()}`,
                    type: data.type,
                    payload: data.payload || {},
                    priority: typeof data.priority === 'string'
                        ? this.convertPriorityToNumber(data.priority)
                        : data.priority || 0,
                    delay: data.delay || 0,
                    maxAttempts: data.maxAttempts || 3,
                    status: shared_1.TaskStatus.PENDING,
                },
            });
            this.logger.log(`Created task ${task.id} of type ${task.type}`);
            return task;
        }
        catch (error) {
            this.logger.error('Failed to create task:', error);
            throw error;
        }
    }
    async getTask(taskId) {
        return await this.prismaService.task.findUnique({
            where: { id: taskId },
            include: {
                workflow: true,
                logs: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });
    }
    async listTasks(filters = {}) {
        const { page = 1, limit = 10, ...where } = filters;
        const skip = (page - 1) * limit;
        const [tasks, total] = await Promise.all([
            this.prismaService.task.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    workflow: {
                        select: { id: true, name: true },
                    },
                },
            }),
            this.prismaService.task.count({ where }),
        ]);
        return {
            tasks,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }
    async updateTaskStatus(taskId, status, metadata) {
        const updateData = {
            status,
            updatedAt: new Date(),
        };
        if (status === shared_1.TaskStatus.PROCESSING) {
            updateData.startedAt = new Date();
        }
        else if (status === shared_1.TaskStatus.COMPLETED) {
            updateData.completedAt = new Date();
        }
        await this.prismaService.task.update({
            where: { id: taskId },
            data: updateData,
        });
        await this.prismaService.taskLog.create({
            data: {
                taskId,
                level: 'INFO',
                message: `Task status changed to ${status}`,
                metadata: metadata ? JSON.stringify(metadata) : undefined,
            },
        });
        this.logger.log(`Task ${taskId} status updated to ${status}`);
    }
    async retryTask(taskId) {
        const task = await this.prismaService.task.findUnique({
            where: { id: taskId },
        });
        if (!task) {
            throw new Error('Task not found');
        }
        if (task.attempts >= task.maxAttempts) {
            throw new Error('Task has exceeded maximum retry attempts');
        }
        await this.prismaService.task.update({
            where: { id: taskId },
            data: {
                status: shared_1.TaskStatus.PENDING,
                updatedAt: new Date(),
            },
        });
        await this.prismaService.taskLog.create({
            data: {
                taskId,
                level: 'INFO',
                message: 'Task manually retried',
            },
        });
        this.logger.log(`Task ${taskId} manually retried`);
    }
    async cancelTask(taskId) {
        await this.prismaService.task.update({
            where: { id: taskId },
            data: {
                status: shared_1.TaskStatus.CANCELLED,
                updatedAt: new Date(),
            },
        });
        await this.prismaService.taskLog.create({
            data: {
                taskId,
                level: 'INFO',
                message: 'Task cancelled',
            },
        });
        this.logger.log(`Task ${taskId} cancelled`);
    }
    async getTaskLogs(taskId, page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        const [logs, total] = await Promise.all([
            this.prismaService.taskLog.findMany({
                where: { taskId },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prismaService.taskLog.count({ where: { taskId } }),
        ]);
        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }
    async getTaskStats() {
        const [totalTasks, pendingTasks, processingTasks, completedTasks, cancelledTasks, retryingTasks, queuedTasks, permanentlyFailedTasks,] = await Promise.all([
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
            this.prismaService.task.count({
                where: { status: shared_1.TaskStatus.RETRYING },
            }),
            this.prismaService.task.count({
                where: { status: shared_1.TaskStatus.QUEUED },
            }),
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
        const effectivelyCompletedTasks = completedTasks;
        const effectivelyFailedTasks = permanentlyFailedTasks;
        const finishedTasks = effectivelyCompletedTasks + effectivelyFailedTasks;
        const taskTypeStats = await this.getTaskTypeStatistics();
        return {
            total: totalTasks,
            pending: pendingTasks,
            processing: processingTasks,
            queued: queuedTasks,
            retrying: retryingTasks,
            completed: effectivelyCompletedTasks,
            failed: effectivelyFailedTasks,
            cancelled: cancelledTasks,
            successRate: finishedTasks > 0
                ? Math.round((effectivelyCompletedTasks / finishedTasks) * 100)
                : 0,
            taskTypeStats,
        };
    }
    async getTaskTypeStatistics() {
        const tasks = await this.prismaService.task.findMany({
            select: {
                name: true,
                type: true,
                workflowId: true,
                payload: true,
            },
        });
        const typeStats = {};
        const branchingStats = {
            branchingTasks: 0,
            dependentTasks: 0,
            workflowTasks: 0,
            regularTasks: 0,
        };
        tasks.forEach((task) => {
            typeStats[task.type] = (typeStats[task.type] || 0) + 1;
            const taskName = task.name || '';
            const payload = task.payload || {};
            if (taskName.includes('Branch ') ||
                taskName.includes('Parallel Task') ||
                taskName.includes('Conditional') ||
                payload.conditionalBranch === true ||
                payload.branchType === 'main' ||
                payload.branchType === 'follow-up' ||
                payload.parallelExecution === true ||
                payload.parallelGroup !== undefined) {
                branchingStats.branchingTasks++;
            }
            else if (taskName.includes('Chain Step') ||
                taskName.includes('Step ') ||
                payload.chainStep !== undefined ||
                payload.dependsOn !== null ||
                payload.totalSteps !== undefined) {
                branchingStats.dependentTasks++;
            }
            else if (task.workflowId) {
                branchingStats.workflowTasks++;
            }
            else {
                branchingStats.regularTasks++;
            }
        });
        return {
            byType: typeStats,
            branchingStats,
        };
    }
    async getRecentBranchingAndDependentTasks(page = 1, limit = 5) {
        const tasks = await this.prismaService.task.findMany({
            select: {
                id: true,
                name: true,
                type: true,
                status: true,
                priority: true,
                workflowId: true,
                payload: true,
                createdAt: true,
                completedAt: true,
                attempts: true,
                maxAttempts: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 200,
        });
        const branchingTasks = [];
        const dependentTasks = [];
        const dependentTasksByWorkflow = new Map();
        tasks.forEach((task) => {
            const taskName = task.name || '';
            const payload = task.payload || {};
            if (taskName.includes('Branch ') ||
                taskName.includes('Parallel Task') ||
                taskName.includes('Conditional') ||
                payload.conditionalBranch === true ||
                payload.branchType === 'main' ||
                payload.branchType === 'follow-up' ||
                payload.parallelExecution === true ||
                payload.parallelGroup !== undefined) {
                branchingTasks.push({
                    ...task,
                    category: 'branching',
                    branchingType: this.getBranchingType(taskName, payload),
                    branchingDetails: this.getBranchingDetails(taskName, payload),
                });
            }
            else if (taskName.includes('Chain Step') ||
                taskName.includes('Step ') ||
                payload.chainStep !== undefined ||
                payload.dependsOn !== null ||
                payload.totalSteps !== undefined) {
                const workflowId = task.workflowId || 'no-workflow';
                if (!dependentTasksByWorkflow.has(workflowId)) {
                    dependentTasksByWorkflow.set(workflowId, []);
                }
                dependentTasksByWorkflow.get(workflowId).push({
                    ...task,
                    category: 'dependent',
                    dependencyInfo: this.getDependencyInfo(taskName, payload),
                    dependencyDetails: this.getDependencyDetails(taskName, payload),
                });
            }
        });
        dependentTasksByWorkflow.forEach((tasks, workflowId) => {
            tasks.sort((a, b) => {
                const aStep = a.payload?.chainStep || 0;
                const bStep = b.payload?.chainStep || 0;
                return aStep - bStep;
            });
            dependentTasks.push(...tasks);
        });
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedBranchingTasks = branchingTasks.slice(startIndex, endIndex);
        const paginatedDependentTasks = dependentTasks.slice(startIndex, endIndex);
        return {
            branchingTasks: paginatedBranchingTasks,
            dependentTasks: paginatedDependentTasks,
            pagination: {
                branchingTasks: {
                    currentPage: page,
                    totalItems: branchingTasks.length,
                    totalPages: Math.ceil(branchingTasks.length / limit),
                    hasNext: endIndex < branchingTasks.length,
                    hasPrev: page > 1,
                },
                dependentTasks: {
                    currentPage: page,
                    totalItems: dependentTasks.length,
                    totalPages: Math.ceil(dependentTasks.length / limit),
                    hasNext: endIndex < dependentTasks.length,
                    hasPrev: page > 1,
                },
            },
        };
    }
    getBranchingType(taskName, payload) {
        if (taskName.includes('Parallel Task'))
            return 'Parallel Execution';
        if (taskName.includes('Branch '))
            return 'Branching Workflow';
        if (taskName.includes('Conditional'))
            return 'Conditional Branch';
        if (payload.parallelExecution)
            return 'Parallel Execution';
        if (payload.conditionalBranch)
            return 'Conditional Branch';
        return 'Branching Task';
    }
    getBranchingDetails(taskName, payload) {
        if (payload.parallelExecution) {
            return {
                type: 'parallel',
                parallelGroup: payload.parallelGroup,
                parallelIndex: payload.parallelIndex,
                totalParallel: payload.totalParallel,
                description: `Task ${payload.parallelIndex} of ${payload.totalParallel} in parallel group ${payload.parallelGroup}`,
            };
        }
        if (taskName.includes('Branch ')) {
            const match = taskName.match(/Branch (\d+)/);
            return {
                type: 'branch',
                branchNumber: match ? parseInt(match[1]) : 1,
                description: `Branch ${match ? match[1] : '1'} in workflow`,
            };
        }
        if (payload.conditionalBranch) {
            return {
                type: 'conditional',
                condition: payload.condition || 'unknown',
                description: `Conditional branch based on ${payload.condition || 'unknown'} condition`,
            };
        }
        return {
            type: 'unknown',
            description: 'Branching task',
        };
    }
    getDependencyInfo(taskName, payload) {
        if (taskName.includes('Chain Step')) {
            const match = taskName.match(/Chain Step (\d+)/);
            if (match) {
                return `Step ${match[1]} of Chain`;
            }
        }
        if (payload.chainStep && payload.totalSteps) {
            return `Step ${payload.chainStep} of ${payload.totalSteps}`;
        }
        if (payload.dependsOn) {
            return `Depends on: ${payload.dependsOn}`;
        }
        return 'Sequential Task';
    }
    getDependencyDetails(taskName, payload) {
        if (payload.chainStep && payload.totalSteps) {
            const previousStep = payload.chainStep > 1 ? payload.chainStep - 1 : null;
            const nextStep = payload.chainStep < payload.totalSteps ? payload.chainStep + 1 : null;
            return {
                chainStep: payload.chainStep,
                totalSteps: payload.totalSteps,
                dependsOn: payload.dependsOn,
                previousStep: previousStep ? `Chain Step ${previousStep}` : null,
                nextStep: nextStep ? `Chain Step ${nextStep}` : null,
                isFirst: payload.chainStep === 1,
                isLast: payload.chainStep === payload.totalSteps,
                description: `Step ${payload.chainStep} of ${payload.totalSteps}${payload.dependsOn ? ` (depends on: ${payload.dependsOn})` : ''}`,
            };
        }
        return {
            description: 'Dependent task',
        };
    }
    convertPriorityToNumber(priority) {
        switch (priority.toLowerCase()) {
            case 'high':
                return 3;
            case 'medium':
                return 2;
            case 'low':
                return 1;
            default:
                return 0;
        }
    }
};
exports.TaskOrchestrationService = TaskOrchestrationService;
exports.TaskOrchestrationService = TaskOrchestrationService = TaskOrchestrationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_1.PrismaService])
], TaskOrchestrationService);
//# sourceMappingURL=task-orchestration.service.js.map