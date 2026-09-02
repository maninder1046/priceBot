import { executePool, executeWithRetry } from '../src/services/checker/workerPool.js';

console.log('🧪 Running Scheduler Worker Pool & Reliability Test Suite...\n');

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

// 1. Concurrency limit verification
let activeConcurrent = 0;
let maxActiveObserved = 0;

const concurrentTasks = Array.from({ length: 15 }, (_, i) => async () => {
  activeConcurrent++;
  if (activeConcurrent > maxActiveObserved) {
    maxActiveObserved = activeConcurrent;
  }
  // Simulate async work
  await new Promise((resolve) => setTimeout(resolve, 30));
  activeConcurrent--;
  return `task_${i}`;
});

const poolResults = await executePool(concurrentTasks, 3);
assert(poolResults.length === 15, 'WorkerPool: Completed all 15 tasks');
assert(maxActiveObserved <= 3, `WorkerPool: Concurrency capped at max 3 (Observed: ${maxActiveObserved})`);
assert(poolResults.every((r) => r.status === 'fulfilled'), 'WorkerPool: All tasks fulfilled');

// 2. Retry with Exponential Backoff verification
let failAttempts = 0;
const flakyTask = async () => {
  failAttempts++;
  if (failAttempts < 3) {
    throw new Error('Transient network glitch');
  }
  return 'success_after_retries';
};

const retryResult = await executeWithRetry(flakyTask, { maxRetries: 3, baseDelayMs: 20 });
assert(retryResult === 'success_after_retries', 'RetryEngine: Flaky task recovered successfully');
assert(failAttempts === 3, 'RetryEngine: Exactly 3 attempts made before succeeding');

// 3. Task Timeout verification
const hangingTask = async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return 'too_late';
};

let timeoutCaught = false;
try {
  await executeWithRetry(hangingTask, { maxRetries: 0, timeoutMs: 50 });
} catch (err) {
  if (err.message.includes('timed out')) {
    timeoutCaught = true;
  }
}
assert(timeoutCaught === true, 'RetryEngine: Cleanly aborted hanging task exceeding timeout');

console.log(`\n========================================`);
console.log(`Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
