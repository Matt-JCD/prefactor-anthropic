# Testing Guide

## Test Suite

The package includes comprehensive unit tests covering all major functionality.

### Test Coverage

- ✅ **23 tests total, all passing**
- 3 test files:
  1. `token-usage.test.ts` - Token extraction logic (9 tests)
  2. `wrap.test.ts` - Client wrapping functionality (8 tests)
  3. `handlers/create.test.ts` - Non-streaming handler (6 tests)

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Build
npm run build
```

## Test Breakdown

### Token Usage Tests (`token-usage.test.ts`)

Tests the extraction of token usage from Anthropic API responses:

- ✅ Extract tokens with no cache tokens
- ✅ Include cache creation tokens in prompt tokens
- ✅ Include cache read tokens in prompt tokens
- ✅ Include both cache creation and read tokens
- ✅ Extract from streaming (initial usage only)
- ✅ Extract from streaming (delta usage only)
- ✅ Combine initial and delta usage
- ✅ Prefer delta output_tokens over initial
- ✅ Return null when no usage data

### Client Wrapping Tests (`wrap.test.ts`)

Tests the proxy-based wrapping mechanism:

- ✅ Wrap client and return same reference
- ✅ Intercept `messages.create()` calls
- ✅ Intercept `messages.stream()` calls
- ✅ Pass through non-intercepted methods
- ✅ Handle streaming create (`stream: true`)
- ✅ Fall through to original on Prefactor error
- ✅ Respect `captureInputs` config
- ✅ Respect `maxInputMessages` config

### Handler Tests (`handlers/create.test.ts`)

Tests the non-streaming create handler:

- ✅ Start and end span for successful request
- ✅ End span with error on failed request
- ✅ Respect `captureInputs=false` config
- ✅ Respect `captureOutputs=false` config
- ✅ Capture system prompt and tool count
- ✅ Limit captured messages to `maxInputMessages`

## Manual Testing

### Test with Real API

To test with real Anthropic and Prefactor APIs:

1. Set environment variables:
   ```bash
   export ANTHROPIC_API_KEY="your-anthropic-key"
   export PREFACTOR_API_KEY="your-prefactor-key"
   export PREFACTOR_API_URL="https://api.prefactor.ai"
   ```

2. Run the example:
   ```bash
   npx tsx example.ts
   ```

3. Expected output:
   ```
   🚀 Making a non-streaming request...
   ✅ Response: [TextBlock with response]
   📊 Tokens: { input_tokens: X, output_tokens: Y, ... }

   🌊 Making a streaming request...
   [streamed text appears here]
   ✅ Stream complete
   📊 Tokens: { input_tokens: X, output_tokens: Y, ... }

   🛑 Shutting down...
   ✅ Done!
   ```

4. Verify in Prefactor dashboard:
   - Log into Prefactor dashboard
   - Navigate to your agent
   - Verify 2 spans appear (one for each request)
   - Check span details include:
     - Model name
     - Input messages
     - Output content
     - Token usage (prompt + completion + total)
     - Latency

### Test Scenarios

#### 1. Non-Streaming Request
```typescript
const message = await tracedClient.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 100,
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

Expected: Span created with complete token usage

#### 2. Streaming Request (Raw)
```typescript
const stream = await tracedClient.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 100,
  messages: [{ role: 'user', content: 'Count to 5' }],
  stream: true,
});

for await (const event of stream) {
  // Process events
}
```

Expected: Span created, ended after stream completes with accumulated token usage

#### 3. Streaming Request (Helper)
```typescript
const stream = tracedClient.messages.stream({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 100,
  messages: [{ role: 'user', content: 'Tell a story' }],
});

const finalMessage = await stream.finalMessage();
```

Expected: Span created, ended with finalMessage token usage

#### 4. Error Handling
```typescript
try {
  await tracedClient.messages.create({
    model: 'invalid-model',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'Hello' }],
  });
} catch (error) {
  // Error should be propagated
}
```

Expected: Span created with error details, error propagated to user

#### 5. Prefactor Unavailable
Set invalid Prefactor API URL or key, then make request.

Expected: Anthropic request succeeds normally, span creation fails silently

## Performance Testing

Test with varying loads:

1. **Single request**: Verify minimal overhead
2. **10 concurrent requests**: Verify no blocking
3. **Streaming requests**: Verify events flow without buffering

Monitor:
- Latency impact (should be < 5ms per request)
- Memory usage (no leaks from event listeners)
- Error propagation (user errors never swallowed)

## Integration Testing

For full integration tests:

1. Create a test Prefactor agent
2. Run automated tests with real API calls
3. Verify spans in Prefactor dashboard
4. Check span data completeness
5. Verify token counts match Anthropic's response

## Troubleshooting

### Tests Failing

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build

# Run tests
npm test
```

### Build Errors

```bash
# Check TypeScript
npm run typecheck

# If type errors, check @anthropic-ai/sdk version
npm list @anthropic-ai/sdk
```

### Example Not Working

- Verify environment variables are set
- Check API keys are valid
- Ensure Prefactor API is accessible
- Check console for error messages
