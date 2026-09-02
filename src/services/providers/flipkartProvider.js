import { BaseProvider } from './baseProvider.js';
import { parsePriceToInteger } from '../../utils/currency/currencyFormatter.js';

export class FlipkartProvider extends BaseProvider {
  constructor() {
    super('Flipkart');
  }

  extractStoreSpecific($) {
    const name = $('span.B_NuCI').text() ||
                 $('h1._6EBuvT').text() ||
                 $('span._35KyD6').text();

    const rawPrice = $('div._30jeq3._16Jk6d').text() ||
                     $('div.Nx9bqj.CxhGGd').text() ||
                     $('div._30jeq3').first().text();

    const isSoldOut = $('div._16FRp0').text().toLowerCase().includes('sold out');

    return {
      name,
      price: parsePriceToInteger(rawPrice),
      available: !isSoldOut
    };
  }
}

export const flipkartProvider = new FlipkartProvider();
