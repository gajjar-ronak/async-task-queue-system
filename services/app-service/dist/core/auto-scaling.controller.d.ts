import { AutoScalingService, AutoScalingConfig } from './auto-scaling.service';
export declare class UpdateAutoScalingConfigDto {
    scaleUpThreshold?: number;
    scaleDownThreshold?: number;
    minNodes?: number;
    maxNodes?: number;
    cooldownPeriod?: number;
    checkInterval?: number;
}
export declare class AutoScalingController {
    private autoScalingService;
    constructor(autoScalingService: AutoScalingService);
    getAutoScalingStats(): Promise<{
        success: boolean;
        data: {
            currentNodes: number;
            config: AutoScalingConfig;
            lastScalingAction: Date | null;
            recentEvents: import("./auto-scaling.service").ScalingEvent[];
            isInCooldown: boolean;
            cooldownRemaining: number;
        };
    }>;
    getConfig(): Promise<{
        success: boolean;
        data: AutoScalingConfig;
    }>;
    updateConfig(updateDto: UpdateAutoScalingConfigDto): Promise<{
        success: boolean;
        message: string;
        data: AutoScalingConfig;
    }>;
    manualScaleUp(): Promise<{
        success: boolean;
        message: string;
    }>;
    manualScaleDown(): Promise<{
        success: boolean;
        message: string;
    }>;
    getCurrentNodeCount(): Promise<{
        success: boolean;
        data: {
            currentNodes: number;
            timestamp: string;
        };
    }>;
}
