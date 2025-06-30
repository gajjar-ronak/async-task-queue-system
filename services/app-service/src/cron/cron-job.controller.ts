import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Param, 
  Body, 
  HttpException, 
  HttpStatus,
  Query 
} from '@nestjs/common';
import { CronJobManagerService, CronJobDefinition } from './cron-job-manager.service';

export class CreateCronJobDto {
  name: string;
  description: string;
  schedule: string;
  taskType: string;
  payload?: any;
  enabled?: boolean;
}

export class UpdateCronJobDto {
  name?: string;
  description?: string;
  schedule?: string;
  taskType?: string;
  payload?: any;
  enabled?: boolean;
}

@Controller('cron')
export class CronJobController {
  constructor(private cronJobManagerService: CronJobManagerService) {}

  @Get()
  async getCronJobs() {
    try {
      const jobs = await this.cronJobManagerService.getCronJobs();
      return {
        success: true,
        data: jobs,
        count: jobs.length,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to fetch CRON jobs',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats')
  async getCronJobStats() {
    try {
      const stats = await this.cronJobManagerService.getCronJobStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to fetch CRON job statistics',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getCronJob(@Param('id') id: string) {
    try {
      const job = await this.cronJobManagerService.getCronJob(id);
      if (!job) {
        throw new HttpException(
          {
            success: false,
            message: 'CRON job not found',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: job,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to fetch CRON job',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/executions')
  async getCronJobExecutions(@Param('id') id: string) {
    try {
      const executions = await this.cronJobManagerService.getExecutions(id);
      return {
        success: true,
        data: executions,
        count: executions.length,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to fetch CRON job executions',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id/enable')
  async enableCronJob(@Param('id') id: string) {
    try {
      await this.cronJobManagerService.enableCronJob(id);
      return {
        success: true,
        message: 'CRON job enabled successfully',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to enable CRON job',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id/disable')
  async disableCronJob(@Param('id') id: string) {
    try {
      await this.cronJobManagerService.disableCronJob(id);
      return {
        success: true,
        message: 'CRON job disabled successfully',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to disable CRON job',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
