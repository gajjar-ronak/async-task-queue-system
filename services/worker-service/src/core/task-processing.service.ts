import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import {
  PrismaService,
  TaskStatus,
  TaskResult,
  DlqTaskData,
} from "@distributed-async-task-worker/shared";
import { QueueManagerService } from "../queue/queue-manager.service";
import { DeadLetterQueueService } from "./dead-letter-queue.service";

@Injectable()
export class TaskProcessingService {
  private readonly logger = new Logger(TaskProcessingService.name);

  constructor(
    private prismaService: PrismaService,
    @Inject(forwardRef(() => QueueManagerService))
    private queueManagerService: QueueManagerService,
    @Inject(forwardRef(() => DeadLetterQueueService))
    private deadLetterQueueService: DeadLetterQueueService
  ) {}

  async processTask(
    taskId: string,
    taskType: string,
    payload: any
  ): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // Log task start
      await this.logTaskEvent(
        taskId,
        "INFO",
        `Starting task processing: ${taskType}`
      );

      // Update task status to processing
      await this.updateTaskStatus(taskId, TaskStatus.PROCESSING);

      // Track task start for performance metrics
      // TODO: Add performance metrics tracking

      // Process based on task type
      const result = await this.executeTaskByType(taskType, payload, taskId);

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Update task status to completed with retry logic
      await this.updateTaskStatusWithRetry(taskId, TaskStatus.COMPLETED);

      // Track task completion for performance metrics
      // TODO: Add performance metrics tracking

      // Log success
      await this.logTaskEvent(
        taskId,
        "INFO",
        `Task completed successfully in ${processingTime}ms`,
        { processingTime, result }
      );

      return {
        success: true,
        data: result,
        metadata: { processingTime },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Handle retry logic
      const shouldRetry = await this.handleTaskFailureWithRetry(
        taskId,
        error,
        processingTime
      );

      return {
        success: false,
        error: error.message,
        metadata: { processingTime, willRetry: shouldRetry },
      };
    }
  }

  private async handleTaskFailureWithRetry(
    taskId: string,
    error: any,
    processingTime: number
  ): Promise<boolean> {
    try {
      // Get current task to check retry count
      const task = await this.prismaService.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        this.logger.error(`Task ${taskId} not found for retry logic`);
        return false;
      }

      const currentAttempts = task.attempts + 1;
      const maxAttempts = task.maxAttempts || 3;

      // Log the failure
      await this.logTaskEvent(
        taskId,
        "ERROR",
        `Task failed on attempt ${currentAttempts}/${maxAttempts} after ${processingTime}ms: ${error.message}`,
        { processingTime, error: error.stack, attempt: currentAttempts }
      );

      if (currentAttempts < maxAttempts) {
        // Update attempts count and reset to PENDING for retry
        await this.updateTaskStatusWithRetry(taskId, TaskStatus.PENDING, {
          attempts: currentAttempts,
          startedAt: null, // Reset started time for retry
        });

        // Log retry
        await this.logTaskEvent(
          taskId,
          "INFO",
          `Task scheduled for retry (attempt ${currentAttempts + 1}/${maxAttempts})`,
          { attempt: currentAttempts + 1, maxAttempts }
        );

        // Re-add to queue for retry with delay
        const delay = Math.min(1000 * Math.pow(2, currentAttempts - 1), 30000); // Exponential backoff, max 30s
        setTimeout(async () => {
          try {
            await this.queueManagerService.addTask({
              taskId: taskId,
              type: task.type,
              data: task.payload as any,
              priority: task.priority,
            });
            this.logger.log(
              `Task ${taskId} re-queued for retry after ${delay}ms delay`
            );
          } catch (retryError) {
            this.logger.error(
              `Failed to re-queue task ${taskId} for retry:`,
              retryError
            );
          }
        }, delay);

        return true; // Will retry
      } else {
        // Max attempts reached, move to Dead Letter Queue
        await this.moveTaskToDeadLetterQueue(
          task,
          error,
          currentAttempts,
          maxAttempts
        );

        await this.logTaskEvent(
          taskId,
          "ERROR",
          `Task permanently failed after ${currentAttempts} attempts and moved to Dead Letter Queue`,
          { finalAttempt: currentAttempts, maxAttempts }
        );

        return false; // No more retries
      }
    } catch (retryError) {
      this.logger.error(`Error in retry logic for task ${taskId}:`, retryError);
      return false;
    }
  }

  /**
   * Move a failed task to the Dead Letter Queue
   */
  private async moveTaskToDeadLetterQueue(
    task: any,
    error: any,
    currentAttempts: number,
    maxAttempts: number
  ): Promise<void> {
    try {
      // Collect retry history from task logs
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

      // Determine failure reason
      let failureReason = "Unknown error";
      if (error.message) {
        if (error.message.includes("timeout")) {
          failureReason = "Timeout";
        } else if (error.message.includes("network")) {
          failureReason = "Network error";
        } else if (error.message.includes("database")) {
          failureReason = "Database error";
        } else if (error.message.includes("validation")) {
          failureReason = "Validation error";
        } else {
          failureReason = "Processing error";
        }
      }

      // Find when the task first failed
      const firstFailureLog = taskLogs.find((log) => log.level === "ERROR");
      const firstFailedAt = firstFailureLog
        ? firstFailureLog.createdAt
        : new Date();

      // Prepare DLQ task data
      const dlqTaskData: DlqTaskData = {
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
          processingTime:
            Date.now() - (task.startedAt?.getTime() || Date.now()),
          errorType: error.constructor.name,
        },
      };

      // Move to DLQ
      const dlqTaskId =
        await this.deadLetterQueueService.moveTaskToDlq(dlqTaskData);

      // Mark original task as FAILED (for statistics)
      await this.updateTaskStatusWithRetry(task.id, TaskStatus.FAILED, {
        attempts: currentAttempts,
        failedAt: new Date(),
      });

      this.logger.log(
        `Task ${task.id} moved to Dead Letter Queue with DLQ ID: ${dlqTaskId}`
      );
    } catch (dlqError) {
      this.logger.error(
        `Failed to move task ${task.id} to Dead Letter Queue:`,
        dlqError
      );

      // Fallback: just mark as failed if DLQ fails
      await this.updateTaskStatusWithRetry(task.id, TaskStatus.FAILED, {
        attempts: currentAttempts,
        failedAt: new Date(),
      });
    }
  }

  private async executeTaskByType(
    taskType: string,
    payload: any,
    taskId: string
  ): Promise<any> {
    switch (taskType) {
      case "api-call":
        return await this.processApiCall(payload, taskId);
      case "database-operation":
        return await this.processDatabaseOperation(payload, taskId);
      case "file-processing":
        return await this.processFileOperation(payload, taskId);
      case "email-send":
      case "email": // Support both email-send and email
        return await this.processEmailSend(payload, taskId);
      case "data-transformation":
      case "data-processing": // Support both data-transformation and data-processing
        return await this.processDataTransformation(payload, taskId);
      case "webhook-call":
        return await this.processWebhookCall(payload, taskId);
      case "report-generation":
        return await this.processReportGeneration(payload, taskId);
      // Additional task types
      case "image-processing":
        return await this.processImageProcessing(payload, taskId);
      case "notification":
        return await this.processNotification(payload, taskId);
      // CRON job task types
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

  private async processApiCall(payload: any, taskId: string): Promise<any> {
    const { url, method = "GET", headers = {}, body } = payload;

    await this.logTaskEvent(
      taskId,
      "INFO",
      `Making ${method} request to ${url}`
    );

    // Simulate API call with shorter, more realistic delay
    await new Promise((resolve) =>
      setTimeout(resolve, 100 + Math.random() * 500)
    );

    // Simulate different response scenarios with higher success rate
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

  private async processDatabaseOperation(
    payload: any,
    taskId: string
  ): Promise<any> {
    const { operation, table, data } = payload;

    await this.logTaskEvent(
      taskId,
      "INFO",
      `Executing ${operation} on ${table}`
    );

    // Simulate database operation with shorter delay
    await new Promise((resolve) =>
      setTimeout(resolve, 50 + Math.random() * 200)
    );

    return {
      operation,
      table,
      affected: Math.floor(Math.random() * 100) + 1,
      timestamp: new Date().toISOString(),
    };
  }

  private async processFileOperation(
    payload: any,
    taskId: string
  ): Promise<any> {
    const { filename, operation = "process" } = payload;

    await this.logTaskEvent(taskId, "INFO", `Processing file: ${filename}`);

    // Simulate file processing with shorter delay
    await new Promise((resolve) =>
      setTimeout(resolve, 100 + Math.random() * 300)
    );

    return {
      filename,
      operation,
      size: Math.floor(Math.random() * 1000000) + 1000,
      processed: true,
      timestamp: new Date().toISOString(),
    };
  }

  private async processEmailSend(payload: any, taskId: string): Promise<any> {
    const { recipient, subject, template } = payload;

    await this.logTaskEvent(taskId, "INFO", `Sending email to ${recipient}`);

    // Simulate email sending with shorter delay
    await new Promise((resolve) =>
      setTimeout(resolve, 50 + Math.random() * 150)
    );

    return {
      recipient,
      subject,
      template,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sent: true,
      timestamp: new Date().toISOString(),
    };
  }

  private async processDataTransformation(
    payload: any,
    taskId: string
  ): Promise<any> {
    const { source, target, records } = payload;

    await this.logTaskEvent(
      taskId,
      "INFO",
      `Transforming ${records} records from ${source} to ${target}`
    );

    // Simulate data transformation with shorter delay
    await new Promise((resolve) =>
      setTimeout(resolve, 100 + Math.random() * 400)
    );

    return {
      source,
      target,
      recordsProcessed: records,
      transformationRules: ["normalize", "validate", "enrich"],
      timestamp: new Date().toISOString(),
    };
  }

  private async processWebhookCall(payload: any, taskId: string): Promise<any> {
    const { url, event, data } = payload;

    await this.logTaskEvent(
      taskId,
      "INFO",
      `Sending webhook ${event} to ${url}`
    );

    // Simulate webhook call
    await new Promise((resolve) =>
      setTimeout(resolve, 600 + Math.random() * 1000)
    );

    return {
      url,
      event,
      status: "delivered",
      responseTime: Math.floor(Math.random() * 500) + 100,
      timestamp: new Date().toISOString(),
    };
  }

  private async processReportGeneration(
    payload: any,
    taskId: string
  ): Promise<any> {
    const { reportType, dateRange, format = "pdf" } = payload;

    await this.logTaskEvent(
      taskId,
      "INFO",
      `Generating ${reportType} report in ${format} format`
    );

    // Simulate report generation
    await new Promise((resolve) =>
      setTimeout(resolve, 2000 + Math.random() * 3000)
    );

    return {
      reportType,
      dateRange,
      format,
      filename: `report_${reportType}_${Date.now()}.${format}`,
      size: Math.floor(Math.random() * 5000000) + 100000,
      timestamp: new Date().toISOString(),
    };
  }

  private async processImageProcessing(
    payload: any,
    taskId: string
  ): Promise<any> {
    const { image_url, operations = [] } = payload;

    await this.logTaskEvent(
      taskId,
      "INFO",
      `Processing image ${image_url} with operations: ${operations.join(", ")}`
    );

    // Simulate image processing with realistic delay
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1500)
    );

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

  private async processNotification(
    payload: any,
    taskId: string
  ): Promise<any> {
    const { user_id, message, channels = [] } = payload;

    await this.logTaskEvent(
      taskId,
      "INFO",
      `Sending notification to user ${user_id} via channels: ${channels.join(", ")}`
    );

    // Simulate notification sending
    await new Promise((resolve) =>
      setTimeout(resolve, 100 + Math.random() * 300)
    );

    const results = channels.map((channel: string) => ({
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

  private async updateTaskStatus(
    taskId: string,
    status: TaskStatus
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (status === TaskStatus.PROCESSING) {
        updateData.startedAt = new Date();
      } else if (status === TaskStatus.COMPLETED) {
        updateData.completedAt = new Date();
      } else if (status === TaskStatus.FAILED) {
        updateData.failedAt = new Date();
      }

      await this.prismaService.task.update({
        where: { id: taskId },
        data: updateData,
      });

      this.logger.log(`Task ${taskId} status updated to ${status}`);
    } catch (error) {
      this.logger.error(
        `Failed to update task ${taskId} status to ${status}:`,
        error
      );
      throw error;
    }
  }

  private async updateTaskStatusWithRetry(
    taskId: string,
    status: TaskStatus,
    additionalData?: any,
    maxRetries: number = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (additionalData) {
          // Update with additional data
          await this.prismaService.task.update({
            where: { id: taskId },
            data: {
              status,
              ...additionalData,
            },
          });
        } else {
          // Use existing method for simple status update
          await this.updateTaskStatus(taskId, status);
        }
        return; // Success, exit retry loop
      } catch (error) {
        this.logger.warn(
          `Attempt ${attempt}/${maxRetries} failed to update task ${taskId} status:`,
          error
        );

        if (attempt === maxRetries) {
          this.logger.error(
            `All ${maxRetries} attempts failed to update task ${taskId} status to ${status}`
          );
          throw error;
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 100)
        );
      }
    }
  }

  private async logTaskEvent(
    taskId: string,
    level: string,
    message: string,
    metadata?: any
  ): Promise<void> {
    try {
      await this.prismaService.taskLog.create({
        data: {
          taskId,
          level: level as any,
          message,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log task event for ${taskId}:`, error);
    }
  }

  // CRON job task processors
  private async processDataCleanup(payload: any, taskId: string): Promise<any> {
    const { retentionDays = 7 } = payload;

    await this.logTaskEvent(
      taskId,
      "INFO",
      `Starting data cleanup with ${retentionDays} days retention`
    );

    // Simulate cleanup operations
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 2000)
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Simulate cleanup results
    const cleanupResults = {
      completedTasks: Math.floor(Math.random() * 500) + 100,
      oldLogs: Math.floor(Math.random() * 1000) + 200,
      tempFiles: Math.floor(Math.random() * 50) + 10,
      cutoffDate: cutoffDate.toISOString(),
      retentionDays,
      timestamp: new Date().toISOString(),
    };

    await this.logTaskEvent(
      taskId,
      "INFO",
      `Data cleanup completed: ${cleanupResults.completedTasks} tasks, ${cleanupResults.oldLogs} logs, ${cleanupResults.tempFiles} temp files removed`
    );

    return cleanupResults;
  }

  private async processHealthCheck(payload: any, taskId: string): Promise<any> {
    const {
      checkDatabase = true,
      checkRedis = true,
      checkQueue = true,
    } = payload;

    await this.logTaskEvent(
      taskId,
      "INFO",
      "Starting comprehensive system health check"
    );

    // Simulate health checks
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1000)
    );

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

    // Check overall health status
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

    await this.logTaskEvent(
      taskId,
      overallStatus === "healthy" ? "INFO" : "WARN",
      `Health check completed with status: ${overallStatus}`
    );

    return {
      ...healthResults,
      overallStatus,
    };
  }

  private async processDailyReport(payload: any, taskId: string): Promise<any> {
    const { includeCharts = true, emailReport = false } = payload;

    await this.logTaskEvent(
      taskId,
      "INFO",
      "Generating daily performance report"
    );

    // Simulate report generation
    await new Promise((resolve) =>
      setTimeout(resolve, 2000 + Math.random() * 3000)
    );

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
        systemUptime: Math.floor(Math.random() * 24 * 60) + 60, // minutes
        memoryUsage: Math.floor(Math.random() * 80) + 20, // percentage
        cpuUsage: Math.floor(Math.random() * 60) + 10, // percentage
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

    await this.logTaskEvent(
      taskId,
      "INFO",
      `Daily report generated: ${reportData.summary.totalTasks} total tasks processed`
    );

    return reportData;
  }
}
