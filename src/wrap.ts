import type Anthropic from '@anthropic-ai/sdk';
import { initCore, ensureAgentInstanceStarted } from './init.js';
import type { PrefactorAnthropicConfig } from './types.js';
import { handleNonStreamingCreate } from './handlers/create.js';
import { handleStreamingCreate } from './handlers/create-stream.js';
import { handleMessageStream } from './handlers/stream.js';

/**
 * Wrap an Anthropic client to automatically trace all messages API calls
 * to the Prefactor Agent Control Plane.
 *
 * Returns the same client reference with `messages` replaced by a Proxy.
 * The wrapped client is a drop-in replacement -- all types and methods
 * remain identical.
 *
 * @example
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk';
 * import { wrapAnthropicClient } from '@prefactor/anthropic';
 *
 * const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 * const tracedClient = wrapAnthropicClient(client, {
 *   agentId: 'my-agent',
 *   apiKey: process.env.PREFACTOR_API_KEY!,
 *   apiUrl: 'https://api.prefactor.ai',
 * });
 *
 * // Use exactly as before - tracing happens automatically
 * const message = await tracedClient.messages.create({
 *   model: 'claude-sonnet-4-5-20250929',
 *   max_tokens: 1024,
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */
export function wrapAnthropicClient<T extends Anthropic>(
  client: T,
  config?: PrefactorAnthropicConfig,
): T {
  const { tracer, agentManager } = initCore(config);
  const originalMessages = client.messages;

  // Build agent info from config
  const agentInfo = config?.prefactorConfig?.httpConfig
    ? {
        agentId: config.prefactorConfig.httpConfig.agentId,
        agentIdentifier: config.prefactorConfig.httpConfig.agentIdentifier,
        agentName: config.prefactorConfig.httpConfig.agentName,
        agentDescription: config.prefactorConfig.httpConfig.agentDescription,
      }
    : config
      ? {
          agentId: config.agentId,
          agentIdentifier: '1.0.0',
        }
      : undefined;

  const messagesProxy = new Proxy(originalMessages, {
    get(target, prop, receiver) {
      if (prop === 'create') {
        return function wrappedCreate(body: any, options?: any) {
          try {
            ensureAgentInstanceStarted(agentManager, agentInfo);

            if (body.stream === true) {
              return handleStreamingCreate(
                tracer,
                target.create,
                target,
                body,
                options,
                config,
              );
            } else {
              return handleNonStreamingCreate(
                tracer,
                target.create,
                target,
                body,
                options,
                config,
              );
            }
          } catch (e) {
            // If Prefactor fails, fall through to original
            return target.create(body, options);
          }
        };
      }

      if (prop === 'stream') {
        return function wrappedStream(body: any, options?: any) {
          try {
            ensureAgentInstanceStarted(agentManager, agentInfo);
            return handleMessageStream(
              tracer,
              target.stream,
              target,
              body,
              options,
              config,
            );
          } catch (e) {
            // If Prefactor fails, fall through to original
            return target.stream(body, options);
          }
        };
      }

      // For parse(), bind to the proxy receiver so internal this.create() uses wrapped version
      if (prop === 'parse') {
        return function wrappedParse(params: any, options?: any): any {
          try {
            ensureAgentInstanceStarted(agentManager, agentInfo);
            // Call parse with `this` bound to the proxy so internal create() calls are traced
            return (target.parse as any).call(receiver, params, options);
          } catch (e) {
            return target.parse(params, options);
          }
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  });

  // Replace messages with the proxy
  (client as any).messages = messagesProxy;

  return client;
}
