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

    return {
      success: true,
      title: product.name,
      price: product.price,
      available: product.available
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}
