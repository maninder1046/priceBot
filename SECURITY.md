# Security Architecture & Roadmap Guide

This document outlines the security layers and best practices for **priceBot**, tracking what is currently implemented and what must be applied during upcoming development phases.

---

## 🛡️ Current Security Status (Phase 1)

| Layer | Status | Implementation |
| :--- | :---: | :--- |
| **Secret Isolation** | ✅ Implemented | Secrets reside strictly in `.env` (never hardcoded in source). |
| **Git Exclusion** | ✅ Implemented | `.gitignore` explicitly ignores `.env` and `*.log` files. |
| **Fail-Fast Validation** | ✅ Implemented | `src/config/env.js` validates `BOT_TOKEN` before startup to avoid unhandled runtime crashes. |
| **Error Isolation** | ✅ Implemented | `bot.catch()` in `src/bot/bot.js` catches unhandled exceptions, keeping stack traces and tokens away from Telegram chat outputs. |

---

## 🔒 Security Layers Roadmap

### 1. Rate Limiting & Flood Control (DoSLayer)
* **Trigger Phase:** Phase 1 / Phase 2
* **Risk:** Malicious users or bots spamming commands to exhaust memory/CPU or trigger Telegram API rate limits (HTTP 429).
* **Action:**
  - Install `@grammyjs/ratelimiter`
  - Limit users to a reasonable threshold (e.g., 2–3 requests per second per `user_id`).
  - Send a friendly *"You're doing that too fast. Please wait a moment."* message when throttled.

---

### 2. SSRF (Server-Side Request Forgery) & URL Validation
* **Trigger Phase:** Phase 2 (URL Input & Scraping)
* **Risk:** Attackers submitting URLs targeting internal/private services (e.g., `http://localhost:8080`, `http://192.168.1.1`, or `http://169.254.169.254`).
* **Action:**
  - Require protocol to strictly be `https:`.
  - Whitelist allowed merchant hostnames (e.g., `amazon.in`, `flipkart.com`, `myntra.com`).
  - Resolve DNS hostnames before requesting and verify the IP does **not** fall in private/loopback ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  - Limit HTTP redirects (`maxRedirects: 3`) and set request timeouts (e.g., 5000ms).

---

### 3. Telegram Message Injection Prevention
* **Trigger Phase:** Phase 2 / Phase 3 (Displaying Scraped Product Data & Alerts)
* **Risk:** Product titles containing special Markdown characters (`*`, `_`, `[`, `` ` ``) will break formatting and cause Telegram 400 Bad Request errors.
* **Action:**
  - Prefer `parse_mode: 'HTML'` and escape user/scraped text using HTML entity escaping:
    ```javascript
    export function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
    ```

---

### 4. Multi-Tenant Data Isolation (Authorization Scoping)
* **Trigger Phase:** Phase 3 (Database Storage & Subscriptions)
* **Risk:** User A accessing, modifying, or viewing tracked products belonging to User B (IDOR vulnerability).
* **Action:**
  - Every database query for tracked items must strictly include the user filter `where user_id = ctx.from.id`.
  - Never accept an arbitrary user identifier in command parameters.

---

### 5. Telegram API Auto-Retry & Network Resilience
* **Trigger Phase:** Phase 3 / Phase 4 (Periodic background price checking)
* **Risk:** Telegram API temporarily throwing rate-limit errors or network drops when broadcasting alerts to multiple users simultaneously.
* **Action:**
  - Install `@grammyjs/auto-retry` plugin.
  - Automatically honor Telegram `retry_after` responses for smooth background notification queues.

---

## 📋 Pre-Deployment Security Checklist
- [ ] Ensure `.env` is **NOT** tracked in git (`git status --ignored` should show `.env`).
- [ ] Keep dependencies updated with `npm audit`.
- [ ] Run bot with non-root permissions in production (e.g., Docker container / systemd).
