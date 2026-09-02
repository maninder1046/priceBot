import { DatabaseService } from '../src/services/database/database.js';
import { TrackerStore } from '../src/services/database/trackerStore.js';

console.log('🧪 Running Persistent SQLite Database Test Suite...\n');

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

// Use isolated in-memory DB for test suite
const testDb = new DatabaseService(':memory:');
const trackerStore = new TrackerStore(testDb);

// 1. User creation
const user1 = testDb.ensureUser(12345);
assert(user1.telegram_id === 12345, 'User 1 created in SQLite');
const user1Duplicate = testDb.ensureUser(12345);
assert(user1.id === user1Duplicate.id, 'User lookup deduplication works (same user ID returned)');

// 2. Product creation & Deduplication
const prod1 = testDb.findOrCreateProduct({
  normalizedUrl: 'https://www.amazon.in/dp/B08L5VJZ37',
  platform: 'Amazon',
  name: 'Samsung SSD 980',
  initialPrice: 6499
});
assert(prod1.initial_price === 6499, 'Product created with integer price 6499');

const prod1Duplicate = testDb.findOrCreateProduct({
  normalizedUrl: 'https://www.amazon.in/dp/B08L5VJZ37',
  platform: 'Amazon',
  name: 'Samsung SSD 980 New Title',
  initialPrice: 6499
});
assert(prod1.id === prod1Duplicate.id, 'Product deduplication works (1 row for same URL)');

// 3. Multi-user tracking on same product (Single scrape target)
const track1 = trackerStore.addTracker({
  userId: 12345,
  productUrl: 'https://www.amazon.in/dp/B08L5VJZ37',
  platform: 'Amazon',
  title: 'Samsung SSD 980',
  initialPrice: 6499
});
assert(track1.success === true, 'User 1 started tracking product');

const user2 = testDb.ensureUser(67890);
const track2 = trackerStore.addTracker({
  userId: 67890,
  productUrl: 'https://www.amazon.in/dp/B08L5VJZ37',
  platform: 'Amazon',
  title: 'Samsung SSD 980',
  initialPrice: 6499
});
assert(track2.success === true, 'User 2 started tracking same product');

const productsCount = testDb.db.prepare('SELECT COUNT(*) as count FROM products').get();
assert(productsCount.count === 1, 'Normalized Schema: Exactly 1 product row exists for both users');

const trackingCount = testDb.db.prepare('SELECT COUNT(*) as count FROM tracking WHERE active = 1').get();
assert(trackingCount.count === 2, 'Normalized Schema: 2 separate tracking rows exist');

const uniqueActiveProducts = testDb.getAllActiveUniqueProducts();
assert(uniqueActiveProducts.length === 1, 'Scheduler will only scrape this product ONCE (100% deduplication)');

// 4. User-isolated listing
const user1List = trackerStore.getTrackersByUser(12345);
assert(user1List.length === 1, 'User 1 sees their tracked product');

const user2List = trackerStore.getTrackersByUser(67890);
assert(user2List.length === 1, 'User 2 sees their tracked product');

// 5. User 1 stops tracking without affecting User 2
const stop1 = trackerStore.stopTrackerByIndex(12345, 1);
assert(stop1.success === true, 'User 1 stopped tracking');
assert(trackerStore.getTrackersByUser(12345).length === 0, 'User 1 active list is now 0');
assert(trackerStore.getTrackersByUser(67890).length === 1, 'User 2 tracking remains untouched (Isolation intact)');

const remainingActive = testDb.getAllActiveUniqueProducts();
assert(remainingActive.length === 1, 'Product still tracked for remaining user');

// 6. User 2 stops tracking
trackerStore.stopTrackerByIndex(67890, 1);
assert(testDb.getAllActiveUniqueProducts().length === 0, 'No active products left for scheduler');

console.log(`\n========================================`);
console.log(`Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
