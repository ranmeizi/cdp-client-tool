import { Browser } from "puppeteer-core";
import { Logger } from "./logger";
import { launchBrowser } from "./utils";
import { ManagerOptions, Socket, SocketOptions } from "socket.io-client";
import { io } from "socket.io-client";
import * as path from 'node:path'
import * as requireFromString from 'require-from-string';
import handlers, { type Handler } from "./presetEventHandlers";
import { ClientOptions } from "./common";

const defaultOptions: ClientOptions = {
    deviceName: 'default',
    gateways: []
}

type ScriptJobType = 'local' | 'remote'
type ScriptJobStatus = 'pending' | 'running' | 'success' | 'failed'

export type ScriptJob = {
    id: string
    type: ScriptJobType
    filename?: string
    description?: string
    createdAt: number
    startedAt?: number
    finishedAt?: number
    status: ScriptJobStatus
    errorMessage?: string
}

export type ExecQueueResult =
    | { status: 'executing', jobId: string }
    | { status: 'queued', jobId: string, position: number }
    | { status: 'overflow', reason: string }

export type ScriptQueueSnapshot = {
    running: ScriptJob | null
    pending: ScriptJob[]
    capacity: number
}

export class Client {
    browser: Browser | undefined

    public logger: Logger = new Logger()

    public running: boolean = false

    // 脚本执行队列（每个客户端一份）
    private scriptQueue: ScriptJob[] = []
    private runningJob: ScriptJob | null = null
    private readonly queueCapacity = 10
    private jobIdSeq = 0

    constructor(
        private options: ClientOptions = defaultOptions,
    ) {
        this.init()
    }

    private nextJobId() {
        return `job-${Date.now()}-${this.jobIdSeq++}`
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
        // 使用普通 require，脚本内部可以使用 require() 引用其他 CJS 模块
        // 这里不做缓存，由 Node 模块系统自行处理
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const req = require
        return req(path.resolve(process.cwd(), 'local_scripts', filename))
    }

    public getStringModule(moduleString: string) {
        const module = requireFromString(moduleString)
        return module
    }

    get ctx() {
        return {
            greeting: 'hello, remote script',
            browser: this.browser!,
            logger: this.logger
        }
    }

    /** 当前脚本队列快照，给队列查询接口使用 */
    public getScriptQueueSnapshot(): ScriptQueueSnapshot {
        return {
            running: this.runningJob,
            pending: [...this.scriptQueue],
            capacity: this.queueCapacity,
        }
    }

    /** 入队远程脚本执行 */
    public enqueueRemoteScript(raw: Buffer): ExecQueueResult {
        const job: ScriptJob = {
            id: this.nextJobId(),
            type: 'remote',
            description: 'remote_script',
            createdAt: Date.now(),
            status: 'pending',
        }
        return this.enqueueJob(job, async () => {
            const script = this.getStringModule(raw.toString())
            const run = this.runCatchFunction(async () => await script(this.ctx))
            await run()
        })
    }

    /** 入队本地脚本执行 */
    public enqueueLocalScript(filename: string): ExecQueueResult {
        const job: ScriptJob = {
            id: this.nextJobId(),
            type: 'local',
            filename,
            description: filename,
            createdAt: Date.now(),
            status: 'pending',
        }
        return this.enqueueJob(job, async () => {
            const script = this.getLocalModule(filename)
            const run = this.runCatchFunction(() => script(this.ctx))
            await run()
        })
    }

    private enqueueJob(job: ScriptJob, runner: () => Promise<void>): ExecQueueResult {
        const total = this.scriptQueue.length + (this.runningJob ? 1 : 0)
        if (total >= this.queueCapacity) {
            return {
                status: 'overflow',
                reason: `queue is full (${this.queueCapacity})`,
            }
        }

        // 将执行逻辑挂在 job 上，方便调试（不导出给外部）
        // @ts-expect-error internal field
        job._runner = runner

        if (!this.runningJob) {
            job.status = 'running'
            job.startedAt = Date.now()
            this.runningJob = job
            this.runJob(job)
            return { status: 'executing', jobId: job.id }
        } else {
            job.status = 'pending'
            this.scriptQueue.push(job)
            return {
                status: 'queued',
                jobId: job.id,
                position: this.scriptQueue.length,
            }
        }
    }

    private async runJob(job: ScriptJob) {
        // @ts-expect-error internal field
        const runner: (() => Promise<void>) | undefined = job._runner
        if (!runner) return
        try {
            await runner()
            job.status = 'success'
        } catch (e: any) {
            job.status = 'failed'
            job.errorMessage = e?.message || String(e)
            this.logger.error('脚本执行失败', e)
        } finally {
            job.finishedAt = Date.now()
            this.runningJob = null
            const next = this.scriptQueue.shift()
            if (next) {
                next.status = 'running'
                next.startedAt = Date.now()
                this.runningJob = next
                this.runJob(next)
            }
        }
    }
}