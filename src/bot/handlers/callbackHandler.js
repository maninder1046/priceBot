import { InlineKeyboard } from 'grammy';
import { trackerStore as defaultTrackerStore } from '../../services/database/trackerStore.js';
import { formatCurrency } from '../../utils/currency/currencyFormatter.js';
import { escapeHtml } from '../../utils/sanitizers/textSanitizer.js';
import { config } from '../../config/env.js';

/**
 * Builds the text and InlineKeyboard for a user's active tracking list.
 * 
 * @param {number|string} userId 
 * @param {import('../../services/database/trackerStore.js').TrackerStore} [customStore]
 * @returns {{ text: string, keyboard: InlineKeyboard }}
 */
export function buildTrackingListPayload(userId, customStore = defaultTrackerStore) {
  const store = (customStore && typeof customStore.getTrackersByUser === 'function')
    ? customStore
    : defaultTrackerStore;

  const activeTrackers = store.getTrackersByUser(userId);

  if (activeTrackers.length === 0) {
    return {
      text: `📭 <b>No active trackers found.</b>\n\nSend me a product link to start monitoring its price!`,
      keyboard: new InlineKeyboard()
    };
  }

  const lines = [
    `📦 <b>Active Tracking (${activeTrackers.length}/${config.maxTrackedPerUser})</b>`,
    ``
  ];

  const keyboard = new InlineKeyboard();

  activeTrackers.forEach((tracker, index) => {
    const priceDisplay = tracker.initialPrice > 0
      ? formatCurrency(tracker.initialPrice)
      : '⏳ <i>Out of Stock (Alert when available)</i>';

    lines.push(
      `<b>${index + 1}. ${escapeHtml(tracker.title)}</b>`,
      `   Price: <b>${priceDisplay}</b>`,
      `   Platform: <i>${escapeHtml(tracker.platform.toUpperCase())}</i>`,
      ``
    );

    // Add action buttons for this item (Stop + Direct Link)
    keyboard
      .text(`❌ Stop #${index + 1}`, `stop:${tracker.tracking_id}`)
      .url(`🛒 View Product`, tracker.productUrl)
      .row();
  });

  // Footer controls
  if (activeTrackers.length > 1) {
    keyboard.text(`🛑 Stop All (${activeTrackers.length})`, 'stop_all');
  }
  keyboard.text(`🔄 Refresh`, 'refresh_list');

  return {
    text: lines.join('\n'),
    keyboard
  };
}

/**
 * Handles button callback queries from inline keyboards
 * @param {import('grammy').Context} ctx
 * @param {import('../../services/database/trackerStore.js').TrackerStore} [customStore]
 */
export async function handleCallbackQuery(ctx, customStore) {
  const data = ctx.callbackQuery?.data;
  const userId = ctx.from?.id;

  // Resolve store cleanly without direct db access
  const store = (customStore && typeof customStore.stopTrackerById === 'function')
    ? customStore
    : defaultTrackerStore;

  if (!data || !userId) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    if (data.startsWith('stop:')) {
      const trackingId = parseInt(data.split(':')[1], 10);
      
      // Stop tracking through domain store
      const stopResult = store.stopTrackerById(userId, trackingId);

      if (stopResult.success) {
        await ctx.answerCallbackQuery({ text: `Stopped tracking: ${stopResult.stoppedTracker.title.slice(0, 30)}...` });
      } else {
        await ctx.answerCallbackQuery({ text: 'Tracker already stopped or not found.' });
      }

      // Re-render the updated list in-place
      const payload = buildTrackingListPayload(userId, store);
      await ctx.editMessageText(payload.text, {
        parse_mode: 'HTML',
        reply_markup: payload.keyboard,
        link_preview_options: { is_disabled: true }
      });
      return;
    }

    if (data === 'stop_all') {
      const result = store.stopAllTrackers(userId);
      await ctx.answerCallbackQuery({ text: `Stopped all ${result.stoppedCount} active trackers.` });

      await ctx.editMessageText(`🛑 <b>All active trackers have been stopped.</b>\n\nSend me a new product link anytime to resume tracking!`, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
      });
      return;
    }

    if (data === 'refresh_list') {
      await ctx.answerCallbackQuery({ text: 'List refreshed!' });
      const payload = buildTrackingListPayload(userId, store);
      await ctx.editMessageText(payload.text, {
        parse_mode: 'HTML',
        reply_markup: payload.keyboard,
        link_preview_options: { is_disabled: true }
      });
      return;
    }

    if (data.startsWith('cancel_fetch:')) {
      const { activeFetchAbortMap } = await import('./urlHandler.js');
      const trigger = activeFetchAbortMap.get(userId);
      if (trigger) {
        trigger();
        activeFetchAbortMap.delete(userId);
      }

      await ctx.answerCallbackQuery({ text: 'Fetching cancelled.' });
      await ctx.editMessageText('🛑 <i>Fetching cancelled by user.</i>', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
      });
      return;
    }

    await ctx.answerCallbackQuery();
  } catch (err) {
    // If message is not modified, ignore
    if (err.message?.includes('message is not modified')) {
      return;
    }
    console.error('Error handling callback query:', err);
    await ctx.answerCallbackQuery({ text: 'An error occurred while processing.' });
  }
}
