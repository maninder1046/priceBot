import { priceService } from '../src/services/providers/priceService.js';
import { DatabaseService } from '../src/services/database/database.js';
import { TrackerStore } from '../src/services/database/trackerStore.js';

console.log('🧪 Running Product Scraper Service & Tracker Store Test Suite...\n');

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

// 1. Test PriceService Dispatcher
const registered = priceService.getRegisteredPlatforms();
assert(registered.length >= 3, 'PriceService has all 3 store providers registered (Amazon, Flipkart, Myntra)');

// 2. Tracker Store Tests with Isolated In-Memory SQLite
const testDb = new DatabaseService(':memory:');
const trackerStore = new TrackerStore(testDb);

const result = trackerStore.addTracker({
  userId: 123456789,
  productUrl: 'https://www.amazon.in/dp/example',
  platform: 'Amazon',
  title: 'Apple AirPods Pro',
  initialPrice: 6499
});

assert(result.success === true, 'Tracker: addTracker succeeded');
assert(typeof result.tracker.userId === 'number', 'Tracker: userId stored as number');
assert(result.tracker.productUrl === 'https://www.amazon.in/dp/example', 'Tracker: productUrl matches');
assert(result.tracker.platform === 'amazon', 'Tracker: platform normalized');
assert(result.tracker.initialPrice === 6499, 'Tracker: initialPrice stored as integer 6499');
assert(result.tracker.lastPrice === 6499, 'Tracker: lastPrice stored as integer 6499');
assert(result.tracker.active === true, 'Tracker: active is true');
assert(typeof result.tracker.createdAt === 'number', 'Tracker: createdAt timestamp recorded');

const userTrackers = trackerStore.getTrackersByUser(123456789);
assert(userTrackers.length === 1, 'Tracker: User tracking list has 1 item');

console.log(`\n========================================`);
console.log(`Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
