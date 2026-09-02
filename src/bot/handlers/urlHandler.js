import { validateProductUrl, SUPPORTED_STORE_NAMES } from '../../services/validator/urlValidator.js';
import { scrapeProduct } from '../../services/scraper/productScraper.js';
import { trackerStore } from '../../services/database/trackerStore.js';
import { rateLimiter } from '../../services/security/rateLimiter.js';
import { formatCurrency } from '../../utils/currency/currencyFormatter.js';
import { escapeHtml } from '../../utils/sanitizers/textSanitizer.js';
import { config } from '../../config/env.js';

/**
 * Extracts candidate URLs from message text or Telegram entities.
 * @param {import('grammy').Context} ctx 
 * @returns {string[]}
 */
function extractUrls(ctx) {
  const text = ctx.message?.text || '';
  const entities = ctx.message?.entities || [];
  const urls = [];

  // Extract URLs marked by Telegram's entity parser
  for (const entity of entities) {
    if (entity.type === 'url') {
      const urlText = text.substring(entity.offset, entity.offset + entity.length);
      urls.push(urlText);
    } else if (entity.type === 'text_link' && entity.url) {
      urls.push(entity.url);
    }
  }

  // Fallback: If no entities found, check if space-delimited parts look like URLs
  if (urls.length === 0) {
    const tokens = text.split(/\s+/);
    for (const token of tokens) {
      if (token.startsWith('http://') || token.startsWith('https://')) {
        urls.push(token);
      }
    }
  }

  return urls;
}

/**
 * Handles incoming text messages to detect URLs, enforce limits, scrape prices, and start tracking.
 * @param {import('grammy').Context} ctx
 */
export async function handleTextMessage(ctx) {
  const text = ctx.message?.text?.trim() || '';

  // Skip commands as they are handled by bot.command()
  if (text.startsWith('/')) {
    return;
  }

  const detectedUrls = extractUrls(ctx);

  if (detectedUrls.length === 0) {
    // Non-URL message: Guide the user
    await ctx.reply(
      `👋 Send me a product link to start tracking its price!\n\n*Supported Stores:*\n${SUPPORTED_STORE_NAMES}\n\n_Example:_\n\`https://www.amazon.in/dp/example\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const userId = ctx.from.id;

  // 1. Rate Limiting Check (Anti-Flooding / DoS Protection)
  const rateLimitResult = rateLimiter.checkUrlSubmissionLimit(userId);
  if (!rateLimitResult.allowed) {
    await ctx.reply(
      `⏳ <b>Rate limit exceeded.</b>\n\nYou can submit up to ${config.urlRateLimitPerMinute} links per minute. Please wait <b>${rateLimitResult.remainingWaitSeconds}s</b> before submitting another link.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // 2. Capacity Limit Check (Max 5 Tracked Items Per User)
  const activeTrackers = trackerStore.getTrackersByUser(userId);
  if (activeTrackers.length >= config.maxTrackedPerUser) {
    await ctx.reply(
      `⚠️ <b>Capacity Limit Reached</b>\n\nYou are already tracking the maximum limit of <b>${config.maxTrackedPerUser} products</b>.\n\nUse <code>/list</code> to view your items and <code>/stop &lt;number&gt;</code> to remove an item first.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // 3. Process first detected URL
  const targetUrl = detectedUrls[0];
  const validation = validateProductUrl(targetUrl);

  if (!validation.isValid) {
    await ctx.reply(
      `❌ <b>Unsupported website</b>\n\n${escapeHtml(validation.error)}\n\nPlease provide a valid product link from one of our supported stores (${SUPPORTED_STORE_NAMES}).`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Temporary status message while scraping
  const statusMessage = await ctx.reply(`🔍 <i>Fetching product details from ${validation.store}...</i>`, {
    parse_mode: 'HTML'
  });

  try {
    const scrapeResult = await scrapeProduct(validation.url, validation.store);

    if (!scrapeResult.success) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `⚠️ <b>Could not fetch product price</b>\n\n${escapeHtml(scrapeResult.error || 'Please make sure the link points directly to an in-stock product page.')}`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Save tracking record in trackerStore
    const storeResult = trackerStore.addTracker({
      userId: userId,
      productUrl: validation.url,
      platform: validation.store,
      title: scrapeResult.title,
      initialPrice: scrapeResult.price
    });

    if (!storeResult.success) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `⚠️ <b>${escapeHtml(storeResult.error)}</b>`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    const tracker = storeResult.tracker;

    // Formatted display
    const responseText = [
      `📦 <b>Product detected</b>`,
      ``,
      `<b>${escapeHtml(tracker.title)}</b>`,
      ``,
      `💰 Current Price: <b>${formatCurrency(tracker.initialPrice)}</b>`,
      ``,
      `🔍 <i>Price drop tracking started.</i>`,
      `You will be notified if the price drops.`
    ].join('\n');

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      responseText,
      { parse_mode: 'HTML' }
    );

  } catch (error) {
    console.error('Error handling product URL:', error);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMessage.message_id,
      `❌ <b>An error occurred while fetching the product.</b>\nPlease try again in a moment.`,
      { parse_mode: 'HTML' }
    );
  }
}
