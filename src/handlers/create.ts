import type { Tracer } from '@prefactor/core';
import type {
  Message,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/messages';
import type { APIPromise } from '@anthropic-ai/sdk';
import { extractTokenUsage } from '../token-usage.js';
import type { PrefactorAnthropicConfig } from '../types.js';
import { createSpan, buildOutputs, handleSpanError } from './utils.js';

export function handleNonStreamingCreate(
  tracer: Tracer,
  originalCreate: Function,
  thisArg: any,
  body: MessageCreateParamsNonStreaming,
  options?: any,
  pluginConfig?: PrefactorAnthropicConfig,
): APIPromise<Message> {
  const span = createSpan(tracer, 'anthropic:messages.create', body, pluginConfig);
  const resultPromise: APIPromise<Message> = originalCreate.call(thisArg, body, options);

  resultPromise.then(
    (message: Message) => {
      try {
        tracer.endSpan(span, {
          outputs: buildOutputs(message, pluginConfig),
          tokenUsage: extractTokenUsage(message),
        });
      } catch (error) {
        console.error('[Prefactor] Failed to extract outputs/tokens, ending span without data:', error);
        tracer.endSpan(span, {});
      }
    },
    (error: Error) => handleSpanError(tracer, span, error),
  );

  return resultPromise;
}
