import { Job } from 'bull';
import { TaskPayload } from '@distributed-async-task-worker/shared';
import { TaskProcessingService } from '../core/task-processing.service';
export declare class TaskProcessor {
    private taskProcessingService;
    private readonly logger;
    constructor(taskProcessingService: TaskProcessingService);
    handleTask(job: Job<TaskPayload>): Promise<any>;
}
