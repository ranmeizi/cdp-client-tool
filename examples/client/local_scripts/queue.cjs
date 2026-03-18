const { sleep } = require('cdp-client-tool')

async function main() {
    console.log("任务持续30秒 开始");
    await sleep(30000);
    console.log("任务持续30秒 结束");
    return true;
}

// 必须显式 .then/.catch 追踪 Promise，否则 Worker 可能在 await 完成前退出
main()
