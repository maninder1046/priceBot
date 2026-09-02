import { priceService } from '../src/services/providers/priceService.js';
import { amazonProvider } from '../src/services/providers/amazonProvider.js';
import { flipkartProvider } from '../src/services/providers/flipkartProvider.js';
import { myntraProvider } from '../src/services/providers/myntraProvider.js';

console.log('🧪 Running Providers Architecture Test Suite...\n');

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

// 1. Test Registry Registration
assert(priceService.hasProvider('amazon'), 'Registry has amazon');
assert(priceService.hasProvider('flipkart'), 'Registry has flipkart');
assert(priceService.hasProvider('myntra'), 'Registry has myntra');

// 2. Test Amazon Provider HTML Parsing
const amazonMockHtml = `
  <html>
    <head><title>Test Amazon</title></head>
    <body>
      <span id="productTitle">  Sony WH-1000XM5 Wireless Headphones  </span>
      <span class="a-price-whole">29,990.</span>
      <div id="availability"><span>In stock</span></div>
    </body>
  </html>
`;
const amazonParsed = amazonProvider.parseHtml(amazonMockHtml);
assert(amazonParsed.name === 'Sony WH-1000XM5 Wireless Headphones', 'AmazonProvider: Extracted name');
assert(amazonParsed.price === 29990, 'AmazonProvider: Extracted integer price');
assert(amazonParsed.currency === 'INR', 'AmazonProvider: Standard currency is INR');
assert(amazonParsed.available === true, 'AmazonProvider: available is true');

// 3. Test Flipkart Provider HTML Parsing
const flipkartMockHtml = `
  <html>
    <body>
      <span class="B_NuCI">Apple iPhone 15 (Black, 128 GB)</span>
      <div class="_30jeq3 _16Jk6d">₹65,999</div>
    </body>
  </html>
`;
const flipkartParsed = flipkartProvider.parseHtml(flipkartMockHtml);
assert(flipkartParsed.name === 'Apple iPhone 15 (Black, 128 GB)', 'FlipkartProvider: Extracted name');
assert(flipkartParsed.price === 65999, 'FlipkartProvider: Extracted integer price');
assert(flipkartParsed.available === true, 'FlipkartProvider: available is true');

// 4. Test Myntra Provider HTML Parsing
const myntraMockHtml = `
  <html>
    <body>
      <h1 class="pdp-title">Roadster Men Black Casual Shirt</h1>
      <span class="pdp-price"><strong>Rs. 999</strong></span>
    </body>
  </html>
`;
const myntraParsed = myntraProvider.parseHtml(myntraMockHtml);
assert(myntraParsed.name === 'Roadster Men Black Casual Shirt', 'MyntraProvider: Extracted name');
assert(myntraParsed.price === 999, 'MyntraProvider: Extracted integer price');

// 5. Test JSON-LD Schema.org Priority
const schemaMockHtml = `
  <html>
    <head>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org/",
          "@type": "Product",
          "name": "Schema Universal Product",
          "offers": {
            "@type": "Offer",
            "price": "4999.00",
            "priceCurrency": "INR"
          }
        }
      </script>
    </head>
    <body>
      <span id="productTitle">Fallback Selector Title</span>
      <span class="a-price-whole">9,999</span>
    </body>
  </html>
`;
const schemaParsed = amazonProvider.parseHtml(schemaMockHtml);
assert(schemaParsed.name === 'Schema Universal Product', 'Schema priority: Correct title');
assert(schemaParsed.price === 4999, 'Schema priority: Correct integer price');

console.log(`\n========================================`);
console.log(`Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
