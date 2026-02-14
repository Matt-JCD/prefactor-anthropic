import type { TokenUsage } from '@prefactor/core';
import type {
  Usage,
  MessageDeltaUsage,
  Message,
} from '@anthropic-ai/sdk/resources/messages';

/**
 * Extract TokenUsage from an Anthropic Message response.
 * Maps Anthropic's usage format to Prefactor's TokenUsage format.
 *
 * Anthropic usage includes:
 * - input_tokens: base input tokens
 * - cache_creation_input_tokens: tokens used to create cache
 * - cache_read_input_tokens: tokens read from cache
 * - output_tokens: generated tokens
 */
export function extractTokenUsage(message: Message): TokenUsage {
  const usage = message.usage;
  const inputTokens =
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0);

  return {
    promptTokens: inputTokens,
    completionTokens: usage.output_tokens,
    totalTokens: inputTokens + usage.output_tokens,
  };
}

/**
 * Accumulate token usage from streaming events.
 * The message_start event contains initial usage, and message_delta
 * contains the final output_tokens.
 */
export function extractStreamingTokenUsage(
  initialUsage: Usage | undefined,
  deltaUsage: MessageDeltaUsage | undefined,
): TokenUsage | null {
  if (!initialUsage && !deltaUsage) return null;

  const inputTokens =
    (initialUsage?.input_tokens ?? 0) +
    (initialUsage?.cache_creation_input_tokens ?? 0) +
    (initialUsage?.cache_read_input_tokens ?? 0) +
    (deltaUsage?.input_tokens ?? 0) +
    (deltaUsage?.cache_creation_input_tokens ?? 0) +
    (deltaUsage?.cache_read_input_tokens ?? 0);

  const outputTokens =
    deltaUsage?.output_tokens ?? initialUsage?.output_tokens ?? 0;

  return {
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}
