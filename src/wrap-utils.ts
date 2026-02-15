import type { PrefactorAnthropicConfig } from './types.js';
import { secureLogger } from './secure-logger.js';

export function extractAgentInfo(config?: PrefactorAnthropicConfig) {
  if (!config) return undefined;

  const httpConfig = config.prefactorConfig?.httpConfig;
  if (httpConfig) {
    return {
      agentId: httpConfig.agentId,
      agentIdentifier: httpConfig.agentIdentifier,
      agentName: httpConfig.agentName,
      agentDescription: httpConfig.agentDescription,
    };
  }

  return {
    agentId: config.agentId,
    agentIdentifier: '1.0.0',
  };
}

export function wrapWithFallback<T>(
  fn: () => T,
  fallback: () => T,
  operationName: string,
): T {
  try {
    return fn();
  } catch (e) {
    secureLogger.error(`[Prefactor] Failed to wrap ${operationName} call, falling back to original:`, e);
    return fallback();
  }
}
