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
}

export const CCT_EXPLORER_OPTIONS = Symbol('CCT_EXPLORER_OPTIONS');
