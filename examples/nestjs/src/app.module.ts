import { Module } from '@nestjs/common';
import { CctExplorerModule } from '@bomon/nestjs-cct-explorer';
import { SocketIoDeviceGateway } from './socket-io-device.gateway';

@Module({
  imports: [
    CctExplorerModule.forRoot({
      deviceGatewayClass: SocketIoDeviceGateway,
    }),
  ],
})
export class AppModule {}
