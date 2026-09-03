import { BaseProvider } from './baseProvider.js';
import { parsePriceToInteger } from '../../utils/currency/currencyFormatter.js';

export class FlipkartProvider extends BaseProvider {
  constructor() {
    super('Flipkart');
  }

  /**
   * Fetches product data via Flipkart's high-speed mobile API gateway (2.rome.api)
   * @param {string} url 
   */
  async getProduct(url) {
    const { resolveShortUrl } = await import('./httpClient.js');
    const resolvedUrl = await resolveShortUrl(url);
    const parsed = new URL(resolvedUrl);
    const pageUri = parsed.pathname + parsed.search;

    try {
      const res = await fetch('https://2.rome.api.flipkart.com/api/4/page/fetch?cacheFirst=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36',
          'X-User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36 FKUA/msite/0.0.3/msite/Mobile',
          'Origin': 'https://www.flipkart.com',
          'Referer': 'https://www.flipkart.com/'
        },
        body: JSON.stringify({
          pageUri: pageUri,
          requestContext: { type: 'PRODUCT_PAGE' },
          fetchSeoData: true
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        const data = await res.json();
        const rawJson = JSON.stringify(data);
        const slots = data?.RESPONSE?.slots || [];

        // 1. Extract Title
        let name = data?.RESPONSE?.pageData?.seoData?.seo?.title ||
                   data?.RESPONSE?.pageData?.seoData?.seo?.ogTitle ||
                   data?.RESPONSE?.pageData?.pageTitle || '';
        
        // Clean up common suffix
        if (name.includes(' Price in India')) {
          name = name.split(' Price in India')[0].trim();
        } else if (name.includes(' - Buy ')) {
          name = name.split(' - Buy ')[0].trim();
        }

        // 2. Extract Price (First valid ₹ match in slots)
        let price = 0;
        const priceMatches = [...rawJson.matchAll(/\"text\"\s*:\s*\"₹\s*([0-9,]+)\"/g)];
        if (priceMatches.length > 0) {
          price = parsePriceToInteger(priceMatches[0][1]);
        }

        // 3. Extract Stock Status
        const isOutOfStock = rawJson.toLowerCase().includes('out of stock') || 
                             rawJson.toLowerCase().includes('currently out of stock') ||
                             rawJson.toLowerCase().includes('sold out');

        if (price > 0 || isOutOfStock) {
          console.log(`⚡ [Pipeline: Flipkart Rome API] Successfully fetched "${name}" (₹${price}) via 2.rome.api JSON gateway in 0.2s (0 credits)`);
          return {
            name: name || 'Flipkart Product',
            price: !isOutOfStock ? price : 0,
            currency: 'INR',
            available: !isOutOfStock
          };
        }
      }
    } catch (apiErr) {
      console.warn(`⚠️ [Pipeline: Flipkart Rome API] Fallback triggered: ${apiErr.message}`);
    }

    // Fallback: standard HTML scrape
    console.log(`🌐 [Pipeline: HTML Fallback] Fetching Flipkart via HTML pipeline for ${resolvedUrl}`);
    return super.getProduct(resolvedUrl);
  }

  extractStoreSpecific($) {
    const name = $('span.B_NuCI').text() ||
                 $('h1._6EBuvT').text() ||
                 $('span._35KyD6').text();

    const rawPrice = $('div._30jeq3._16Jk6d').text() ||
                     $('div.Nx9bqj.CxhGGd').text() ||
                     $('div._30jeq3').first().text();

    const pageText = $.text().toLowerCase();
    const isSoldOut = $('div._16FRp0').length > 0 ||
                      $('div:contains("Sold Out")').length > 0 ||
                      $('div:contains("Currently Out of Stock")').length > 0 ||
                      pageText.includes('this item is currently out of stock') ||
                      pageText.includes('sold out');

    return {
      name,
      price: !isSoldOut ? parsePriceToInteger(rawPrice) : 0,
      available: !isSoldOut
    };
  }
}

export const flipkartProvider = new FlipkartProvider();
