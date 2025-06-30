"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });
    const port = process.env.WORKER_SERVICE_PORT || 3003;
    await app.listen(port);
    common_1.Logger.log(`🔧 Worker Service is running on: http://localhost:${port}`, 'Bootstrap');
    common_1.Logger.log(`⚡ Ready to process tasks from queue`, 'Bootstrap');
}
bootstrap();
//# sourceMappingURL=main.js.map