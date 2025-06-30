import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { TaskOrchestrationService } from '../coordinator/task-orchestration.service';
import { TaskStatus } from '@distributed-async-task-worker/shared';

@Controller('tasks')
export class TaskController {
  constructor(private taskOrchestrationService: TaskOrchestrationService) {}

  @Post()
  async createTask(
    @Body()
    dto: {
      workflowId?: string;
      name: string;
      type: string;
      payload?: any;
      priority?: number;
      delay?: number;
      maxAttempts?: number;
    },
  ) {
    return await this.taskOrchestrationService.createTask(dto);
  }

  @Get()
  async listTasks(
    @Query('status') status?: TaskStatus,
    @Query('type') type?: string,
    @Query('workflowId') workflowId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.taskOrchestrationService.listTasks({
      status,
      type,
      workflowId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  @Get('stats')
  async getTaskStats() {
    return await this.taskOrchestrationService.getTaskStats();
  }

  @Get('recent-branching-dependent')
  async getRecentBranchingAndDependentTasks(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return await this.taskOrchestrationService.getRecentBranchingAndDependentTasks(
      pageNum,
      limitNum,
    );
  }

  @Get(':id')
  async getTask(@Param('id') id: string) {
    return await this.taskOrchestrationService.getTask(id);
  }

  @Get(':id/logs')
  async getTaskLogs(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.taskOrchestrationService.getTaskLogs(
      id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Put(':id/retry')
  async retryTask(@Param('id') id: string) {
    await this.taskOrchestrationService.retryTask(id);
    return { message: 'Task retried successfully' };
  }

  @Put(':id/cancel')
  async cancelTask(@Param('id') id: string) {
    await this.taskOrchestrationService.cancelTask(id);
    return { message: 'Task cancelled successfully' };
  }
}
