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
