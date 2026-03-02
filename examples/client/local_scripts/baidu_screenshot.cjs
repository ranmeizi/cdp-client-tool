function sleep(timeout){
    return new Promise(resolve => setTimeout(resolve, timeout))
}

/**
 * @type {import('cdp-client-tool').excuteFn}
 */
async function capture(ctx) {
    const browser = ctx.browser

    console.log("I'm running", ctx)

    // 我要截屏

    const page = await browser.newPage()
    await page.goto('https://www.baidu.com')
    await sleep(5000)
    try {
        await page.screenshot({ path: `screenshots/screenshot_${Date.now()}.png` })
        await page.close()
    } catch (error) {
        console.log("screenshot error", error)
    }


    console.log("screenshot success")

    return ctx.greeting
}

module.exports = capture