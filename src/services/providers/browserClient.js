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
  '/snap/bin/chromium',
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

export async function closeBrowser() {
  // No-op for standalone launcher
}

/**
 * Fetches rendered HTML using clean Headless Chromium
 * @param {string} url 
 * @returns {Promise<string>}
 */
export async function fetchHtmlWithBrowser(url) {
  const executablePath = findExecutablePath();
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    pipe: true,
    protocolTimeout: 60000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Mask bot signals cleanly
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    // Navigate with domcontentloaded
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Brief delay for SSR hydration
    await new Promise((resolve) => setTimeout(resolve, 500));

    const content = await page.content();
    return content;
  } finally {
    await browser.close().catch(() => {});
  }
}
