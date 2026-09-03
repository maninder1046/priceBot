import { trackerStore as defaultTrackerStore } from '../database/trackerStore.js';
import { priceService } from '../providers/priceService.js';
import { executePool, executeWithRetry } from './workerPool.js';
import { formatCurrency } from '../../utils/currency/currencyFormatter.js';
import { escapeHtml } from '../../utils/sanitizers/textSanitizer.js';
import { config } from '../../config/env.js';

/**
 * Price Checker Service
 * 
 * Periodically checks prices using real providers (or optional custom fetcher for testing),
 * evaluates price drops against initial_price, broadcasts notifications, and deactivates tracking.
 */

/**
 * Performs a single price check cycle across all active unique products using a worker pool.
 * 
 * @param {import('grammy').Bot} [bot]
 * @param {Function} [customPriceFetcher] - Optional custom fetcher for testing
 * @param {import('../database/trackerStore.js').TrackerStore} [store] - Tracker store instance
 * @returns {Promise<{
 *   checkedCount: number,
 *   alertsSent: number,
 *   failedCount: number
 * }>}
 */
export async function checkProductPrices(bot, customPriceFetcher = null, store = defaultTrackerStore) {
  const activeProducts = store.getAllActiveUniqueProducts();
  let alertsSent = 0;
  let failedCount = 0;

  if (activeProducts.length === 0) {
    return { checkedCount: 0, alertsSent: 0, failedCount: 0 };
  }

  // Create isolated async tasks for the worker pool
  const tasks = activeProducts.map((product) => async () => {
    // 1. Fetch current price with retry and timeout protection
    const currentPrice = await executeWithRetry(
      async () => {
        if (customPriceFetcher) {
          return await customPriceFetcher(product);
        }
        // Live PriceService Provider
        const liveResult = await priceService.getProduct(product.productUrl, product.platform);
        return liveResult.price;
      },
      {
        maxRetries: config.schedulerMaxRetries,
        baseDelayMs: 1000,
        timeoutMs: 15000
      }
    );

    if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) {
      throw new Error(`Invalid price returned for product ${product.id}`);
    }

    // 2. Update last_price in database
    store.updateProductPrice(product.id, currentPrice);

    // 3. Fetch all subscribers for this product
    const subscribers = store.getProductSubscribers(product.id);

    for (const sub of subscribers) {
      // Case A: Back-In-Stock alert (product was tracked while out-of-stock, initialPrice === 0)
      if (sub.initialPrice === 0 && currentPrice > 0) {
        store.deactivateTracking(sub.tracking_id);
        alertsSent++;

        if (bot && bot.api) {
          try {
            const backInStockText = [
              `🟢 <b>BACK IN STOCK!</b>`,
              ``,
              `📦 <b>${escapeHtml(sub.title)}</b>`,
              ``,
              `💰 Now Available at: <b>${formatCurrency(currentPrice)}</b>`,
              ``,
              `⚡ <i>Hurry up before it sells out again!</i>`,
              ``,
              `🛒 <a href="${sub.productUrl}">Buy Now</a>`
            ].join('\n');

            await bot.api.sendMessage(sub.telegramId, backInStockText, {
              parse_mode: 'HTML',
              link_preview_options: { is_disabled: false }
            });
            console.log(`🟢 [Back-in-Stock Alert Sent] Delivered alert for "${sub.title}" (Now ${formatCurrency(currentPrice)}) to User ${sub.telegramId}`);
          } catch (err) {
            console.error(`Failed to send back-in-stock alert to user ${sub.telegramId}:`, err.message);
          }
        }
      }
      // Case B: Price Drop alert (initialPrice > currentPrice)
      else if (sub.initialPrice > 0 && currentPrice < sub.initialPrice) {
        const savings = sub.initialPrice - currentPrice;

        // Soft-disable tracking (active = 0)
        store.deactivateTracking(sub.tracking_id);
        alertsSent++;

        // Broadcast notification to Telegram user
        if (bot && bot.api) {
          try {
            const alertText = [
              `🔔 <b>PRICE DROPPED!</b>`,
              ``,
              `📦 <b>${escapeHtml(sub.title)}</b>`,
              ``,
              `Initial Price: <b>${formatCurrency(sub.initialPrice)}</b>`,
              `Current Price: <b>${formatCurrency(currentPrice)}</b>`,
              ``,
              `💸 You saved: <b>${formatCurrency(savings)}</b>`,
              ``,
              `🛒 <a href="${sub.productUrl}">View Product</a>`
            ].join('\n');

            await bot.api.sendMessage(sub.telegramId, alertText, {
              parse_mode: 'HTML',
              link_preview_options: { is_disabled: false }
            });
            console.log(`🔔 [Price Drop Alert Sent] Delivered alert for "${sub.title}" (Dropped from ${formatCurrency(sub.initialPrice)} to ${formatCurrency(currentPrice)}, Saved ${formatCurrency(savings)}) to User ${sub.telegramId}`);
          } catch (err) {
            console.error(`Failed to send price drop alert to user ${sub.telegramId}:`, err.message);
          }
        }
      }
    }

    return { productId: product.id, currentPrice };
  });

  // Execute all tasks via Worker Pool (controlled concurrency: e.g. 5 workers)
  const results = await executePool(tasks, config.schedulerConcurrency);

  for (const res of results) {
    if (res.status === 'rejected') {
      failedCount++;
      console.error('❌ [Worker Error] Failed checking product:', res.reason?.message || res.reason);
    }
  }

  return {
    checkedCount: activeProducts.length,
    alertsSent,
    failedCount
  };
}
