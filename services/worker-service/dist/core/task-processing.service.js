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
var TaskProcessingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskProcessingService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@distributed-async-task-worker/shared");
const queue_manager_service_1 = require("../queue/queue-manager.service");
const dead_letter_queue_service_1 = require("./dead-letter-queue.service");
let TaskProcessingService = TaskProcessingService_1 = class TaskProcessingService {
    prismaService;
    queueManagerService;
    deadLetterQueueService;
    logger = new common_1.Logger(TaskProcessingService_1.name);
    constructor(prismaService, queueManagerService, deadLetterQueueService) {
        this.prismaService = prismaService;
        this.queueManagerService = queueManagerService;
        this.deadLetterQueueService = deadLetterQueueService;
    }
    async processTask(taskId, taskType, payload) {
        const startTime = Date.now();
        try {
            await this.logTaskEvent(taskId, "INFO", `Starting task processing: ${taskType}`);
            await this.updateTaskStatus(taskId, shared_1.TaskStatus.PROCESSING);
            const result = await this.executeTaskByType(taskType, payload, taskId);
            const processingTime = Date.now() - startTime;
            await this.updateTaskStatusWithRetry(taskId, shared_1.TaskStatus.COMPLETED);
            await this.logTaskEvent(taskId, "INFO", `Task completed successfully in ${processingTime}ms`, { processingTime, result });
            return {
                success: true,
                data: result,
                metadata: { processingTime },
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            const shouldRetry = await this.handleTaskFailureWithRetry(taskId, error, processingTime);
            return {
                success: false,
                error: error.message,
                metadata: { processingTime, willRetry: shouldRetry },
            };
        }
    }
    async handleTaskFailureWithRetry(taskId, error, processingTime) {
        try {
            const task = await this.prismaService.task.findUnique({
                where: { id: taskId },
            });
            if (!task) {
                this.logger.error(`Task ${taskId} not found for retry logic`);
                return false;
            }
            const currentAttempts = task.attempts + 1;
            const maxAttempts = task.maxAttempts || 3;
            await this.logTaskEvent(taskId, "ERROR", `Task failed on attempt ${currentAttempts}/${maxAttempts} after ${processingTime}ms: ${error.message}`, { processingTime, error: error.stack, attempt: currentAttempts });
            if (currentAttempts < maxAttempts) {
                await this.updateTaskStatusWithRetry(taskId, shared_1.TaskStatus.PENDING, {
                    attempts: currentAttempts,
                    startedAt: null,
                });
                await this.logTaskEvent(taskId, "INFO", `Task scheduled for retry (attempt ${currentAttempts + 1}/${maxAttempts})`, { attempt: currentAttempts + 1, maxAttempts });
                const delay = Math.min(1000 * Math.pow(2, currentAttempts - 1), 30000);
                setTimeout(async () => {
                    try {
                        await this.queueManagerService.addTask({
                            taskId: taskId,
                            type: task.type,
                            data: task.payload,
                            priority: task.priority,
                        });
                        this.logger.log(`Task ${taskId} re-queued for retry after ${delay}ms delay`);
                    }
                    catch (retryError) {
                        this.logger.error(`Failed to re-queue task ${taskId} for retry:`, retryError);
                    }
                }, delay);
                return true;
            }
            else {
                await this.moveTaskToDeadLetterQueue(task, error, currentAttempts, maxAttempts);
                await this.logTaskEvent(taskId, "ERROR", `Task permanently failed after ${currentAttempts} attempts and moved to Dead Letter Queue`, { finalAttempt: currentAttempts, maxAttempts });
                return false;
            }
        }
        catch (retryError) {
            this.logger.error(`Error in retry logic for task ${taskId}:`, retryError);
            return false;
        }
    }
    async moveTaskToDeadLetterQueue(task, error, currentAttempts, maxAttempts) {
        try {
            const taskLogs = await this.prismaService.taskLog.findMany({
                where: { taskId: task.id },
                orderBy: { createdAt: "asc" },
            });
            const retryHistory = taskLogs
                .filter((log) => log.level === "ERROR")
                .map((log) => ({
                timestamp: log.createdAt,
                error: log.message,
                metadata: log.metadata,
            }));
            let failureReason = "Unknown error";
            if (error.message) {
                if (error.message.includes("timeout")) {
                    failureReason = "Timeout";
                }
                else if (error.message.includes("network")) {
                    failureReason = "Network error";
                }
                else if (error.message.includes("database")) {
                    failureReason = "Database error";
                }
                else if (error.message.includes("validation")) {
                    failureReason = "Validation error";
                }
                else {
                    failureReason = "Processing error";
                }
            }
            const firstFailureLog = taskLogs.find((log) => log.level === "ERROR");
            const firstFailedAt = firstFailureLog
                ? firstFailureLog.createdAt
                : new Date();
            const dlqTaskData = {
                originalTaskId: task.id,
                workflowId: task.workflowId,
                name: task.name,
                type: task.type,
                payload: task.payload,
                priority: task.priority,
                attempts: currentAttempts,
                maxAttempts: maxAttempts,
                lastError: error.message || "Unknown error",
                lastErrorStack: error.stack,
                failureReason,
                originalCreatedAt: task.createdAt,
                firstFailedAt,
                retryHistory,
                processingMetadata: {
                    nodeId: process.env.NODE_ID || "unknown",
                    processingTime: Date.now() - (task.startedAt?.getTime() || Date.now()),
                    errorType: error.constructor.name,
                },
            };
            const dlqTaskId = await this.deadLetterQueueService.moveTaskToDlq(dlqTaskData);
            await this.updateTaskStatusWithRetry(task.id, shared_1.TaskStatus.FAILED, {
                attempts: currentAttempts,
                failedAt: new Date(),
            });
            this.logger.log(`Task ${task.id} moved to Dead Letter Queue with DLQ ID: ${dlqTaskId}`);
        }
        catch (dlqError) {
            this.logger.error(`Failed to move task ${task.id} to Dead Letter Queue:`, dlqError);
            await this.updateTaskStatusWithRetry(task.id, shared_1.TaskStatus.FAILED, {
                attempts: currentAttempts,
                failedAt: new Date(),
            });
        }
    }
    async executeTaskByType(taskType, payload, taskId) {
        switch (taskType) {
            case "api-call":
                return await this.processApiCall(payload, taskId);
            case "database-operation":
                return await this.processDatabaseOperation(payload, taskId);
            case "file-processing":
                return await this.processFileOperation(payload, taskId);
            case "email-send":
            case "email":
                return await this.processEmailSend(payload, taskId);
            case "data-transformation":
            case "data-processing":
                return await this.processDataTransformation(payload, taskId);
            case "webhook-call":
                return await this.processWebhookCall(payload, taskId);
            case "report-generation":
                return await this.processReportGeneration(payload, taskId);
            case "image-processing":
                return await this.processImageProcessing(payload, taskId);
            case "notification":
                return await this.processNotification(payload, taskId);
            case "data-cleanup":
                return await this.processDataCleanup(payload, taskId);
            case "health-check":
                return await this.processHealthCheck(payload, taskId);
            case "daily-report":
                return await this.processDailyReport(payload, taskId);
            default:
                throw new Error(`Unsupported task type: ${taskType}`);
        }
    }
    async processApiCall(payload, taskId) {
        const { url, method = "GET", headers = {}, body } = payload;
        await this.logTaskEvent(taskId, "INFO", `Making ${method} request to ${url}`);
        await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 500));
        const scenarios = ["success", "success", "success", "success", "error"];
        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
        switch (scenario) {
            case "success":
                return {
                    status: 200,
                    data: {
                        message: "API call successful",
                        url,
                        timestamp: new Date().toISOString(),
                    },
                };
            case "error":
                throw new Error(`API call failed: HTTP 500 from ${url}`);
            case "timeout":
                throw new Error(`API call timeout: ${url}`);
        }
    }
    async processDatabaseOperation(payload, taskId) {
        const { operation, table, data } = payload;
        await this.logTaskEvent(taskId, "INFO", `Executing ${operation} on ${table}`);
        await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 200));
        return {
            operation,
            table,
            affected: Math.floor(Math.random() * 100) + 1,
            timestamp: new Date().toISOString(),
        };
    }
    async processFileOperation(payload, taskId) {
        const { filename, operation = "process" } = payload;
        await this.logTaskEvent(taskId, "INFO", `Processing file: ${filename}`);
        await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 300));
        return {
            filename,
            operation,
            size: Math.floor(Math.random() * 1000000) + 1000,
            processed: true,
            timestamp: new Date().toISOString(),
        };
    }
    async processEmailSend(payload, taskId) {
        const { recipient, subject, template } = payload;
        await this.logTaskEvent(taskId, "INFO", `Sending email to ${recipient}`);
        await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 150));
        return {
            recipient,
            subject,
            template,
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sent: true,
            timestamp: new Date().toISOString(),
        };
    }
    async processDataTransformation(payload, taskId) {
        const { source, target, records } = payload;
        await this.logTaskEvent(taskId, "INFO", `Transforming ${records} records from ${source} to ${target}`);
        await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 400));
        return {
            source,
            target,
            recordsProcessed: records,
            transformationRules: ["normalize", "validate", "enrich"],
            timestamp: new Date().toISOString(),
        };
    }
    async processWebhookCall(payload, taskId) {
        const { url, event, data } = payload;
        await this.logTaskEvent(taskId, "INFO", `Sending webhook ${event} to ${url}`);
        await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 1000));
        return {
            url,
            event,
            status: "delivered",
            responseTime: Math.floor(Math.random() * 500) + 100,
            timestamp: new Date().toISOString(),
        };
    }
    async processReportGeneration(payload, taskId) {
        const { reportType, dateRange, format = "pdf" } = payload;
        await this.logTaskEvent(taskId, "INFO", `Generating ${reportType} report in ${format} format`);
        await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 3000));
        return {
            reportType,
            dateRange,
            format,
            filename: `report_${reportType}_${Date.now()}.${format}`,
            size: Math.floor(Math.random() * 5000000) + 100000,
            timestamp: new Date().toISOString(),
        };
    }
    async processImageProcessing(payload, taskId) {
        const { image_url, operations = [] } = payload;
        await this.logTaskEvent(taskId, "INFO", `Processing image ${image_url} with operations: ${operations.join(", ")}`);
        await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1500));
        return {
            originalUrl: image_url,
            operations,
            processedUrl: `processed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
            size: {
                original: Math.floor(Math.random() * 5000000) + 100000,
                processed: Math.floor(Math.random() * 3000000) + 50000,
            },
            timestamp: new Date().toISOString(),
        };
    }
    async processNotification(payload, taskId) {
        const { user_id, message, channels = [] } = payload;
        await this.logTaskEvent(taskId, "INFO", `Sending notification to user ${user_id} via channels: ${channels.join(", ")}`);
        await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 300));
        const results = channels.map((channel) => ({
            channel,
            status: "sent",
            messageId: `${channel}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        }));
        return {
            userId: user_id,
            message,
            channels: results,
            timestamp: new Date().toISOString(),
        };
    }
    async updateTaskStatus(taskId, status) {
        try {
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
            else if (status === shared_1.TaskStatus.FAILED) {
                updateData.failedAt = new Date();
            }
            await this.prismaService.task.update({
                where: { id: taskId },
                data: updateData,
            });
            this.logger.log(`Task ${taskId} status updated to ${status}`);
        }
        catch (error) {
            this.logger.error(`Failed to update task ${taskId} status to ${status}:`, error);
            throw error;
        }
    }
    async updateTaskStatusWithRetry(taskId, status, additionalData, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (additionalData) {
                    await this.prismaService.task.update({
                        where: { id: taskId },
                        data: {
                            status,
                            ...additionalData,
                        },
                    });
                }
                else {
                    await this.updateTaskStatus(taskId, status);
                }
                return;
            }
            catch (error) {
                this.logger.warn(`Attempt ${attempt}/${maxRetries} failed to update task ${taskId} status:`, error);
                if (attempt === maxRetries) {
                    this.logger.error(`All ${maxRetries} attempts failed to update task ${taskId} status to ${status}`);
                    throw error;
                }
                await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
            }
        }
    }
    async logTaskEvent(taskId, level, message, metadata) {
        try {
            await this.prismaService.taskLog.create({
                data: {
                    taskId,
                    level: level,
                    message,
                    metadata: metadata ? JSON.stringify(metadata) : undefined,
                },
            });
        }
        catch (error) {
            this.logger.error(`Failed to log task event for ${taskId}:`, error);
        }
    }
    async processDataCleanup(payload, taskId) {
        const { retentionDays = 7 } = payload;
        await this.logTaskEvent(taskId, "INFO", `Starting data cleanup with ${retentionDays} days retention`);
        await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const cleanupResults = {
            completedTasks: Math.floor(Math.random() * 500) + 100,
            oldLogs: Math.floor(Math.random() * 1000) + 200,
            tempFiles: Math.floor(Math.random() * 50) + 10,
            cutoffDate: cutoffDate.toISOString(),
            retentionDays,
            timestamp: new Date().toISOString(),
        };
        await this.logTaskEvent(taskId, "INFO", `Data cleanup completed: ${cleanupResults.completedTasks} tasks, ${cleanupResults.oldLogs} logs, ${cleanupResults.tempFiles} temp files removed`);
        return cleanupResults;
    }
    async processHealthCheck(payload, taskId) {
        const { checkDatabase = true, checkRedis = true, checkQueue = true, } = payload;
        await this.logTaskEvent(taskId, "INFO", "Starting comprehensive system health check");
        await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));
        const healthResults = {
            database: checkDatabase
                ? {
                    status: Math.random() > 0.1 ? "healthy" : "warning",
                    responseTime: Math.floor(Math.random() * 50) + 5,
                    connections: Math.floor(Math.random() * 20) + 5,
                }
                : null,
            redis: checkRedis
                ? {
                    status: Math.random() > 0.05 ? "healthy" : "error",
                    responseTime: Math.floor(Math.random() * 10) + 1,
                    memory: Math.floor(Math.random() * 100) + 50,
                }
                : null,
            queue: checkQueue
                ? {
                    status: "healthy",
                    waiting: Math.floor(Math.random() * 100),
                    active: Math.floor(Math.random() * 10),
                    completed: Math.floor(Math.random() * 1000) + 500,
                    failed: Math.floor(Math.random() * 50),
                }
                : null,
            timestamp: new Date().toISOString(),
        };
        let overallStatus = "healthy";
        if (healthResults.database && healthResults.database.status !== "healthy") {
            overallStatus = "warning";
        }
        if (healthResults.redis && healthResults.redis.status !== "healthy") {
            overallStatus = "warning";
        }
        if (healthResults.queue && healthResults.queue.status !== "healthy") {
            overallStatus = "warning";
        }
        await this.logTaskEvent(taskId, overallStatus === "healthy" ? "INFO" : "WARN", `Health check completed with status: ${overallStatus}`);
        return {
            ...healthResults,
            overallStatus,
        };
    }
    async processDailyReport(payload, taskId) {
        const { includeCharts = true, emailReport = false } = payload;
        await this.logTaskEvent(taskId, "INFO", "Generating daily performance report");
        await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 3000));
        const reportData = {
            date: new Date().toISOString().split("T")[0],
            summary: {
                totalTasks: Math.floor(Math.random() * 1000) + 500,
                completedTasks: Math.floor(Math.random() * 900) + 450,
                failedTasks: Math.floor(Math.random() * 50) + 10,
                averageProcessingTime: Math.floor(Math.random() * 500) + 100,
                peakHour: Math.floor(Math.random() * 24),
            },
            performance: {
                tasksPerSecond: (Math.random() * 10 + 5).toFixed(2),
                systemUptime: Math.floor(Math.random() * 24 * 60) + 60,
                memoryUsage: Math.floor(Math.random() * 80) + 20,
                cpuUsage: Math.floor(Math.random() * 60) + 10,
            },
            topTaskTypes: [
                { type: "api-call", count: Math.floor(Math.random() * 200) + 100 },
                {
                    type: "database-operation",
                    count: Math.floor(Math.random() * 150) + 75,
                },
                {
                    type: "file-processing",
                    count: Math.floor(Math.random() * 100) + 50,
                },
            ],
            includeCharts,
            emailReport,
            generatedAt: new Date().toISOString(),
        };
        await this.logTaskEvent(taskId, "INFO", `Daily report generated: ${reportData.summary.totalTasks} total tasks processed`);
        return reportData;
    }
};
exports.TaskProcessingService = TaskProcessingService;
exports.TaskProcessingService = TaskProcessingService = TaskProcessingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => queue_manager_service_1.QueueManagerService))),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => dead_letter_queue_service_1.DeadLetterQueueService))),
    __metadata("design:paramtypes", [shared_1.PrismaService,
        queue_manager_service_1.QueueManagerService,
        dead_letter_queue_service_1.DeadLetterQueueService])
], TaskProcessingService);
//# sourceMappingURL=task-processing.service.js.map