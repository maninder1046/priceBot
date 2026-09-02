import { config } from '../../config/env.js';

/**
 * Executes an asynchronous task function with retry limits, exponential backoff, and timeouts.
 * 
 * @param {Function} taskFn - Async function returning a promise
 * @param {object} [options]
 * @param {number} [options.maxRetries] - Defaults to config.schedulerMaxRetries (2)
 * @param {number} [options.baseDelayMs=1000] - Base backoff delay in ms
 * @param {number} [options.timeoutMs=15000] - Overall timeout per attempt in ms
 * @returns {Promise<any>}
 */
export async function executeWithRetry(taskFn, options = {}) {
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : config.schedulerMaxRetries;
  const baseDelayMs = options.baseDelayMs || 1000;
  const timeoutMs = options.timeoutMs || 15000;

  let attempt = 0;
  let lastError;

  while (attempt <= maxRetries) {
    try {
      const taskPromise = taskFn();
      const timeoutPromise = new Promise((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error(`Task timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      return await Promise.race([taskPromise, timeoutPromise]);
    } catch (err) {
      lastError = err;
      attempt++;

      if (attempt <= maxRetries) {
        // Exponential backoff: baseDelay * 2^(attempt-1) + random jitter
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 500;
        const delay = Math.round(exponentialDelay + jitter);

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Concurrency Worker Pool
 * 
 * Executes an array of async task functions limiting active concurrent execution.
 * 
 * @param {Array<() => Promise<any>>} tasks - Array of factory functions returning promises
 * @param {number} [concurrency] - Maximum simultaneous tasks (default: config.schedulerConcurrency)
 * @returns {Promise<Array<{ status: 'fulfilled'|'rejected', value?: any, reason?: any }>>}
 */
export async function executePool(tasks, concurrency = config.schedulerConcurrency) {
  if (!tasks || tasks.length === 0) {
    return [];
  }

  const limit = Math.max(1, concurrency);
  const results = new Array(tasks.length);
  let currentIndex = 0;

  // Worker loop function
  async function worker() {
    while (currentIndex < tasks.length) {
      const index = currentIndex++;
      const taskFn = tasks[index];

      try {
        const value = await taskFn();
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  // Spawn pool of workers
  const workerCount = Math.min(limit, tasks.length);
  const workerPromises = [];

  for (let i = 0; i < workerCount; i++) {
    workerPromises.push(worker());
  }

  await Promise.all(workerPromises);
  return results;
}
