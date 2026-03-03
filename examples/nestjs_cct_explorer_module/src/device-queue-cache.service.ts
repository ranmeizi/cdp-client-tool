import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import type { ScriptQueueSnapshot } from './device-gateway.interface';
import { DEVICE_GATEWAY_TOKEN } from './tokens';
import type { DeviceGateway } from './device-gateway.interface';
import { CCT_EXPLORER_OPTIONS, type CctExplorerModuleOptions } from './tokens';

export interface DeviceQueueState {
  snapshot: ScriptQueueSnapshot | null;
  updatedAt: number;
  error?: string;
}

@Injectable()
export class DeviceQueueCacheService implements OnModuleInit {
  private readonly cache = new Map<string, DeviceQueueState>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;

  constructor(
    @Inject(DEVICE_GATEWAY_TOKEN)
    private readonly gateway: DeviceGateway,
    @Inject(CCT_EXPLORER_OPTIONS)
    private readonly options: CctExplorerModuleOptions,
  ) {}

  onModuleInit() {
    const ms = this.options.scriptQueuePollIntervalMs ?? 1000;
    if (ms <= 0 || typeof this.gateway.getScriptQueue !== 'function') return;
    this.refresh();
    this.intervalId = setInterval(() => this.refresh(), ms);
  }

  getState(deviceName: string): DeviceQueueState | null {
    return this.cache.get(deviceName) ?? null;
  }

  private async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    const now = Date.now();
    try {
      const devices = await this.gateway.listDevices();
      await Promise.all(
        devices.map(async (d) => {
          try {
            const snapshot = await this.gateway.getScriptQueue!(d.name);
            this.cache.set(d.name, { snapshot, updatedAt: now });
          } catch (err: any) {
            this.cache.set(d.name, {
              snapshot: null,
              updatedAt: now,
              error: err?.message ?? '获取队列失败',
            });
          }
        }),
      );
    } catch (err) {
      // listDevices 失败时不覆盖已有缓存
    } finally {
      this.refreshing = false;
    }
  }
}
