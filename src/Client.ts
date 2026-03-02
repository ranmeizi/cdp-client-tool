import { Browser } from "puppeteer-core";
import { Logger } from "./logger";
import { launchBrowser } from "./utils";
import { ManagerOptions, Socket, SocketOptions } from "socket.io-client";
import { io } from "socket.io-client";
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as requireFromString from 'require-from-string';
import handlers, { type Handler } from "./presetEventHandlers";
import { ClientOptions, EVENTS } from "./common";

const defaultOptions: ClientOptions = {
    deviceName: 'default',
    gateways: []
}

export class Client {
    browser: Browser | undefined

    public logger: Logger = new Logger()

    public running: boolean = false

    constructor(
        private options: ClientOptions = defaultOptions,
    ) {
        this.init()
    }
    runCatchFunction(func: Function) {
        const that = this;
        return async function (...args: any[]) {
            try {
                return await func(...args);
            } catch (error) {
                that.logger.error('runCatchFunction error', error)
                that.options.onError && that.options.onError(error)
            }
        };
    }

    // 初始化
    private async init() {
        // 连接浏览器
        this.browser = await this.runCatchFunction(launchBrowser)()

        this.options.onInit && this.options.onInit(this.ctx)

        // 连接网关
        for (const gateway of this.options.gateways) {

            const warpHandler = (fn: Handler) => {
                return (data, callback) => {
                    console.log('see', data, callback)
                    return fn.call(this, {
                        data,
                        callback,
                        gateway,
                        ctx: this.ctx
                    })
                }
            }

            const socket = io(gateway.uri, {
                ...gateway.opts,
                query: { ...gateway.opts?.query, deviceName: this.options.deviceName },
            });

            socket.on('connect', () => {
                this.logger.success(`[${gateway.name}]: socketio 连接成功`);
            })

            socket.on('disconnect', () => {
                this.logger.warn(`[${gateway.name}]: socketio 断开连接`);
            });

            socket.on('connect_error', (err) => {
                this.logger.error(`[${gateway.name}]: connect_error 错误`, err)
            })
            socket.on('error', (err) => {
                this.logger.error(`[[${gateway.name}]]: socketio 错误`, err)
            })

            // 预设事件
            for (const eventName in handlers) {
                socket.on(eventName, warpHandler(handlers[eventName]))
            }

            // 自己处理
            gateway.onSocketInit && gateway.onSocketInit(socket)
        }
    }

    /** 加载 local_scripts 下的脚本，使用 Node require，脚本以 CJS 运行，内部可使用 require() 引用其他 CJS 模块 */
    public getLocalModule(filename: string) {
        return require(path.resolve(process.cwd(), 'local_scripts', filename))
    }

    public getStringModule(moduleString: string) {
        const module = requireFromString(moduleString)
        return module
    }

    get ctx() {
        return {
            greeting: 'hello, remote script',
            browser: this.browser!
        }
    }
}