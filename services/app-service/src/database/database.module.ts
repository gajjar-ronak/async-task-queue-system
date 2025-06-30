import { Module, Global } from '@nestjs/common';
import { PrismaService } from '@distributed-async-task-worker/shared';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => {
        const prisma = PrismaService.getInstance();
        prisma.connect();
        return prisma;
      },
    },
  ],
  exports: [PrismaService],
})
export class DatabaseModule {}
