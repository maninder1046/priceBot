import { bot } from './bot/bot.js';
import { priceScheduler } from './services/checker/scheduler.js';

console.log('🤖 Starting Price Drop Bot...');

// Register standard command menu in Telegram UI (Menu Button / Autocomplete)
async function registerBotCommands() {
  try {
    await bot.api.setMyCommands([
      { command: 'start', description: 'Start the bot & get welcome guide' },
      { command: 'list', description: 'View and manage active price trackers' },
      { command: 'stop', description: 'Stop tracking an item (/stop 1 or /stop all)' },
      { command: 'help', description: 'Display commands and safety limits' }
    ]);
    console.log('📋 Telegram Command Menu registered successfully!');
  } catch (err) {
    console.error('⚠️ Failed to register command menu with Telegram:', err.message);
  }
}

// Start long-polling
bot.start({
  onStart: async (botInfo) => {
    console.log(`✅ Bot @${botInfo.username} successfully connected and listening for updates!`);
    
    // Register commands in Telegram popup menu
    await registerBotCommands();

    // Start background price checking scheduler
    priceScheduler.start(bot);
  }
});

// Graceful shutdown handling
async function handleShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  priceScheduler.stop();
  bot.stop();
  try {
    const { closeBrowser } = await import('./services/providers/browserClient.js');
    await closeBrowser();
  } catch {}
  process.exit(0);
}

process.once('SIGINT', () => handleShutdown('SIGINT'));
process.once('SIGTERM', () => handleShutdown('SIGTERM'));
