#!/usr/bin/env node
const fetch = require('node-fetch')
const puppeteer = require('puppeteer')
const fs = require('fs')
const promisify = require('util').promisify
const writeFile = promisify(fs.writeFile)

const argv = require('yargs')
    .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Path to result file if nedded',
    })
    .option('url', {
        alias: 'u',
        type: 'string',
        description: 'URL of resource which CF guarded'
    }).argv


async function tryToPassCF(url) {
    const browser = await puppeteer.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.0 Safari/537.36'
        ],
        devtools: true,
        headless: true,
        defaultViewport: null,
        ignoreHTTPSErrors: true,
    })

    const page = await browser.newPage()
    page.setViewport({
        width: 1024 + Math.floor(Math.random() * 100),
        height: 768 + Math.floor(Math.random() * 100),
    })

    const coockiesList = ['xf_session', '__cfduid', 'cf_chl_1', 'cf_chl_prog', 'cf_clearance']

    await page.goto(url)

    const result = await new Promise(res => {
        const interval = setInterval(async () => {
            await page.mouse.move(Math.random() * 300, Math.random() * 300)
            const { cookies } = await page._client.send('Network.getAllCookies')
            const nedeedCookies = cookies.filter(value => ~coockiesList.indexOf(value.name))

            if (nedeedCookies.length === coockiesList.length) {
                res(cookies)
                clearInterval(interval)
            }
        }, 1000)
    }) 

    const cookiesHeaderValue = result.reduce((acc, cookie) => {
        return `${acc}${cookie.name}=${cookie.value};`
    }, '').slice(0, -1)


    const headers = {
        'User-Agent': await browser.userAgent(),
        'Cookie': cookiesHeaderValue,
    }

    await browser.close()

    try {
        const res = await fetch(url, {
            headers,
        })
        if (res.ok) {
            return headers
        } else {
            throw Error('Cannot compute headers')
        }
    } catch(e) {
        console.log("FUCK", e)
    }
}

if (require.main === module) {
    (async () => {
        try {
            const headers = await tryToPassCF(argv.url);
            const output = Object.keys(headers).reduce((acc, key) => `${acc}${key}:${headers[key]}\n`, '')

            if (argv.output) {
                await writeFile(argv.output, output, {
                    flag: 'w+'
                })
            }
    
            console.log(output)
        } catch(e) {
            console.error('Cannot pass CF')
        }
    })() 
}