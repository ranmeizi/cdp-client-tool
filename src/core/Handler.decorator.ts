import { EVENTS } from "../common";

/** 事件 payload 类型映射，与 EVENTS 一一对应 */
export type EventPayloads = {
  [EVENTS.IS_FILE_EXIST]: { payload: { path: string } };
  [EVENTS.WRITE_FILE]: {
    payload: { filename: string; content: string | Uint8Array; flags?: string };
  };
  [EVENTS.RM]: { payload: { path: string; recursive?: boolean } };
  [EVENTS.READ_DIR]: { payload: { path: string } };
  [EVENTS.READ_FILE]: { payload: { path: string } };
  [EVENTS.EXEC_LOCAL_SCRIPT]: { payload: { filename: string; params?: any } };
  [EVENTS.EXEC_REMOTE_SCRIPT]: { payload: { raw: Buffer; params?: any } };
  [EVENTS.SCRIPT_QUEUE]: { payload: Record<string, never> };
  [EVENTS.INTERRUPT_SCRIPT]: { payload: { jobId: string } };
  [EVENTS.UNDO_SCRIPT]: { payload: { jobId: string } };
};

export type EventKey = keyof EventPayloads;

/** Handler 接收的上下文，泛型 K 为事件名，自动推导 data 类型 */
export type HandlerContext<K extends EventKey = EventKey> = {
  data: EventPayloads[K];
  callback: (...args: any[]) => void;
  gateway: import("../common").GatewayConfig;
  ctx: import("../common").Context;
};

/** 辅助类型：根据事件名推导 Handler 参数类型 */
export type HandlerFor<K extends EventKey> = HandlerContext<K>;

const HANDLER_REGISTRY = Symbol("handler:registry");

/** 从类实例获取已注册的 handler 列表 */
export function getHandlerRegistry(
  instance: object
): Array<{ event: EventKey; key: string }> {
  const ctor = (instance as any).constructor;
  return (ctor[HANDLER_REGISTRY] as Array<{ event: EventKey; key: string }>) ?? [];
}

/**
 * Handler 装饰器：注册事件到方法，实现隐式 socket.on 绑定 + 类型约束
 *
 * 用法：
 *   @Handler(EVENTS.READ_DIR)
 *   async readDir({ data, callback }: HandlerContext<typeof EVENTS.READ_DIR>) {
 *     // data 自动推导为 { payload: { path: string } }
 *     callback(await readdir(data.payload.path));
 *   }
 */
export function Handler<K extends EventKey>(eventName: K) {
  return function (
    target: object,
    propertyKey: string,
    _descriptor?: PropertyDescriptor
  ) {
    const ctor =
      typeof target === "function" ? target : (target as any).constructor;
    const registry: Array<{ event: EventKey; key: string }> =
      (ctor as any)[HANDLER_REGISTRY] ?? [];
    registry.push({ event: eventName, key: propertyKey });
    (ctor as any)[HANDLER_REGISTRY] = registry;
  };
}
