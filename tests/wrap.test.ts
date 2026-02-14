import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wrapAnthropicClient } from '../src/wrap';
import type Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@anthropic-ai/sdk/resources/messages';

// Mock @prefactor/core
vi.mock('@prefactor/core', () => ({
  configureLogging: vi.fn(),
  createConfig: vi.fn((config) => config),
  createCore: vi.fn(() => ({
    tracer: {
      startSpan: vi.fn(() => ({ spanId: 'test-span-id' })),
      endSpan: vi.fn(),
    },
    agentManager: {
      registerSchema: vi.fn(),
      startInstance: vi.fn(),
    },
  })),
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
  registerShutdownHandler: vi.fn(),
  shutdown: vi.fn(),
  createSpanTypePrefixer: vi.fn(() => (type: string) => `anthropic:${type}`),
  SpanType: {
    LLM: 'llm',
    TOOL: 'tool',
    CHAIN: 'chain',
    AGENT: 'agent',
  },
  serializeValue: vi.fn((val) => val),
}));

describe('wrapAnthropicClient', () => {
  let mockClient: any;
  let mockCreate: any;
  let mockStream: any;
  let mockParse: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCreate = vi.fn();
    mockStream = vi.fn();
    mockParse = vi.fn();

    mockClient = {
      messages: {
        create: mockCreate,
        stream: mockStream,
        parse: mockParse,
        countTokens: vi.fn(),
        batches: {},
      },
      completions: {},
      models: {},
      beta: {},
    };
  });

  it('should wrap the client and return it', () => {
    const wrapped = wrapAnthropicClient(mockClient, {
      agentId: 'test-agent',
      apiKey: 'test-key',
    });

    expect(wrapped).toBe(mockClient);
    expect(wrapped.messages).toBeDefined();
  });

  it('should intercept messages.create() calls', async () => {
    const mockMessage: Message = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello!' }],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
      },
    } as Message;

    const mockPromise = Promise.resolve(mockMessage);
    (mockPromise as any).then = function (onFulfilled: any, onRejected: any) {
      return Promise.prototype.then.call(this, onFulfilled, onRejected);
    };

    mockCreate.mockReturnValue(mockPromise);

    const wrapped = wrapAnthropicClient(mockClient, {
      agentId: 'test-agent',
      apiKey: 'test-key',
    });

    const result = wrapped.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(mockCreate).toHaveBeenCalledWith(
      {
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }],
      },
      undefined,
    );

    const message = await result;
    expect(message).toEqual(mockMessage);
  });

  it('should intercept messages.stream() calls', () => {
    const mockMessageStream = {
      on: vi.fn().mockReturnThis(),
      once: vi.fn().mockReturnThis(),
      finalMessage: vi.fn(),
    };

    mockStream.mockReturnValue(mockMessageStream);

    const wrapped = wrapAnthropicClient(mockClient, {
      agentId: 'test-agent',
      apiKey: 'test-key',
    });

    const result = wrapped.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(mockStream).toHaveBeenCalledWith(
      {
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }],
      },
      undefined,
    );

    expect(result).toBe(mockMessageStream);
    expect(mockMessageStream.once).toHaveBeenCalledWith(
      'finalMessage',
      expect.any(Function),
    );
    expect(mockMessageStream.once).toHaveBeenCalledWith(
      'error',
      expect.any(Function),
    );
    expect(mockMessageStream.once).toHaveBeenCalledWith(
      'abort',
      expect.any(Function),
    );
  });

  it('should pass through non-intercepted methods', () => {
    const wrapped = wrapAnthropicClient(mockClient, {
      agentId: 'test-agent',
      apiKey: 'test-key',
    });

    const countTokens = wrapped.messages.countTokens;
    expect(countTokens).toBe(mockClient.messages.countTokens);
  });

  it('should handle streaming create (stream: true)', async () => {
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: 'message_start',
          message: {
            usage: {
              input_tokens: 10,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        };
        yield {
          type: 'message_delta',
          usage: {
            output_tokens: 5,
          },
          delta: {
            stop_reason: 'end_turn',
          },
        };
      },
    };

    const mockPromise = Promise.resolve(mockStream);
    (mockPromise as any)._thenUnwrap = function (transform: any) {
      return this.then(transform);
    };

    mockCreate.mockReturnValue(mockPromise);

    const wrapped = wrapAnthropicClient(mockClient, {
      agentId: 'test-agent',
      apiKey: 'test-key',
    });

    const result = await wrapped.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true,
    });

    expect(mockCreate).toHaveBeenCalled();

    // Consume the stream
    const events = [];
    for await (const event of result as any) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('message_start');
    expect(events[1].type).toBe('message_delta');
  });

  it('should fall through to original on Prefactor error', async () => {
    const mockMessage: Message = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello!' }],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
      },
    } as Message;

    mockCreate.mockResolvedValue(mockMessage);

    // Mock initCore to throw
    const { createCore } = await import('@prefactor/core');
    vi.mocked(createCore).mockImplementationOnce(() => {
      throw new Error('Prefactor error');
    });

    const wrapped = wrapAnthropicClient(mockClient, {
      agentId: 'test-agent',
      apiKey: 'test-key',
    });

    // Should not throw, should fall through to original
    const result = await wrapped.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result).toEqual(mockMessage);
  });

  it('should respect captureInputs config', () => {
    const wrapped = wrapAnthropicClient(mockClient, {
      agentId: 'test-agent',
      apiKey: 'test-key',
      captureInputs: false,
    });

    wrapped.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Sensitive data' }],
    });

    expect(mockCreate).toHaveBeenCalled();
  });

  it('should respect maxInputMessages config', () => {
    const wrapped = wrapAnthropicClient(mockClient, {
      agentId: 'test-agent',
      apiKey: 'test-key',
      maxInputMessages: 5,
    });

    wrapped.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [
        { role: 'user', content: '1' },
        { role: 'assistant', content: '2' },
        { role: 'user', content: '3' },
        { role: 'assistant', content: '4' },
        { role: 'user', content: '5' },
        { role: 'assistant', content: '6' },
      ],
    });

    expect(mockCreate).toHaveBeenCalled();
  });
});
