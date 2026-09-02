import { DatabaseService } from '../src/services/database/database.js';
import { TrackerStore } from '../src/services/database/trackerStore.js';
import { checkProductPrices } from '../src/services/checker/priceChecker.js';
import { getSimulatedPrice } from './helpers/priceSimulator.js';

console.log('🧪 Running Price Checker & Drop Notification Test Suite...\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

// 1. Test Simulator Range
const simPrice = getSimulatedPrice(10000);
assert(typeof simPrice === 'number' && simPrice > 0, 'Simulator generates positive integer price');

// Use isolated in-memory DB for tests so user's real database is NEVER wiped
const testDbService = new DatabaseService(':memory:');
const trackerStore = new TrackerStore(testDbService);

// 2. Setup 2 users tracking the same product with different initial prices
const user1TelegramId = 111111;
const user2TelegramId = 222222;

// User 1 tracked at Initial = ₹10,000
trackerStore.addTracker({
  userId: user1TelegramId,
  productUrl: 'https://www.amazon.in/dp/SIMULATE_TEST',
  platform: 'Amazon',
  title: 'Samsung SSD 1TB',
  initialPrice: 10000
});

// User 2 tracked at Initial = ₹9,000
trackerStore.addTracker({
  userId: user2TelegramId,
  productUrl: 'https://www.amazon.in/dp/SIMULATE_TEST',
  platform: 'Amazon',
  title: 'Samsung SSD 1TB',
  initialPrice: 9000
});

const sentMessages = [];
const mockBot = {
  api: {
    sendMessage: async (chatId, text, options) => {
      sentMessages.push({ chatId, text, options });
    }
  }
};

// Scenario A: Price increases to ₹11,000 (No drop for anyone)
await checkProductPrices(mockBot, () => 11000, trackerStore);
assert(sentMessages.length === 0, 'Scenario A (₹11,000): No alerts sent for price increase');
assert(trackerStore.getTrackersByUser(user1TelegramId).length === 1, 'Scenario A: User 1 tracker still active');
assert(trackerStore.getTrackersByUser(user2TelegramId).length === 1, 'Scenario A: User 2 tracker still active');

// Scenario B: Price stays exact at ₹10,000 (No drop)
await checkProductPrices(mockBot, () => 10000, trackerStore);
assert(sentMessages.length === 0, 'Scenario B (₹10,000): No alert sent for same price');

// Scenario C: Price drops to ₹9,500 (Drops for User 1, but NOT for User 2)
await checkProductPrices(mockBot, () => 9500, trackerStore);
assert(sentMessages.length === 1, 'Scenario C (₹9,500): Exactly 1 alert sent');
assert(sentMessages[0].chatId === user1TelegramId, 'Scenario C: Alert delivered to User 1 (Initial ₹10,000)');
assert(sentMessages[0].text.includes('PRICE DROPPED!'), 'Scenario C: Alert message contains 🔔 PRICE DROPPED!');
assert(sentMessages[0].text.includes('You saved: <b>₹500</b>'), 'Scenario C: Savings correctly formatted');

// Verify soft-deactivation (record exists in SQLite but active = 0)
const allUser1Records = testDbService.db.prepare(`
  SELECT t.* FROM tracking t 
  JOIN users u ON t.user_id = u.id 
  WHERE u.telegram_id = ?
`).all(user1TelegramId);

assert(allUser1Records.length === 1, 'Soft-Deactivation: Record is preserved in SQLite (NOT deleted)');
assert(allUser1Records[0].active === 0, 'Soft-Deactivation: active is set to 0');
assert(trackerStore.getTrackersByUser(user1TelegramId).length === 0, 'User 1 active list is now empty');
assert(trackerStore.getTrackersByUser(user2TelegramId).length === 1, 'User 2 tracking remains active');

// Scenario D: Price drops further to ₹8,500 (Now drops for User 2)
sentMessages.length = 0;
await checkProductPrices(mockBot, () => 8500, trackerStore);
assert(sentMessages.length === 1, 'Scenario D (₹8,500): User 2 alert sent');
assert(sentMessages[0].chatId === user2TelegramId, 'Scenario D: Alert delivered to User 2');
assert(trackerStore.getTrackersByUser(user2TelegramId).length === 0, 'Scenario D: User 2 tracking auto-disabled');

// All records remain preserved in SQLite history
const totalDbRows = testDbService.db.prepare('SELECT COUNT(*) as count FROM tracking').get();
assert(totalDbRows.count === 2, 'History Preserved: All tracking rows remain in SQLite database');

console.log(`\n========================================`);
console.log(`Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
