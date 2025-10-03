/**
 * Visitor Bot - User-Friendly Edition
 *
 * This script allows you to easily send simulated, human-like visits
 * to your website.
 *
 * Features:
 *  - Simple terminal interface to input URL and visit count.
 *  - Advanced human behavior simulation (typing with errors, smooth scrolling).
 *  - Live progress tracking and a clear final summary.
 *
 * How to Run:
 *   Simply type the following command in your terminal:
 *   node visitor_bot.js
 */

const { chromium } = require('playwright');
const readline = require('readline');

// --- User Interface Functions to get input ---

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

async function getUserInput() {
    console.log("========================================");
    console.log("  Welcome to the Automated Visitor Bot  ");
    console.log("========================================");

    const targetUrl = await askQuestion("Please enter the full website URL (e.g., https://www.example.com): ");
    if (!targetUrl || !targetUrl.startsWith('http')) {
        console.error("\n[ERROR] Invalid URL. Please start with http:// or https://");
        process.exit(1);
    }

    const totalSessionsStr = await askQuestion("How many visits would you like to send? (e.g., 50): ");
    const totalSessions = parseInt(totalSessionsStr, 10);
    if (isNaN(totalSessions) || totalSessions <= 0) {
        console.error("\n[ERROR] Please enter a valid, positive number.");
        process.exit(1);
    }
    
    console.log("\nThank you! The bot is preparing to start...");
    return { targetUrl, totalSessions };
}


// --- Human Behavior Simulation Functions ---

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function humanLikeTyping(page, selector, text) {
    await page.click(selector);
    for (const char of text) {
        await sleep(rand(40, 110));
        if (Math.random() < 0.05) { // 5% chance of typo
            await page.keyboard.type(String.fromCharCode(rand(97, 122))); // type a random letter
            await sleep(rand(150, 400));
            await page.keyboard.press('Backspace');
        }
        await page.keyboard.type(char);
    }
}

async function smoothScroll(page) {
    for (let i = 0; i < rand(5, 10); i++) {
        await page.mouse.wheel(0, rand(100, 300));
        await sleep(rand(200, 500));
    }
}

// --- Core Session Worker ---

async function runSession(browser, sessionId, config) {
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
    });
    const page = await context.newPage();

    try {
        await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await sleep(rand(2000, 5000));
        
        await smoothScroll(page);
        await sleep(rand(1000, 3000));

        const searchInputSelector = 'input[type="search"], input[name*="search"]';
        if (await page.locator(searchInputSelector).count() > 0) {
            await humanLikeTyping(page, searchInputSelector, 'exploring interesting topics');
            await page.keyboard.press('Enter');
            await page.waitForLoadState('domcontentloaded').catch(() => {});
            await sleep(rand(2000, 4000));
        }

        await sleep(rand(3000, 6000));
        await context.close();
        return true; // Return success
    } catch (error) {
        // Log errors quietly for the final summary, no need to flood the console.
        await context.close();
        return false; // Return failure
    }
}

// --- Main Orchestrator Function ---

async function main() {
    const config = await getUserInput();
    
    // Default setting for concurrent workers. You can change this if needed.
    const concurrency = 10;
    
    console.log(`\n[STARTING] Sending ${config.totalSessions} visits to ${config.targetUrl}`);
    console.log(`[CONFIG] Concurrency set to ${concurrency} simultaneous visits.\n`);

    const launchOptions = { headless: true };
    if (process.env.PROXY_URL) {
      launchOptions.proxy = { server: process.env.PROXY_URL };
      console.log(`[CONFIG] Using proxy server: ${new URL(process.env.PROXY_URL).hostname}\n`);
    }

    const browser = await chromium.launch(launchOptions);
    
    let completedSessions = 0;
    let successfulSessions = 0;
    const tasks = Array.from({ length: config.totalSessions }, (_, i) => i + 1);

    const worker = async () => {
        while (tasks.length > 0) {
            const taskId = tasks.shift();
            if (taskId) {
                const success = await runSession(browser, taskId, config);
                completedSessions++;
                if (success) {
                    successfulSessions++;
                }
                process.stdout.write(`\r[PROGRESS] Completed ${completedSessions} of ${config.totalSessions} visits. (Successful: ${successfulSessions})`);
            }
        }
    };

    const workerPromises = Array(concurrency).fill(0).map(() => worker());
    await Promise.all(workerPromises);

    await browser.close();

    // Final Summary Report
    console.log("\n\n========================================");
    console.log("         Final Operation Summary        ");
    console.log("========================================");
    console.log(` Requested Visits: ${config.totalSessions}`);
    console.log(` Successful Visits (No Errors): ${successfulSessions}`);
    
    const successRate = config.totalSessions > 0 ? (successfulSessions / config.totalSessions) * 100 : 0;
    console.log(` Success Rate: ${successRate.toFixed(2)}%`);
    console.log("========================================\n");
}

main().catch(console.error);