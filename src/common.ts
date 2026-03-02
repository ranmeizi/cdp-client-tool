import { ManagerOptions, SocketOptions } from "socket.io-client"
import { Client } from "./Client"
import * as path from "node:path"
import { ensureDir } from "./utils"

export enum EVENTS {
    SET_FILE = "set_file",
    IS_FILE_EXIST = "is_file_exist",
    WRITE_FILE = 'write_file', // 写入文件 基本与nodefs的一致，多了前缀校验 和 空文件夹处理
    RM = "rm", // 删除文件
    READ_DIR = "read_dir", // 读取目录
    READ_FILE = "read_file", // 读取文件    
    EXEC_LOCAL_SCRIPT = "exec_local_script", // 执行本地脚本
    EXEX_REMOTE_SCRIPT = "exec_remote_script", // 执行远程脚本
}

export type GatewayConfig = {
    name: string // 命名
    uri: string,
    opts?: Partial<ManagerOptions & SocketOptions>
    onSocketInit?: (socket: any) => void
}

export type ClientOptions = {
    deviceName: string // 设备名
    onInit?: (ctx: Client['ctx']) => void
    onError?: (error: any) => void
    gateways: GatewayConfig[]
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