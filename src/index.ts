import forever from 'forever-monitor';

forever.start("./build/bot.js", {
    max: Infinity,
    silent: false,
    minUptime: 10000
})