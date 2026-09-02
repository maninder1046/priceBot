import { dbService as defaultDbService } from './database.js';

/**
 * Tracker Store Service
 */
export class TrackerStore {
  constructor(db = defaultDbService) {
    this.db = db;
  }

  addTracker({ userId, productUrl, platform, title, initialPrice }) {
    return this.db.addTracker({
      telegramId: userId,
      productUrl,
      platform,
      title,
      initialPrice
    });
  }

  getTrackersByUser(userId) {
    return this.db.getUserActiveTrackers(userId);
  }

  stopTrackerById(userId, trackingId) {
    return this.db.stopTrackerByIdForUser(userId, trackingId);
  }

  stopTrackerByIndex(userId, index1Based) {
    return this.db.stopTrackerByIndex(userId, index1Based);
  }

  stopAllTrackers(userId) {
    return this.db.stopAllTrackers(userId);
  }

  getAllActiveUniqueProducts() {
    return this.db.getAllActiveUniqueProducts();
  }

  getProductSubscribers(productId) {
    return this.db.getProductSubscribers(productId);
  }

  deactivateTracking(trackingId) {
    return this.db.deactivateTracking(trackingId);
  }

  updateProductPrice(productId, newPrice) {
    return this.db.updateProductPrice(productId, newPrice);
  }
}

export const trackerStore = new TrackerStore();
