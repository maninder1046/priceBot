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

    const availText = $('#availability').text().toLowerCase();
    const isOutOfStock = availText.includes('currently unavailable') ||
                         availText.includes('out of stock') ||
                         $('input#add-to-cart-button').length === 0 && availText.includes('unavailable');

    return {
      name,
      price: !isOutOfStock ? parsePriceToInteger(rawPrice) : 0,
      available: !isOutOfStock
    };
  }
}

export const amazonProvider = new AmazonProvider();
