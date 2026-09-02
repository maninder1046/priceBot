import { rateLimiter } from '../src/services/security/rateLimiter.js';

console.log('🧪 Running Rate Limiter Test Suite...\n');

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

rateLimiter.clear();
const testUserId = 998877;

const req1 = rateLimiter.checkUrlSubmissionLimit(testUserId);
assert(req1.allowed === true, 'Submission 1: Allowed');

const req2 = rateLimiter.checkUrlSubmissionLimit(testUserId);
assert(req2.allowed === true, 'Submission 2: Allowed');

const req3 = rateLimiter.checkUrlSubmissionLimit(testUserId);
assert(req3.allowed === true, 'Submission 3: Allowed');

const req4 = rateLimiter.checkUrlSubmissionLimit(testUserId);
assert(req4.allowed === false, 'Submission 4: Blocked (Rate limit exceeded)');
assert(req4.remainingWaitSeconds > 0, `Remaining wait reported (${req4.remainingWaitSeconds}s)`);

const otherUserReq = rateLimiter.checkUrlSubmissionLimit(112233);
assert(otherUserReq.allowed === true, 'Different user is not affected by other user rate limit');

console.log(`\n========================================`);
console.log(`Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
