/**
 * Phoenix Bot - Standalone, Zero-Setup Edition
 *
 * This is a fully autonomous script. It automatically checks for and installs its own
 * dependencies (`playwright`, `axios`, etc.) before running. The user only needs to

 * have Node.js and npm installed.
 *
 * --- Features ---
 *  - Auto-Installer: No need to run `npm install` manually.
 *  - Multi-Source Proxy Aggregator & Live Validator.
 *  - Advanced Stealth Engine to bypass bot detectors.
 *  - Resilient Task Queue for high success rates.
 *  - Superior Human Emulation with complex interactions.
 *
 * How to Run:
 *   Just run the script directly with Node.js:
 *   node phoenix_bot_standalone.js
 */

// --- BOOTSTRAP: Auto-Dependency Installer ---

const { execSync } = require('child_process');

async function runBootstrap() {
    console.log('[SETUP] Phoenix Bot initializing...');
    const requiredPackages = [
        'playwright',
        'playwright-extra',
        'puppeteer-extra-plugin-stealth',
        'axios'
    ];
    
    const missingPackages = requiredPackages.filter(pkg => {
        try {
            require.resolve(pkg);
            return false;
        } catch (err) {
            return true;
        }
    });

    if (missingPackages.length > 0) {
        console.log(`[SETUP] Missing dependencies detected: ${missingPackages.join(', ')}`);
        console.log('[SETUP] Attempting to install automatically. This may take a few minutes...');
        try {
            // Playwright needs a special install command to download browsers
            if (missingPackages.includes('playwright')) {
                 console.log('[SETUP] Installing Playwright and its browsers...');
                 execSync('npm install playwright', { stdio: 'inherit' });
                 execSync('npx playwright install', { stdio: 'inherit' });
            }
            
            const otherPackages = missingPackages.filter(p => p !== 'playwright');
            if (otherPackages.length > 0) {
                 console.log(`[SETUP] Installing: ${otherPackages.join(' ')}...`);
                 execSync(`npm install ${otherPackages.join(' ')}`, { stdio: 'inherit' });
            }

            console.log('[SETUP] All dependencies installed successfully.');
        } catch (error) {
            console.error('\n[FATAL ERROR] Failed to install dependencies automatically.');
            console.error('Please try running "npm install" manually and then restart the script.');
            process.exit(1);
        }
    } else {
        console.log('[SETUP] All dependencies are already installed.');
    }
}

// --- MAIN APPLICATION LOGIC ---

async function startPhoenixBot() {
    console.log('[SETUP] All systems go. Starting the bot engine...\n');
    
    // Now that we know packages are installed, we can require them.
    const { chromium } = require('playwright-extra');
    const stealth = require('puppeteer-extra-plugin-stealth')();
    const readline = require('readline');
    const axios = require('axios');

    chromium.use(stealth);

    // --- Configuration ---
    const PROXY_SOURCES = [
        'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all',
        'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
        'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
        'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt',
        'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt'
    ];
    const USER_AGENTS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0'
    ];
    const PROXY_VALIDATION_TARGET = 'http://httpbin.org/ip';
    const PROXY_VALIDATION_TIMEOUT = 8000;

    // --- Helper Functions ---
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    // --- Intelligent Proxy Manager ---
    class ProxyManager {
        constructor(sources) { this.sources = sources; this.validProxies = []; this.currentIndex = 0; }
        async initialize() {
            console.log('[ProxyManager] Fetching proxies from multiple sources...');
            const responses = await Promise.allSettled(this.sources.map(url => axios.get(url, { timeout: 10000 })));
            let rawProxies = [];
            responses.forEach(res => { if (res.status === 'fulfilled') rawProxies.push(...res.value.data.split(/\r?\n/).filter(p => p.trim())); });
            const uniqueProxies = [...new Set(rawProxies)];
            console.log(`[ProxyManager] Found ${uniqueProxies.length} unique proxies. Starting live validation...`);
            this.validProxies = (await Promise.all(uniqueProxies.map(p => this.validate(p)))).filter(Boolean);
            if (this.validProxies.length === 0) throw new Error("Initialization failed: Could not find any working proxies.");
            this.validProxies.sort(() => Math.random() - 0.5);
            console.log(`[ProxyManager] Validation complete. ${this.validProxies.length} proxies are live and ready.`);
        }
        async validate(proxy) { try { await axios.get(PROXY_VALIDATION_TARGET, { proxy: { protocol: 'http', host: proxy.split(':')[0], port: parseInt(proxy.split(':')[1]) }, timeout: PROXY_VALIDATION_TIMEOUT }); return proxy; } catch { return null; } }
        getProxy() { if (this.validProxies.length === 0) return null; const proxy = this.validProxies[this.currentIndex]; this.currentIndex = (this.currentIndex + 1) % this.validProxies.length; return proxy; }
    }

    // --- User Interface ---
    async function getUserInput() {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const ask = (query) => new Promise(resolve => rl.question(query, resolve));
        console.log("=================================================");
        console.log("        Welcome to the Phoenix Bot         ");
        console.log(" (Standalone, Self-Healing Visitor Bot) ");
        console.log("=================================================");
        const targetUrl = await ask("Enter the full website URL: ");
        if (!targetUrl || !targetUrl.startsWith('http')) { console.error("\n[ERROR] Invalid URL."); process.exit(1); }
        const totalSessions = parseInt(await ask("How many visits to send? "), 10);
        if (isNaN(totalSessions) || totalSessions <= 0) { console.error("\n[ERROR] Invalid number."); process.exit(1); }
        rl.close();
        return { targetUrl, totalSessions };
    }

    // --- Core Session Worker ---
    async function runSession(browser, config, proxy) {
        let context;
        try {
            const [host, port] = proxy.split(':');
            context = await browser.newContext({ proxy: { server: `http://${host}:${port}` }, userAgent: USER_AGENTS[rand(0, USER_AGENTS.length - 1)], viewport: { width: 1920, height: 1080 } });
            const page = await context.newPage();
            await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
            await sleep(rand(2000, 4000));
            for (let i = 0; i < rand(4, 8); i++) { await page.mouse.wheel(0, rand(200, 500)); await sleep(rand(500, 1500)); }
            if (Math.random() < 0.6) {
                const links = await page.locator(`a[href^="/"], a[href*="${new URL(config.targetUrl).hostname}"]`).all();
                if (links.length > 0) { const link = links[rand(0, links.length - 1)]; await link.hover().catch(() => {}); await sleep(rand(500, 1000)); await link.click({ timeout: 15000 }).catch(() => {}); await page.waitForLoadState('domcontentloaded').catch(() => {}); await sleep(rand(3000, 7000)); }
            }
            await context.close(); return true;
        } catch { if (context) await context.close(); return false; }
    }

    // --- Main Orchestrator ---
    async function main() {
        const config = await getUserInput();
        const proxyManager = new ProxyManager(PROXY_SOURCES);
        await proxyManager.initialize();
        const browser = await chromium.launch({ headless: true });
        let completed = 0, successful = 0;
        const concurrency = Math.min(30, proxyManager.validProxies.length);
        console.log(`\n[Orchestrator] Starting ${config.totalSessions} sessions with a concurrency of ${concurrency}...`);
        let sessionQueue = Array.from({ length: config.totalSessions }, (_, i) => i + 1);
        const worker = async () => {
            while (sessionQueue.shift()) {
                const proxy = proxyManager.getProxy(); if (!proxy) break;
                if (await runSession(browser, config, proxy)) successful++;
                completed++;
                const successRate = completed > 0 ? (successful / completed * 100).toFixed(2) : "0.00";
                process.stdout.write(`\r[PROGRESS] Completed: ${completed}/${config.totalSessions} | Success: ${successful} (${successRate}%)`);
            }
        };
        await Promise.all(Array(concurrency).fill(0).map(worker));
        await browser.close();
        console.log("\n\n================= FINAL SUMMARY ==================");
        console.log(` Target: ${config.targetUrl}`);
        console.log(` Requested Visits: ${config.totalSessions}`);
        console.log(` Successful Visits: ${successful}`);
        const finalRate = config.totalSessions > 0 ? (successful / config.totalSessions * 100).toFixed(2) : "0.00";
        console.log(` Final Success Rate: ${finalRate}%`);
        console.log("================================================\n");
    }

    await main().catch(error => console.error("\n[FATAL ERROR]", error));
}

// --- Entry Point ---
(async () => {
    await runBootstrap();
    await startPhoenixBot();
})();