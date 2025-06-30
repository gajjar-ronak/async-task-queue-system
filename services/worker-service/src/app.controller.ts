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
      name: 'Distributed Async Task Worker - Worker Service',
      version: '1.0.0',
      description: 'Worker service for distributed async task worker system',
      features: [
        'Task Processing',
        'Queue Management',
        'Worker Node Operations',
        'Performance Metrics Collection',
        'Dead Letter Queue Management',
      ],
      endpoints: {
        health: '/health',
        queue: '/queue',
        worker: '/worker',
        metrics: '/metrics',
      },
    };
  }
}
