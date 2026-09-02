import { amazonProvider } from './amazonProvider.js';
import { flipkartProvider } from './flipkartProvider.js';
import { myntraProvider } from './myntraProvider.js';

/**
 * Price Service Registry
 * 
 * Routes incoming URLs to their respective store provider based on platform name.
 */
export class PriceService {
  constructor() {
    /** @type {Map<string, import('./baseProvider.js').BaseProvider>} */
    this.providers = new Map();
    this.registerDefaultProviders();
  }

  registerDefaultProviders() {
    this.registerProvider('amazon', amazonProvider);
    this.registerProvider('flipkart', flipkartProvider);
    this.registerProvider('myntra', myntraProvider);
  }

  /**
   * Registers a store provider.
   * 
   * @param {string} platform 
   * @param {import('./baseProvider.js').BaseProvider} provider 
   */
  registerProvider(platform, provider) {
    this.providers.set(platform.toLowerCase(), provider);
  }

  /**
   * Gets product details using the registered provider for the platform.
   * 
   * @param {string} url 
   * @param {string} platform 
   * @returns {Promise<{
   *   name: string,
   *   price: number,
   *   currency: string,
   *   available: boolean
   * }>}
   */
  async getProduct(url, platform) {
    const key = (platform || '').toLowerCase();
    const provider = this.providers.get(key);

    if (!provider) {
      throw new Error(`No provider registered for platform: "${platform}"`);
    }

    return provider.getProduct(url);
  }

  /**
   * Checks if a platform has a registered provider.
   * 
   * @param {string} platform 
   * @returns {boolean}
   */
  hasProvider(platform) {
    return this.providers.has((platform || '').toLowerCase());
  }

  /**
   * Returns list of registered platform names.
   * 
   * @returns {string[]}
   */
  getRegisteredPlatforms() {
    return Array.from(this.providers.keys());
  }
}

export const priceService = new PriceService();
