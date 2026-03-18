import { Runner } from "./core/Runner";
import fs from 'node:fs'
import { sleep } from "./utils";
import { ClientOptions, PushJobResult, saveScriptFile } from "./common";
import { WsHandler } from "./core/WsHandler";


const defaultOptions: ClientOptions = {
    capacity: 10,
    timeout: 1000 * 60 * 5, 
    minInterval: 1000 * 5,
    gateways: [],
    deviceName: 'default',
}

export class Client {
    public runner: Runner
    public ws: WsHandler

    // 依赖
    get deps() {
        return {
            runner: this.runner,
            ws: this.ws,
        }
    }

    constructor(options: ClientOptions ) {
        const runner = new Runner(this.deps, {
            capacity: options.capacity ?? defaultOptions.capacity,
            minInterval: options.minInterval ?? defaultOptions.minInterval,
            timeout: options.timeout ?? defaultOptions.timeout,
        });
        this.runner = runner; // 先赋值，否则 WsHandler 拿到的 ctx.runner 为 undefined
        const ws = new WsHandler(this.deps, {
            gateways: options.gateways,
            deviceName: options.deviceName,
        });
        this.ws = ws;
    }
}