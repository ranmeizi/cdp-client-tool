import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SocketIoDeviceGateway } from './socket-io-device.gateway';
import { ScriptActionBizService } from './script-action.biz.service';
import { Server } from 'socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpServer = app.getHttpServer();
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });
  const gateway = app.get(SocketIoDeviceGateway);
  const bizService = app.get(ScriptActionBizService);
  gateway.setIo(io);
  gateway.onDeviceConnected(async (deviceName) => {
    try {
      const result = await bizService.runBaiduScreenshotAction(deviceName);

      const result2 = await bizService.runBaiduScreenshotAction(deviceName);

    } catch (error) {
      console.error('biz action failed:', deviceName, error);
    }
  });

  const port = 3000;
  await app.listen(port);
  console.log(`Nest gateway running at http://localhost:${port}`);
  console.log(`Browser UI: http://localhost:${port}/browser`);
}

bootstrap();
