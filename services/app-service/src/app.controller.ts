import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('info')
  getInfo() {
    return {
      name: 'Distributed Async Task Worker - App Service',
      version: '1.0.0',
      description: 'App service for distributed async task worker system',
      features: [
        'REST API Endpoints',
        'Dashboard UI',
        'Task Coordination',
        'Workflow Management',
        'System Monitoring',
        'Auto-scaling Management',
      ],
      endpoints: {
        workflows: '/workflows',
        tasks: '/tasks',
        health: '/health',
        system: '/system',
        'auto-scaling': '/auto-scaling',
        cron: '/cron',
      },
    };
  }
}
