import { trackerStore } from '../../services/database/trackerStore.js';
import { buildTrackingListPayload } from './callbackHandler.js';
import { escapeHtml } from '../../utils/sanitizers/textSanitizer.js';
import { config } from '../../config/env.js';

/**
 * Handles the /start command
 * @param {import('grammy').Context} ctx
 */
export async function handleStart(ctx) {
  const userName = ctx.from?.first_name || 'there';
  
  const welcomeMessage = [
    `👋 *Hello, ${userName}!* Welcome to *Price Drop Bot*.`,
    ``,
    `I can monitor product prices from supported online stores and notify you the moment the price drops!`,
    ``,
    `💡 *Quick Commands:*`,
    `• Paste any product URL to start tracking`,
    `• /list - View your actively tracked items`,
    `• /stop - Stop tracking an item`,
    `• /help - Display full command guide`,
    ``,
    `_Happy Saving!_ 🏷️`
  ].join('\n');

  await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
}

/**
 * Handles the /help command
 * @param {import('grammy').Context} ctx
 */
export async function handleHelp(ctx) {
  const helpMessage = [
    `📖 <b>Price Drop Bot - Help Guide</b>`,
    ``,
    `<b>Commands:</b>`,
    `• /start - Start the bot & welcome greeting`,
    `• /list - List your active price trackers with interactive buttons`,
    `• /stop &lt;number&gt; - Stop tracking an item (e.g. <code>/stop 1</code>)`,
    `• /stop all - Stop tracking all your items`,
    `• /help - Display this help guide`,
    ``,
    `<b>Limits &amp; Rules:</b>`,
    `• Maximum <b>${config.maxTrackedPerUser}</b> tracked products per user.`,
    `• Maximum <b>${config.urlRateLimitPerMinute}</b> URL submissions per minute.`,
    ``,
    `<i>Simply paste a product link from ${SUPPORTED_STORE_NAMES} anytime!</i>`
  ].join('\n');

  await ctx.reply(helpMessage, { parse_mode: 'HTML' });
}

/**
 * Handles the /list command - Displays active tracking items with Inline Keyboards
 * @param {import('grammy').Context} ctx
 */
export async function handleList(ctx) {
  const userId = ctx.from?.id;
  const payload = buildTrackingListPayload(userId, trackerStore);

  await ctx.reply(payload.text, {
    parse_mode: 'HTML',
    reply_markup: payload.keyboard,
    link_preview_options: { is_disabled: true }
  });
}

/**
 * Handles the /stop command - Stops tracking an item or all items
 * @param {import('grammy').Context} ctx
 */
export async function handleStop(ctx) {
  const userId = ctx.from?.id;

  // Robustly extract argument from ctx.match or message text
  let matchText = (ctx.match || '').toString().trim();
  if (!matchText && ctx.message?.text) {
    const parts = ctx.message.text.trim().split(/\s+/);
    if (parts.length > 1) {
      matchText = parts.slice(1).join(' ').trim();
    }
  }

  // If user just typed "/stop" without args, show active items with buttons
  if (!matchText) {
    await handleList(ctx);
    return;
  }

  if (matchText.toLowerCase() === 'all') {
    const result = trackerStore.stopAllTrackers(userId);
    await ctx.reply(
      `🛑 <b>Stopped all trackers.</b> (${result.stoppedCount} product${result.stoppedCount === 1 ? '' : 's'} removed)`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const index = parseInt(matchText, 10);
  if (isNaN(index)) {
    await ctx.reply(
      `⚠️ <b>Invalid command format.</b>\n\nUse: <code>/stop 1</code> or tap the buttons in <code>/list</code>`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const stopResult = trackerStore.stopTrackerByIndex(userId, index);

  if (!stopResult.success) {
    await ctx.reply(`⚠️ ${stopResult.error}`, { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply(
    `🛑 <b>Stopped tracking:</b>\n\n<b>${escapeHtml(stopResult.stoppedTracker.title)}</b>`,
    { parse_mode: 'HTML' }
  );
}
