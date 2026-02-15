/**
 * Secure logging utility that sanitizes sensitive data before logging
 */

const SENSITIVE_PATTERNS = [
  // Anthropic API keys
  { pattern: /sk-ant-api03-[a-zA-Z0-9_-]{95}/g, replacement: 'sk-ant-***' },
  { pattern: /sk-ant-[a-zA-Z0-9_-]+/g, replacement: 'sk-ant-***' },
  { pattern: /sk-[a-z]+-[a-zA-Z0-9_-]{20,}/g, replacement: 'sk-***' },
  // NPM tokens
  { pattern: /npm_[a-zA-Z0-9]{36}/g, replacement: 'npm_***' },
  { pattern: /npm_[a-zA-Z0-9]+/g, replacement: 'npm_***' },
  // Prefactor API tokens
  { pattern: /pf_[a-zA-Z0-9_-]+/g, replacement: 'pf_***' },
  // Generic tokens (Bearer, API keys in headers)
  { pattern: /Bearer\s+[a-zA-Z0-9_-]{20,}/gi, replacement: 'Bearer ***' },
  { pattern: /"api[_-]?key"\s*:\s*"[^"]+"/gi, replacement: '"api_key": "***"' },
  { pattern: /"token"\s*:\s*"[^"]+"/gi, replacement: '"token": "***"' },
];

function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    let sanitized = value;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, replacement);
    }
    return sanitized;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeValue(value.message),
      stack: value.stack ? sanitizeValue(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    const sanitized: any = {};
    for (const [key, val] of Object.entries(value)) {
      // Sanitize keys that might contain sensitive data
      if (/api[_-]?key|token|secret|password|auth/i.test(key)) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = sanitizeValue(val);
      }
    }
    return sanitized;
  }

  return value;
}

function formatArgs(...args: any[]): any[] {
  return args.map(sanitizeValue);
}

export const secureLogger = {
  log: (...args: any[]) => {
    console.log(...formatArgs(...args));
  },

  error: (...args: any[]) => {
    console.error(...formatArgs(...args));
  },

  warn: (...args: any[]) => {
    console.warn(...formatArgs(...args));
  },

  info: (...args: any[]) => {
    console.info(...formatArgs(...args));
  },

  debug: (...args: any[]) => {
    console.debug(...formatArgs(...args));
  },
};

// Legacy logger for backward compatibility
export const logger = secureLogger;
