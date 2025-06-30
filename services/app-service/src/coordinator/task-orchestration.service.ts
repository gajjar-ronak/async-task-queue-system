import { Injectable, Logger } from '@nestjs/common';
import {
  PrismaService,
  TaskStatus,
} from '@distributed-async-task-worker/shared';

@Injectable()
export class TaskOrchestrationService {
  private readonly logger = new Logger(TaskOrchestrationService.name);

  constructor(private prismaService: PrismaService) {}

  async createTask(data: {
    workflowId?: string;
    name: string;
    type: string;
    payload?: any;
    priority?: number;
    delay?: number;
    maxAttempts?: number;
  }): Promise<any> {
    try {
      const task = await this.prismaService.task.create({
        data: {
          workflowId: data.workflowId,
          name: data.name || `${data.type}-task-${Date.now()}`,
          type: data.type,
          payload: data.payload || {},
          priority:
            typeof data.priority === 'string'
              ? this.convertPriorityToNumber(data.priority)
              : data.priority || 0,
          delay: data.delay || 0,
          maxAttempts: data.maxAttempts || 3,
          status: TaskStatus.PENDING,
        },
      });

      this.logger.log(`Created task ${task.id} of type ${task.type}`);
      return task;
    } catch (error) {
      this.logger.error('Failed to create task:', error);
      throw error;
    }
  }

  async getTask(taskId: string): Promise<any> {
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

  async listTasks(
    filters: {
      status?: TaskStatus;
      type?: string;
      workflowId?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<any> {
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

  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    metadata?: any,
  ): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === TaskStatus.PROCESSING) {
      updateData.startedAt = new Date();
    } else if (status === TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    await this.prismaService.task.update({
      where: { id: taskId },
      data: updateData,
    });

    // Log the status change
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

  async retryTask(taskId: string): Promise<void> {
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
        status: TaskStatus.PENDING,
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

  async cancelTask(taskId: string): Promise<void> {
    await this.prismaService.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.CANCELLED,
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

  async getTaskLogs(taskId: string, page = 1, limit = 50): Promise<any> {
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

  async getTaskStats(): Promise<any> {
    const [
      totalTasks,
      pendingTasks,
      processingTasks,
      completedTasks,
      cancelledTasks,
      retryingTasks,
      queuedTasks,
      // Get failed tasks that have exhausted all retry attempts
      permanentlyFailedTasks,
    ] = await Promise.all([
      this.prismaService.task.count(),
      this.prismaService.task.count({ where: { status: TaskStatus.PENDING } }),
      this.prismaService.task.count({
        where: { status: TaskStatus.PROCESSING },
      }),
      this.prismaService.task.count({
        where: { status: TaskStatus.COMPLETED },
      }),
      this.prismaService.task.count({
        where: { status: TaskStatus.CANCELLED },
      }),
      this.prismaService.task.count({
        where: { status: TaskStatus.RETRYING },
      }),
      this.prismaService.task.count({
        where: { status: TaskStatus.QUEUED },
      }),
      // Get all failed tasks and filter by attempts >= maxAttempts
      this.prismaService.task
        .findMany({
          where: {
            status: TaskStatus.FAILED,
          },
          select: {
            attempts: true,
            maxAttempts: true,
          },
        })
        .then(
          (tasks) =>
            tasks.filter((task) => task.attempts >= task.maxAttempts).length,
        ),
    ]);

    // Calculate success rate based on completed tasks vs truly failed tasks
    const effectivelyCompletedTasks = completedTasks;
    const effectivelyFailedTasks = permanentlyFailedTasks;
    const finishedTasks = effectivelyCompletedTasks + effectivelyFailedTasks;

    // Get task type statistics including branching tasks
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
      successRate:
        finishedTasks > 0
          ? Math.round((effectivelyCompletedTasks / finishedTasks) * 100)
          : 0,
      taskTypeStats,
    };
  }

  async getTaskTypeStatistics(): Promise<any> {
    // Get all tasks with their types
    const tasks = await this.prismaService.task.findMany({
      select: {
        name: true,
        type: true,
        workflowId: true,
        payload: true,
      },
    });

    const typeStats: Record<string, number> = {};
    const branchingStats = {
      branchingTasks: 0,
      dependentTasks: 0,
      workflowTasks: 0,
      regularTasks: 0,
    };

    tasks.forEach((task) => {
      // Count by type
      typeStats[task.type] = (typeStats[task.type] || 0) + 1;

      // Categorize task types based on task name patterns and workflow association
      const taskName = task.name || '';
      const payload = (task.payload as any) || {};

      if (
        // Check for branching tasks by name patterns
        taskName.includes('Branch ') ||
        taskName.includes('Parallel Task') ||
        taskName.includes('Conditional') ||
        // Check for payload metadata (for advanced branching)
        payload.conditionalBranch === true ||
        payload.branchType === 'main' ||
        payload.branchType === 'follow-up' ||
        payload.parallelExecution === true ||
        payload.parallelGroup !== undefined
      ) {
        branchingStats.branchingTasks++;
      } else if (
        // Check for dependent task chains by name patterns
        taskName.includes('Chain Step') ||
        taskName.includes('Step ') ||
        // Check for payload metadata (for advanced chaining)
        payload.chainStep !== undefined ||
        payload.dependsOn !== null ||
        payload.totalSteps !== undefined
      ) {
        branchingStats.dependentTasks++;
      } else if (task.workflowId) {
        branchingStats.workflowTasks++;
      } else {
        branchingStats.regularTasks++;
      }
    });

    return {
      byType: typeStats,
      branchingStats,
    };
  }

  async getRecentBranchingAndDependentTasks(
    page: number = 1,
    limit: number = 5,
  ): Promise<any> {
    // Get recent tasks with detailed information
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
      take: 200, // Get more tasks to filter from
    });

    const branchingTasks: any[] = [];
    const dependentTasks: any[] = [];

    // Group dependent tasks by workflow to show relationships
    const dependentTasksByWorkflow = new Map<string, any[]>();

    tasks.forEach((task) => {
      const taskName = task.name || '';
      const payload = (task.payload as any) || {};

      // Categorize and collect branching tasks
      if (
        taskName.includes('Branch ') ||
        taskName.includes('Parallel Task') ||
        taskName.includes('Conditional') ||
        payload.conditionalBranch === true ||
        payload.branchType === 'main' ||
        payload.branchType === 'follow-up' ||
        payload.parallelExecution === true ||
        payload.parallelGroup !== undefined
      ) {
        branchingTasks.push({
          ...task,
          category: 'branching',
          branchingType: this.getBranchingType(taskName, payload),
          branchingDetails: this.getBranchingDetails(taskName, payload),
        });
      }
      // Categorize and collect dependent tasks
      else if (
        taskName.includes('Chain Step') ||
        taskName.includes('Step ') ||
        payload.chainStep !== undefined ||
        payload.dependsOn !== null ||
        payload.totalSteps !== undefined
      ) {
        const workflowId = task.workflowId || 'no-workflow';
        if (!dependentTasksByWorkflow.has(workflowId)) {
          dependentTasksByWorkflow.set(workflowId, []);
        }
        dependentTasksByWorkflow.get(workflowId)!.push({
          ...task,
          category: 'dependent',
          dependencyInfo: this.getDependencyInfo(taskName, payload),
          dependencyDetails: this.getDependencyDetails(taskName, payload),
        });
      }
    });

    // Sort dependent tasks within each workflow by chain step
    dependentTasksByWorkflow.forEach((tasks, workflowId) => {
      tasks.sort((a, b) => {
        const aStep = (a.payload as any)?.chainStep || 0;
        const bStep = (b.payload as any)?.chainStep || 0;
        return aStep - bStep;
      });
      dependentTasks.push(...tasks);
    });

    // Apply pagination
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

  private getBranchingType(taskName: string, payload: any): string {
    if (taskName.includes('Parallel Task')) return 'Parallel Execution';
    if (taskName.includes('Branch ')) return 'Branching Workflow';
    if (taskName.includes('Conditional')) return 'Conditional Branch';
    if (payload.parallelExecution) return 'Parallel Execution';
    if (payload.conditionalBranch) return 'Conditional Branch';
    return 'Branching Task';
  }

  private getBranchingDetails(taskName: string, payload: any): any {
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

  private getDependencyInfo(taskName: string, payload: any): string {
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

  private getDependencyDetails(taskName: string, payload: any): any {
    if (payload.chainStep && payload.totalSteps) {
      const previousStep = payload.chainStep > 1 ? payload.chainStep - 1 : null;
      const nextStep =
        payload.chainStep < payload.totalSteps ? payload.chainStep + 1 : null;

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

  private convertPriorityToNumber(priority: string): number {
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
}
