"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const path_1 = require("path");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });
    app.useStaticAssets((0, path_1.join)(__dirname, '..', '..', '..'), {
        index: false,
        prefix: '/',
    });
    const port = process.env.APP_SERVICE_PORT || 3002;
    await app.listen(port);
    common_1.Logger.log(`🚀 App Service is running on: http://localhost:${port}`, 'Bootstrap');
    common_1.Logger.log(`📊 Dashboard available at: http://localhost:${port}/dashboard.html`, 'Bootstrap');
}
bootstrap();
//# sourceMappingURL=main.js.map