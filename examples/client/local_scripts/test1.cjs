function sleep(timeout) {
    return new Promise(resolve => setTimeout(resolve, timeout))
}

/**
 * @type {import('cdp-client-tool').excuteFn}
 */
async function capture(ctx) {
    const browser = ctx.browser

    const params = ctx.params

    const page = await browser.newPage()
    page.goto(`https://gushitong.baidu.com/stock/${params.share_code}`)

    await page.waitForSelector('.chart-container', { timeout: 10000 })

    await click5minBtn(page)

    console.log('click5minBtn success')

    // 等待接口请求
    const finalResponse = await page.waitForResponse(
        response => response.request().method() === 'GET' &&
            response.url().startsWith('https://finance.pae.baidu.com/vapi/v1/getquotation?') && response.status() === 200,
    );

    const json = await finalResponse.json()

    console.log('json', json)
    const data = getStructData(json.Result.newMarketData.marketData)

    // await page.close()
    console.log('data', data)

    await sleep(30000)

    return ctx.greeting
}

const more_selector = '.public-tab .chart-dropdown-container .entry'

/**
 * @param {import('puppeteer-core').Page} page
 */
async function click5minBtn(page) {
    // 鼠标浮动到更多选项
    const moreBtn = await page.$(more_selector)

    console.log('什么？')

    await moreBtn.hover()

    await sleep(1000)

    let btn5min;

    // 点击
    for (const el of await moreBtn.$$('.dropdown-menu-list-wrapper .dropdown-menu-item')) {
        const textContent = await (await el.getProperty('textContent')).jsonValue()
        console.log('textContent', textContent)
        if (textContent.indexOf('5分') !== -1) {
            btn5min = el
            break;
        }
    }

    if (!btn5min) {
        throw new Error('未找到5分按钮')
    }

    await sleep(500)

    await btn5min.click()
}

function FinScopeGraph5minData(data) {
    return {
        ts: data[0],
        datetime: data[1],
        open: data[2],
        close: data[3],
        volume: data[4],
        high: data[5],
        low: data[6],
        amount: data[7],
        change: data[8],
        change_rate: data[9],
        turnover_rate: data[10],
        val12: data[11],
        val13: data[12],
        val14: data[13],
        val15: data[14],
        val16: data[15],
        val17: data[16],
        val18: data[17],
    }
}

/**
 *@typedef {[string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string]} SplitData
 */

/**
 * @typedef {FinScopeGraph5minData}
 * @description 5分钟数据
 * @property {number} ts 时间戳             第一位
 * @property {string} datetime 时间         第二位
 * @property {number} open 开盘价           第三位
 * @property {number} close 收盘价          第四位
 * @property {number} volume 成交量         第五位
 * @property {number} high 最高价           第六位
 * @property {number} low 最低价            第七位
 * @property {number} amount 成交额         第八位
 * @property {number} change 涨跌额         第九位
 * @property {number} change_rate 涨跌幅    第十位
 * @property {number} turnover_rate 换手率  第十一位
 * @property {number} val12  不知道        第十二位
 * @property {number} val13  不知道        第十三位
 * @property {number} val14  不知道        第十四位
 * @property {number} val15  不知道        第十五位
 * @property {number} val16  不知道        第十六位
 * @property {number} val17  不知道        第十七位
 * @property {number} val18  不知道        第十八位
 */

/**
 * @param {string} marketData
 * @returns {FinScopeGraph5minData[]}
 */
function getStructData(marketData) {
    const rows = marketData.split(';')

    /** @type {SplitData[]} */
    const datagrid = rows.map(row => row.split(','))

    return datagrid.map(item => new FinScopeGraph5minData(item))

}


module.exports = capture