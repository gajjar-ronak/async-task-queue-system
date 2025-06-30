import { PrismaClient } from '@prisma/client';
export declare class PrismaService extends PrismaClient {
    private static instance;
    constructor();
    static getInstance(): PrismaService;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
}
