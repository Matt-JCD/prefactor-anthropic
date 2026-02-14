import {
  configureLogging,
  createConfig,
  createCore,
  getLogger,
  registerShutdownHandler,
  shutdown as shutdownCore,
  type CoreRuntime,
  type Tracer,
  type AgentInstanceManager,
} from '@prefactor/core';
import type { PrefactorAnthropicConfig } from './types.js';

const logger = getLogger('prefactor-anthropic');

const DEFAULT_ANTHROPIC_AGENT_SCHEMA = {
  external_identifier: 'anthropic-schema',
  span_schemas: {
    'anthropic:llm': { type: 'object', additionalProperties: true },
  },
  span_result_schemas: {
    'anthropic:llm': { type: 'object', additionalProperties: true },
  },
};

// Module-level globals (singleton pattern matching @prefactor/langchain)
let globalCore: CoreRuntime | null = null;
let globalTracer: Tracer | null = null;
let agentInstanceStarted = false;

// Register shutdown handler
registerShutdownHandler('prefactor-anthropic', () => {
  if (globalCore) {
    logger.info('Shutting down Prefactor Anthropic SDK');
  }
  globalCore = null;
  globalTracer = null;
  agentInstanceStarted = false;
});

export function initCore(config?: PrefactorAnthropicConfig): {
  tracer: Tracer;
  agentManager: AgentInstanceManager;
} {
  if (globalCore) {
    return {
      tracer: globalCore.tracer,
      agentManager: globalCore.agentManager,
    };
  }

  configureLogging();

  // Build config from user's simplified config or use their prefactorConfig
  let coreConfig = config?.prefactorConfig;

  if (!coreConfig && config) {
    // Build HTTP config from simplified config
    if (!config.apiKey) {
      throw new Error(
        'apiKey is required in PrefactorAnthropicConfig, or provide full prefactorConfig',
      );
    }

    const apiUrl =
      config.apiUrl ?? process.env.PREFACTOR_API_URL ?? 'https://api.prefactor.ai';

    coreConfig = {
      transportType: 'http',
      httpConfig: {
        apiUrl,
        apiToken: config.apiKey,
        agentId: config.agentId,
        agentIdentifier: '1.0.0',
        agentSchema: DEFAULT_ANTHROPIC_AGENT_SCHEMA,
      },
    };
  } else if (!coreConfig) {
    // No config provided at all - try to use env vars
    const apiUrl = process.env.PREFACTOR_API_URL;
    const apiToken = process.env.PREFACTOR_API_TOKEN;
    if (!apiUrl || !apiToken) {
      throw new Error(
        'Either provide PrefactorAnthropicConfig or set PREFACTOR_API_URL and PREFACTOR_API_TOKEN environment variables',
      );
    }
    coreConfig = {
      transportType: 'http',
      httpConfig: {
        apiUrl,
        apiToken,
        agentId: process.env.PREFACTOR_AGENT_ID,
        agentIdentifier: '1.0.0',
        agentSchema: DEFAULT_ANTHROPIC_AGENT_SCHEMA,
      },
    };
  }

  // Ensure schema is set if using HTTP config
  if (
    coreConfig.transportType === 'http' &&
    coreConfig.httpConfig &&
    !coreConfig.httpConfig.agentSchema
  ) {
    coreConfig = {
      ...coreConfig,
      httpConfig: {
        ...coreConfig.httpConfig,
        agentSchema: DEFAULT_ANTHROPIC_AGENT_SCHEMA,
      },
    };
  }

  const finalConfig = createConfig(coreConfig);
  const core = createCore(finalConfig);
  globalCore = core;
  globalTracer = core.tracer;

  if (finalConfig.httpConfig?.agentSchema) {
    core.agentManager.registerSchema(finalConfig.httpConfig.agentSchema);
  }

  return { tracer: core.tracer, agentManager: core.agentManager };
}

export function ensureAgentInstanceStarted(
  agentManager: AgentInstanceManager,
  agentInfo?: {
    agentId?: string;
    agentIdentifier?: string;
    agentName?: string;
    agentDescription?: string;
  },
): void {
  if (agentInstanceStarted) return;
  try {
    agentManager.startInstance(agentInfo);
    agentInstanceStarted = true;
  } catch (error) {
    logger.error('Failed to start agent instance:', error);
  }
}

export function getTracer(): Tracer {
  if (!globalTracer) {
    initCore();
  }
  return globalTracer!;
}

export { shutdownCore as shutdown };

// Auto-shutdown on process exit
process.on('beforeExit', () => {
  shutdownCore().catch((error) => {
    console.error('Error during Prefactor Anthropic SDK shutdown:', error);
  });
});
