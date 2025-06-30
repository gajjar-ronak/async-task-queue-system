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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronJobController = exports.UpdateCronJobDto = exports.CreateCronJobDto = void 0;
const common_1 = require("@nestjs/common");
const cron_job_manager_service_1 = require("./cron-job-manager.service");
class CreateCronJobDto {
    name;
    description;
    schedule;
    taskType;
    payload;
    enabled;
}
exports.CreateCronJobDto = CreateCronJobDto;
class UpdateCronJobDto {
    name;
    description;
    schedule;
    taskType;
    payload;
    enabled;
}
exports.UpdateCronJobDto = UpdateCronJobDto;
let CronJobController = class CronJobController {
    cronJobManagerService;
    constructor(cronJobManagerService) {
        this.cronJobManagerService = cronJobManagerService;
    }
    async getCronJobs() {
        try {
            const jobs = await this.cronJobManagerService.getCronJobs();
            return {
                success: true,
                data: jobs,
                count: jobs.length,
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: 'Failed to fetch CRON jobs',
                error: error.message,
            }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getCronJobStats() {
        try {
            const stats = await this.cronJobManagerService.getCronJobStats();
            return {
                success: true,
                data: stats,
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: 'Failed to fetch CRON job statistics',
                error: error.message,
            }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getCronJob(id) {
        try {
            const job = await this.cronJobManagerService.getCronJob(id);
            if (!job) {
                throw new common_1.HttpException({
                    success: false,
                    message: 'CRON job not found',
                }, common_1.HttpStatus.NOT_FOUND);
            }
            return {
                success: true,
                data: job,
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException({
                success: false,
                message: 'Failed to fetch CRON job',
                error: error.message,
            }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getCronJobExecutions(id) {
        try {
            const executions = await this.cronJobManagerService.getExecutions(id);
            return {
                success: true,
                data: executions,
                count: executions.length,
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: 'Failed to fetch CRON job executions',
                error: error.message,
            }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async enableCronJob(id) {
        try {
            await this.cronJobManagerService.enableCronJob(id);
            return {
                success: true,
                message: 'CRON job enabled successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: 'Failed to enable CRON job',
                error: error.message,
            }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async disableCronJob(id) {
        try {
            await this.cronJobManagerService.disableCronJob(id);
            return {
                success: true,
                message: 'CRON job disabled successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: 'Failed to disable CRON job',
                error: error.message,
            }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.CronJobController = CronJobController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CronJobController.prototype, "getCronJobs", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CronJobController.prototype, "getCronJobStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronJobController.prototype, "getCronJob", null);
__decorate([
    (0, common_1.Get)(':id/executions'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronJobController.prototype, "getCronJobExecutions", null);
__decorate([
    (0, common_1.Put)(':id/enable'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronJobController.prototype, "enableCronJob", null);
__decorate([
    (0, common_1.Put)(':id/disable'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CronJobController.prototype, "disableCronJob", null);
exports.CronJobController = CronJobController = __decorate([
    (0, common_1.Controller)('cron'),
    __metadata("design:paramtypes", [cron_job_manager_service_1.CronJobManagerService])
], CronJobController);
//# sourceMappingURL=cron-job.controller.js.map