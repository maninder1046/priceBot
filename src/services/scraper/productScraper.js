import { priceService } from '../providers/priceService.js';

/**
 * Scrapes product information via PriceService provider architecture.
 * 
 * @param {string} url 
 * @param {string} platform 
 * @returns {Promise<{
 *   success: boolean,
 *   title?: string,
 *   price?: number,
 *   error?: string
 * }>}
 */
export async function scrapeProduct(url, platform) {
  try {
    const product = await priceService.getProduct(url, platform);

    if (!product.available) {
      return {
        success: false,
        title: product.name,
        error: 'Product is currently out of stock or unavailable on the store.'
      };
    }

    return {
      success: true,
      title: product.name,
      price: product.price
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}
