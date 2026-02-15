import type { Tracer } from '@prefactor/core';
import type {
  Message,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/messages';
import type { APIPromise } from '@anthropic-ai/sdk';
import { extractTokenUsage } from '../token-usage.js';
import type { PrefactorAnthropicConfig } from '../types.js';
import { createSpan, buildOutputs, handleSpanError } from './utils.js';
import { secureLogger } from '../secure-logger.js';

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
        secureLogger.error('[Prefactor] Failed to extract outputs/tokens, ending span without data:', error);
        try {
          tracer.endSpan(span, {});
        } catch (endSpanError) {
          secureLogger.error('[Prefactor] Critical: Failed to end span even without data:', endSpanError);
        }
      }
    },
    (error: Error) => handleSpanError(tracer, span, error),
  );

  return resultPromise;
}
