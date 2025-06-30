import { StressTestService, StressTestSession } from './stress-test.service';
export interface StressTestConfig {
    totalTasks: number;
    durationMinutes: number;
    taskTypes: string[];
    priorityDistribution: {
        high: number;
        medium: number;
        low: number;
    };
}
export declare class StressTestController {
    private stressTestService;
    constructor(stressTestService: StressTestService);
    startStressTest(config: StressTestConfig): Promise<{
        testId: string;
        message: string;
    }>;
    getStressTestStatus(testId: string): Promise<StressTestSession | null>;
    getStressTestResults(testId: string): Promise<any>;
    stopStressTest(testId: string): Promise<{
        message: string;
    }>;
    startAutoScalingTest(): Promise<{
        testId: string;
        message: string;
    }>;
    startMegaStressTest(): Promise<{
        testId: string;
        message: string;
    }>;
    startAdvancedBranchingTest(): Promise<{
        testId: string;
        message: string;
    }>;
}
