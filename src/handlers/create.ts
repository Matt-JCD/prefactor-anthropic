import {
  SpanContext,
  createSpanTypePrefixer,
  SpanType,
  serializeValue,
  type Tracer,
} from '@prefactor/core';
import type {
  Message,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/messages';
import type { APIPromise } from '@anthropic-ai/sdk';
import { extractTokenUsage } from '../token-usage.js';
import type { PrefactorAnthropicConfig } from '../types.js';

const toAnthropicSpanType = createSpanTypePrefixer('anthropic');

export function handleNonStreamingCreate(
  tracer: Tracer,
  originalCreate: Function,
  thisArg: any,
  body: MessageCreateParamsNonStreaming,
  options?: any,
  pluginConfig?: PrefactorAnthropicConfig,
): APIPromise<Message> {
  const maxMessages = pluginConfig?.maxInputMessages ?? 3;

  const span = tracer.startSpan({
    name: 'anthropic:messages.create',
    spanType: toAnthropicSpanType(SpanType.LLM),
    inputs: {
      model: body.model,
      max_tokens: body.max_tokens,
      messages:
        pluginConfig?.captureInputs !== false
          ? serializeValue(body.messages.slice(-maxMessages))
          : '[redacted]',
      ...(body.system ? { system: serializeValue(body.system) } : {}),
      ...(body.tools ? { tool_count: body.tools.length } : {}),
    },
  });

  // Call the original and handle the APIPromise
  const resultPromise: APIPromise<Message> = originalCreate.call(
    thisArg,
    body,
    options,
  );

  // Attach then/catch handlers to record the span outcome
  // We return the original APIPromise to preserve .withResponse(), .asResponse() etc.
  resultPromise.then(
    (message: Message) => {
      try {
        const tokenUsage = extractTokenUsage(message);
        const outputs =
          pluginConfig?.captureOutputs !== false
            ? {
                content: serializeValue(message.content),
                stop_reason: message.stop_reason,
              }
            : { stop_reason: message.stop_reason };
        tracer.endSpan(span, { outputs, tokenUsage });
      } catch (e) {
        // Never break user code
        tracer.endSpan(span, {});
      }
    },
    (error: Error) => {
      try {
        tracer.endSpan(span, { error });
      } catch {
        // Swallow
      }
    },
  );

  return resultPromise;
}
