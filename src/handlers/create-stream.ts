import type { Tracer } from '@prefactor/core';
import type {
  MessageCreateParamsStreaming,
  RawMessageStreamEvent,
  RawMessageStartEvent,
  RawMessageDeltaEvent,
  Usage,
  MessageDeltaUsage,
} from '@anthropic-ai/sdk/resources/messages';
import type { APIPromise } from '@anthropic-ai/sdk';
import { extractStreamingTokenUsage } from '../token-usage.js';
import type { PrefactorAnthropicConfig } from '../types.js';
import { createSpan, createSpanEnder } from './utils.js';
import { secureLogger } from '../secure-logger.js';

type Stream<T> = AsyncIterable<T>;

function createStreamWrapper(
  originalStream: Stream<RawMessageStreamEvent>,
  span: any,
  tracer: Tracer,
  pluginConfig?: PrefactorAnthropicConfig,
): Stream<RawMessageStreamEvent> {
  let initialUsage: Usage | undefined;
  let deltaUsage: MessageDeltaUsage | undefined;
  let stopReason: string | null = null;
  const endSpan = createSpanEnder(tracer, span);

  const wrappedIterator = async function* () {
    try {
      for await (const event of originalStream) {
        if (event.type === 'message_start') {
          initialUsage = (event as RawMessageStartEvent).message.usage;
        } else if (event.type === 'message_delta') {
          const deltaEvent = event as RawMessageDeltaEvent;
          deltaUsage = deltaEvent.usage;
          stopReason = deltaEvent.delta.stop_reason;
        }
        yield event;
      }

      try {
        endSpan({
          outputs: { stop_reason: stopReason },
          tokenUsage: extractStreamingTokenUsage(initialUsage, deltaUsage) ?? undefined,
        });
      } catch (endSpanError) {
        secureLogger.error('[Prefactor] Failed to end span on stream completion:', endSpanError);
      }
    } catch (error) {
      try {
        endSpan({ error: error as Error });
      } catch (endSpanError) {
        secureLogger.error('[Prefactor] Failed to end span on stream error:', endSpanError);
      }
      throw error;
    }
  };

  return new Proxy(originalStream, {
    get(target, prop, receiver) {
      if (prop === Symbol.asyncIterator) {
        return () => wrappedIterator()[Symbol.asyncIterator]();
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
  const span = createSpan(tracer, 'anthropic:messages.create[stream]', body, pluginConfig, true);
  const resultPromise: APIPromise<Stream<RawMessageStreamEvent>> = originalCreate.call(
    thisArg,
    body,
    options,
  );

  let spanEnded = false;
  resultPromise.catch((error: any) => {
    if (!spanEnded) {
      spanEnded = true;
      try {
        tracer.endSpan(span, { error: error as Error });
      } catch (endSpanError) {
        secureLogger.error('[Prefactor] Failed to end span on stream error:', endSpanError);
      }
    }
  });

  if ('_thenUnwrap' in resultPromise && typeof resultPromise._thenUnwrap === 'function') {
    return (resultPromise as any)._thenUnwrap((stream: Stream<RawMessageStreamEvent>) =>
      createStreamWrapper(stream, span, tracer, pluginConfig),
    );
  }

  return resultPromise.then((stream: any) =>
    createStreamWrapper(stream, span, tracer, pluginConfig),
  ) as any;
}
