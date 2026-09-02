# Project Architecture & Modular Code Rules

## 📁 Modular File Organization Policy

To maintain code readability, prevent bloated files, and simplify testing/debugging:

1. **Single Responsibility Principle:**
   - Never cluster unrelated logic into a single monolithic file.
   - Separate concerns into dedicated directories and focused modules:
     - `src/config/`: Configuration loading, validation, and constants.
     - `src/bot/`: Bot handlers, command routers, middleware, and message dispatchers.
     - `src/services/`: Business logic, scrapers, URL validators, database adapters.
     - `src/utils/`: Generic helper functions, formatters, and sanitizers.
     - `test/`: Automated test suites separated by unit/module.

2. **File Size & Scope Guidelines:**
   - Keep individual files focused (typically under 100–150 lines).
   - If a file begins managing multiple domains (e.g., both URL validation and HTML scraping), split it into separate modules (e.g., `urlValidator.js` and `scraper.js`).

3. **Explicit Exports & Clean Imports:**
   - Every file must have clear, named exports.
   - Use standard ES module import syntax (`import { ... } from './...'`).

## 🧹 Zero Redundant Code Policy

1. **No Dead / Unused Code:**
   - Always remove unused variables, unused imports, deprecated helper functions, and commented-out code blocks.

2. **Strict DRY (Don't Repeat Yourself):**
   - Avoid duplicate parsing or validation logic across different files.
   - Extract common patterns into `src/utils/` or dedicated shared services.

3. **Clean Refactoring:**
   - When refactoring or replacing an old implementation, delete the old implementation completely rather than leaving dead artifacts.
