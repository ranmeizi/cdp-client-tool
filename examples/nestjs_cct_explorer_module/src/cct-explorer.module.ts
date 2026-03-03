import { DynamicModule, Module } from '@nestjs/common';
import { CctExplorerController } from './cct-explorer.controller';
import { DeviceQueueCacheService } from './device-queue-cache.service';
import {
  CCT_EXPLORER_OPTIONS,
  CctExplorerModuleOptions,
  DEVICE_GATEWAY_TOKEN,
} from './tokens';

@Module({})
export class CctExplorerModule {
  static forRoot(options: CctExplorerModuleOptions): DynamicModule {
    const { deviceGatewayClass, ...rest } = options;
    return {
      module: CctExplorerModule,
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
      ],
      exports: [CCT_EXPLORER_OPTIONS, DEVICE_GATEWAY_TOKEN],
    };
  }
}
