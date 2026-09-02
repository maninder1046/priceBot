import { DatabaseService } from '../src/services/database/database.js';
import { TrackerStore } from '../src/services/database/trackerStore.js';
import { buildTrackingListPayload, handleCallbackQuery } from '../src/bot/handlers/callbackHandler.js';

console.log('🧪 Running Inline Keyboards & Callback Handler Test Suite...\n');

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

// Use an isolated in-memory database for testing so development database is NEVER wiped
const testDbService = new DatabaseService(':memory:');
const trackerStore = new TrackerStore(testDbService);
const testUser = 887766;

// 1. Empty List Payload
const emptyPayload = buildTrackingListPayload(testUser, trackerStore);
assert(emptyPayload.text.includes('No active trackers found'), 'Empty list: Correct text');

// 2. Add Tracked Products
const item1 = trackerStore.addTracker({
  userId: testUser,
  productUrl: 'https://www.amazon.in/dp/ITEM1',
  platform: 'Amazon',
  title: 'Samsung SSD 1TB',
  initialPrice: 6499
});

const item2 = trackerStore.addTracker({
  userId: testUser,
  productUrl: 'https://www.flipkart.com/dp/ITEM2',
  platform: 'Flipkart',
  title: 'Apple iPhone 15',
  initialPrice: 65999
});

// 3. Build List Payload with 2 Items
const populatedPayload = buildTrackingListPayload(testUser, trackerStore);
assert(populatedPayload.text.includes('Active Tracking (2/5)'), 'Populated list: Shows 2/5 count');
assert(populatedPayload.text.includes('Samsung SSD 1TB'), 'Populated list: Contains product 1');
assert(populatedPayload.text.includes('Apple iPhone 15'), 'Populated list: Contains product 2');

const keyboardRows = populatedPayload.keyboard.inline_keyboard;
assert(keyboardRows.length >= 3, 'Keyboard: Has product action rows and footer row');

// Row 1 buttons: [❌ Stop #1] [🛒 View Product]
const row1 = keyboardRows[0];
assert(row1[0].text.includes('Stop #1'), 'Button: Stop #1 text matches');
assert(row1[0].callback_data.startsWith('stop:'), 'Button: Stop callback_data format is stop:<id>');
assert(row1[1].text.includes('View Product'), 'Button: View Product text matches');
assert(row1[1].url === 'https://www.amazon.in/dp/ITEM1', 'Button: URL matches product URL');

// 4. Test Callback Query: Stop Item 1
let answeredToast = '';
let editedText = '';

const mockCtx = {
  from: { id: testUser },
  callbackQuery: { data: row1[0].callback_data },
  answerCallbackQuery: async (opts) => {
    answeredToast = opts?.text || '';
  },
  editMessageText: async (text) => {
    editedText = text;
  }
};

await handleCallbackQuery(mockCtx, trackerStore);
assert(answeredToast.includes('Stopped tracking'), 'Callback stop: Answered toast notification');
assert(editedText.includes('Active Tracking (1/5)'), 'Callback stop: Re-rendered list with 1 item remaining');
assert(trackerStore.getTrackersByUser(testUser).length === 1, 'Database: 1 active tracker left');

// 5. Test Callback Query: Stop All
let stopAllToast = '';
const mockStopAllCtx = {
  from: { id: testUser },
  callbackQuery: { data: 'stop_all' },
  answerCallbackQuery: async (opts) => {
    stopAllToast = opts?.text || '';
  },
  editMessageText: async (text) => {
    editedText = text;
  }
};

await handleCallbackQuery(mockStopAllCtx, trackerStore);
assert(stopAllToast.includes('Stopped all'), 'Callback stop_all: Toast confirmed');
assert(editedText.includes('All active trackers have been stopped'), 'Callback stop_all: Final state message shown');
assert(trackerStore.getTrackersByUser(testUser).length === 0, 'Database: 0 active trackers left');

console.log(`\n========================================`);
console.log(`Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
