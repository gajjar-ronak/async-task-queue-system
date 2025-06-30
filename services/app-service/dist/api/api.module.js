"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiModule = void 0;
const common_1 = require("@nestjs/common");
const health_controller_1 = require("./health.controller");
const system_controller_1 = require("./system.controller");
const workflow_controller_1 = require("./workflow.controller");
const task_controller_1 = require("./task.controller");
const stress_test_controller_1 = require("./stress-test.controller");
const stress_test_service_1 = require("./stress-test.service");
const coordinator_module_1 = require("../coordinator/coordinator.module");
const core_module_1 = require("../core/core.module");
let ApiModule = class ApiModule {
};
exports.ApiModule = ApiModule;
exports.ApiModule = ApiModule = __decorate([
    (0, common_1.Module)({
        imports: [coordinator_module_1.CoordinatorModule, core_module_1.CoreModule],
        controllers: [
            health_controller_1.HealthController,
            system_controller_1.SystemController,
            workflow_controller_1.WorkflowController,
            task_controller_1.TaskController,
            stress_test_controller_1.StressTestController,
        ],
        providers: [stress_test_service_1.StressTestService],
    })
], ApiModule);
//# sourceMappingURL=api.module.js.map