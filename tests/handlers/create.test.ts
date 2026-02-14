import { describe, it, expect, vi } from 'vitest';
import { handleNonStreamingCreate } from '../../src/handlers/create';
import type { Message, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';

describe('handleNonStreamingCreate', () => {
  it('should start and end a span for successful request', async () => {
    const mockSpan = { spanId: 'test-span-123' };
    const mockTracer = {
      startSpan: vi.fn(() => mockSpan),
      endSpan: vi.fn(),
    };

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

    const mockCreate = vi.fn(() => {
      const promise = Promise.resolve(mockMessage);
      (promise as any).then = function (onFulfilled: any, onRejected: any) {
        return Promise.prototype.then.call(this, onFulfilled, onRejected);
      };
      return promise;
    });

    const body: MessageCreateParamsNonStreaming = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    };

    const result = handleNonStreamingCreate(
      mockTracer as any,
      mockCreate,
      null,
      body,
      undefined,
      {},
    );

    expect(mockTracer.startSpan).toHaveBeenCalledWith({
      name: 'anthropic:messages.create',
      spanType: expect.any(String),
      inputs: expect.objectContaining({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 100,
        messages: expect.any(Array),
      }),
    });

    expect(mockCreate).toHaveBeenCalledWith(body, undefined);

    // Wait for the promise to resolve
    await result;

    // Wait for .then() to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockTracer.endSpan).toHaveBeenCalledWith(mockSpan, {
      outputs: expect.objectContaining({
        stop_reason: 'end_turn',
      }),
      tokenUsage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
    });
  });

  it('should end span with error on failed request', async () => {
    const mockSpan = { spanId: 'test-span-123' };
    const mockTracer = {
      startSpan: vi.fn(() => mockSpan),
      endSpan: vi.fn(),
    };

    const mockError = new Error('API Error');
    const mockCreate = vi.fn(() => {
      const promise = Promise.reject(mockError);
      (promise as any).then = function (onFulfilled: any, onRejected: any) {
        return Promise.prototype.then.call(this, onFulfilled, onRejected);
      };
      return promise;
    });

    const body: MessageCreateParamsNonStreaming = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    };

    const result = handleNonStreamingCreate(
      mockTracer as any,
      mockCreate,
      null,
      body,
      undefined,
      {},
    );

    expect(mockTracer.startSpan).toHaveBeenCalled();

    try {
      await result;
    } catch (e) {
      expect(e).toBe(mockError);
    }

    // Wait for .catch() to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockTracer.endSpan).toHaveBeenCalledWith(mockSpan, {
      error: mockError,
    });
  });

  it('should respect captureInputs=false config', () => {
    const mockTracer = {
      startSpan: vi.fn(() => ({ spanId: 'test' })),
      endSpan: vi.fn(),
    };

    const mockCreate = vi.fn(() => Promise.resolve({} as Message));

    const body: MessageCreateParamsNonStreaming = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Sensitive' }],
    };

    handleNonStreamingCreate(
      mockTracer as any,
      mockCreate,
      null,
      body,
      undefined,
      { captureInputs: false },
    );

    expect(mockTracer.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: expect.objectContaining({
          messages: '[redacted]',
        }),
      }),
    );
  });

  it('should respect captureOutputs=false config', async () => {
    const mockSpan = { spanId: 'test-span-123' };
    const mockTracer = {
      startSpan: vi.fn(() => mockSpan),
      endSpan: vi.fn(),
    };

    const mockMessage: Message = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Sensitive response!' }],
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

    const mockCreate = vi.fn(() => {
      const promise = Promise.resolve(mockMessage);
      (promise as any).then = function (onFulfilled: any, onRejected: any) {
        return Promise.prototype.then.call(this, onFulfilled, onRejected);
      };
      return promise;
    });

    const body: MessageCreateParamsNonStreaming = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    };

    const result = handleNonStreamingCreate(
      mockTracer as any,
      mockCreate,
      null,
      body,
      undefined,
      { captureOutputs: false },
    );

    await result;
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockTracer.endSpan).toHaveBeenCalledWith(mockSpan, {
      outputs: expect.objectContaining({
        stop_reason: 'end_turn',
      }),
      tokenUsage: expect.any(Object),
    });

    // Verify content is NOT in outputs
    const endSpanCall = mockTracer.endSpan.mock.calls[0][1];
    expect(endSpanCall.outputs).not.toHaveProperty('content');
  });

  it('should capture system prompt and tool count if present', () => {
    const mockTracer = {
      startSpan: vi.fn(() => ({ spanId: 'test' })),
      endSpan: vi.fn(),
    };

    const mockCreate = vi.fn(() => Promise.resolve({} as Message));

    const body: MessageCreateParamsNonStreaming = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
      system: 'You are a helpful assistant',
      tools: [
        {
          name: 'get_weather',
          description: 'Get weather',
          input_schema: { type: 'object', properties: {} },
        },
      ],
    };

    handleNonStreamingCreate(
      mockTracer as any,
      mockCreate,
      null,
      body,
      undefined,
      {},
    );

    expect(mockTracer.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: expect.objectContaining({
          system: 'You are a helpful assistant',
          tool_count: 1,
        }),
      }),
    );
  });

  it('should limit captured messages to maxInputMessages', () => {
    const mockTracer = {
      startSpan: vi.fn(() => ({ spanId: 'test' })),
      endSpan: vi.fn(),
    };

    const mockCreate = vi.fn(() => Promise.resolve({} as Message));

    const body: MessageCreateParamsNonStreaming = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [
        { role: 'user', content: '1' },
        { role: 'assistant', content: '2' },
        { role: 'user', content: '3' },
        { role: 'assistant', content: '4' },
        { role: 'user', content: '5' },
      ],
    };

    handleNonStreamingCreate(
      mockTracer as any,
      mockCreate,
      null,
      body,
      undefined,
      { maxInputMessages: 2 },
    );

    const startSpanCall = mockTracer.startSpan.mock.calls[0][0];
    // Should only capture last 2 messages
    expect(startSpanCall.inputs.messages).toHaveLength(2);
  });
});
