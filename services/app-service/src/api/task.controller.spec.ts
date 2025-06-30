import { Test, TestingModule } from "@nestjs/testing";
import { TaskController } from "./task.controller";
import { TaskOrchestrationService } from "../coordinator/task-orchestration.service";
import { TaskStatus } from "@distributed-async-task-worker/shared";
import { BadRequestException, NotFoundException } from "@nestjs/common";

describe("TaskController", () => {
  let controller: TaskController;
  let taskOrchestrationService: TaskOrchestrationService;

  const mockTaskOrchestrationService = {
    createTask: jest.fn(),
    getTask: jest.fn(),
    listTasks: jest.fn(),
    getTaskStats: jest.fn(),
    cancelTask: jest.fn(),
    retryTask: jest.fn(),
    getTaskLogs: jest.fn(),
    getRecentBranchingAndDependentTasks: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        {
          provide: TaskOrchestrationService,
          useValue: mockTaskOrchestrationService,
        },
      ],
    }).compile();

    controller = module.get<TaskController>(TaskController);
    taskOrchestrationService = module.get<TaskOrchestrationService>(
      TaskOrchestrationService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createTask", () => {
    it("should create a task successfully", async () => {
      const createTaskDto = {
        name: "Test Task",
        type: "data-processing",
        payload: { data: "test" },
        priority: 1,
      };

      const expectedTask = {
        id: "task-123",
        ...createTaskDto,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
      };

      mockTaskOrchestrationService.createTask.mockResolvedValue(expectedTask);

      const result = await controller.createTask(createTaskDto);

      expect(taskOrchestrationService.createTask).toHaveBeenCalledWith(
        createTaskDto
      );
      expect(result).toEqual(expectedTask);
    });

    it("should throw BadRequestException for invalid task data", async () => {
      const invalidTaskDto = {
        name: "",
        type: "invalid-type",
        payload: null,
      };

      mockTaskOrchestrationService.createTask.mockRejectedValue(
        new BadRequestException("Invalid task data")
      );

      await expect(controller.createTask(invalidTaskDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("getTask", () => {
    it("should return a task by id", async () => {
      const taskId = "task-123";
      const expectedTask = {
        id: taskId,
        name: "Test Task",
        type: "data-processing",
        status: TaskStatus.COMPLETED,
        createdAt: new Date(),
      };

      mockTaskOrchestrationService.getTask.mockResolvedValue(expectedTask);

      const result = await controller.getTask(taskId);

      expect(taskOrchestrationService.getTask).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(expectedTask);
    });

    it("should throw NotFoundException for non-existent task", async () => {
      const taskId = "non-existent-task";

      mockTaskOrchestrationService.getTask.mockRejectedValue(
        new NotFoundException("Task not found")
      );

      await expect(controller.getTask(taskId)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("listTasks", () => {
    it("should return paginated tasks", async () => {
      const expectedResult = {
        tasks: [
          {
            id: "task-1",
            name: "Task 1",
            status: TaskStatus.PENDING,
          },
          {
            id: "task-2",
            name: "Task 2",
            status: TaskStatus.PENDING,
          },
        ],
        total: 2,
        page: 1,
        limit: 10,
      };

      mockTaskOrchestrationService.listTasks.mockResolvedValue(expectedResult);

      const result = await controller.listTasks(
        TaskStatus.PENDING,
        undefined,
        undefined,
        "1",
        "10"
      );

      expect(taskOrchestrationService.listTasks).toHaveBeenCalledWith({
        status: TaskStatus.PENDING,
        type: undefined,
        workflowId: undefined,
        page: 1,
        limit: 10,
      });
      expect(result).toEqual(expectedResult);
    });

    it("should return empty array when no tasks found", async () => {
      const expectedResult = {
        tasks: [],
        total: 0,
        page: 1,
        limit: 10,
      };

      mockTaskOrchestrationService.listTasks.mockResolvedValue(expectedResult);

      const result = await controller.listTasks();

      expect(result.tasks).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("getTaskStats", () => {
    it("should return task statistics", async () => {
      const expectedStats = {
        total: 100,
        pending: 20,
        processing: 10,
        completed: 65,
        failed: 5,
        successRate: 92.9,
      };

      mockTaskOrchestrationService.getTaskStats.mockResolvedValue(
        expectedStats
      );

      const result = await controller.getTaskStats();

      expect(taskOrchestrationService.getTaskStats).toHaveBeenCalled();
      expect(result).toEqual(expectedStats);
      expect(result.successRate).toBeCloseTo(92.9, 1);
    });
  });

  describe("cancelTask", () => {
    it("should cancel a task successfully", async () => {
      const taskId = "task-123";

      mockTaskOrchestrationService.cancelTask.mockResolvedValue(undefined);

      const result = await controller.cancelTask(taskId);

      expect(taskOrchestrationService.cancelTask).toHaveBeenCalledWith(taskId);
      expect(result).toEqual({ message: "Task cancelled successfully" });
    });

    it("should throw NotFoundException when cancelling non-existent task", async () => {
      const taskId = "non-existent-task";

      mockTaskOrchestrationService.cancelTask.mockRejectedValue(
        new NotFoundException("Task not found")
      );

      await expect(controller.cancelTask(taskId)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
