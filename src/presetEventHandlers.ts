import { Client } from "./Client"
import { EVENTS, GatewayConfig } from "./common"
import { readFile, rm, writeFile, readdir } from 'node:fs/promises'

export type Handler<TData = any> = (this: Client, { }: {
    data: TData,
    gateway: GatewayConfig,
    ctx: Client['ctx'],
    callback: (...args: any[]) => void
}) => void | Promise<void> // 同步｜异步

// 事件对应的 payload 类型映射
type EventPayloads = {
  [EVENTS.READ_DIR]: { payload: { path: string } },
  [EVENTS.WRITE_FILE]: { payload: { filename: string, content: string | Uint8Array, flags?: string } },
  [EVENTS.RM]: { payload: { path: string, recursive?: boolean } },
  [EVENTS.EXEX_REMOTE_SCRIPT]: { payload: { raw: Buffer } },
  [EVENTS.EXEC_LOCAL_SCRIPT]: { payload: { filename: string } },
}

type HandlerMap = { [K in keyof EventPayloads]: Handler<EventPayloads[K]> }


const handlers: Partial<HandlerMap> = {
    // 运行远程脚本
    async [EVENTS.EXEX_REMOTE_SCRIPT]({ data, callback }) {
        const { payload } = data
        const script = this.getStringModule(payload.raw.toString())

        const res = await this.runCatchFunction(async () => await script(this.ctx))

        callback(res)
    },

    // 运行本地脚本
    async [EVENTS.EXEC_LOCAL_SCRIPT]({ data, callback }) {
        const { payload } = data
        const script = this.getLocalModule(payload.filename)
        // callback(await script(this.ctx))
    },

    // 读取目录
    async [EVENTS.READ_DIR]({ data, callback }) {
        const { payload } = data
        const res = await this.runCatchFunction(async () => await readdir(payload.path))
        callback(res)
    },
}

export default handlers