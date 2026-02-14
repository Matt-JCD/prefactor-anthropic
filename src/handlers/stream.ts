import {
  createSpanTypePrefixer,
  SpanType,
  serializeValue,
  type Tracer,
} from '@prefactor/core';
import type {
  MessageCreateParams,
  Message,
} from '@anthropic-ai/sdk/resources/messages';
import type { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';

type MessageStreamParams = MessageCreateParams;
import { extractTokenUsage } from '../token-usage.js';
import type { PrefactorAnthropicConfig } from '../types.js';

const toAnthropicSpanType = createSpanTypePrefixer('anthropic');

export function handleMessageStream(
  tracer: Tracer,
  originalStream: Function,
  thisArg: any,
  body: MessageStreamParams,
  options?: any,
  pluginConfig?: PrefactorAnthropicConfig,
): MessageStream {
  const maxMessages = pluginConfig?.maxInputMessages ?? 3;

  const span = tracer.startSpan({
    name: 'anthropic:messages.stream',
    spanType: toAnthropicSpanType(SpanType.LLM),
    inputs: {
      model: body.model,
      max_tokens: body.max_tokens,
      streaming: true,
      messages:
        pluginConfig?.captureInputs !== false
          ? serializeValue(body.messages.slice(-maxMessages))
          : '[redacted]',
      ...(body.system ? { system: serializeValue(body.system) } : {}),
      ...(body.tools ? { tool_count: body.tools.length } : {}),
    },
  });

  // Call the original - returns MessageStream synchronously
  const messageStream: MessageStream = originalStream.call(thisArg, body, options);

  let spanEnded = false;
  const endSpanOnce = (options: any) => {
    if (spanEnded) return;
    spanEnded = true;
    try {
      tracer.endSpan(span, options);
    } catch {
      // Swallow
    }
  };

  // Attach event listeners to capture span data
  messageStream.once('finalMessage', (message: Message) => {
    try {
      const tokenUsage = extractTokenUsage(message);
      const outputs =
        pluginConfig?.captureOutputs !== false
          ? {
              content: serializeValue(message.content),
              stop_reason: message.stop_reason,
            }
          : { stop_reason: message.stop_reason };
      endSpanOnce({ outputs, tokenUsage });
    } catch {
      endSpanOnce({});
    }
  });

  messageStream.once('error', (error: Error) => {
    endSpanOnce({ error });
  });

  messageStream.once('abort', (error: Error) => {
    endSpanOnce({ error });
  });

  return messageStream;
}
