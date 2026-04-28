import { DynamicModule, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { CctExplorerController } from './cct-explorer.controller';
import { DeviceQueueCacheService } from './device-queue-cache.service';
import { CctActionsService } from './cct-actions.service';
import {
  CCT_EXPLORER_OPTIONS,
  CctExplorerModuleOptions,
  DEVICE_GATEWAY_TOKEN,
} from './tokens';

@Module({})
export class CctExplorerModule {
  static forRoot(options: CctExplorerModuleOptions): DynamicModule {
    const { deviceGatewayClass, ...rest } = options;
    const browserPath = join(__dirname, 'public', 'browser');
    return {
      module: CctExplorerModule,
      imports: [
        ServeStaticModule.forRoot({
          rootPath: browserPath,
          serveRoot: '/browser',
        }),
      ],
      controllers: [CctExplorerController],
      providers: [
        {
          provide: CCT_EXPLORER_OPTIONS,
          useValue: rest,
        },
        deviceGatewayClass,
        {
          provide: DEVICE_GATEWAY_TOKEN,
          useExisting: deviceGatewayClass,
        },
        DeviceQueueCacheService,
        CctActionsService,
      ],
      exports: [CCT_EXPLORER_OPTIONS, DEVICE_GATEWAY_TOKEN, CctActionsService],
    };
  }
}
