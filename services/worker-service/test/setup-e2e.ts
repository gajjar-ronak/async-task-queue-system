import { PrismaService } from "@distributed-async-task-worker/shared";

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = "test";
  // Use the existing development database for tests
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:password@localhost:5432/async_task_db";
  process.env.REDIS_HOST = "localhost";
  process.env.REDIS_PORT = "6379";
  process.env.WORKER_SERVICE_PORT = "3003";
  process.env.WORKER_NODE_ID = "test-worker-1";
  process.env.WORKER_CONCURRENCY = "2";
});

// Global test cleanup
afterAll(async () => {
  // Clean up only test-specific data to avoid interfering with development data
  try {
    const prisma = new PrismaService();

    // Only clean up test-specific data (tasks created during tests)
    await prisma.taskLog.deleteMany({
      where: {
        task: {
          name: {
            contains: "test",
          },
        },
      },
    });
    await prisma.task.deleteMany({
      where: {
        name: {
          contains: "test",
        },
      },
    });

    await prisma.$disconnect();
  } catch (error) {
    console.warn("Cleanup warning:", error.message);
  }
});

// Increase timeout for E2E tests
jest.setTimeout(30000);
