import { BaseProvider } from './baseProvider.js';
import { parsePriceToInteger } from '../../utils/currency/currencyFormatter.js';

export class MyntraProvider extends BaseProvider {
  constructor() {
    super('Myntra');
  }

  extractStoreSpecific($) {
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
