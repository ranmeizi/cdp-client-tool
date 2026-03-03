import { Client } from "./Client"
import { EVENTS, GatewayConfig, resolveAndValidate } from "./common"
import { readFile, rm, readdir } from 'node:fs/promises'

export type Handler<TData = any> = (this: Client, { }: {
    data: TData,
    gateway: GatewayConfig,
    ctx: Client['ctx'],
    callback: (...args: any[]) => void
}) => void | Promise<void> // 同步｜异步

// 事件对应的 payload 类型映射
type EventPayloads = {
    // 文件浏览
    [EVENTS.READ_DIR]: { payload: { path: string } },
    [EVENTS.WRITE_FILE]: { payload: { filename: string, content: string | Uint8Array, flags?: string } },
    [EVENTS.RM]: { payload: { path: string, recursive?: boolean } },
    [EVENTS.READ_FILE]: { payload: { path: string } },
    // 执行脚本
    [EVENTS.EXEC_REMOTE_SCRIPT]: { payload: { raw: Buffer } },
    [EVENTS.EXEC_LOCAL_SCRIPT]: { payload: { filename: string } },
    // 队列查询
    [EVENTS.SCRIPT_QUEUE]: { payload: {} },
}

type HandlerMap = { [K in keyof EventPayloads]: Handler<EventPayloads[K]> }


const handlers: Partial<HandlerMap> = {
    // 运行远程脚本
    async [EVENTS.EXEC_REMOTE_SCRIPT]({ data, callback }) {
        const { payload } = data
        const res = this.enqueueRemoteScript(payload.raw)
        callback(res)
    },

    // 运行本地脚本
    async [EVENTS.EXEC_LOCAL_SCRIPT]({ data, callback }) {
        const { payload } = data
        const res = this.enqueueLocalScript(payload.filename)
        callback(res)
    },

    async [EVENTS.WRITE_FILE]({ data, callback }) {
        const { payload } = data
        const { filename, content } = payload
        const filePath = resolveAndValidate(filename)

        // 

        callback({ ok: true })
    },

    // 读取目录：返回 { name, type: 'file'|'dir' }[] 供 browser 展示
    async [EVENTS.READ_DIR]({ data, callback }) {
        const { payload } = data
        const dirPath = resolveAndValidate(payload.path)
        const run = this.runCatchFunction(async () => {
            const list = await readdir(dirPath, { withFileTypes: true })
            return list.map(d => ({ name: d.name, type: d.isDirectory() ? 'dir' as const : 'file' as const }))
        })
        const entries = await run()
        callback(entries ?? [])
    },

    // 读取文件：仅允许 local_scripts / screenshots 下，返回 Buffer
    async [EVENTS.READ_FILE]({ data, callback }) {
        const { payload } = data
        const filePath = resolveAndValidate(payload.path)
        const run = this.runCatchFunction(async () => await readFile(filePath))
        const content = await run()
        callback(content ?? null)
    },

    // 删除文件：仅允许 local_scripts / screenshots 下
    async [EVENTS.RM]({ data, callback }) {
        const { payload } = data
        const filePath = resolveAndValidate(payload.path)
        const run = this.runCatchFunction(async () => await rm(filePath, { force: true }))
        await run()
        callback({ ok: true })
    },

    // 查询脚本执行队列
    async [EVENTS.SCRIPT_QUEUE]({ callback }) {
        const snapshot = this.getScriptQueueSnapshot()
        callback(snapshot)
    },
}

export default handlers