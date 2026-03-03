function sleep(timeout){
    return new Promise(resolve => setTimeout(resolve, timeout))
}

/**
 * @type {import('cdp-client-tool').excuteFn}
 */
async function capture(ctx) {
    const browser = ctx.browser

    console.log("任务持续30秒 开始")
    await sleep(30000)
    console.log("任务持续30秒 结束")

    return ctx.greeting
}

module.exports = capture