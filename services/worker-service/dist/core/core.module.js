"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const task_processing_service_1 = require("./task-processing.service");
const performance_metrics_service_1 = require("./performance-metrics.service");
const dead_letter_queue_service_1 = require("./dead-letter-queue.service");
const database_module_1 = require("../database/database.module");
const queue_module_1 = require("../queue/queue.module");
let CoreModule = class CoreModule {
};
exports.CoreModule = CoreModule;
exports.CoreModule = CoreModule = __decorate([
    (0, common_1.Module)({
        imports: [
            database_module_1.DatabaseModule,
            schedule_1.ScheduleModule.forRoot(),
            (0, common_1.forwardRef)(() => queue_module_1.QueueModule),
        ],
        providers: [
            task_processing_service_1.TaskProcessingService,
            performance_metrics_service_1.PerformanceMetricsService,
            dead_letter_queue_service_1.DeadLetterQueueService,
        ],
        controllers: [],
        exports: [
            task_processing_service_1.TaskProcessingService,
            performance_metrics_service_1.PerformanceMetricsService,
            dead_letter_queue_service_1.DeadLetterQueueService,
        ],
    })
], CoreModule);
//# sourceMappingURL=core.module.js.map