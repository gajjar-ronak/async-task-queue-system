import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getHello(): string;
    getInfo(): {
        name: string;
        version: string;
        description: string;
        features: string[];
        endpoints: {
            health: string;
            queue: string;
            worker: string;
            metrics: string;
        };
    };
}
