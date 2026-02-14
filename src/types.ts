import type { Config as CoreConfig } from '@prefactor/core';

/**
 * Configuration for the Prefactor Anthropic plugin.
 */
export interface PrefactorAnthropicConfig {
  /**
   * Prefactor agent ID
   */
  agentId: string;

  /**
   * Prefactor API key (authentication token)
   */
  apiKey: string;

  /**
   * Optional Prefactor API URL override.
   * If not provided, uses PREFACTOR_API_URL environment variable.
   */
  apiUrl?: string;

  /**
   * Optional environment ID to include in agent metadata.
   * This is passed as metadata and may be used by the Prefactor API.
   */
  environmentId?: string;

  /**
   * Whether to capture input messages in spans.
   * Default: true
   */
  captureInputs?: boolean;

  /**
   * Whether to capture output content in spans.
   * Default: true
   */
  captureOutputs?: boolean;

  /**
   * Maximum number of recent input messages to capture.
   * Default: 3
   */
  maxInputMessages?: number;

  /**
   * Full @prefactor/core config for advanced usage.
   * If provided, this takes precedence over individual config fields.
   */
  prefactorConfig?: Partial<CoreConfig>;
}
