# 🏷️ Price Drop Telegram Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

A lightweight, robust Telegram Bot that tracks product prices across major e-commerce platforms (**Amazon, Flipkart, Myntra**) and automatically alerts users the moment a price drops.

---

## ✨ Features

- 🛒 **Supported Stores:** Amazon, Flipkart, and Myntra (handles both desktop URLs and mobile app share links).
- 🔔 **Instant Alerts:** Automatically calculates price drops against the initial price and delivers formatted Telegram alerts with product links.
- 📱 **Interactive Inline Keyboards:** Manage active items directly in Telegram with `[ ❌ Stop ]`, `[ 🛒 View Product ]`, `[ 🛑 Stop All ]`, and `[ 🔄 Refresh ]` buttons.
- ⚡ **Relational & Normalized SQLite Storage:** High-performance storage via `better-sqlite3` with WAL mode and product URL deduplication.
- 🛡️ **Hardened Security & SSRF Protection:** Private IP/localhost blocking, credential stripping, 10s request timeouts, 5MB response size caps, and strict HTML escaping.
- 🔄 **Concurrency & Resilience Engine:** Background scheduler with worker pools (fixed concurrency), exponential backoff retry with jitter, and overlap execution locks.
- 🧪 **100% Test Coverage:** 10 isolated unit test suites verifying all critical paths without touching live database files.

---

## 📁 Project Structure

```
priceBot/
├── src/
│   ├── bot/
│   │   ├── bot.js                 # grammY bot initialization & middlewares
│   │   └── handlers/
│   │       ├── commands.js        # /start, /help, /list, /stop command handlers
│   │       ├── callbackHandler.js # Inline keyboard buttons & callback query handler
│   │       └── urlHandler.js      # URL extraction, rate-limiting & tracker registration
│   ├── config/
│   │   └── env.js                 # Environment variable validation & defaults
│   ├── services/
│   │   ├── checker/
│   │   │   ├── priceChecker.js    # Price evaluation & notification broadcaster
│   │   │   ├── scheduler.js       # Background interval runner with overlap protection
│   │   │   └── workerPool.js      # Controlled concurrency pool & retry engine
│   │   ├── database/
│   │   │   ├── database.js        # Relational SQLite database engine with WAL mode
│   │   │   └── trackerStore.js    # Data Access Layer / Domain store proxy
│   │   ├── providers/
│   │   │   ├── baseProvider.js    # Abstract provider & Schema.org JSON-LD parser
│   │   │   ├── httpClient.js      # Hardened HTTP client with short-link unshortening
│   │   │   ├── priceService.js    # Store provider dispatcher registry
│   │   │   ├── amazonProvider.js  # Amazon store provider
│   │   │   ├── flipkartProvider.js# Flipkart store provider
│   │   │   └── myntraProvider.js  # Myntra store provider
│   │   ├── scraper/
│   │   │   ├── productScraper.js  # Unified scraping interface
│   │   │   └── schemaParser.js    # Schema.org JSON-LD extractor
│   │   ├── security/
│   │   │   └── rateLimiter.js     # Sliding-window rate limiter with memory sweep
│   │   └── validator/
│   │       └── urlValidator.js    # Domain allowlisting & SSRF guard
│   ├── utils/
│   │   ├── currency/currencyFormatter.js
│   │   ├── network/stealthHeaders.js
│   │   └── sanitizers/textSanitizer.js
│   └── index.js                   # Application entry point & lifecycle hooks
│
├── test/                          # Unit test suites (runs with isolated in-memory SQLite)
├── .env.example                   # Environment configuration template
├── .gitignore                     # Git ignore rules for secrets and DB files
└── package.json
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v18.0.0` or higher
- **Telegram Bot Token**: Create a bot via [@BotFather](https://t.me/BotFather) and copy the HTTP API token.

### 2. Installation
```bash
# Clone repository
git clone https://github.com/your-username/priceBot.git
cd priceBot

# Install dependencies
npm install
```

### 3. Environment Configuration
Create your `.env` file from the provided template:
```bash
cp .env.example .env
```

Edit `.env` and set your credentials:
```ini
BOT_TOKEN=your_telegram_bot_token_here
CHECK_INTERVAL_MINUTES=30
SCHEDULER_CONCURRENCY=5
MAX_TRACKED_PER_USER=5
```

### 4. Running the Bot

**Development Mode (Auto-restart on edit):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

---

## 🧪 Running Automated Tests

Run the complete suite of 10 automated unit tests (tests run in `:memory:` SQLite without altering real database files):

```bash
npm test
```

---

## 📖 Bot Commands

| Command | Description |
| :--- | :--- |
| `/start` | Start the bot and get a welcome guide |
| `/list` | View active tracked products with interactive buttons |
| `/stop <number>` | Stop tracking a specific item (e.g., `/stop 1`) |
| `/stop all` | Stop tracking all active products |
| `/help` | Display command guide, store support, and limits |

---

## 🛡️ Security Best Practices

- **Zero Secret Exposure:** `.env` and SQLite `.db` files are strictly excluded via `.gitignore`.
- **SSRF Defense:** Prevents requests to local IPs (`127.0.0.1`), private networks (`10.0.0.0/8`, `192.168.0.0/16`), and AWS/GCP cloud metadata endpoints (`169.254.169.254`).
- **Memory Safety:** Periodic in-memory sweep sweeps expired rate-limit windows without holding process references.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
