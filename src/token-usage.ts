import type {
  Message,
  Usage,
  MessageDeltaUsage,
} from '@anthropic-ai/sdk/resources/messages';
import type { TokenUsage } from '@prefactor/core';

function sumUsageTokens(usage?: Usage | MessageDeltaUsage): number {
  if (!usage) return 0;
  return (
    (usage.input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0)
  );
}

export function extractTokenUsage(message: Message): TokenUsage {
  const inputTokens = sumUsageTokens(message.usage);
  const outputTokens = message.usage.output_tokens;
  return {
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

export function extractStreamingTokenUsage(
  initialUsage: Usage | undefined,
  deltaUsage: MessageDeltaUsage | undefined,
): TokenUsage | null {
  if (!initialUsage && !deltaUsage) return null;

  const inputTokens = sumUsageTokens(initialUsage) + sumUsageTokens(deltaUsage);
  const outputTokens = deltaUsage?.output_tokens ?? initialUsage?.output_tokens ?? 0;

  return {
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}
