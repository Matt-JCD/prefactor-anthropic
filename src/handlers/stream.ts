import type { Tracer } from '@prefactor/core';
import type {
  MessageCreateParams,
  Message,
} from '@anthropic-ai/sdk/resources/messages';
import type { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';
import { extractTokenUsage } from '../token-usage.js';
import type { PrefactorAnthropicConfig } from '../types.js';
import { createSpan, buildOutputs, createSpanEnder } from './utils.js';

type MessageStreamParams = MessageCreateParams;

export function handleMessageStream(
  tracer: Tracer,
  originalStream: Function,
  thisArg: any,
  body: MessageStreamParams,
  options?: any,
  pluginConfig?: PrefactorAnthropicConfig,
): MessageStream {
  const span = createSpan(tracer, 'anthropic:messages.stream', body, pluginConfig, true);
  const messageStream: MessageStream = originalStream.call(thisArg, body, options);
  const endSpan = createSpanEnder(tracer, span);

  messageStream.once('finalMessage', (message: Message) => {
    try {
      endSpan({
        outputs: buildOutputs(message, pluginConfig),
        tokenUsage: extractTokenUsage(message),
      });
    } catch (error) {
      console.error('[Prefactor] Failed to extract token usage from stream:', error);
      endSpan({});
    }
  });

  messageStream.once('error', (error: Error) => endSpan({ error }));
  messageStream.once('abort', (error: Error) => endSpan({ error }));

  return messageStream;
}
