import type Anthropic from '@anthropic-ai/sdk';
import { initCore, ensureAgentInstanceStarted } from './init.js';
import type { PrefactorAnthropicConfig } from './types.js';
import { handleNonStreamingCreate } from './handlers/create.js';
import { handleStreamingCreate } from './handlers/create-stream.js';
import { handleMessageStream } from './handlers/stream.js';
import { extractAgentInfo, wrapWithFallback } from './wrap-utils.js';

export function wrapAnthropicClient<T extends Anthropic>(
  client: T,
  config?: PrefactorAnthropicConfig,
): T {
  const { tracer, agentManager } = initCore(config);
  const originalMessages = client.messages;
  const agentInfo = extractAgentInfo(config);

  const messagesProxy = new Proxy(originalMessages, {
    get(target, prop, receiver) {
      if (prop === 'create') {
        return function wrappedCreate(body: any, options?: any) {
          return wrapWithFallback(
            () => {
              ensureAgentInstanceStarted(agentManager, agentInfo);
              return body.stream === true
                ? handleStreamingCreate(tracer, target.create, target, body, options, config)
                : handleNonStreamingCreate(tracer, target.create, target, body, options, config);
            },
            () => target.create(body, options),
            'create',
          );
        };
      }

      if (prop === 'stream') {
        return function wrappedStream(body: any, options?: any) {
          return wrapWithFallback(
            () => {
              ensureAgentInstanceStarted(agentManager, agentInfo);
              return handleMessageStream(tracer, target.stream, target, body, options, config);
            },
            () => target.stream(body, options),
            'stream',
          );
        };
      }

      if (prop === 'parse') {
        return function wrappedParse(params: any, options?: any): any {
          return wrapWithFallback(
            () => {
              ensureAgentInstanceStarted(agentManager, agentInfo);
              return (target.parse as any).call(receiver, params, options);
            },
            () => target.parse(params, options),
            'parse',
          );
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  });

  (client as any).messages = messagesProxy;
  return client;
}
