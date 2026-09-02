import { validateProductUrl } from '../src/services/validator/urlValidator.js';

console.log('🧪 Running URL Validation & SSRF Prevention Test Suite...\n');

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

// 1. Valid URLs from Allowed Stores (Amazon, Flipkart, Myntra)
const validTestCases = [
  { url: 'https://www.amazon.in/dp/B08L5VJZ37', expectedStore: 'Amazon' },
  { url: 'https://amzn.to/3xyz123', expectedStore: 'Amazon' },
  { url: 'https://amazon.com/Apple-iPhone-13-128GB-Midnight/dp/B09G9FPHP7', expectedStore: 'Amazon' },
  { url: 'https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4', expectedStore: 'Flipkart' },
  { url: 'https://dl.flipkart.com/s/xyz123', expectedStore: 'Flipkart' },
  { url: 'https://www.myntra.com/shirts/roadster/roadster-men-black-shirt/12345/buy', expectedStore: 'Myntra' }
];

for (const tc of validTestCases) {
  const result = validateProductUrl(tc.url);
  assert(result.isValid && result.store === tc.expectedStore, `${tc.url}\n   -> Store: ${result.store}`);
}

// 2. Disallowed / Unsupported Domains
const disallowedDomains = [
  'https://evil-site.com/product/123',
  'https://random-store.org',
  'https://blinkit.com/prn/123',
  'https://www.meesho.com/s/p/123'
];

for (const url of disallowedDomains) {
  const result = validateProductUrl(url);
  assert(!result.isValid, `${url}\n   -> Rejected: ${result.error}`);
}

// 3. Security Checks (SSRF, Insecure Protocol, Auth Injection)
const securityTestCases = [
  { url: 'http://www.amazon.in/dp/example', reason: 'HTTP plain text' },
  { url: 'http://127.0.0.1:8080/admin', reason: 'Local IP loopback' },
  { url: 'http://169.254.169.254/latest/meta-data/', reason: 'Cloud metadata IP' },
  { url: 'https://localhost:3000', reason: 'Localhost domain' },
  { url: 'javascript:alert(1)', reason: 'Javascript pseudo protocol' },
  { url: 'https://admin:secret@amazon.in/dp/test', reason: 'Credential injection' }
];

for (const tc of securityTestCases) {
  const result = validateProductUrl(tc.url);
  assert(!result.isValid, `${tc.url}\n   -> Rejected: ${result.error}`);
}

console.log(`\n========================================`);
console.log(`Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
