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
var StressTestService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StressTestService = void 0;
const common_1 = require("@nestjs/common");
const task_orchestration_service_1 = require("../coordinator/task-orchestration.service");
const workflow_service_1 = require("../coordinator/workflow.service");
let StressTestService = StressTestService_1 = class StressTestService {
    taskOrchestrationService;
    workflowService;
    logger = new common_1.Logger(StressTestService_1.name);
    activeSessions = new Map();
    intervals = new Map();
    TASK_TYPES = [
        "api-call",
        "database-operation",
        "file-processing",
        "email-send",
        "data-transformation",
    ];
    BRANCHING_TASK_TYPES = [
        "branching-workflow",
        "dependent-task-chain",
        "conditional-branch",
        "parallel-execution",
    ];
    constructor(taskOrchestrationService, workflowService) {
        this.taskOrchestrationService = taskOrchestrationService;
        this.workflowService = workflowService;
    }
    async startStressTest(config) {
        const testId = this.generateTestId();
        const totalTasks = Number(config.totalTasks);
        const durationMinutes = Number(config.durationMinutes);
        const priorityDistribution = config.priorityDistribution || {
            high: 30,
            medium: 50,
            low: 20,
        };
        const highPriority = Number(priorityDistribution.high);
        const mediumPriority = Number(priorityDistribution.medium);
        const lowPriority = Number(priorityDistribution.low);
        this.logger.log(`Received config: totalTasks=${totalTasks}, durationMinutes=${durationMinutes}, priorities=[${highPriority}, ${mediumPriority}, ${lowPriority}]`);
        if (isNaN(totalTasks) ||
            isNaN(durationMinutes) ||
            totalTasks <= 0 ||
            durationMinutes <= 0) {
            throw new Error("Invalid configuration: totalTasks and durationMinutes must be positive numbers");
        }
        const totalPercentage = highPriority + mediumPriority + lowPriority;
        if (Math.abs(totalPercentage - 100) > 0.1) {
            throw new Error("Priority distribution must sum to 100%");
        }
        const taskTypes = config.taskTypes && config.taskTypes.length > 0
            ? config.taskTypes
            : this.TASK_TYPES;
        const normalizedConfig = {
            totalTasks,
            durationMinutes,
            taskTypes,
            priorityDistribution: {
                high: highPriority,
                medium: mediumPriority,
                low: lowPriority,
            },
        };
        const session = {
            id: testId,
            config: normalizedConfig,
            startTime: new Date(),
            status: "running",
            tasksCreated: 0,
            tasksCompleted: 0,
            tasksFailed: 0,
            priorityStats: { high: 0, medium: 0, low: 0 },
            taskTypeStats: {},
            branchingStats: {
                branchingTasks: 0,
                dependentTasks: 0,
                workflowTasks: 0,
                regularTasks: 0,
            },
            createdTaskIds: [],
            createdWorkflowIds: [],
        };
        this.activeSessions.set(testId, session);
        this.startTaskCreation(session);
        this.logger.log(`Started stress test ${testId} with ${totalTasks} tasks over ${durationMinutes} minutes`);
        return {
            testId,
            message: `Stress test started successfully. Will create ${totalTasks} tasks over ${durationMinutes} minutes.`,
        };
    }
    startTaskCreation(session) {
        const { totalTasks, durationMinutes, taskTypes, priorityDistribution } = session.config;
        const intervalMs = (durationMinutes * 60 * 1000) / totalTasks;
        let tasksCreated = 0;
        const interval = setInterval(async () => {
            if (tasksCreated >= totalTasks || session.status !== "running") {
                clearInterval(interval);
                this.intervals.delete(session.id);
                if (session.status === "running") {
                    session.status = "completed";
                    session.endTime = new Date();
                    this.logger.log(`Stress test ${session.id} completed. Created ${tasksCreated} tasks.`);
                }
                return;
            }
            try {
                const priority = this.determinePriority(priorityDistribution);
                const shouldCreateAdvancedTask = Math.random() < 0.1;
                if (shouldCreateAdvancedTask) {
                    await this.createAdvancedTask(session, priority, tasksCreated + 1);
                }
                else {
                    const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
                    const payload = this.generateTaskPayload(taskType);
                    const task = await this.taskOrchestrationService.createTask({
                        name: `Stress Test Task ${tasksCreated + 1}`,
                        type: taskType,
                        payload,
                        priority,
                        maxAttempts: 3,
                    });
                    session.createdTaskIds.push(task.id);
                    session.taskTypeStats[taskType] =
                        (session.taskTypeStats[taskType] || 0) + 1;
                    session.branchingStats.regularTasks++;
                }
                session.tasksCreated++;
                if (priority >= 8)
                    session.priorityStats.high++;
                else if (priority >= 4)
                    session.priorityStats.medium++;
                else
                    session.priorityStats.low++;
                tasksCreated++;
            }
            catch (error) {
                this.logger.error(`Error creating stress test task: ${error.message}`);
                session.tasksFailed++;
            }
        }, intervalMs);
        this.intervals.set(session.id, interval);
    }
    determinePriority(distribution) {
        const random = Math.random() * 100;
        if (random < distribution.high) {
            return Math.floor(Math.random() * 3) + 8;
        }
        else if (random < distribution.high + distribution.medium) {
            return Math.floor(Math.random() * 4) + 4;
        }
        else {
            return Math.floor(Math.random() * 4);
        }
    }
    generateTaskPayload(taskType) {
        const basePayload = {
            timestamp: new Date().toISOString(),
            stressTest: true,
        };
        switch (taskType) {
            case "api-call":
                return {
                    ...basePayload,
                    url: `https://api.example.com/orders/${Math.random().toString(36).substr(2, 9)}`,
                    method: ["GET", "POST", "PUT"][Math.floor(Math.random() * 3)],
                    headers: { "Content-Type": "application/json" },
                    body: { orderId: Math.random().toString(36).substr(2, 9) },
                };
            case "database-operation":
                return {
                    ...basePayload,
                    operation: ["SELECT", "INSERT", "UPDATE"][Math.floor(Math.random() * 3)],
                    table: ["orders", "products", "customers"][Math.floor(Math.random() * 3)],
                    data: { id: Math.floor(Math.random() * 1000) },
                };
            case "file-processing":
                return {
                    ...basePayload,
                    filename: `file_${Math.random().toString(36).substr(2, 8)}.csv`,
                    operation: ["process", "validate", "transform"][Math.floor(Math.random() * 3)],
                    size: Math.floor(Math.random() * 1000000) + 1000,
                };
            case "email-send":
                return {
                    ...basePayload,
                    recipient: `user${Math.floor(Math.random() * 1000)}@example.com`,
                    subject: `Stress Test Email ${Math.random().toString(36).substr(2, 6)}`,
                    template: ["welcome", "order_confirmation", "newsletter"][Math.floor(Math.random() * 3)],
                };
            case "data-transformation":
                return {
                    ...basePayload,
                    inputFormat: ["json", "csv", "xml"][Math.floor(Math.random() * 3)],
                    outputFormat: ["json", "csv", "xml"][Math.floor(Math.random() * 3)],
                    recordCount: Math.floor(Math.random() * 10000) + 100,
                };
            default:
                return basePayload;
        }
    }
    generateTestId() {
        return `stress-test-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    }
    async createAdvancedTask(session, priority, taskNumber) {
        const branchingType = this.BRANCHING_TASK_TYPES[Math.floor(Math.random() * this.BRANCHING_TASK_TYPES.length)];
        switch (branchingType) {
            case "branching-workflow":
                await this.createBranchingWorkflow(session, priority, taskNumber);
                break;
            case "dependent-task-chain":
                await this.createDependentTaskChain(session, priority, taskNumber);
                break;
            case "conditional-branch":
                await this.createConditionalBranch(session, priority, taskNumber);
                break;
            case "parallel-execution":
                await this.createParallelExecution(session, priority, taskNumber);
                break;
        }
    }
    async createBranchingWorkflow(session, priority, taskNumber) {
        const branchCount = Math.floor(Math.random() * 3) + 2;
        const tasks = [];
        for (let i = 0; i < branchCount; i++) {
            const taskType = this.TASK_TYPES[Math.floor(Math.random() * this.TASK_TYPES.length)];
            tasks.push({
                name: `Branch ${i + 1} - ${taskType}`,
                type: taskType,
                payload: this.generateTaskPayload(taskType),
                priority,
                maxAttempts: 3,
            });
        }
        const workflow = await this.workflowService.createWorkflow({
            name: `Branching Workflow ${taskNumber}`,
            description: `Stress test branching workflow with ${branchCount} parallel branches`,
            tasks,
        });
        session.createdWorkflowIds.push(workflow.id);
        session.taskTypeStats["branching-workflow"] =
            (session.taskTypeStats["branching-workflow"] || 0) + 1;
        session.branchingStats.branchingTasks++;
        session.branchingStats.workflowTasks++;
        this.logger.log(`Created branching workflow ${workflow.id} with ${branchCount} branches`);
    }
    async createDependentTaskChain(session, priority, taskNumber) {
        const chainLength = Math.floor(Math.random() * 3) + 2;
        const tasks = [];
        for (let i = 0; i < chainLength; i++) {
            const taskType = this.TASK_TYPES[Math.floor(Math.random() * this.TASK_TYPES.length)];
            tasks.push({
                name: `Chain Step ${i + 1} - ${taskType}`,
                type: taskType,
                payload: {
                    ...this.generateTaskPayload(taskType),
                    chainStep: i + 1,
                    totalSteps: chainLength,
                    dependsOn: i > 0 ? `Chain Step ${i}` : null,
                },
                priority,
                delay: i * 1000,
                maxAttempts: 3,
            });
        }
        const workflow = await this.workflowService.createWorkflow({
            name: `Dependent Task Chain ${taskNumber}`,
            description: `Stress test dependent task chain with ${chainLength} sequential tasks`,
            tasks,
        });
        session.createdWorkflowIds.push(workflow.id);
        session.taskTypeStats["dependent-task-chain"] =
            (session.taskTypeStats["dependent-task-chain"] || 0) + 1;
        session.branchingStats.dependentTasks++;
        session.branchingStats.workflowTasks++;
        this.logger.log(`Created dependent task chain ${workflow.id} with ${chainLength} tasks`);
    }
    async createConditionalBranch(session, priority, taskNumber) {
        const condition = Math.random() > 0.5 ? "success" : "failure";
        const taskType = this.TASK_TYPES[Math.floor(Math.random() * this.TASK_TYPES.length)];
        const mainTask = await this.taskOrchestrationService.createTask({
            name: `Conditional Main Task ${taskNumber}`,
            type: taskType,
            payload: {
                ...this.generateTaskPayload(taskType),
                conditionalBranch: true,
                condition,
                branchType: "main",
            },
            priority,
            maxAttempts: 3,
        });
        const followUpTasks = condition === "success" ? 2 : 1;
        for (let i = 0; i < followUpTasks; i++) {
            const followUpType = this.TASK_TYPES[Math.floor(Math.random() * this.TASK_TYPES.length)];
            const followUpTask = await this.taskOrchestrationService.createTask({
                name: `Conditional Follow-up ${i + 1} - ${taskNumber}`,
                type: followUpType,
                payload: {
                    ...this.generateTaskPayload(followUpType),
                    conditionalBranch: true,
                    condition,
                    branchType: "followup",
                    parentTaskId: mainTask.id,
                },
                priority,
                delay: 2000,
                maxAttempts: 3,
            });
            session.createdTaskIds.push(followUpTask.id);
        }
        session.createdTaskIds.push(mainTask.id);
        session.taskTypeStats["conditional-branch"] =
            (session.taskTypeStats["conditional-branch"] || 0) + 1;
        session.branchingStats.branchingTasks++;
        this.logger.log(`Created conditional branch ${mainTask.id} with condition: ${condition}`);
    }
    async createParallelExecution(session, priority, taskNumber) {
        const parallelCount = Math.floor(Math.random() * 4) + 2;
        const tasks = [];
        for (let i = 0; i < parallelCount; i++) {
            const taskType = this.TASK_TYPES[Math.floor(Math.random() * this.TASK_TYPES.length)];
            tasks.push({
                name: `Parallel Task ${i + 1} - ${taskNumber}`,
                type: taskType,
                payload: {
                    ...this.generateTaskPayload(taskType),
                    parallelExecution: true,
                    parallelGroup: taskNumber,
                    parallelIndex: i + 1,
                    totalParallel: parallelCount,
                },
                priority,
                maxAttempts: 3,
            });
        }
        const workflow = await this.workflowService.createWorkflow({
            name: `Parallel Execution ${taskNumber}`,
            description: `Stress test parallel execution with ${parallelCount} concurrent tasks`,
            tasks,
        });
        session.createdWorkflowIds.push(workflow.id);
        session.taskTypeStats["parallel-execution"] =
            (session.taskTypeStats["parallel-execution"] || 0) + 1;
        session.branchingStats.branchingTasks++;
        session.branchingStats.workflowTasks++;
        this.logger.log(`Created parallel execution ${workflow.id} with ${parallelCount} tasks`);
    }
    async getStressTestStatus(testId) {
        return this.activeSessions.get(testId) || null;
    }
    async getStressTestResults(testId) {
        const session = this.activeSessions.get(testId);
        if (!session) {
            throw new Error(`Stress test ${testId} not found`);
        }
        const taskStats = await this.getTaskStatsForTest(session.createdTaskIds);
        return {
            testId: session.id,
            config: session.config,
            startTime: session.startTime,
            endTime: session.endTime,
            status: session.status,
            duration: session.endTime
                ? (session.endTime.getTime() - session.startTime.getTime()) / 1000
                : (new Date().getTime() - session.startTime.getTime()) / 1000,
            tasksCreated: session.tasksCreated,
            priorityStats: session.priorityStats,
            taskTypeStats: session.taskTypeStats,
            branchingStats: session.branchingStats,
            createdWorkflowIds: session.createdWorkflowIds,
            currentTaskStats: taskStats,
        };
    }
    async stopStressTest(testId) {
        const session = this.activeSessions.get(testId);
        if (!session) {
            throw new Error(`Stress test ${testId} not found`);
        }
        if (session.status === "running") {
            session.status = "stopped";
            session.endTime = new Date();
            const interval = this.intervals.get(testId);
            if (interval) {
                clearInterval(interval);
                this.intervals.delete(testId);
            }
            this.logger.log(`Stress test ${testId} stopped manually`);
        }
        return { message: `Stress test ${testId} stopped successfully` };
    }
    async getTaskStatsForTest(taskIds) {
        if (taskIds.length === 0) {
            return {
                completed: 0,
                processing: 0,
                pending: 0,
                failed: 0,
            };
        }
        try {
            const tasks = await Promise.all(taskIds.map((id) => this.taskOrchestrationService.getTask(id).catch(() => null)));
            const validTasks = tasks.filter((task) => task !== null);
            const stats = {
                completed: 0,
                processing: 0,
                pending: 0,
                failed: 0,
                queued: 0,
                retrying: 0,
                cancelled: 0,
            };
            validTasks.forEach((task) => {
                switch (task.status) {
                    case "COMPLETED":
                        stats.completed++;
                        break;
                    case "PROCESSING":
                        stats.processing++;
                        break;
                    case "PENDING":
                        stats.pending++;
                        break;
                    case "FAILED":
                        stats.failed++;
                        break;
                    case "QUEUED":
                        stats.queued++;
                        break;
                    case "RETRYING":
                        stats.retrying++;
                        break;
                    case "CANCELLED":
                        stats.cancelled++;
                        break;
                }
            });
            return stats;
        }
        catch (error) {
            this.logger.error(`Error getting task stats: ${error.message}`);
            return {
                completed: 0,
                processing: 0,
                pending: 0,
                failed: 0,
            };
        }
    }
};
exports.StressTestService = StressTestService;
exports.StressTestService = StressTestService = StressTestService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [task_orchestration_service_1.TaskOrchestrationService,
        workflow_service_1.WorkflowService])
], StressTestService);
//# sourceMappingURL=stress-test.service.js.map