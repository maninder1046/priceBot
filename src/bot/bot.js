import { Bot } from 'grammy';
import { config } from '../config/env.js';
import { handleStart, handleHelp, handleList, handleStop } from './handlers/commands.js';
import { handleTextMessage } from './handlers/urlHandler.js';
import { handleCallbackQuery } from './handlers/callbackHandler.js';

// Initialize the Bot instance with the validated Bot Token
export const bot = new Bot(config.botToken);

// Register command listeners
bot.command('start', handleStart);
bot.command('help', handleHelp);
bot.command('list', handleList);
bot.command('stop', handleStop);

// Register inline keyboard callback query handler
bot.on('callback_query:data', handleCallbackQuery);

// Register text message handler for URL detection
bot.on('message:text', handleTextMessage);

// Global error handling middleware for grammY
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`❌ Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  console.error('Error details:', e);
});
