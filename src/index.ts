import forever from 'forever-monitor';

if (process.env.ENV == "dev") {
    await import('./bot.js')
} else {
    forever.start("./build/bot.js", {
        max: Infinity,
        silent: false,
        minUptime: 10000
    })
}