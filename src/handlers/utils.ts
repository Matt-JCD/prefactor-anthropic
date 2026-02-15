import {
  SpanType,
  serializeValue,
  type Tracer,
  type Span,
} from '@prefactor/core';
import type {
  Message,
  MessageCreateParams,
} from '@anthropic-ai/sdk/resources/messages';
import type { PrefactorAnthropicConfig } from '../types.js';
import { toAnthropicSpanType, DEFAULT_MAX_MESSAGES } from './constants.js';

export function getMaxMessages(config?: PrefactorAnthropicConfig): number {
  return config?.maxInputMessages ?? DEFAULT_MAX_MESSAGES;
}

export function buildSpanInputs(
  body: MessageCreateParams,
  config?: PrefactorAnthropicConfig,
  streaming?: boolean,
) {
  const maxMessages = getMaxMessages(config);
  return {
    model: body.model,
    max_tokens: body.max_tokens,
    ...(streaming ? { streaming: true } : {}),
    messages:
      config?.captureInputs !== false
        ? serializeValue(body.messages.slice(-maxMessages))
        : '[redacted]',
    ...(body.system ? { system: serializeValue(body.system) } : {}),
    ...(body.tools ? { tool_count: body.tools.length } : {}),
  };
}

export function createSpan(
  tracer: Tracer,
  name: string,
  body: MessageCreateParams,
  config?: PrefactorAnthropicConfig,
  streaming?: boolean,
) {
  return tracer.startSpan({
    name,
    spanType: toAnthropicSpanType(SpanType.LLM),
    inputs: buildSpanInputs(body, config, streaming),
  });
}

export function buildOutputs(
  message: Message,
  config?: PrefactorAnthropicConfig,
) {
  return config?.captureOutputs !== false
    ? {
        content: serializeValue(message.content),
        stop_reason: message.stop_reason,
      }
    : { stop_reason: message.stop_reason };
}

export function createSpanEnder(tracer: Tracer, span: Span) {
  let spanEnded = false;
  return (options: any) => {
    if (spanEnded) return;
    spanEnded = true;
    try {
      tracer.endSpan(span, options);
    } catch (error) {
      console.error('[Prefactor] Failed to end span:', error);
    }
  };
}

export function handleSpanError(
  tracer: Tracer,
  span: Span,
  error: Error,
  context: string = 'error',
) {
  try {
    tracer.endSpan(span, { error });
  } catch (endSpanError) {
    console.error(`[Prefactor] Failed to end span on ${context}:`, endSpanError);
  }
}
