/**
 * Price Simulator Service
 * 
 * Provides safe mock price fluctuations for testing the scheduler,
 * drop detection, and notification lifecycle without hammering live servers.
 */

/**
 * Generates a simulated current price for a product.
 * Returns a price that can fluctuate below, at, or above the base initial price.
 * 
 * @param {number} [basePrice=6499] 
 * @param {number} [minVariance=-0.3] - Minimum percentage change (-30%)
 * @param {number} [maxVariance=0.15] - Maximum percentage change (+15%)
 * @returns {number}
 */
export function getSimulatedPrice(basePrice = 6499, minVariance = -0.3, maxVariance = 0.15) {
  const safeBase = typeof basePrice === 'number' && !isNaN(basePrice) && basePrice > 0 ? basePrice : 6499;
  const variance = Math.random() * (maxVariance - minVariance) + minVariance;
  const simulated = Math.round(safeBase * (1 + variance));
  return Math.max(1, simulated);
}
