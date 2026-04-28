const { sleep, reportResult } = require('cdp-client-tool')

async function main() {
    console.log("任务持续30秒 开始");
    await sleep(30000);
    console.log("任务持续30秒 结束");
    return {
        code: 200,
        message: '任务持续30秒 结束',
        data: {
            result: true,
        }
    }
}

// 必须显式 .then/.catch 追踪 Promise，否则 Worker 可能在 await 完成前退出
main().then(result => {
    reportResult(result)
}).catch(error => {
    reportResult({
        code: 500,
        message: error.message,
        data: null
    })
})

