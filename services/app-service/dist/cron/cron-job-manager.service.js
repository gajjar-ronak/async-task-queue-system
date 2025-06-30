"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CronJobManagerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronJobManagerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const shared_1 = require("@distributed-async-task-worker/shared");
const cron_1 = require("cron");
let CronJobManagerService = CronJobManagerService_1 = class CronJobManagerService {
    prismaService;
    schedulerRegistry;
    logger = new common_1.Logger(CronJobManagerService_1.name);
    cronJobs = new Map();
    executions = new Map();
    constructor(prismaService, schedulerRegistry) {
        this.prismaService = prismaService;
        this.schedulerRegistry = schedulerRegistry;
    }
    async onModuleInit() {
        await this.initializeCronJobs();
    }
    async initializeCronJobs() {
        this.logger.log('Initializing CRON jobs...');
        const defaultJobs = [
            {
                name: 'System Health Check',
                description: 'Periodic system health monitoring',
                schedule: '*/5 * * * *',
                enabled: true,
                taskType: 'health-check',
                payload: { type: 'system-health' },
            },
            {
                name: 'Database Cleanup',
                description: 'Clean up old completed tasks and logs',
                schedule: '0 2 * * *',
                enabled: true,
                taskType: 'data-cleanup',
                payload: { type: 'database-cleanup', retentionDays: 30 },
            },
        ];
        for (const jobDef of defaultJobs) {
            const jobId = `cron-${jobDef.name.toLowerCase().replace(/\s+/g, '-')}`;
            const cronJob = {
                ...jobDef,
                id: jobId,
                runCount: 0,
                successCount: 0,
                failureCount: 0,
                averageExecutionTime: 0,
            };
            this.cronJobs.set(jobId, cronJob);
            await this.scheduleCronJob(cronJob);
        }
        this.logger.log(`Initialized ${this.cronJobs.size} CRON jobs`);
    }
    async scheduleCronJob(jobDef) {
        if (!jobDef.enabled) {
            return;
        }
        try {
            const job = new cron_1.CronJob(jobDef.schedule, async () => {
                await this.executeCronJob(jobDef.id);
            });
            this.schedulerRegistry.addCronJob(jobDef.id, job);
            job.start();
            this.logger.log(`Scheduled CRON job: ${jobDef.name} (${jobDef.schedule})`);
        }
        catch (error) {
            this.logger.error(`Failed to schedule CRON job ${jobDef.name}:`, error);
        }
    }
    async executeCronJob(jobId) {
        const jobDef = this.cronJobs.get(jobId);
        if (!jobDef) {
            this.logger.error(`CRON job ${jobId} not found`);
            return;
        }
        const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const execution = {
            id: executionId,
            cronJobId: jobId,
            startTime: new Date(),
            status: 'running',
        };
        this.executions.set(executionId, execution);
        try {
            this.logger.log(`Executing CRON job: ${jobDef.name}`);
            const task = await this.prismaService.task.create({
                data: {
                    name: `CRON: ${jobDef.name}`,
                    type: jobDef.taskType,
                    payload: jobDef.payload || {},
                    priority: 1,
                    status: shared_1.TaskStatus.PENDING,
                },
            });
            execution.endTime = new Date();
            execution.status = 'completed';
            execution.executionTime = execution.endTime.getTime() - execution.startTime.getTime();
            execution.result = { taskId: task.id };
            jobDef.runCount++;
            jobDef.successCount++;
            jobDef.lastRun = execution.startTime;
            jobDef.averageExecutionTime =
                (jobDef.averageExecutionTime * (jobDef.runCount - 1) + execution.executionTime) / jobDef.runCount;
            this.logger.log(`CRON job ${jobDef.name} completed successfully. Created task: ${task.id}`);
        }
        catch (error) {
            execution.endTime = new Date();
            execution.status = 'failed';
            execution.error = error.message;
            execution.executionTime = execution.endTime.getTime() - execution.startTime.getTime();
            jobDef.runCount++;
            jobDef.failureCount++;
            this.logger.error(`CRON job ${jobDef.name} failed:`, error);
        }
        this.executions.set(executionId, execution);
    }
    async getCronJobs() {
        return Array.from(this.cronJobs.values());
    }
    async getCronJob(jobId) {
        return this.cronJobs.get(jobId);
    }
    async getExecutions(jobId) {
        const executions = Array.from(this.executions.values());
        return jobId ? executions.filter(e => e.cronJobId === jobId) : executions;
    }
    async enableCronJob(jobId) {
        const jobDef = this.cronJobs.get(jobId);
        if (!jobDef) {
            throw new Error(`CRON job ${jobId} not found`);
        }
        jobDef.enabled = true;
        await this.scheduleCronJob(jobDef);
        this.logger.log(`Enabled CRON job: ${jobDef.name}`);
    }
    async disableCronJob(jobId) {
        const jobDef = this.cronJobs.get(jobId);
        if (!jobDef) {
            throw new Error(`CRON job ${jobId} not found`);
        }
        jobDef.enabled = false;
        try {
            this.schedulerRegistry.deleteCronJob(jobId);
        }
        catch (error) {
        }
        this.logger.log(`Disabled CRON job: ${jobDef.name}`);
    }
    async getCronJobStats() {
        const jobs = Array.from(this.cronJobs.values());
        const executions = Array.from(this.executions.values());
        return {
            totalJobs: jobs.length,
            enabledJobs: jobs.filter(j => j.enabled).length,
            totalExecutions: executions.length,
            successfulExecutions: executions.filter(e => e.status === 'completed').length,
            failedExecutions: executions.filter(e => e.status === 'failed').length,
            runningExecutions: executions.filter(e => e.status === 'running').length,
            jobs: jobs.map(job => ({
                id: job.id,
                name: job.name,
                enabled: job.enabled,
                runCount: job.runCount,
                successCount: job.successCount,
                failureCount: job.failureCount,
                lastRun: job.lastRun,
            })),
        };
    }
};
exports.CronJobManagerService = CronJobManagerService;
exports.CronJobManagerService = CronJobManagerService = CronJobManagerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_1.PrismaService,
        schedule_1.SchedulerRegistry])
], CronJobManagerService);
//# sourceMappingURL=cron-job-manager.service.js.map