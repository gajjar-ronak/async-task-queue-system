"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoordinatorModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const coordinator_service_1 = require("./coordinator.service");
const workflow_service_1 = require("./workflow.service");
const task_orchestration_service_1 = require("./task-orchestration.service");
const database_module_1 = require("../database/database.module");
let CoordinatorModule = class CoordinatorModule {
};
exports.CoordinatorModule = CoordinatorModule;
exports.CoordinatorModule = CoordinatorModule = __decorate([
    (0, common_1.Module)({
        imports: [schedule_1.ScheduleModule.forRoot(), database_module_1.DatabaseModule],
        providers: [coordinator_service_1.CoordinatorService, workflow_service_1.WorkflowService, task_orchestration_service_1.TaskOrchestrationService],
        exports: [coordinator_service_1.CoordinatorService, workflow_service_1.WorkflowService, task_orchestration_service_1.TaskOrchestrationService],
    })
], CoordinatorModule);
//# sourceMappingURL=coordinator.module.js.map