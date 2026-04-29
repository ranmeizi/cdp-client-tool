import { Socket } from "socket.io-client";
import { Context, EVENTS, GatewayConfig, PushJobResult, resolveAndValidate, ScriptJob } from "../common";
import { io } from "socket.io-client";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ensureDir } from "../utils";
import {
    Handler,
    getHandlerRegistry,
    HandlerContext,
    type EventKey,
} from "./Handler.decorator";
import { logger } from "src/logger";
import { Client } from "src/Client";

type WsHandlerOptions = {
    gateways: GatewayConfig[];
    deviceName?: string;
    onInit?: (ctx: Context) => void;
};


export class WsHandler {

    public sockets: Map<string, Socket> = new Map();

    constructor(
        private readonly client: Client,
        private readonly options: WsHandlerOptions
    ) {
        this.init();
    }

    get ctx() {
        return this.client.deps;
    }

    init() {
        this.options.onInit?.(this.ctx);

        for (const gateway of this.options.gateways) {
            const socket = io(gateway.uri, {
                ...gateway.opts,
                query: {
                    ...gateway.opts?.query,
                    deviceName: this.options.deviceName ?? "default",
                },
            });

            socket.on("connect_error", (err) => {
                logger.error(`[${gateway.name}]: connect_error 错误`, err);
            });
            socket.on("error", (err) => {
                logger.error(`[${gateway.name}]: socketio 错误`, err);
            });

            this.sockets.set(gateway.name, socket);

            // 隐式绑定：从 @Handler 装饰器注册表自动 socket.on
            this.attachHandlers(socket, gateway);

            gateway.onSocketInit?.(socket);
        }
    }

    /** 将 @Handler 装饰的方法绑定到 socket，无需手动写 socket.on */
    private attachHandlers(socket: Socket, gateway: GatewayConfig) {
        const warpHandler = (fn: (ctx: HandlerContext<EventKey>) => void | Promise<void>) =>
            (data: any, callback: (...args: any[]) => void) =>
                fn.call(this, { data, callback, gateway, ctx: this.ctx });

        for (const { event, key } of getHandlerRegistry(this)) {
            const method = (this as any)[key];
            if (typeof method === "function") {
                socket.on(event, warpHandler(method.bind(this)));
            }
        }
    }

    @Handler(EVENTS.READ_DIR)
    async readDir({ data, callback }: HandlerContext<typeof EVENTS.READ_DIR>) {
        try {
            const dirPath = resolveAndValidate(data.payload.path);
            const list = await readdir(dirPath, { withFileTypes: true });
            callback(
                list.map((d) => ({
                    name: d.name,
                    type: d.isDirectory() ? ("dir" as const) : ("file" as const),
                }))
            );
        } catch (e: any) {
            logger.error("read_dir 失败", e);
            callback([]);
        }
    }

    @Handler(EVENTS.READ_FILE)
    async readFile({ data, callback }: HandlerContext<typeof EVENTS.READ_FILE>) {
        try {
            const filePath = resolveAndValidate(data.payload.path);
            const content = await readFile(filePath);
            callback(content);
        } catch (e: any) {
            logger.error("read_file 失败", e);
            callback(null);
        }
    }

    @Handler(EVENTS.WRITE_FILE)
    async writeFile({ data, callback }: HandlerContext<typeof EVENTS.WRITE_FILE>) {
        try {
            const { filename, content, flags } = data.payload;
            const filePath = resolveAndValidate(filename);
            await ensureDir(dirname(filePath));
            const buf = Buffer.isBuffer(content) ? content : typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content);
            await writeFile(filePath, buf, { flag: flags ?? "w" });
            callback({ ok: true });
        } catch (e: any) {
            logger.error("write_file 失败", e);
            callback({ ok: false });
        }
    }

    @Handler(EVENTS.RM)
    async rm({ data, callback }: HandlerContext<typeof EVENTS.RM>) {
        try {
            const filePath = resolveAndValidate(data.payload.path);
            await rm(filePath, { force: true });
            callback({ ok: true });
        } catch (e: any) {
            logger.error("rm 失败", e);
            callback({ ok: false });
        }
    }

    @Handler(EVENTS.EXEC_LOCAL_SCRIPT)
    async execLocalScript({ data, callback, gateway }: HandlerContext<typeof EVENTS.EXEC_LOCAL_SCRIPT>) {
        try {
            const { filename, params } = data.payload;
            const base = filename.includes("/") ? filename : join("local_scripts", filename);
            const filePath = resolveAndValidate(base);
            const job: ScriptJob = {
                id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                type: "local",
                filename: filePath,
                params,
                gatewayName: gateway.name,
            };
            const result = await this.ctx.runner.execJob(job);
            callback(this.mapExecResult(result, job.id));
        } catch (e: any) {
            logger.error("exec_local_script 失败", e);
            callback({ status: "overflow", reason: e?.message ?? "执行失败" });
        }
    }

    @Handler(EVENTS.EXEC_REMOTE_SCRIPT)
    async execRemoteScript({ data, callback, gateway }: HandlerContext<typeof EVENTS.EXEC_REMOTE_SCRIPT>) {
        try {
            const { raw, params } = data.payload;
            const job: ScriptJob = {
                id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                type: "remote",
                script: raw.toString("utf8"),
                params,
                gatewayName: gateway.name,
            };
            const result = await this.ctx.runner.execJob(job);
            callback(this.mapExecResult(result, job.id));
        } catch (e: any) {
            logger.error("exec_remote_script 失败", e);
            callback({ status: "overflow", reason: e?.message ?? "执行失败" });
        }
    }

    private mapExecResult(result: PushJobResult, jobId: string) {
        switch (result) {
            case PushJobResult.SUCCESS:
                return { status: "executing" as const, jobId };
            case PushJobResult.SUCCESS_IN_QUEUE:
                return {
                    status: "queued" as const,
                    jobId,
                    position: this.ctx.runner.getQueueLength(),
                };
            case PushJobResult.QUEUE_FULL:
                return { status: "overflow" as const, reason: "queue is full" };
            case PushJobResult.FAILED:
                return { status: "overflow" as const, reason: "execution failed" };
            case PushJobResult.FILE_SAVE_FAILED:
                return { status: "overflow" as const, reason: "file save failed" };
            default:
                return { status: "overflow" as const, reason: "unknown" };
        }
    }

    @Handler(EVENTS.INTERRUPT_SCRIPT)
    async interruptScript({ data, callback }: HandlerContext<typeof EVENTS.INTERRUPT_SCRIPT>) {
        try {
            const { jobId } = data.payload;
            const result = this.ctx.runner.interruptJob(jobId);
            callback(result);
        } catch (e: any) {
            logger.error("interrupt_script 失败", e);
            callback({ ok: false, reason: e?.message ?? "取消失败" });
        }
    }

    @Handler(EVENTS.UNDO_SCRIPT)
    async undoScript({ data, callback }: HandlerContext<typeof EVENTS.UNDO_SCRIPT>) {
        try {
            const { jobId } = data.payload;
            const result = this.ctx.runner.interruptJob(jobId);
            callback(result);
        } catch (e: any) {
            logger.error("undo_script 失败", e);
            callback({ ok: false, reason: e?.message ?? "撤销失败" });
        }
    }

    @Handler(EVENTS.SCRIPT_QUEUE)
    async scriptQueue({ callback }: HandlerContext<typeof EVENTS.SCRIPT_QUEUE>) {
        try {
            const snapshot = this.ctx.runner.getScriptQueueSnapshot();
            callback(snapshot);
        } catch (e: any) {
            logger.error("script_queue 失败", e);
            callback({ running: null, pending: [], capacity: 10 });
        }
    }
}
