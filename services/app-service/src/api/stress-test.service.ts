import { Injectable, Logger } from "@nestjs/common";
import { TaskOrchestrationService } from "../coordinator/task-orchestration.service";
import { WorkflowService } from "../coordinator/workflow.service";
import { StressTestConfig } from "./stress-test.controller";

export interface StressTestSession {
  id: string;
  config: StressTestConfig;
  startTime: Date;
  endTime?: Date;
  status: "running" | "completed" | "stopped" | "failed";
  tasksCreated: number;
  tasksCompleted: number;
  tasksFailed: number;
  priorityStats: {
    high: number;
    medium: number;
    low: number;
  };
  taskTypeStats: Record<string, number>;
  branchingStats: {
    branchingTasks: number;
    dependentTasks: number;
    workflowTasks: number;
    regularTasks: number;
  };
  createdTaskIds: string[];
  createdWorkflowIds: string[];
}

@Injectable()
export class StressTestService {
  private readonly logger = new Logger(StressTestService.name);
  private activeSessions = new Map<string, StressTestSession>();
  private intervals = new Map<string, NodeJS.Timeout>();

  // Define 5 task types that match the actual supported types
  private readonly TASK_TYPES = [
    "api-call",
    "database-operation",
    "file-processing",
    "email-send",
    "data-transformation",
  ];

  // Define advanced task types for branching and dependencies
  private readonly BRANCHING_TASK_TYPES = [
    "branching-workflow",
    "dependent-task-chain",
    "conditional-branch",
    "parallel-execution",
  ];

  constructor(
    private taskOrchestrationService: TaskOrchestrationService,
    private workflowService: WorkflowService
  ) {}

  async startStressTest(
    config: StressTestConfig
  ): Promise<{ testId: string; message: string }> {
    const testId = this.generateTestId();

    // Convert string values to numbers if needed
    const totalTasks = Number(config.totalTasks);
    const durationMinutes = Number(config.durationMinutes);

    // Set default priority distribution if not provided
    const priorityDistribution = config.priorityDistribution || {
      high: 30,
      medium: 50,
      low: 20,
    };

    const highPriority = Number(priorityDistribution.high);
    const mediumPriority = Number(priorityDistribution.medium);
    const lowPriority = Number(priorityDistribution.low);

    this.logger.log(
      `Received config: totalTasks=${totalTasks}, durationMinutes=${durationMinutes}, priorities=[${highPriority}, ${mediumPriority}, ${lowPriority}]`
    );

    // Validate config
    if (
      isNaN(totalTasks) ||
      isNaN(durationMinutes) ||
      totalTasks <= 0 ||
      durationMinutes <= 0
    ) {
      throw new Error(
        "Invalid configuration: totalTasks and durationMinutes must be positive numbers"
      );
    }

    const totalPercentage = highPriority + mediumPriority + lowPriority;
    if (Math.abs(totalPercentage - 100) > 0.1) {
      throw new Error("Priority distribution must sum to 100%");
    }

    // Use default task types if none provided
    const taskTypes =
      config.taskTypes && config.taskTypes.length > 0
        ? config.taskTypes
        : this.TASK_TYPES;

    // Create normalized config with numeric values
    const normalizedConfig: StressTestConfig = {
      totalTasks,
      durationMinutes,
      taskTypes,
      priorityDistribution: {
        high: highPriority,
        medium: mediumPriority,
        low: lowPriority,
      },
    };

    const session: StressTestSession = {
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

    // Start creating tasks
    this.startTaskCreation(session);

    this.logger.log(
      `Started stress test ${testId} with ${totalTasks} tasks over ${durationMinutes} minutes`
    );

    return {
      testId,
      message: `Stress test started successfully. Will create ${totalTasks} tasks over ${durationMinutes} minutes.`,
    };
  }

  private startTaskCreation(session: StressTestSession): void {
    const { totalTasks, durationMinutes, taskTypes, priorityDistribution } =
      session.config;
    const intervalMs = (durationMinutes * 60 * 1000) / totalTasks; // Distribute tasks evenly over time

    let tasksCreated = 0;

    const interval = setInterval(async () => {
      if (tasksCreated >= totalTasks || session.status !== "running") {
        clearInterval(interval);
        this.intervals.delete(session.id);

        if (session.status === "running") {
          session.status = "completed";
          session.endTime = new Date();
          this.logger.log(
            `Stress test ${session.id} completed. Created ${tasksCreated} tasks.`
          );
        }
        return;
      }

      try {
        // Determine priority based on distribution
        const priority = this.determinePriority(priorityDistribution);

        // Determine if this should be a branching/dependent task (10% chance)
        const shouldCreateAdvancedTask = Math.random() < 0.1;

        if (shouldCreateAdvancedTask) {
          // Create branching or dependent task
          await this.createAdvancedTask(session, priority, tasksCreated + 1);
        } else {
          // Create regular task
          const taskType =
            taskTypes[Math.floor(Math.random() * taskTypes.length)];

          // Generate task payload based on type
          const payload = this.generateTaskPayload(taskType);

          // Create task
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

        // Update session stats
        session.tasksCreated++;

        if (priority >= 8) session.priorityStats.high++;
        else if (priority >= 4) session.priorityStats.medium++;
        else session.priorityStats.low++;

        tasksCreated++;
      } catch (error) {
        this.logger.error(`Error creating stress test task: ${error.message}`);
        session.tasksFailed++;
      }
    }, intervalMs);

    this.intervals.set(session.id, interval);
  }

  private determinePriority(
    distribution: StressTestConfig["priorityDistribution"]
  ): number {
    const random = Math.random() * 100;

    if (random < distribution.high) {
      return Math.floor(Math.random() * 3) + 8; // 8-10 (high priority)
    } else if (random < distribution.high + distribution.medium) {
      return Math.floor(Math.random() * 4) + 4; // 4-7 (medium priority)
    } else {
      return Math.floor(Math.random() * 4); // 0-3 (low priority)
    }
  }

  private generateTaskPayload(taskType: string): any {
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
          operation: ["SELECT", "INSERT", "UPDATE"][
            Math.floor(Math.random() * 3)
          ],
          table: ["orders", "products", "customers"][
            Math.floor(Math.random() * 3)
          ],
          data: { id: Math.floor(Math.random() * 1000) },
        };

      case "file-processing":
        return {
          ...basePayload,
          filename: `file_${Math.random().toString(36).substr(2, 8)}.csv`,
          operation: ["process", "validate", "transform"][
            Math.floor(Math.random() * 3)
          ],
          size: Math.floor(Math.random() * 1000000) + 1000,
        };

      case "email-send":
        return {
          ...basePayload,
          recipient: `user${Math.floor(Math.random() * 1000)}@example.com`,
          subject: `Stress Test Email ${Math.random().toString(36).substr(2, 6)}`,
          template: ["welcome", "order_confirmation", "newsletter"][
            Math.floor(Math.random() * 3)
          ],
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

  private generateTestId(): string {
    return `stress-test-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  private async createAdvancedTask(
    session: StressTestSession,
    priority: number,
    taskNumber: number
  ): Promise<void> {
    const branchingType =
      this.BRANCHING_TASK_TYPES[
        Math.floor(Math.random() * this.BRANCHING_TASK_TYPES.length)
      ];

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

  private async createBranchingWorkflow(
    session: StressTestSession,
    priority: number,
    taskNumber: number
  ): Promise<void> {
    // Create a workflow with multiple branching tasks
    const branchCount = Math.floor(Math.random() * 3) + 2; // 2-4 branches
    const tasks: Array<{
      name: string;
      type: string;
      payload: any;
      priority: number;
      maxAttempts: number;
    }> = [];

    for (let i = 0; i < branchCount; i++) {
      const taskType =
        this.TASK_TYPES[Math.floor(Math.random() * this.TASK_TYPES.length)];
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

    this.logger.log(
      `Created branching workflow ${workflow.id} with ${branchCount} branches`
    );
  }

  private async createDependentTaskChain(
    session: StressTestSession,
    priority: number,
    taskNumber: number
  ): Promise<void> {
    // Create a chain of dependent tasks
    const chainLength = Math.floor(Math.random() * 3) + 2; // 2-4 tasks in chain
    const tasks: Array<{
      name: string;
      type: string;
      payload: any;
      priority: number;
      delay: number;
      maxAttempts: number;
    }> = [];

    for (let i = 0; i < chainLength; i++) {
      const taskType =
        this.TASK_TYPES[Math.floor(Math.random() * this.TASK_TYPES.length)];
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
        delay: i * 1000, // Sequential delay
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

    this.logger.log(
      `Created dependent task chain ${workflow.id} with ${chainLength} tasks`
    );
  }

  private async createConditionalBranch(
    session: StressTestSession,
    priority: number,
    taskNumber: number
  ): Promise<void> {
    // Create a conditional branching scenario
    const condition = Math.random() > 0.5 ? "success" : "failure";
    const taskType =
      this.TASK_TYPES[Math.floor(Math.random() * this.TASK_TYPES.length)];

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

    // Create follow-up tasks based on condition
    const followUpTasks = condition === "success" ? 2 : 1;
    for (let i = 0; i < followUpTasks; i++) {
      const followUpType =
        this.TASK_TYPES[Math.floor(Math.random() * this.TASK_TYPES.length)];
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
        delay: 2000, // Wait for main task
        maxAttempts: 3,
      });

      session.createdTaskIds.push(followUpTask.id);
    }

    session.createdTaskIds.push(mainTask.id);
    session.taskTypeStats["conditional-branch"] =
      (session.taskTypeStats["conditional-branch"] || 0) + 1;
    session.branchingStats.branchingTasks++;

    this.logger.log(
      `Created conditional branch ${mainTask.id} with condition: ${condition}`
    );
  }

  private async createParallelExecution(
    session: StressTestSession,
    priority: number,
    taskNumber: number
  ): Promise<void> {
    // Create parallel execution tasks
    const parallelCount = Math.floor(Math.random() * 4) + 2; // 2-5 parallel tasks
    const tasks: Array<{
      name: string;
      type: string;
      payload: any;
      priority: number;
      maxAttempts: number;
    }> = [];

    for (let i = 0; i < parallelCount; i++) {
      const taskType =
        this.TASK_TYPES[Math.floor(Math.random() * this.TASK_TYPES.length)];
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

    this.logger.log(
      `Created parallel execution ${workflow.id} with ${parallelCount} tasks`
    );
  }

  async getStressTestStatus(testId: string): Promise<StressTestSession | null> {
    return this.activeSessions.get(testId) || null;
  }

  async getStressTestResults(testId: string): Promise<any> {
    const session = this.activeSessions.get(testId);
    if (!session) {
      throw new Error(`Stress test ${testId} not found`);
    }

    // Get current task stats for created tasks
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

  async stopStressTest(testId: string): Promise<{ message: string }> {
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

  private async getTaskStatsForTest(taskIds: string[]): Promise<any> {
    if (taskIds.length === 0) {
      return {
        completed: 0,
        processing: 0,
        pending: 0,
        failed: 0,
      };
    }

    try {
      // Get task statistics from the orchestration service
      const tasks = await Promise.all(
        taskIds.map((id) =>
          this.taskOrchestrationService.getTask(id).catch(() => null)
        )
      );

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
    } catch (error) {
      this.logger.error(`Error getting task stats: ${error.message}`);
      return {
        completed: 0,
        processing: 0,
        pending: 0,
        failed: 0,
      };
    }
  }
}
