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
exports.StressTestController = void 0;
const common_1 = require("@nestjs/common");
const stress_test_service_1 = require("./stress-test.service");
let StressTestController = class StressTestController {
    stressTestService;
    constructor(stressTestService) {
        this.stressTestService = stressTestService;
    }
    async startStressTest(config) {
        return await this.stressTestService.startStressTest(config);
    }
    async getStressTestStatus(testId) {
        return await this.stressTestService.getStressTestStatus(testId);
    }
    async getStressTestResults(testId) {
        return await this.stressTestService.getStressTestResults(testId);
    }
    async stopStressTest(testId) {
        return await this.stressTestService.stopStressTest(testId);
    }
    async startAutoScalingTest() {
        const config = {
            totalTasks: 200,
            durationMinutes: 2,
            taskTypes: ['api-call', 'database-operation', 'file-processing'],
            priorityDistribution: {
                high: 30,
                medium: 50,
                low: 20,
            },
        };
        return await this.stressTestService.startStressTest(config);
    }
    async startMegaStressTest() {
        const config = {
            totalTasks: 500,
            durationMinutes: 3,
            taskTypes: [
                'api-call',
                'database-operation',
                'file-processing',
                'email-send',
                'data-transformation',
            ],
            priorityDistribution: {
                high: 40,
                medium: 40,
                low: 20,
            },
        };
        return await this.stressTestService.startStressTest(config);
    }
    async startAdvancedBranchingTest() {
        const config = {
            totalTasks: 100,
            durationMinutes: 2,
            taskTypes: [
                'api-call',
                'database-operation',
                'file-processing',
                'email-send',
                'data-transformation',
            ],
            priorityDistribution: {
                high: 30,
                medium: 50,
                low: 20,
            },
        };
        return await this.stressTestService.startStressTest(config);
    }
};
exports.StressTestController = StressTestController;
__decorate([
    (0, common_1.Post)('start'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StressTestController.prototype, "startStressTest", null);
__decorate([
    (0, common_1.Get)('status/:testId'),
    __param(0, (0, common_1.Param)('testId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StressTestController.prototype, "getStressTestStatus", null);
__decorate([
    (0, common_1.Get)('results/:testId'),
    __param(0, (0, common_1.Param)('testId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StressTestController.prototype, "getStressTestResults", null);
__decorate([
    (0, common_1.Post)('stop/:testId'),
    __param(0, (0, common_1.Param)('testId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StressTestController.prototype, "stopStressTest", null);
__decorate([
    (0, common_1.Post)('auto-scaling-test'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StressTestController.prototype, "startAutoScalingTest", null);
__decorate([
    (0, common_1.Post)('mega-stress-test'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StressTestController.prototype, "startMegaStressTest", null);
__decorate([
    (0, common_1.Post)('advanced-branching-test'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StressTestController.prototype, "startAdvancedBranchingTest", null);
exports.StressTestController = StressTestController = __decorate([
    (0, common_1.Controller)('stress-test'),
    __metadata("design:paramtypes", [stress_test_service_1.StressTestService])
], StressTestController);
//# sourceMappingURL=stress-test.controller.js.map