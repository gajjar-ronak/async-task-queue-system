"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const client_1 = require("@prisma/client");
class PrismaService extends client_1.PrismaClient {
    static instance;
    constructor() {
        super({
            log: ['warn', 'error'],
        });
    }
    static getInstance() {
        if (!PrismaService.instance) {
            PrismaService.instance = new PrismaService();
        }
        return PrismaService.instance;
    }
    async connect() {
        try {
            await this.$connect();
            console.log('Database connected successfully');
        }
        catch (error) {
            console.error('Failed to connect to database:', error);
            throw error;
        }
    }
    async disconnect() {
        await this.$disconnect();
        console.log('Database disconnected');
    }
}
exports.PrismaService = PrismaService;
