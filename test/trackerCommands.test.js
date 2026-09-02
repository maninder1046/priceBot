import { DatabaseService } from '../src/services/database/database.js';
import { TrackerStore } from '../src/services/database/trackerStore.js';
import { config } from '../src/config/env.js';

console.log('🧪 Running Tracker Capacity & Command Store Test Suite...\n');

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

// Use isolated in-memory DB for capacity tests
const testDb = new DatabaseService(':memory:');
const trackerStore = new TrackerStore(testDb);
const testUserId = 999999;

// 1. Add 5 tracked products (Capacity Limit)
for (let i = 1; i <= config.maxTrackedPerUser; i++) {
  const res = trackerStore.addTracker({
    userId: testUserId,
    productUrl: `https://www.amazon.in/dp/PRODUCT_${i}`,
    platform: 'Amazon',
    title: `Product #${i}`,
    initialPrice: 1000 * i
  });
  assert(res.success === true, `Added item ${i}/${config.maxTrackedPerUser}`);
}

// 2. Add 6th item (Should be blocked)
const excessResult = trackerStore.addTracker({
  userId: testUserId,
  productUrl: 'https://www.amazon.in/dp/EXCESS_PRODUCT',
  platform: 'Amazon',
  title: 'Excess Product',
  initialPrice: 9999
});

assert(excessResult.success === false, '6th item rejected: Max capacity enforced');
assert(excessResult.error.includes('Limit reached'), 'Correct capacity error message returned');

// 3. Test Active Trackers Count
let activeList = trackerStore.getTrackersByUser(testUserId);
assert(activeList.length === config.maxTrackedPerUser, `Active tracker list has ${config.maxTrackedPerUser} items`);

// 4. Test Stopping 1 item by index (1-based index)
const stopFirstResult = trackerStore.stopTrackerByIndex(testUserId, 1);
assert(stopFirstResult.success === true, 'Stopped item #1 successfully');
assert(stopFirstResult.stoppedTracker.title === 'Product #1', 'Correct item deactivated');

activeList = trackerStore.getTrackersByUser(testUserId);
assert(activeList.length === config.maxTrackedPerUser - 1, `Active list count decreased to ${config.maxTrackedPerUser - 1}`);

// 5. Add a new item now that a slot was freed
const replaceResult = trackerStore.addTracker({
  userId: testUserId,
  productUrl: 'https://www.amazon.in/dp/REPLACEMENT_PRODUCT',
  platform: 'Amazon',
  title: 'Replacement Product',
  initialPrice: 5000
});
assert(replaceResult.success === true, 'Added new item after freeing capacity slot');

// 6. Test Stop All Trackers
const stopAllResult = trackerStore.stopAllTrackers(testUserId);
assert(stopAllResult.success === true, 'Stopped all trackers successfully');
assert(stopAllResult.stoppedCount === config.maxTrackedPerUser, `Reported ${config.maxTrackedPerUser} items stopped`);

activeList = trackerStore.getTrackersByUser(testUserId);
assert(activeList.length === 0, 'Active list is now completely empty');

console.log(`\n========================================`);
console.log(`Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
