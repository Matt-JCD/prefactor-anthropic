import type { CoreConfig } from '@prefactor/core';
import type { PrefactorAnthropicConfig } from './types.js';

const DEFAULT_API_URL = 'https://api.prefactor.ai';
const DEFAULT_AGENT_IDENTIFIER = '1.0.0';

export const DEFAULT_ANTHROPIC_AGENT_SCHEMA = {
  external_identifier: 'anthropic-schema',
  span_schemas: {
    'anthropic:llm': { type: 'object', additionalProperties: true },
  },
  span_result_schemas: {
    'anthropic:llm': { type: 'object', additionalProperties: true },
  },
};

export function buildCoreConfig(config?: PrefactorAnthropicConfig): CoreConfig {
  // Case 1: Full config provided
  if (config?.prefactorConfig) {
    const coreConfig = config.prefactorConfig;
    // Ensure schema exists
    if (coreConfig.transportType === 'http') {
      return {
        ...coreConfig,
        httpConfig: {
          ...coreConfig.httpConfig,
          agentSchema: coreConfig.httpConfig?.agentSchema ?? DEFAULT_ANTHROPIC_AGENT_SCHEMA,
        },
      };
    }
    return coreConfig;
  }

  // Case 2 & 3: Build from simplified config or env vars
  const apiUrl = config?.apiUrl ?? process.env.PREFACTOR_API_URL ?? DEFAULT_API_URL;
  const apiToken = config?.apiKey ?? process.env.PREFACTOR_API_TOKEN;
  const agentId = config?.agentId ?? process.env.PREFACTOR_AGENT_ID;

  // Validate API URL to prevent SSRF
  try {
    const url = new URL(apiUrl);

    // Production allowlist
    const allowedHosts = ['api.prefactor.ai'];
    const isAllowedHost = allowedHosts.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );

    if (!isAllowedHost) {
      // Allow localhost/development only for specific cases
      const hostname = url.hostname.toLowerCase();
      const isLocalhost = hostname === 'localhost' || hostname.match(/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);

      // Parse IP if it's not localhost
      if (!isLocalhost) {
        // Check for IPv6 addresses
        if (hostname.includes(':') || hostname.startsWith('[')) {
          // IPv6 address
          const ipv6 = hostname.replace(/^\[|\]$/g, '');
          // Check for IPv6 localhost and private ranges
          const isPrivateIPv6 =
            ipv6 === '::1' || // IPv6 loopback
            ipv6.startsWith('fc') || // Unique local addresses (fc00::/7)
            ipv6.startsWith('fd') || // Unique local addresses (fc00::/7)
            ipv6.startsWith('fe80:'); // Link-local addresses (fe80::/10)

          if (!isPrivateIPv6) {
            throw new Error(`API URL hostname '${url.hostname}' is not in the allowlist`);
          }
        } else {
          // IPv4 address
          const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
          if (ipv4Match) {
            const octets = ipv4Match.slice(1, 5).map(Number);
            // Validate octets are in valid range (0-255)
            if (octets.some((octet) => octet < 0 || octet > 255)) {
              throw new Error(`Invalid IP address: ${hostname}`);
            }
            // Check for private/reserved IP ranges (RFC1918, link-local, etc.)
            const isPrivateIP =
              octets[0] === 10 || // 10.0.0.0/8
              (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || // 172.16.0.0/12
              (octets[0] === 192 && octets[1] === 168) || // 192.168.0.0/16
              (octets[0] === 169 && octets[1] === 254) || // 169.254.0.0/16 (link-local)
              octets[0] === 127; // 127.0.0.0/8 (loopback)

            if (!isPrivateIP) {
              throw new Error(`API URL hostname '${url.hostname}' is not in the allowlist`);
            }
          } else {
            // Non-IP hostname that's not in allowlist
            throw new Error(`API URL hostname '${url.hostname}' is not in the allowlist`);
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Invalid API URL: ${apiUrl}`);
    }
    throw error;
  }

  // Validate required fields
  if (!apiToken) {
    throw new Error(
      config
        ? 'apiKey is required in PrefactorAnthropicConfig'
        : 'Either provide PrefactorAnthropicConfig or set PREFACTOR_API_TOKEN environment variable',
    );
  }

  return {
    transportType: 'http',
    httpConfig: {
      apiUrl,
      apiToken,
      agentId,
      agentIdentifier: DEFAULT_AGENT_IDENTIFIER,
      agentSchema: DEFAULT_ANTHROPIC_AGENT_SCHEMA,
    },
  };
}
