import puppeteer from 'puppeteer-core';
import fs from 'fs';

/**
 * Common Chromium/Chrome executable paths across Linux and Windows
 */
const POSSIBLE_PATHS = [
  // Linux (Native Google Chrome / Debian packages first)
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  // Windows
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

function findExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  for (const p of POSSIBLE_PATHS) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return undefined;
}

// ---------------------------------------------------------
// Browser Singleton & Auto-Idle Memory Management
// ---------------------------------------------------------
let cachedBrowser = null;
let idleCloseTimer = null;
const IDLE_TIMEOUT_MS = 45 * 1000; // Auto-close browser after 45 seconds of idle to free RAM immediately

export async function closeBrowser() {
  if (idleCloseTimer) clearTimeout(idleCloseTimer);
  if (cachedBrowser) {
    try {
      await cachedBrowser.close();
    } catch {}
    cachedBrowser = null;
  }
}

function resetIdleTimer() {
  if (idleCloseTimer) clearTimeout(idleCloseTimer);
  idleCloseTimer = setTimeout(async () => {
    await closeBrowser();
  }, IDLE_TIMEOUT_MS);
}

async function getOrCreateBrowser() {
  resetIdleTimer();

  const isAlive = cachedBrowser && (typeof cachedBrowser.connected === 'boolean' ? cachedBrowser.connected : true) && (typeof cachedBrowser.isConnected === 'function' ? cachedBrowser.isConnected() : true);

  if (isAlive) {
    return cachedBrowser;
  }

  const executablePath = findExecutablePath();
  cachedBrowser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    pipe: false,
    protocolTimeout: 120000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions'
    ]
  });

  cachedBrowser.on('disconnected', () => {
    cachedBrowser = null;
  });

  return cachedBrowser;
}

/**
 * Fetches rendered HTML using the warm Singleton Headless Stealth Chromium
 * @param {string} url 
 * @returns {Promise<string>}
 */
export async function fetchHtmlWithBrowser(url) {
  const browser = await getOrCreateBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 800 });

    // Native Stealth Masking (Bypasses bot checks cleanly without fragile plugin hooks)
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      window.chrome = { runtime: {} };
    });

    // Set realistic headers
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    // Navigate with domcontentloaded (generous 60s timeout for cloud networks)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Minimal delay for hydration scripts
    await new Promise((resolve) => setTimeout(resolve, 400));

    const content = await page.content();
    return content;
  } catch (err) {
    if (err.message.includes('Protocol error') || err.message.includes('Target.setDiscoverTargets') || err.message.includes('Session closed')) {
      if (cachedBrowser) {
        try { await cachedBrowser.close(); } catch {}
        cachedBrowser = null;
      }
    }
    throw err;
  } finally {
    // Only close the lightweight tab, keep the browser engine warm!
    await page.close().catch(() => {});
    resetIdleTimer();
  }
}
