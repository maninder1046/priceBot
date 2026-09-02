import { parsePriceToInteger } from '../../utils/currency/currencyFormatter.js';
import { cleanTitle } from '../../utils/sanitizers/textSanitizer.js';

/**
 * Recursively searches a JSON-LD object or array for a Product schema.
 * 
 * @param {any} data 
 * @returns {{ title?: string, price?: number } | null}
 */
export function extractFromSchema(data) {
  if (!data || typeof data !== 'object') return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractFromSchema(item);
      if (found) return found;
    }
    return null;
  }

  // Check if current node is a Product
  const isProduct = data['@type'] === 'Product' || data['@type']?.includes?.('Product');
  if (isProduct) {
    const title = data.name || data.title;
    let price = null;

    if (data.offers) {
      const offers = Array.isArray(data.offers) ? data.offers[0] : data.offers;
      price = parsePriceToInteger(offers.price || offers.lowPrice || offers.highPrice);
    }

    if (title || price) {
      return {
        title: cleanTitle(title),
        price
      };
    }
  }

  // Search inside nested properties (e.g. '@graph')
  for (const key of Object.keys(data)) {
    if (typeof data[key] === 'object') {
      const found = extractFromSchema(data[key]);
      if (found) return found;
    }
  }

  return null;
}
