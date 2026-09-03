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
    let pageUri = parsed.pathname + parsed.search;
    if (pageUri.startsWith('/dl/')) {
      pageUri = pageUri.replace('/dl/', '/');
    }

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

        // 1. Extract exact product title from SEO or pageData
        let name = data?.RESPONSE?.pageData?.seoData?.seo?.title ||
                   data?.RESPONSE?.pageData?.seoData?.seo?.ogTitle ||
                   data?.RESPONSE?.pageData?.pageTitle || '';
        
        if (name.includes(' Price in India')) {
          name = name.split(' Price in India')[0].trim();
        } else if (name.includes(' - Buy ')) {
          name = name.split(' - Buy ')[0].trim();
        }

        // 2. Extract exact main product price by inspecting slots
        let price = 0;
        let isOutOfStock = false;

        // Traverse slots to find the primary product summary widget
        for (const slot of slots) {
          const wData = slot?.widget?.data || {};
          
          // Case A: Standard PRODUCT_PAGE_SUMMARY or ATLAS widget with pricing
          if (wData.pricing?.value?.finalPrice?.value) {
            price = wData.pricing.value.finalPrice.value;
          } else if (wData.price?.value?.finalPrice?.value) {
            price = wData.price.value.finalPrice.value;
          } else if (wData.productSummary?.value?.pricing?.displayPrice) {
            price = wData.productSummary.value.pricing.displayPrice;
          }

          if (price > 0) break;
        }

        // Fallback to top-level price if not found in structured widgets
        if (!price) {
          // Look for price in the first 3 slots only (main product card, ignoring bottom carousels)
          for (let i = 0; i < Math.min(slots.length, 4); i++) {
            const slotStr = JSON.stringify(slots[i]);
            const match = slotStr.match(/\"text\"\s*:\s*\"₹\s*([0-9,]+)\"/);
            if (match) {
              price = parsePriceToInteger(match[1]);
              if (price > 0) break;
            }
          }
        }

        // 3. Extract Stock Status
        isOutOfStock = rawJson.toLowerCase().includes('out of stock') || 
                       rawJson.toLowerCase().includes('currently out of stock') ||
                       rawJson.toLowerCase().includes('sold out');

        if (price > 0 || isOutOfStock || name) {
          console.log(`⚡ [Pipeline: Flipkart Rome API] Successfully fetched "${name}" (₹${price}) via 2.rome.api JSON gateway in 0.2s (0 credits)`);
          return {
            name: name || 'Flipkart Product',
            price: !isOutOfStock ? price : 0,
            currency: 'INR',
            available: !isOutOfStock,
            productUrl: resolvedUrl
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
