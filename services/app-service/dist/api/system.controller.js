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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemController = void 0;
const common_1 = require("@nestjs/common");
const node_manager_service_1 = require("../core/node-manager.service");
const performance_metrics_service_1 = require("../core/performance-metrics.service");
let SystemController = class SystemController {
    nodeManagerService;
    performanceMetricsService;
    constructor(nodeManagerService, performanceMetricsService) {
        this.nodeManagerService = nodeManagerService;
        this.performanceMetricsService = performanceMetricsService;
    }
    async getNodes() {
        return await this.nodeManagerService.getAllNodes();
    }
    async getActiveNodesCount() {
        const count = await this.nodeManagerService.getActiveNodesCount();
        return { activeNodes: count };
    }
    async getCurrentPerformance() {
        return await this.performanceMetricsService.getCurrentPerformanceMetrics();
    }
    async getPerformanceSummary() {
        return await this.performanceMetricsService.getSystemPerformanceSummary();
    }
    async getHistoricalPerformance() {
        return await this.performanceMetricsService.getHistoricalMetrics(24);
    }
};
exports.SystemController = SystemController;
__decorate([
    (0, common_1.Get)('nodes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemController.prototype, "getNodes", null);
__decorate([
    (0, common_1.Get)('nodes/active-count'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemController.prototype, "getActiveNodesCount", null);
__decorate([
    (0, common_1.Get)('performance/current'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemController.prototype, "getCurrentPerformance", null);
__decorate([
    (0, common_1.Get)('performance/summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemController.prototype, "getPerformanceSummary", null);
__decorate([
    (0, common_1.Get)('performance/historical'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemController.prototype, "getHistoricalPerformance", null);
exports.SystemController = SystemController = __decorate([
    (0, common_1.Controller)('system'),
    __metadata("design:paramtypes", [node_manager_service_1.NodeManagerService,
        performance_metrics_service_1.PerformanceMetricsService])
], SystemController);
//# sourceMappingURL=system.controller.js.map