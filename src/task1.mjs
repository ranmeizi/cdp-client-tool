/**
 * @type {import('./excuteFn.type').excuteFn}
 */
async function capture(ctx) {
    const browser = ctx.browser

    console.log("I'm running", ctx)

    return ctx.greeting
}

module.exports = capture