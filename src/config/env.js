import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHECK_INTERVAL_MINUTES = parseInt(process.env.CHECK_INTERVAL_MINUTES || '30', 10);
const MAX_TRACKED_PER_USER = parseInt(process.env.MAX_TRACKED_PER_USER || '5', 10);
const URL_RATE_LIMIT_PER_MINUTE = parseInt(process.env.URL_RATE_LIMIT_PER_MINUTE || '3', 10);
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'pricebot.db');
const SCHEDULER_CONCURRENCY = parseInt(process.env.SCHEDULER_CONCURRENCY || '5', 10);
const SCHEDULER_MAX_RETRIES = parseInt(process.env.SCHEDULER_MAX_RETRIES || '2', 10);
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || '';

if (!BOT_TOKEN || BOT_TOKEN.trim() === '' || BOT_TOKEN === 'your_telegram_bot_token_here') {
  console.error('\n❌ [CONFIG ERROR] BOT_TOKEN is missing or invalid in your .env file.');
  console.error('👉 Please create a .env file with a valid token from @BotFather:\n');
  console.error('   BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ\n');
  process.exit(1);
}

export const config = {
  botToken: BOT_TOKEN.trim(),
  checkIntervalMinutes: isNaN(CHECK_INTERVAL_MINUTES) ? 30 : CHECK_INTERVAL_MINUTES,
  maxTrackedPerUser: isNaN(MAX_TRACKED_PER_USER) ? 5 : MAX_TRACKED_PER_USER,
  urlRateLimitPerMinute: isNaN(URL_RATE_LIMIT_PER_MINUTE) ? 3 : URL_RATE_LIMIT_PER_MINUTE,
  dbPath: DB_PATH,
  schedulerConcurrency: isNaN(SCHEDULER_CONCURRENCY) ? 5 : SCHEDULER_CONCURRENCY,
  schedulerMaxRetries: isNaN(SCHEDULER_MAX_RETRIES) ? 2 : SCHEDULER_MAX_RETRIES,
  scraperApiKey: SCRAPER_API_KEY.trim()
};
