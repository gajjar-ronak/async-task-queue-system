import { Injectable, Logger } from '@nestjs/common';
import {
  PrismaService,
  TaskStatus,
  CreateWorkflowDto,
  CreateTaskDto,
} from '@distributed-async-task-worker/shared';

export { CreateWorkflowDto, CreateTaskDto };

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(private prismaService: PrismaService) {}

  async createWorkflow(dto: CreateWorkflowDto): Promise<any> {
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
              status: TaskStatus.PENDING,
            })),
          },
        },
        include: {
          tasks: true,
        },
      });

      this.logger.log(
        `Created workflow ${workflow.id} with ${workflow.tasks.length} tasks`,
      );
      return workflow;
    } catch (error) {
      this.logger.error('Failed to create workflow:', error);
      throw error;
    }
  }

  async getWorkflow(workflowId: string): Promise<any> {
    return await this.prismaService.workflow.findUnique({
      where: { id: workflowId },
      include: {
        tasks: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async listWorkflows(page = 1, limit = 10): Promise<any> {
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

  async getWorkflowStatus(workflowId: string): Promise<any> {
    const workflow = await this.prismaService.workflow.findUnique({
      where: { id: workflowId },
      include: {
        tasks: true,
      },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const taskCounts = workflow.tasks.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalTasks = workflow.tasks.length;
    const completedTasks = taskCounts[TaskStatus.COMPLETED] || 0;
    const failedTasks = taskCounts[TaskStatus.FAILED] || 0;
    const processingTasks = taskCounts[TaskStatus.PROCESSING] || 0;
    const pendingTasks = taskCounts[TaskStatus.PENDING] || 0;

    let status = 'pending';
    if (completedTasks === totalTasks) {
      status = 'completed';
    } else if (failedTasks > 0 && completedTasks + failedTasks === totalTasks) {
      status = 'failed';
    } else if (processingTasks > 0 || pendingTasks < totalTasks) {
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
        percentage:
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      taskCounts,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    };
  }

  async pauseWorkflow(workflowId: string): Promise<void> {
    await this.prismaService.workflow.update({
      where: { id: workflowId },
      data: { isActive: false },
    });

    // Cancel pending tasks
    await this.prismaService.task.updateMany({
      where: {
        workflowId,
        status: TaskStatus.PENDING,
      },
      data: {
        status: TaskStatus.CANCELLED,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Workflow ${workflowId} paused`);
  }

  async resumeWorkflow(workflowId: string): Promise<void> {
    await this.prismaService.workflow.update({
      where: { id: workflowId },
      data: { isActive: true },
    });

    // Resume cancelled tasks
    await this.prismaService.task.updateMany({
      where: {
        workflowId,
        status: TaskStatus.CANCELLED,
      },
      data: {
        status: TaskStatus.PENDING,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Workflow ${workflowId} resumed`);
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    await this.prismaService.workflow.delete({
      where: { id: workflowId },
    });

    this.logger.log(`Workflow ${workflowId} deleted`);
  }

  async retryFailedTasks(workflowId: string): Promise<void> {
    const updatedTasks = await this.prismaService.task.updateMany({
      where: {
        workflowId,
        status: TaskStatus.FAILED,
        attempts: {
          lt: this.prismaService.task.fields.maxAttempts,
        },
      },
      data: {
        status: TaskStatus.PENDING,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `Retried ${updatedTasks.count} failed tasks in workflow ${workflowId}`,
    );
  }
}
