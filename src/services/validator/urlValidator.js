/**
 * URL Validator & SSRF Prevention Service
 */

export const ALLOWED_STORES = [
  {
    name: 'Amazon',
    domains: [
      'amazon.in',
      'amazon.com',
      'amazon.co.uk',
      'amazon.de',
      'amazon.ca',
      'amzn.to',
      'amzn.in',
      'amzn.eu'
    ]
  },
  {
    name: 'Flipkart',
    domains: [
      'flipkart.com',
      'dl.flipkart.com',
      'fkrt.it',
      'fkrt.co'
    ]
  },
  {
    name: 'Myntra',
    domains: [
      'myntra.com'
    ]
  }
];

export const SUPPORTED_STORE_NAMES = ALLOWED_STORES.map((s) => s.name).join(', ');

function matchesDomain(hostname, allowedDomain) {
  return hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`);
}

/**
 * Validates a user-submitted product URL for security and store support.
 * 
 * @param {string} rawUrl 
 * @returns {{
 *   isValid: boolean,
 *   url?: string,
 *   store?: string,
 *   error?: string
 * }}
 */
export function validateProductUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      isValid: false,
      error: 'Please provide a valid URL string.'
    };
  }

  const trimmed = rawUrl.trim();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    return {
      isValid: false,
      error: 'Invalid URL format. Please make sure the link starts with https://'
    };
  }

  // 1. Enforce HTTPS only (blocks javascript:, file:, ftp:, gopher:, http:)
  if (parsed.protocol !== 'https:') {
    return {
      isValid: false,
      error: 'Insecure protocol. Only HTTPS URLs are permitted.'
    };
  }

  // 2. Prevent credentials in URL
  if (parsed.username || parsed.password) {
    return {
      isValid: false,
      error: 'URLs containing authentication credentials are not allowed.'
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. SSRF Protection
  const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':') || hostname.startsWith('[');
  const isLocalhost = hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal');

  if (isIpAddress || isLocalhost) {
    return {
      isValid: false,
      error: 'Private IP addresses and localhost are forbidden.'
    };
  }

  // 4. Domain allowlist check
  for (const store of ALLOWED_STORES) {
    const isMatched = store.domains.some((domain) => matchesDomain(hostname, domain));
    if (isMatched) {
      return {
        isValid: true,
        url: parsed.toString(),
        store: store.name
      };
    }
  }

  return {
    isValid: false,
    error: `Unsupported website. Currently supported: ${SUPPORTED_STORE_NAMES}.`
  };
}
