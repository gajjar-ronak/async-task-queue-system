import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { WorkflowService, CreateWorkflowDto } from '../coordinator/workflow.service';

@Controller('workflows')
export class WorkflowController {
  constructor(private workflowService: WorkflowService) {}

  @Post()
  async createWorkflow(@Body() dto: CreateWorkflowDto) {
    return await this.workflowService.createWorkflow(dto);
  }

  @Get()
  async listWorkflows(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.workflowService.listWorkflows(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get(':id')
  async getWorkflow(@Param('id') id: string) {
    return await this.workflowService.getWorkflow(id);
  }

  @Get(':id/status')
  async getWorkflowStatus(@Param('id') id: string) {
    return await this.workflowService.getWorkflowStatus(id);
  }

  @Put(':id/pause')
  async pauseWorkflow(@Param('id') id: string) {
    await this.workflowService.pauseWorkflow(id);
    return { message: 'Workflow paused successfully' };
  }

  @Put(':id/resume')
  async resumeWorkflow(@Param('id') id: string) {
    await this.workflowService.resumeWorkflow(id);
    return { message: 'Workflow resumed successfully' };
  }

  @Put(':id/retry-failed')
  async retryFailedTasks(@Param('id') id: string) {
    await this.workflowService.retryFailedTasks(id);
    return { message: 'Failed tasks retried successfully' };
  }

  @Delete(':id')
  async deleteWorkflow(@Param('id') id: string) {
    await this.workflowService.deleteWorkflow(id);
    return { message: 'Workflow deleted successfully' };
  }
}
