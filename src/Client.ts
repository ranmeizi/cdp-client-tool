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

fs.readdir

const defaultOptions: ClientOptions = {
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
                return (data, callback) => fn.call(this, {
                    data,
                    callback,
                    gateway,
                    ctx: this.ctx
                })
            }

            const socket = io(gateway.uri, gateway.opts);

            socket.on('connect',()=>{
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

            socket.on(EVENTS.SET_FILE, ({ payload }, listener) => {

                const { filename, content } = payload

                if (!filename) {
                    listener({
                        code: '400',
                        message: 'filename is required'
                    })
                }

                if (!filename.startsWith('modules')) {
                    listener({
                        code: '400',
                        message: 'filename must start with modules'
                    })
                }

                try {
                    saveFile(filename, content)
                    listener({
                        code: '200',
                        message: 'success'
                    })
                } catch (e) {
                    listener({
                        code: '500',
                        message: e.message
                    })
                }

            })

            socket.on(EVENTS.IS_FILE_EXIST, async ({ payload }, listener) => {
                const { filename, content } = payload


            })

            // 预设事件
            for(const eventName in handlers){
                socket.on(eventName, warpHandler(handlers[eventName]))
            }

            // 自己处理
            gateway.onSocketInit && gateway.onSocketInit(socket)
        }
    }

    // 从字符串获取module
    public getLocalModule(filename: string) {
        return import(filename)
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

function saveFile(path: string, data: string) {
    fs.writeFileSync(path, data)
}