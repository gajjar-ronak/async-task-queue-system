import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "@distributed-async-task-worker/shared";

describe("Worker Health API (e2e)", () => {
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

  describe("/health (GET)", () => {
    it("should return basic health status", async () => {
      const response = await request(app.getHttpServer())
        .get("/health")
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        timestamp: expect.any(String),
        service: "worker-service",
        database: expect.stringMatching(/^(connected|disconnected)$/),
        redis: expect.stringMatching(/^(connected|disconnected)$/),
        worker: expect.any(Object),
        nodeId: expect.any(String),
        hostname: expect.any(String),
      });
    });
  });
});
