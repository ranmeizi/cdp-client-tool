import { ManagerOptions, SocketOptions } from "socket.io-client"
import { Client } from "./Client"
import * as path from "node:path"
import { ensureDir } from "./utils"
import * as fs from 'node:fs'
import { Runner } from "./core/Runner"
import { WsHandler } from "./core/WsHandler"

export enum EVENTS {
    IS_FILE_EXIST = "is_file_exist",
    WRITE_FILE = 'write_file', // 写入文件 基本与nodefs的一致，多了前缀校验 和 空文件夹处理
    RM = "rm", // 删除文件
    READ_DIR = "read_dir", // 读取目录
    READ_FILE = "read_file", // 读取文件    
    EXEC_LOCAL_SCRIPT = "exec_local_script", // 执行本地脚本
    EXEC_REMOTE_SCRIPT = "exec_remote_script", // 执行远程脚本
    SCRIPT_QUEUE = "script_queue", // 查询脚本执行队列
    INTERRUPT_SCRIPT = "interrupt_script", // 中断脚本执行
    UNDO_SCRIPT = "undo_script", // 撤销脚本执行
}

export type Context = {
    runner: Runner
    ws: WsHandler
}

export type ScriptJob = {
    id: string
    // 本地代码 | 远程代码
    type: 'local' | 'remote'
    // 文件名 如果传了 filename 和 script 则先保存 script 再按 local 方式执行
    filename?: string
    // 脚本字符串
    script?: string
    params?: any
}

export enum PushJobResult {
    SUCCESS = 'success',
    SUCCESS_IN_QUEUE = 'success_in_queue',
    FAILED = 'failed',
    QUEUE_FULL = 'queue_full',
    FILE_SAVE_FAILED = 'file_save_failed',
}

export type GatewayConfig = {
    name: string // 命名
    uri: string,
    opts?: Partial<ManagerOptions & SocketOptions>
    onSocketInit?: (socket: any) => void
}

export type ClientOptions = {
    capacity?: number;
    timeout?: number;// 超时时间
    minInterval?: number;// 最小间隔时间
    gateways: GatewayConfig[]; // 网关配置
    deviceName?: string; // 设备名称
}

const ALLOWED_DIRS = ['local_scripts', 'screenshots'] as const

/** 校验 path 是否落在允许的目录下（local_scripts / screenshots） */
export function resolveAndValidate(basePath: string): string {
    const cwd = process.cwd()
    const resolved = path.resolve(cwd, basePath)
    const allowedRoots = ALLOWED_DIRS.map(d => path.resolve(cwd, d))
    const normalized = path.normalize(resolved)
    const allowed = allowedRoots.some(root => normalized === root || normalized.startsWith(root + path.sep))
    if (!allowed) {
        throw new Error(`路径仅允许在 ${ALLOWED_DIRS.join('、')} 下`)
    }
    return resolved
}



export function getSctiptFilePath(filename: string) {
    const pathStr = path.resolve(process.cwd(), 'local_scripts', filename)

    // 
}

export function getScreenshotFilePath(filename: string) {
    const pathStr = path.resolve(process.cwd(), 'screenshots', filename)

}

// 存脚本
export async function saveScriptFile(filename: string, script: string) {
    await ensureDir(path.resolve(process.cwd(), 'local_scripts'))

    fs.writeFileSync(path.resolve(process.cwd(), 'local_scripts', filename), script);
}