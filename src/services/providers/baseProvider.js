import * as cheerio from 'cheerio';
import { extractFromSchema } from '../scraper/schemaParser.js';
import { cleanTitle } from '../../utils/sanitizers/textSanitizer.js';
import { parsePriceToInteger } from '../../utils/currency/currencyFormatter.js';
import { secureFetchHtml } from './httpClient.js';

/**
 * Abstract Base Provider Class
 */
export class BaseProvider {
  /**
   * @param {string} name - Provider identifier (e.g. 'Amazon', 'Flipkart')
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * Fetches and parses a product URL, returning standard product contract.
   * 
   * @param {string} url 
   * @returns {Promise<{
   *   name: string,
   *   price: number,
   *   currency: string,
   *   available: boolean
   * }>}
   */
  async getProduct(url) {
    const html = await secureFetchHtml(url);
    return this.parseHtml(html);
  }

  /**
   * Parses raw HTML into the standard product format.
   * 
   * @param {string} html 
   * @returns {{
   *   name: string,
   *   price: number,
   *   currency: string,
   *   available: boolean
   * }}
   */
  parseHtml(html) {
    const $ = cheerio.load(html);

    // 1. Try JSON-LD Schema.org extraction first
    let schemaName = '';
    let schemaPrice = null;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonContent = $(el).html()?.trim();
        if (!jsonContent) return;
        const parsed = JSON.parse(jsonContent);
        const res = extractFromSchema(parsed);
        if (res) {
          if (!schemaName && res.title) schemaName = res.title;
          if (!schemaPrice && res.price) schemaPrice = res.price;
        }
      } catch {
        // ignore parse error
      }
    });

    if (schemaName && schemaPrice) {
      return {
        name: schemaName,
        price: schemaPrice,
        currency: 'INR',
        available: true
      };
    }

    // 2. Delegate to store-specific selector parser
    const specific = this.extractStoreSpecific($, html);
    const finalName = cleanTitle(specific.name || schemaName || $('meta[property="og:title"]').attr('content') || $('title').text());
    const finalPrice = specific.price || schemaPrice || parsePriceToInteger($('meta[property="og:price:amount"]').attr('content'));

    if (!finalPrice) {
      throw new Error(`Could not extract price from ${this.name} page. Product may be out of stock or requires login.`);
    }

    return {
      name: finalName || `${this.name} Product`,
      price: finalPrice,
      currency: 'INR',
      available: specific.available !== undefined ? specific.available : true
    };
  }

  /**
   * Hook for store-specific selectors (overridden by sub-classes).
   * 
   * @param {import('cheerio').CheerioAPI} $ 
   * @param {string} html 
   * @returns {{ name?: string, price?: number | null, available?: boolean }}
   */
  extractStoreSpecific($, html) {
    return { name: undefined, price: null, available: true };
  }
}
