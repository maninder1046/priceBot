import { BaseProvider } from './baseProvider.js';
import { parsePriceToInteger } from '../../utils/currency/currencyFormatter.js';

export class MyntraProvider extends BaseProvider {
  constructor() {
    super('Myntra');
  }

  extractStoreSpecific($, html = '') {
    // 1. Try parsing SSR embedded state (window.__myx)
    if (html) {
      const start = html.indexOf('window.__myx = {');
      if (start !== -1) {
        try {
          const jsonStart = start + 'window.__myx = '.length;
          const scriptEnd = html.indexOf('</script>', jsonStart);
          const rawJson = html.slice(jsonStart, scriptEnd).trim();
          const cleanJson = rawJson.endsWith(';') ? rawJson.slice(0, -1) : rawJson;
          const data = JSON.parse(cleanJson);
          const pdp = data.pdpData || {};
          const title = pdp.name || pdp.title || '';
          const rawPrice = pdp.price?.discounted || pdp.price?.mrp || pdp.mrp;
          const parsedPrice = typeof rawPrice === 'number' ? rawPrice : parsePriceToInteger(rawPrice);
          const isOutOfStock = pdp.outOfStock === true || pdp.isOutOfStock === true;

          if (parsedPrice) {
            return {
              name: title,
              price: parsedPrice,
              available: !isOutOfStock
            };
          }
        } catch {
          // fallback to DOM selectors
        }
      }
    }

    // 2. DOM Selector fallback
    const name = $('h1.pdp-title').text() ||
                 $('h1.pdp-name').text();

    const rawPrice = $('span.pdp-price strong').text() ||
                     $('span.pdp-price').first().text();

    return {
      name,
      price: parsePriceToInteger(rawPrice),
      available: true
    };
  }
}

export const myntraProvider = new MyntraProvider();
