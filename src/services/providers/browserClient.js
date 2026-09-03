import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

/**
 * Common Chromium/Chrome executable paths across Linux and Windows
 */
const POSSIBLE_PATHS = [
  // Linux (Ubuntu / Debian / Oracle Cloud)
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
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

/**
 * Fetches rendered HTML using headless Stealth Chromium
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
      '--no-zygote',
      '--disable-extensions',
      '--disable-software-rasterizer',
      '--disable-background-networking',
      '--disable-default-apps'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Block heavy assets (images, stylesheets, fonts, media) to make page load 5x faster and prevent timeouts
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Set realistic headers & cookies
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    // Navigate and wait for DOM content loaded (30s timeout)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait a brief moment for dynamic hydration/scripts
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const content = await page.content();
    return content;
  } finally {
    await browser.close().catch(() => {});
  }
}
