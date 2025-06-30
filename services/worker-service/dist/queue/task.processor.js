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
var TaskProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const task_processing_service_1 = require("../core/task-processing.service");
let TaskProcessor = TaskProcessor_1 = class TaskProcessor {
    taskProcessingService;
    logger = new common_1.Logger(TaskProcessor_1.name);
    constructor(taskProcessingService) {
        this.taskProcessingService = taskProcessingService;
    }
    async handleTask(job) {
        const { taskId, type, data } = job.data;
        try {
            this.logger.log(`Processing task ${taskId} of type ${type}`);
            await job.progress(10);
            const result = await this.taskProcessingService.processTask(taskId, type, data);
            await job.progress(100);
            this.logger.log(`Task ${taskId} completed successfully`);
            return result;
        }
        catch (error) {
            this.logger.error(`Task ${taskId} failed:`, error);
            throw error;
        }
    }
};
exports.TaskProcessor = TaskProcessor;
__decorate([
    (0, bull_1.Process)({
        name: 'process-task',
        concurrency: 10,
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TaskProcessor.prototype, "handleTask", null);
exports.TaskProcessor = TaskProcessor = TaskProcessor_1 = __decorate([
    (0, bull_1.Processor)('task-queue'),
    __metadata("design:paramtypes", [task_processing_service_1.TaskProcessingService])
], TaskProcessor);
//# sourceMappingURL=task.processor.js.map