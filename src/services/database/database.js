import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../../config/env.js';

/**
 * SQLite Database Service
 */
export class DatabaseService {
  constructor(dbPath = config.dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.init();
  }

  init() {
    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.createSchema();
  }

  createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        normalized_url TEXT UNIQUE NOT NULL,
        platform TEXT NOT NULL,
        name TEXT NOT NULL,
        initial_price INTEGER NOT NULL,
        last_price INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        initial_price INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE(user_id, product_id)
      );

      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_products_url ON products(normalized_url);
      CREATE INDEX IF NOT EXISTS idx_tracking_user_active ON tracking(user_id, active);
    `);

    // Dynamic migration: Ensure initial_price column exists if table was created in an older phase
    const tableInfo = this.db.prepare('PRAGMA table_info(tracking)').all();
    const hasInitialPrice = tableInfo.some((col) => col.name === 'initial_price');
    if (!hasInitialPrice) {
      this.db.exec('ALTER TABLE tracking ADD COLUMN initial_price INTEGER NOT NULL DEFAULT 0');
    }
  }

  ensureUser(telegramId) {
    const numericId = Number(telegramId);
    const existing = this.db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(numericId);
    if (existing) {
      return existing;
    }

    const now = Date.now();
    const result = this.db.prepare('INSERT INTO users (telegram_id, created_at) VALUES (?, ?)').run(numericId, now);
    return {
      id: result.lastInsertRowid,
      telegram_id: numericId,
      created_at: now
    };
  }

  findOrCreateProduct({ normalizedUrl, platform, name, initialPrice }) {
    const existing = this.db.prepare('SELECT * FROM products WHERE normalized_url = ?').get(normalizedUrl);
    const priceInt = Math.round(initialPrice || 0);

    if (existing) {
      if (existing.last_price === 0 && priceInt > 0) {
        this.db.prepare('UPDATE products SET last_price = ?, name = ? WHERE id = ?').run(priceInt, name || existing.name, existing.id);
      }
      return existing;
    }

    const now = Date.now();
    const result = this.db.prepare(`
      INSERT INTO products (normalized_url, platform, name, initial_price, last_price, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(normalizedUrl, platform.toLowerCase(), name, priceInt, priceInt, now);

    return {
      id: result.lastInsertRowid,
      normalized_url: normalizedUrl,
      platform: platform.toLowerCase(),
      name,
      initial_price: priceInt,
      last_price: priceInt,
      created_at: now
    };
  }

  addTracker({ telegramId, productUrl, platform, title, initialPrice }) {
    const user = this.ensureUser(telegramId);
    const product = this.findOrCreateProduct({
      normalizedUrl: productUrl,
      platform,
      name: title,
      initialPrice
    });

    const activeCountRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM tracking WHERE user_id = ? AND active = 1
    `).get(user.id);

    const existingTracking = this.db.prepare(`
      SELECT * FROM tracking WHERE user_id = ? AND product_id = ?
    `).get(user.id, product.id);

    if ((!existingTracking || existingTracking.active === 0) && activeCountRow.count >= config.maxTrackedPerUser) {
      return {
        success: false,
        error: `Limit reached. You can track up to ${config.maxTrackedPerUser} products at a time. Use /stop to remove an item.`
      };
    }

    const now = Date.now();
    const priceInt = Math.round(initialPrice);

    if (existingTracking) {
      this.db.prepare(`UPDATE tracking SET active = 1, initial_price = ? WHERE id = ?`).run(priceInt, existingTracking.id);
    } else {
      this.db.prepare(`
        INSERT INTO tracking (user_id, product_id, initial_price, active, created_at) VALUES (?, ?, ?, 1, ?)
      `).run(user.id, product.id, priceInt, now);
    }

    return {
      success: true,
      tracker: {
        userId: user.telegram_id,
        productId: product.id,
        productUrl: product.normalized_url,
        platform: product.platform,
        title: product.name,
        initialPrice: priceInt,
        lastPrice: product.last_price,
        active: true,
        createdAt: now
      }
    };
  }

  getUserActiveTrackers(telegramId) {
    const numericId = Number(telegramId);
    return this.db.prepare(`
      SELECT 
        t.id as tracking_id,
        p.id as product_id,
        p.name as title,
        p.normalized_url as productUrl,
        p.platform,
        t.initial_price as initialPrice,
        p.last_price as lastPrice,
        t.created_at as trackingCreatedAt
      FROM tracking t
      JOIN users u ON t.user_id = u.id
      JOIN products p ON t.product_id = p.id
      WHERE u.telegram_id = ? AND t.active = 1
      ORDER BY t.created_at ASC
    `).all(numericId);
  }

  getProductSubscribers(productId) {
    return this.db.prepare(`
      SELECT 
        t.id as tracking_id,
        u.telegram_id as telegramId,
        t.initial_price as initialPrice,
        p.last_price as lastPrice,
        p.name as title,
        p.normalized_url as productUrl,
        p.platform
      FROM tracking t
      JOIN users u ON t.user_id = u.id
      JOIN products p ON t.product_id = p.id
      WHERE t.product_id = ? AND t.active = 1
    `).all(productId);
  }

  deactivateTracking(trackingId) {
    this.db.prepare('UPDATE tracking SET active = 0 WHERE id = ?').run(trackingId);
  }

  stopTrackerByIdForUser(telegramId, trackingId) {
    const tracker = this.db.prepare(`
      SELECT t.*, p.name as title FROM tracking t
      JOIN users u ON t.user_id = u.id
      JOIN products p ON t.product_id = p.id
      WHERE t.id = ? AND u.telegram_id = ? AND t.active = 1
    `).get(trackingId, Number(telegramId));

    if (!tracker) {
      return { success: false, error: 'Tracker already stopped or not found.' };
    }

    this.deactivateTracking(trackingId);

    return {
      success: true,
      stoppedTracker: tracker
    };
  }

  stopTrackerByIndex(telegramId, index1Based) {
    const activeList = this.getUserActiveTrackers(telegramId);

    if (index1Based < 1 || index1Based > activeList.length) {
      return {
        success: false,
        error: `Invalid product number. Please specify a number between 1 and ${activeList.length}.`
      };
    }

    const target = activeList[index1Based - 1];
    this.deactivateTracking(target.tracking_id);

    return {
      success: true,
      stoppedTracker: target
    };
  }

  stopAllTrackers(telegramId) {
    const user = this.db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(Number(telegramId));
    if (!user) {
      return { success: true, stoppedCount: 0 };
    }

    const result = this.db.prepare('UPDATE tracking SET active = 0 WHERE user_id = ? AND active = 1').run(user.id);

    return {
      success: true,
      stoppedCount: result.changes
    };
  }

  getAllActiveUniqueProducts() {
    return this.db.prepare(`
      SELECT DISTINCT 
        p.id,
        p.normalized_url as productUrl,
        p.platform,
        p.name,
        p.initial_price as initialPrice,
        p.last_price as lastPrice
      FROM products p
      JOIN tracking t ON p.id = t.product_id
      WHERE t.active = 1
    `).all();
  }

  updateProductPrice(productId, newPrice) {
    this.db.prepare('UPDATE products SET last_price = ? WHERE id = ?').run(Math.round(newPrice), productId);
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

export const dbService = new DatabaseService();
