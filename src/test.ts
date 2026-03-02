import { Client } from "./Client";

const gateways = [
    {
        name: "test",
        uri: "http://127.0.0.1:3000",
        opts: {
            transports: ['websocket'],
            path: '/socket.io',
        },
        onSocketInit(socket) {
            socket.on('capture:script', ({ payload }: RunScriptEvent) => {

                // 获取脚本

                // 运行脚本
            })
        },
    }
]

type RunScriptEvent = {
    payload: {
        script: string
        scriptFileName: string
    }
}

const c = new Client({
    onInit() {
        // @ts-ignore
        console.log("init", this.options);
    },
    gateways,
})

c.logger.info("hello", c.browser)