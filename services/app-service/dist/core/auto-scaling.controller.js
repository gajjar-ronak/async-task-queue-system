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
exports.AutoScalingController = exports.UpdateAutoScalingConfigDto = void 0;
const common_1 = require("@nestjs/common");
const auto_scaling_service_1 = require("./auto-scaling.service");
class UpdateAutoScalingConfigDto {
    scaleUpThreshold;
    scaleDownThreshold;
    minNodes;
    maxNodes;
    cooldownPeriod;
    checkInterval;
}
exports.UpdateAutoScalingConfigDto = UpdateAutoScalingConfigDto;
let AutoScalingController = class AutoScalingController {
    autoScalingService;
    constructor(autoScalingService) {
        this.autoScalingService = autoScalingService;
    }
    async getAutoScalingStats() {
        try {
            const stats = await this.autoScalingService.getAutoScalingStats();
            return {
                success: true,
                data: stats,
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: 'Failed to fetch auto-scaling statistics',
                error: error.message,
            }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getConfig() {
        try {
            const stats = await this.autoScalingService.getAutoScalingStats();
            return {
                success: true,
                data: stats.config,
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: 'Failed to fetch auto-scaling configuration',
                error: error.message,
            }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updateConfig(updateDto) {
        try {
            const updatedConfig = await this.autoScalingService.updateConfig(updateDto);
            return {
                success: true,
                message: 'Auto-scaling configuration updated successfully',
                data: updatedConfig,
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: 'Failed to update auto-scaling configuration',
                error: error.message,
            }, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async manualScaleUp() {
        try {
            await this.autoScalingService.manualScaleUp();
            return {
                success: true,
                message: 'Manual scale up executed successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: 'Failed to execute manual scale up',
                error: error.message,
            }, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async manualScaleDown() {
        try {
            await this.autoScalingService.manualScaleDown();
            return {
                success: true,
                message: 'Manual scale down executed successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: 'Failed to execute manual scale down',
                error: error.message,
            }, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async getCurrentNodeCount() {
        try {
            const nodeCount = await this.autoScalingService.getCurrentNodeCount();
            return {
                success: true,
                data: {
                    currentNodes: nodeCount,
                    timestamp: new Date().toISOString(),
                },
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: 'Failed to fetch current node count',
                error: error.message,
            }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.AutoScalingController = AutoScalingController;
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AutoScalingController.prototype, "getAutoScalingStats", null);
__decorate([
    (0, common_1.Get)('config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AutoScalingController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Put)('config'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpdateAutoScalingConfigDto]),
    __metadata("design:returntype", Promise)
], AutoScalingController.prototype, "updateConfig", null);
__decorate([
    (0, common_1.Post)('scale-up'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AutoScalingController.prototype, "manualScaleUp", null);
__decorate([
    (0, common_1.Post)('scale-down'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AutoScalingController.prototype, "manualScaleDown", null);
__decorate([
    (0, common_1.Get)('nodes/count'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AutoScalingController.prototype, "getCurrentNodeCount", null);
exports.AutoScalingController = AutoScalingController = __decorate([
    (0, common_1.Controller)('api/auto-scaling'),
    __metadata("design:paramtypes", [auto_scaling_service_1.AutoScalingService])
], AutoScalingController);
//# sourceMappingURL=auto-scaling.controller.js.map