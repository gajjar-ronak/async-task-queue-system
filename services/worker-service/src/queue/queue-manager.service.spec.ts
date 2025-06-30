import { Test, TestingModule } from "@nestjs/testing";
import { QueueManagerService } from "./queue-manager.service";
import { getQueueToken } from "@nestjs/bull";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";

describe("QueueManagerService", () => {
  let service: QueueManagerService;
  let mockQueue: any;
  let configService: ConfigService;

  const mockBullQueue = {
    add: jest.fn(),
    addBulk: jest.fn(),
    getJob: jest.fn(),
    getJobs: jest.fn(),
    getWaiting: jest.fn(),
    getActive: jest.fn(),
    getCompleted: jest.fn(),
    getFailed: jest.fn(),
    getDelayed: jest.fn(),
    removeJobs: jest.fn(),
    clean: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    isPaused: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueManagerService,
        {
          provide: getQueueToken("task-queue"),
          useValue: mockBullQueue,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<QueueManagerService>(QueueManagerService);
    mockQueue = module.get(getQueueToken("task-queue"));
    configService = module.get<ConfigService>(ConfigService);

    // Setup default config values
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: any) => {
        const config = {
          QUEUE_REMOVE_ON_COMPLETE: 100,
          QUEUE_REMOVE_ON_FAIL: 50,
        };
        return config[key] ?? defaultValue;
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("addTask", () => {
    it("should add a task to the queue successfully", async () => {
      const taskPayload = {
        taskId: "task-123",
        type: "data-processing",
        data: { name: "Test Task", payload: { data: "test" } },
        priority: 1,
        delay: 0,
        attempts: 3,
      };

      const mockJob = {
        id: "job-123",
        data: taskPayload,
        opts: {
          priority: 1,
          delay: 0,
          attempts: 3,
        },
      };

      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.addTask(taskPayload);

      expect(mockQueue.add).toHaveBeenCalledWith("process-task", taskPayload, {
        priority: 1,
        delay: 0,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
      expect(result).toEqual(mockJob);
    });

    it("should handle task addition errors", async () => {
      const taskPayload = {
        taskId: "task-123",
        type: "data-processing",
        data: { name: "Test Task", payload: { data: "test" } },
      };

      const error = new Error("Queue is full");
      mockQueue.add.mockRejectedValue(error);

      await expect(service.addTask(taskPayload)).rejects.toThrow(
        "Queue is full"
      );
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it("should use default values for optional parameters", async () => {
      const taskPayload = {
        taskId: "task-123",
        type: "data-processing",
        data: { name: "Test Task", payload: { data: "test" } },
      };

      const mockJob = { id: "job-123", data: taskPayload };
      mockQueue.add.mockResolvedValue(mockJob);

      await service.addTask(taskPayload);

      expect(mockQueue.add).toHaveBeenCalledWith("process-task", taskPayload, {
        priority: 0, // default
        delay: 0, // default
        attempts: 3, // default
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    });
  });

  describe("addBulkTasks", () => {
    it("should add multiple tasks to the queue", async () => {
      const taskPayloads = [
        {
          taskId: "task-1",
          type: "data-processing",
          data: { name: "Task 1", payload: { data: "test1" } },
          priority: 1,
        },
        {
          taskId: "task-2",
          type: "data-processing",
          data: { name: "Task 2", payload: { data: "test2" } },
          priority: 2,
        },
      ];

      const mockJobs = [
        { id: "job-1", data: taskPayloads[0] },
        { id: "job-2", data: taskPayloads[1] },
      ];

      mockQueue.addBulk.mockResolvedValue(mockJobs);

      const result = await service.addBulkTasks(taskPayloads);

      expect(mockQueue.addBulk).toHaveBeenCalledWith([
        {
          name: "process-task",
          data: taskPayloads[0],
          opts: {
            priority: 1,
            delay: 0,
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 2000,
            },
          },
        },
        {
          name: "process-task",
          data: taskPayloads[1],
          opts: {
            priority: 2,
            delay: 0,
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 2000,
            },
          },
        },
      ]);
      expect(result).toEqual(mockJobs);
    });

    it("should handle bulk task addition errors", async () => {
      const taskPayloads = [
        {
          taskId: "task-1",
          type: "data-processing",
          data: { name: "Task 1", payload: { data: "test1" } },
        },
      ];

      const error = new Error("Bulk operation failed");
      mockQueue.addBulk.mockRejectedValue(error);

      await expect(service.addBulkTasks(taskPayloads)).rejects.toThrow(
        "Bulk operation failed"
      );
    });
  });

  describe("getQueueStats", () => {
    it("should return queue statistics", async () => {
      const mockWaitingJobs = [{ id: "job-1" }, { id: "job-2" }];
      const mockActiveJobs = [{ id: "job-3" }];
      const mockCompletedJobs = [{ id: "job-4" }, { id: "job-5" }];
      const mockFailedJobs = [{ id: "job-6" }];
      const mockDelayedJobs = [];

      mockQueue.getWaiting.mockResolvedValue(mockWaitingJobs);
      mockQueue.getActive.mockResolvedValue(mockActiveJobs);
      mockQueue.getCompleted.mockResolvedValue(mockCompletedJobs);
      mockQueue.getFailed.mockResolvedValue(mockFailedJobs);
      mockQueue.getDelayed.mockResolvedValue(mockDelayedJobs);

      const result = await service.getQueueStats();

      expect(result).toEqual({
        waiting: 2,
        active: 1,
        completed: 2,
        failed: 1,
        delayed: 0,
      });
    });

    it("should handle queue stats errors", async () => {
      mockQueue.getWaiting.mockRejectedValue(new Error("Queue error"));

      await expect(service.getQueueStats()).rejects.toThrow("Queue error");
    });
  });

  describe("pauseQueue", () => {
    it("should pause the queue", async () => {
      mockQueue.pause.mockResolvedValue(undefined);

      await service.pauseQueue();

      expect(mockQueue.pause).toHaveBeenCalled();
    });
  });

  describe("resumeQueue", () => {
    it("should resume the queue", async () => {
      mockQueue.resume.mockResolvedValue(undefined);

      await service.resumeQueue();

      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe("cleanQueue", () => {
    it("should clean completed and failed jobs", async () => {
      mockQueue.clean.mockResolvedValue([]);

      await service.cleanQueue();

      expect(mockQueue.clean).toHaveBeenCalledWith(5000, "completed");
      expect(mockQueue.clean).toHaveBeenCalledWith(5000, "failed");
    });
  });
});
