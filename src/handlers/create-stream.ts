import {
  createSpanTypePrefixer,
  SpanType,
  serializeValue,
  type Tracer,
  type Span,
} from '@prefactor/core';
import type {
  MessageCreateParamsStreaming,
  RawMessageStreamEvent,
  RawMessageStartEvent,
  RawMessageDeltaEvent,
  Usage,
  MessageDeltaUsage,
} from '@anthropic-ai/sdk/resources/messages';
import type { APIPromise } from '@anthropic-ai/sdk';

type Stream<T> = AsyncIterable<T>;
import { extractStreamingTokenUsage } from '../token-usage.js';
import type { PrefactorAnthropicConfig } from '../types.js';

const toAnthropicSpanType = createSpanTypePrefixer('anthropic');

/**
 * Creates an async iterator wrapper that intercepts stream events
 * to capture token usage without disturbing the consumer.
 */
function createStreamWrapper(
  originalStream: Stream<RawMessageStreamEvent>,
  span: Span,
  tracer: Tracer,
  pluginConfig?: PrefactorAnthropicConfig,
): Stream<RawMessageStreamEvent> {
  let initialUsage: Usage | undefined;
  let deltaUsage: MessageDeltaUsage | undefined;
  let stopReason: string | null = null;
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

  // Wrap the async iterator
  const originalIterator =
    originalStream[Symbol.asyncIterator].bind(originalStream);

  const wrappedIterator = async function* () {
    try {
      for await (const event of {
        [Symbol.asyncIterator]: originalIterator,
      }) {
        // Capture data from events
        if (event.type === 'message_start') {
          const startEvent = event as RawMessageStartEvent;
          initialUsage = startEvent.message.usage;
        } else if (event.type === 'message_delta') {
          const deltaEvent = event as RawMessageDeltaEvent;
          deltaUsage = deltaEvent.usage;
          stopReason = deltaEvent.delta.stop_reason;
        }

        yield event;
      }

      // Stream completed successfully
      const tokenUsage = extractStreamingTokenUsage(initialUsage, deltaUsage);
      const outputs =
        pluginConfig?.captureOutputs !== false
          ? { stop_reason: stopReason }
          : { stop_reason: stopReason };
      endSpanOnce({ outputs, tokenUsage: tokenUsage ?? undefined });
    } catch (error) {
      endSpanOnce({ error: error as Error });
      throw error;
    }
  };

  // Create a proxy around the original stream that replaces the async iterator
  return new Proxy(originalStream, {
    get(target, prop, receiver) {
      if (prop === Symbol.asyncIterator) {
        return () => {
          const gen = wrappedIterator();
          return gen[Symbol.asyncIterator]();
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export function handleStreamingCreate(
  tracer: Tracer,
  originalCreate: Function,
  thisArg: any,
  body: MessageCreateParamsStreaming,
  options?: any,
  pluginConfig?: PrefactorAnthropicConfig,
): APIPromise<Stream<RawMessageStreamEvent>> {
  const maxMessages = pluginConfig?.maxInputMessages ?? 3;

  const span = tracer.startSpan({
    name: 'anthropic:messages.create[stream]',
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

  const resultPromise: APIPromise<Stream<RawMessageStreamEvent>> =
    originalCreate.call(thisArg, body, options);

  // Handle the case where the promise rejects before streaming starts
  let spanEnded = false;
  resultPromise.catch((error: any) => {
    if (!spanEnded) {
      spanEnded = true;
      try {
        tracer.endSpan(span, { error: error as Error });
      } catch {
        // Swallow
      }
    }
  });

  // Use _thenUnwrap if available to transform the stream while preserving APIPromise
  if ('_thenUnwrap' in resultPromise && typeof resultPromise._thenUnwrap === 'function') {
    return (resultPromise as any)._thenUnwrap((stream: Stream<RawMessageStreamEvent>) => {
      return createStreamWrapper(stream, span, tracer, pluginConfig);
    });
  }

  // Fallback: wrap using .then() (loses some APIPromise methods but still works)
  return resultPromise.then((stream: any) =>
    createStreamWrapper(stream, span, tracer, pluginConfig),
  ) as any;
}
