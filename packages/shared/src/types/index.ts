// Re-export Prisma types
export { TaskStatus, LogLevel, DlqStatus } from '@prisma/client';

// Task-related interfaces
export interface TaskPayload {
  taskId: string;
  type: string;
  data: any;
  priority?: number;
  delay?: number;
  attempts?: number;
}

export interface TaskResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: any;
}

export interface CreateTaskDto {
  name: string;
  type: string;
  payload?: any;
  priority?: number;
  delay?: number;
  maxAttempts?: number;
}

// Workflow interfaces
export interface CreateWorkflowDto {
  name: string;
  description?: string;
  tasks: CreateTaskDto[];
}

// Dead Letter Queue interfaces
export interface DlqTaskData {
  originalTaskId: string;
  workflowId?: string;
  name: string;
  type: string;
  payload?: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  lastErrorStack?: string;
  failureReason?: string;
  originalCreatedAt: Date;
  firstFailedAt: Date;
  retryHistory?: any[];
  processingMetadata?: any;
}

export interface DlqStats {
  total: number;
  pending: number;
  reprocessing: number;
  resolved: number;
  archived: number;
  byType: Record<string, number>;
  byFailureReason: Record<string, number>;
}

// Performance metrics interfaces
export interface PerformanceData {
  avgProcessingTime: number;
  tasksPerSecond: number;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  timestamp: Date;
}

// Queue statistics
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// Worker node interfaces
export interface WorkerStats {
  workerId: string;
  isRunning: boolean;
  processingTasks: number;
  currentTasks: string[];
}

// System performance summary
export interface SystemPerformanceSummary {
  activeNodes: number;
  totalTasksLastHour: number;
  avgProcessingTime: number;
  tasksPerSecond: number;
  successRate: number;
}

// Workflow progress
export interface WorkflowProgress {
  total: number;
  completed: number;
  failed: number;
  processing: number;
  pending: number;
  percentage: number;
}

export interface WorkflowStatus {
  workflowId: string;
  status: string;
  progress: WorkflowProgress;
  taskCounts: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

// Task types enum
export enum TaskType {
  API_CALL = 'api-call',
  DATABASE_OPERATION = 'database-operation',
  FILE_PROCESSING = 'file-processing',
  EMAIL_SEND = 'email-send',
  DATA_TRANSFORMATION = 'data-transformation',
  WEBHOOK_CALL = 'webhook-call',
  REPORT_GENERATION = 'report-generation',
  DATA_CLEANUP = 'data-cleanup',
  HEALTH_CHECK = 'health-check',
  SYSTEM_MAINTENANCE = 'system-maintenance',
  BACKUP_OPERATION = 'backup-operation',
  CACHE_REFRESH = 'cache-refresh',
}

// Service communication interfaces
export interface ServiceHealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  details?: any;
}

export interface InterServiceMessage {
  from: string;
  to: string;
  type: string;
  payload: any;
  timestamp: Date;
}
