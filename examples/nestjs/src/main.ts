import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SocketIoDeviceGateway } from './socket-io-device.gateway';
import { Server } from 'socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpServer = app.getHttpServer();
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });
  const gateway = app.get(SocketIoDeviceGateway);
  gateway.setIo(io);

  const port = 3000;
  await app.listen(port);
  console.log(`Nest gateway running at http://localhost:${port}`);
  console.log(`Browser UI: http://localhost:${port}/browser`);
}

bootstrap();
