import { config } from '../../config/env.js';
import { checkProductPrices } from './priceChecker.js';

/**
 * Background Scheduler Service
 * 
 * Periodically triggers price check cycles with cycle overlap locks
 * and safe cadences (30–60 minutes default).
 */
class PriceScheduler {
  constructor() {
    this.intervalHandle = null;
    this.isRunning = false;
    this.isCycleExecuting = false;
  }

  /**
   * Starts the background price check scheduler.
   * 
   * @param {import('grammy').Bot} bot 
   * @param {number} [intervalMinutes] 
   */
  start(bot, intervalMinutes = config.checkIntervalMinutes) {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    const safeIntervalMinutes = Math.max(1, intervalMinutes);
    const intervalMs = safeIntervalMinutes * 60 * 1000;

    console.log(`⏱️ Background Price Scheduler started (Checking every ${safeIntervalMinutes} minute${safeIntervalMinutes === 1 ? '' : 's'}).`);

    // Warmup check after 10 seconds
    setTimeout(() => {
      if (this.isRunning) {
        this.runCycle(bot);
      }
    }, 10000);

    // Set recurring timer
    this.intervalHandle = setInterval(() => {
      this.runCycle(bot);
    }, intervalMs);
  }

  /**
   * Runs a single check cycle with overlap protection and error boundaries.
   * 
   * @param {import('grammy').Bot} bot 
   */
  async runCycle(bot) {
    if (this.isCycleExecuting) {
      console.warn('⚠️ [Scheduler] Previous check cycle is still running. Skipping this tick to prevent overlap.');
      return;
    }

    this.isCycleExecuting = true;

    try {
      console.log('🔍 [Scheduler] Starting concurrent price check cycle...');
      const result = await checkProductPrices(bot);
      console.log(`✅ [Scheduler] Cycle complete: Checked ${result.checkedCount} product(s), sent ${result.alertsSent} alert(s), ${result.failedCount} error(s).`);
    } catch (err) {
      console.error('❌ [Scheduler Error] Fatal error during price check cycle:', err);
    } finally {
      this.isCycleExecuting = false;
    }
  }

  /**
   * Stops the background scheduler cleanly.
   */
  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
    this.isCycleExecuting = false;
    console.log('🛑 Background Price Scheduler stopped.');
  }
}

export const priceScheduler = new PriceScheduler();
