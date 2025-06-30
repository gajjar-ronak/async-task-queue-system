import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "@distributed-async-task-worker/shared";
import { TaskStatus } from "@distributed-async-task-worker/shared";

describe("Task API (e2e)", () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("/tasks (POST)", () => {
    it("should create a new task", async () => {
      const createTaskDto = {
        name: "E2E Test Task",
        type: "data-processing",
        payload: { data: "test data" },
        priority: 1,
      };

      const response = await request(app.getHttpServer())
        .post("/tasks")
        .send(createTaskDto)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: "E2E Test Task",
        type: "data-processing",
        status: TaskStatus.PENDING,
        priority: 1,
        attempts: 0,
        maxAttempts: 3,
        createdAt: expect.any(String),
      });
    });
  });
});
