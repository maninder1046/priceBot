import { BaseProvider } from './baseProvider.js';
import { parsePriceToInteger } from '../../utils/currency/currencyFormatter.js';

export class AmazonProvider extends BaseProvider {
  constructor() {
    super('Amazon');
  }

  extractStoreSpecific($) {
    const name = $('#productTitle').text() ||
                 $('span#title').text();

    const rawPrice = $('span.a-price span.a-offscreen').first().text() ||
                     $('span.a-price-whole').first().text() ||
                     $('#priceblock_ourprice').text() ||
                     $('#priceblock_dealprice').text();

    const isOutOfStock = $('#availability').text().toLowerCase().includes('currently unavailable');

    return {
      name,
      price: parsePriceToInteger(rawPrice),
      available: !isOutOfStock
    };
  }
}

export const amazonProvider = new AmazonProvider();
