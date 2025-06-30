import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Distributed Async Task Worker - Worker Service Ready!';
  }
}
