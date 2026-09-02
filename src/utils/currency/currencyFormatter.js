/**
 * Currency Formatter & Parser Utility
 */

export function parsePriceToInteger(rawPrice) {
  if (typeof rawPrice === 'number') {
    if (isNaN(rawPrice) || rawPrice <= 0) return null;
    return Math.round(rawPrice);
  }

  if (!rawPrice || typeof rawPrice !== 'string') {
    return null;
  }

  const match = rawPrice.replace(/[₹$€£Rs\s]/gi, '').replace(/,/g, '').match(/(\d+(\.\d+)?)/);
  if (!match) {
    return null;
  }

  const numericValue = parseFloat(match[1]);
  if (isNaN(numericValue) || numericValue <= 0) {
    return null;
  }

  return Math.round(numericValue);
}

export function formatCurrency(amount, currencySymbol = '₹') {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return `${currencySymbol}0`;
  }

  const formatted = amount.toLocaleString('en-IN');
  return `${currencySymbol}${formatted}`;
}
