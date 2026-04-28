import { Module } from '@nestjs/common';
import { CctExplorerModule } from '@bomon/nestjs-cct-explorer';
import { SocketIoDeviceGateway } from './socket-io-device.gateway';
import { ScriptActionBizService } from './script-action.biz.service';

@Module({
  imports: [
    CctExplorerModule.forRoot({
      deviceGatewayClass: SocketIoDeviceGateway,
    }),
  ],
  providers: [ScriptActionBizService],
  exports: [ScriptActionBizService],
})
export class AppModule {}
