"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const common_1 = require("@nestjs/common");
const bull_1 = require("@nestjs/bull");
const config_1 = require("@nestjs/config");
const queue_manager_service_1 = require("./queue-manager.service");
const task_processor_1 = require("./task.processor");
const database_module_1 = require("../database/database.module");
const core_module_1 = require("../core/core.module");
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Module)({
        imports: [
            database_module_1.DatabaseModule,
            (0, common_1.forwardRef)(() => core_module_1.CoreModule),
            bull_1.BullModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: async (configService) => ({
                    redis: {
                        host: configService.get('REDIS_HOST', 'localhost'),
                        port: configService.get('REDIS_PORT', 6379),
                        password: configService.get('REDIS_PASSWORD'),
                        maxRetriesPerRequest: 3,
                        retryDelayOnFailover: 100,
                        enableReadyCheck: false,
                        maxLoadingTimeout: 1000,
                    },
                    defaultJobOptions: {
                        removeOnComplete: configService.get('QUEUE_REMOVE_ON_COMPLETE', 100),
                        removeOnFail: configService.get('QUEUE_REMOVE_ON_FAIL', 50),
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 2000,
                        },
                    },
                }),
                inject: [config_1.ConfigService],
            }),
            bull_1.BullModule.registerQueue({
                name: 'task-queue',
                defaultJobOptions: {
                    removeOnComplete: 100,
                    removeOnFail: 50,
                },
            }),
        ],
        providers: [queue_manager_service_1.QueueManagerService, task_processor_1.TaskProcessor],
        exports: [queue_manager_service_1.QueueManagerService],
    })
], QueueModule);
//# sourceMappingURL=queue.module.js.map