import type { DeviceGateway } from './device-gateway.interface';

export const DEVICE_GATEWAY_TOKEN = Symbol('DEVICE_GATEWAY_TOKEN');

export interface CctExplorerModuleOptions {
  /**
   * 实现 DeviceGateway 的类，由宿主应用提供，会在本模块内注册以便 Controller 注入
   */
  deviceGatewayClass: new (...args: any[]) => DeviceGateway;
  /**
   * HTTP 路径前缀，例如 'cct' 则接口为 /cct/api/devices、/cct/browser
   * 空字符串表示挂载在根路径
   */
  pathPrefix?: string;
  /**
   * 脚本队列轮询间隔（毫秒）。模块内会定时向所有设备拉取 script_queue 并缓存，GET api/devices 会带上 scriptQueue/queueUpdatedAt/queueError。
   * 默认 1000。设为 0 则关闭轮询，由接入方自行实现。
   */
  scriptQueuePollIntervalMs?: number;
}

export const CCT_EXPLORER_OPTIONS = Symbol('CCT_EXPLORER_OPTIONS');
