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
import { buildCoreConfig } from './init-utils.js';

const logger = getLogger('prefactor-anthropic');

// Module-level globals (singleton pattern)
let globalCore: CoreRuntime | null = null;
let agentInstanceStarted = false;

registerShutdownHandler('prefactor-anthropic', () => {
  if (globalCore) logger.info('Shutting down Prefactor Anthropic SDK');
  globalCore = null;
  agentInstanceStarted = false;
});

export function initCore(config?: PrefactorAnthropicConfig): {
  tracer: Tracer;
  agentManager: AgentInstanceManager;
} {
  if (globalCore) {
    return { tracer: globalCore.tracer, agentManager: globalCore.agentManager };
  }

  configureLogging();

  const coreConfig = buildCoreConfig(config);
  const finalConfig = createConfig(coreConfig);
  const core = createCore(finalConfig);

  globalCore = core;

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
  if (!globalCore) initCore();
  return globalCore!.tracer;
}

export { shutdownCore as shutdown };

// Auto-shutdown fallback (Node.js only)
if (typeof process !== 'undefined' && process.on) {
  try {
    process.on('beforeExit', () => {
      shutdownCore().catch((error) => {
        logger.error('Error during auto-shutdown:', error);
        // Set exit code to indicate error during shutdown
        if (typeof process.exitCode === 'undefined' || process.exitCode === 0) {
          process.exitCode = 1;
        }
      });
    });
  } catch (error) {
    logger.warn('Could not register process exit handler:', error);
  }
}
