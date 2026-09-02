import { parsePriceToInteger, formatCurrency } from '../src/utils/currency/currencyFormatter.js';
import { escapeHtml, cleanTitle } from '../src/utils/sanitizers/textSanitizer.js';

console.log('🧪 Running Utilities Test Suite...\n');

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

// Currency Parser Tests
assert(parsePriceToInteger('₹6,499') === 6499, 'Parse "₹6,499" -> 6499');
assert(parsePriceToInteger('6,499.00') === 6499, 'Parse "6,499.00" -> 6499');
assert(parsePriceToInteger('Rs. 1,299') === 1299, 'Parse "Rs. 1,299" -> 1299');
assert(parsePriceToInteger('1234') === 1234, 'Parse "1234" -> 1234');
assert(parsePriceToInteger('₹ 999.50') === 1000, 'Parse "₹ 999.50" -> 1000 (Rounded integer)');
assert(parsePriceToInteger('Invalid Price') === null, 'Parse invalid string -> null');

// Currency Formatter Tests
assert(formatCurrency(6499) === '₹6,499', 'Format 6499 -> "₹6,499"');
assert(formatCurrency(100000) === '₹1,00,000', 'Format 100000 -> "₹1,00,000" (Indian locale grouping)');

// Text Sanitizer & HTML Escaping
assert(escapeHtml('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;/script&gt;', 'Escape HTML tags');
assert(escapeHtml('Samsung & Sony') === 'Samsung &amp; Sony', 'Escape ampersand');
assert(cleanTitle('  Samsung   SSD   1TB  \n\n ') === 'Samsung SSD 1TB', 'Clean whitespace from title');

console.log(`\n========================================`);
console.log(`Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
