import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronJobManagerService } from './cron-job-manager.service';
import { CronJobController } from './cron-job.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
  ],
  providers: [CronJobManagerService],
  controllers: [CronJobController],
  exports: [CronJobManagerService],
})
export class CronModule {}
