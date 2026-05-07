const { launchBrowser, sleep, reportResult } = require('cdp-client-tool')

async function main() {
    const browser = await launchBrowser()
    // 我要截屏

    const page = await browser.newPage()
    await page.goto('https://www.baidu.com')
    await sleep(5000)

    let i+ 5)
    try {
        await page.screenshot({ path: `screenshots/screenshot_${Date.now()}.png` })
        await page.close()
        console.log("screenshot success")
    } catch (error) {
        console.log("screenshot error", error)
    } finally {
        await browser.disconnect()
    }

    return {
        code: 200,
        message: 'screenshot success',
        data: {
            result: true,
            screenshot: `screenshots/screenshot_${Date.now()}.png`,
        }
    }
}
main().then(result => {
    reportResult(result)
}).catch(error => {
    reportResult({
        code: 500,
        message: error.message,
        data: null
    })
})
