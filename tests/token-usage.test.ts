import { describe, it, expect } from 'vitest';
import { extractTokenUsage, extractStreamingTokenUsage } from '../src/token-usage';
import type { Message, Usage, MessageDeltaUsage } from '@anthropic-ai/sdk/resources/messages';

describe('extractTokenUsage', () => {
  it('should extract token usage from a message with no cache tokens', () => {
    const message = {
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
      },
    } as Message;

    const result = extractTokenUsage(message);

    expect(result).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
  });

  it('should include cache creation tokens in prompt tokens', () => {
    const message = {
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 20,
        cache_read_input_tokens: null,
      },
    } as Message;

    const result = extractTokenUsage(message);

    expect(result).toEqual({
      promptTokens: 120,
      completionTokens: 50,
      totalTokens: 170,
    });
  });

  it('should include cache read tokens in prompt tokens', () => {
    const message = {
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: 30,
      },
    } as Message;

    const result = extractTokenUsage(message);

    expect(result).toEqual({
      promptTokens: 130,
      completionTokens: 50,
      totalTokens: 180,
    });
  });

  it('should include both cache creation and read tokens', () => {
    const message = {
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 20,
        cache_read_input_tokens: 30,
      },
    } as Message;

    const result = extractTokenUsage(message);

    expect(result).toEqual({
      promptTokens: 150,
      completionTokens: 50,
      totalTokens: 200,
    });
  });
});

describe('extractStreamingTokenUsage', () => {
  it('should return null when no usage data is provided', () => {
    const result = extractStreamingTokenUsage(undefined, undefined);
    expect(result).toBeNull();
  });

  it('should extract from initial usage only', () => {
    const initialUsage: Usage = {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
    } as Usage;

    const result = extractStreamingTokenUsage(initialUsage, undefined);

    expect(result).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
  });

  it('should extract from delta usage only', () => {
    const deltaUsage: MessageDeltaUsage = {
      output_tokens: 75,
    } as MessageDeltaUsage;

    const result = extractStreamingTokenUsage(undefined, deltaUsage);

    expect(result).toEqual({
      promptTokens: 0,
      completionTokens: 75,
      totalTokens: 75,
    });
  });

  it('should combine initial and delta usage', () => {
    const initialUsage: Usage = {
      input_tokens: 100,
      output_tokens: 0,
      cache_creation_input_tokens: 20,
      cache_read_input_tokens: null,
    } as Usage;

    const deltaUsage: MessageDeltaUsage = {
      output_tokens: 75,
    } as MessageDeltaUsage;

    const result = extractStreamingTokenUsage(initialUsage, deltaUsage);

    expect(result).toEqual({
      promptTokens: 120,
      completionTokens: 75,
      totalTokens: 195,
    });
  });

  it('should prefer delta output_tokens over initial', () => {
    const initialUsage: Usage = {
      input_tokens: 100,
      output_tokens: 10,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
    } as Usage;

    const deltaUsage: MessageDeltaUsage = {
      output_tokens: 75,
    } as MessageDeltaUsage;

    const result = extractStreamingTokenUsage(initialUsage, deltaUsage);

    expect(result).toEqual({
      promptTokens: 100,
      completionTokens: 75, // Uses delta, not initial
      totalTokens: 175,
    });
  });
});
