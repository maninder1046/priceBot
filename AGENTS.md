# Antigravity Agent Rules for priceBot

## 📁 Code Organization: No File Clustering

- **Single Responsibility:** Always separate logic across dedicated, relatable files. Do NOT put config, database logic, scrapers, and bot commands into a single monolithic file.
- **Directory Structure:**
  - `src/config/`: Environment configuration and app settings.
  - `src/bot/`: grammY bot instance, command handlers, and message listeners.
  - `src/services/`: Specific services (e.g., `urlValidator.js`, `scraper.js`, `database.js`).
  - `src/utils/`: Helper utilities (e.g., string sanitizers, formatters).
  - `test/`: Focused test files matching their respective service.
- **Modularity:** Keep files concise and focused on one specific domain for effortless debugging and maintenance.

## 🧹 Zero Redundant Code Policy

- **No Dead / Unused Code:** Immediately remove unused variables, dead imports, deprecated helper functions, and commented-out code blocks.
- **Strict DRY (Don't Repeat Yourself):** Avoid duplicate logic (e.g., identical parsing, repeated validation rules, duplicate regex patterns). Extract shared logic into reusable utility functions or services.
- **Clean Refactoring:** When replacing or updating logic, delete the old implementation completely rather than leaving legacy artifacts or backwards-compatibility cruft.
