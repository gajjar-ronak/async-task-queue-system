import { Test, TestingModule } from "@nestjs/testing";
import { AutoScalingService } from "./auto-scaling.service";
import { NodeManagerService } from "./node-manager.service";
import { PrismaService } from "@distributed-async-task-worker/shared";

describe("AutoScalingService", () => {
  let service: AutoScalingService;
  let nodeManagerService: NodeManagerService;
  let prismaService: PrismaService;

  const mockNodeManagerService = {
    getActiveNodesCount: jest.fn(),
    scaleUp: jest.fn(),
    scaleDown: jest.fn(),
  };

  const mockPrismaService = {
    task: {
      count: jest.fn(),
    },
    scalingEvent: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoScalingService,
        {
          provide: NodeManagerService,
          useValue: mockNodeManagerService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AutoScalingService>(AutoScalingService);
    nodeManagerService = module.get<NodeManagerService>(NodeManagerService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("checkAndScale", () => {
    it("should check scaling conditions", async () => {
      // Mock database task counts
      mockPrismaService.task.count
        .mockResolvedValueOnce(60) // pending tasks
        .mockResolvedValueOnce(5); // active tasks

      mockNodeManagerService.getActiveNodesCount.mockResolvedValue(2);

      await service.checkAndScale();

      expect(prismaService.task.count).toHaveBeenCalledTimes(2);
      expect(nodeManagerService.getActiveNodesCount).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      mockPrismaService.task.count.mockRejectedValue(
        new Error("Database error")
      );

      // Should not throw
      await expect(service.checkAndScale()).resolves.not.toThrow();
    });
  });

  describe("service initialization", () => {
    it("should be defined", () => {
      expect(service).toBeDefined();
    });

    it("should have required dependencies", () => {
      expect(nodeManagerService).toBeDefined();
      expect(prismaService).toBeDefined();
    });
  });
});
