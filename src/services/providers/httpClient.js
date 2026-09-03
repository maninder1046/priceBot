import { getStealthHeaders, jitterDelay } from '../../utils/network/stealthHeaders.js';
import { validateProductUrl } from '../validator/urlValidator.js';

const MAX_RESPONSE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB response cap
const REQUEST_TIMEOUT_MS = 12000; // 12 seconds

/**
 * Resolves short links (like amzn.in/d/..., amzn.to/..., fkrt.it/...) to their target canonical URL safely.
 * @param {string} url 
 * @returns {Promise<string>}
 */
export async function resolveShortUrl(url) {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  const isShortDomain = ['amzn.to', 'amzn.in', 'fkrt.it', 'fkrt.co', 'dl.flipkart.com'].some(
    (d) => hostname === d || hostname.endsWith(`.${d}`)
  );

  if (!isShortDomain) {
    return url;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: 'GET',
      headers: getStealthHeaders({ isMobile: true }),
      redirect: 'manual',
      signal: controller.signal
    });

    clearTimeout(timeout);

    const location = res.headers.get('location');
    if (location) {
      const resolved = new URL(location, url).toString();
      const validation = validateProductUrl(resolved);
      if (validation.isValid) {
        return validation.url;
      }
    }
  } catch (err) {
    // If manual resolution fails, fall back to original url
  }

  return url;
}

/**
 * Hardened HTTP Client for Scraping Providers
 * 
 * Enforces timeout, response size limits, redirect domain validation,
 * short link unshortening, and stealth header rotation.
 */
export async function secureFetchHtml(url, options = {}) {
  // 1. Resolve short links first (amzn.in, amzn.to, fkrt.it)
  const targetUrl = await resolveShortUrl(url);

  // 2. Pre-flight URL validation
  const validation = validateProductUrl(targetUrl);
  if (!validation.isValid) {
    throw new Error(`Invalid or disallowed URL: ${validation.error}`);
  }

  // 3. Fast-path: Flipkart on cloud IPs routes via ScraperAPI (1.2s response time)
  if (validation.store === 'Flipkart') {
    const { config } = await import('../../config/env.js');
    if (config.scraperApiKey) {
      try {
        const proxyUrl = `https://api.scraperapi.com?api_key=${config.scraperApiKey}&url=${encodeURIComponent(targetUrl)}&country_code=in`;
        const res = await fetch(proxyUrl, { method: 'GET', signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          const html = await res.text();
          if (html.length > 2000) {
            return html;
          }
        }
      } catch (proxyErr) {
        console.warn(`[Proxy Fallback] ScraperAPI request failed (${proxyErr.message}), falling back to browser...`);
      }
    }
    const { fetchHtmlWithBrowser } = await import('./browserClient.js');
    return await fetchHtmlWithBrowser(targetUrl);
  }

  // 4. Request throttling jitter
  await jitterDelay(300, 800);

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const isMyntra = validation.store === 'Myntra';
    const headers = {
      ...getStealthHeaders({ ...options, isMobile: isMyntra || options.isMobile }),
      ...options.headers
    };

    // Add store-specific headers and session cookies to bypass datacenter firewall checks
    if (validation.store === 'Amazon') {
      headers['Cookie'] = 'i18n-prefs=INR; lc-acbin=en_IN; skin=noskin';
      headers['Referer'] = 'https://www.amazon.in/';
    } else if (validation.store === 'Flipkart') {
      headers['Referer'] = 'https://www.flipkart.com/';
      headers['Origin'] = 'https://www.flipkart.com';
      headers['Sec-Fetch-Site'] = 'same-origin';
      headers['Cookie'] = 'dvc_d=mobile;';
    } else if (validation.store === 'Myntra') {
      headers['Referer'] = 'https://www.myntra.com/';
      headers['Origin'] = 'https://www.myntra.com';
      headers['Sec-Fetch-Site'] = 'same-origin';
      headers['Cookie'] = 'dvc_d=mobile; myx_deviceType=mobile;';
      headers['User-Agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeoutHandle);

    if (!response.ok) {
      throw new Error(`Store responded with HTTP ${response.status} (${response.statusText})`);
    }

    // 4. Post-redirect destination hostname validation (SSRF defense)
    const finalUrl = response.url;
    const finalValidation = validateProductUrl(finalUrl);
    if (!finalValidation.isValid) {
      throw new Error(`Redirected to an unauthorized destination (${finalUrl}): ${finalValidation.error}`);
    }

    // 5. Stream response with 5MB size limit
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let html = '';
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.length;
      if (totalBytes > MAX_RESPONSE_SIZE_BYTES) {
        reader.cancel();
        throw new Error(`Response exceeded maximum allowed size of 5 MB (${totalBytes} bytes received)`);
      }

      html += decoder.decode(value, { stream: true });
    }

    html += decoder.decode(); // flush buffer

    // Check if store returned a fake 200 "Site Maintenance" or CAPTCHA blocking page
    const isMaintenanceBlock = (html.includes('<title>Site Maintenance</title>') || html.includes('Flipkart reCAPTCHA')) && html.length < 5000;
    if (isMaintenanceBlock) {
      throw new Error(`Store returned a bot challenge/maintenance block (HTTP 403 / Challenge)`);
    }

    return html;

  } catch (err) {
    clearTimeout(timeoutHandle);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s while contacting store`);
    }

    // If static request is blocked with 403 Forbidden or bot challenge, fall back to headless Stealth Browser
    if (err.message.includes('403') || err.message.includes('Forbidden') || err.message.includes('503') || err.message.includes('challenge')) {
      try {
        const { fetchHtmlWithBrowser } = await import('./browserClient.js');
        return await fetchHtmlWithBrowser(targetUrl);
      } catch (browserErr) {
        // If browser also fails or is unavailable, throw original helpful error
        throw new Error(`${err.message} (Browser fallback: ${browserErr.message})`);
      }
    }

    throw err;
  }
}
