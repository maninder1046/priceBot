import { config } from '../../config/env.js';

/**
 * In-Memory Sliding Window Rate Limiter Service
 */
class RateLimiter {
  constructor() {
    /** @type {Map<string, number[]>} Timestamps array keyed by userId */
    this.userSubmissionWindows = new Map();

    // Periodic sweep every 5 minutes to prevent unbounded memory growth from stale users
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleEntries();
    }, 5 * 60 * 1000);

    // Ensure timer doesn't block Node process from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  checkUrlSubmissionLimit(userId) {
    const userKey = String(userId);
    const now = Date.now();
    const windowDurationMs = 60 * 1000;
    const maxSubmissions = config.urlRateLimitPerMinute;

    const timestamps = this.userSubmissionWindows.get(userKey) || [];
    const activeTimestamps = timestamps.filter((t) => now - t < windowDurationMs);

    if (activeTimestamps.length >= maxSubmissions) {
      const oldestActive = activeTimestamps[0];
      const remainingWaitMs = windowDurationMs - (now - oldestActive);
      const remainingWaitSeconds = Math.max(1, Math.ceil(remainingWaitMs / 1000));

      return {
        allowed: false,
        remainingWaitSeconds
      };
    }

    activeTimestamps.push(now);
    this.userSubmissionWindows.set(userKey, activeTimestamps);

    return {
      allowed: true
    };
  }

  cleanupStaleEntries() {
    const now = Date.now();
    const windowDurationMs = 60 * 1000;

    for (const [userKey, timestamps] of this.userSubmissionWindows.entries()) {
      const active = timestamps.filter((t) => now - t < windowDurationMs);
      if (active.length === 0) {
        this.userSubmissionWindows.delete(userKey);
      } else {
        this.userSubmissionWindows.set(userKey, active);
      }
    }
  }

  clear() {
    this.userSubmissionWindows.clear();
  }
}

export const rateLimiter = new RateLimiter();
