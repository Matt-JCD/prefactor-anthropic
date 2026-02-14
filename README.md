# @prefactor/anthropic

Anthropic SDK integration for [Prefactor](https://prefactor.ai) observability. Automatically trace all Claude API calls with zero code changes.

## Features

- 🔍 **Automatic tracing** - Wraps your Anthropic client to trace every `messages.create()` and `messages.stream()` call
- 📊 **Complete telemetry** - Captures model, inputs, outputs, token usage, latency, and errors
- 🚀 **Drop-in replacement** - Same interface, same types, no code changes needed
- 🛡️ **Fail-safe** - If Prefactor is unreachable, your Claude calls work normally
- 📦 **Lightweight** - Minimal overhead, uses Proxy-based interception

## Installation

```bash
npm install @prefactor/anthropic @anthropic-ai/sdk
```

Requires:
- Node.js >= 22.0.0
- `@anthropic-ai/sdk` >= 0.70.0

## Quick Start

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { wrapAnthropicClient } from '@prefactor/anthropic';

// Create your normal Anthropic client
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Wrap it - now all API calls are traced
const tracedClient = wrapAnthropicClient(client, {
  agentId: 'my-agent',
  apiKey: process.env.PREFACTOR_API_KEY!,
  apiUrl: 'https://api.prefactor.ai',
});

// Use exactly as before - tracing happens automatically
const message = await tracedClient.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude!' }],
});

console.log(message.content);
```

## Configuration

### Simple Config

```typescript
wrapAnthropicClient(client, {
  agentId: 'my-agent',              // Required: Your Prefactor agent ID
  apiKey: 'pk_...',                 // Required: Your Prefactor API key
  apiUrl: 'https://api.prefactor.ai', // Optional: API URL (default: env var)
  environmentId: 'prod',            // Optional: Environment ID for metadata
  captureInputs: true,              // Optional: Capture input messages (default: true)
  captureOutputs: true,             // Optional: Capture output content (default: true)
  maxInputMessages: 3,              // Optional: How many recent messages to capture (default: 3)
});
```

### Advanced Config

For full control over the `@prefactor/core` configuration:

```typescript
wrapAnthropicClient(client, {
  prefactorConfig: {
    transportType: 'http',
    sampleRate: 1.0,
    captureInputs: true,
    captureOutputs: true,
    httpConfig: {
      apiUrl: 'https://api.prefactor.ai',
      apiToken: 'pk_...',
      agentId: 'my-agent',
      agentIdentifier: '1.0.0',
      agentName: 'My AI Assistant',
      agentDescription: 'Production customer support agent',
      requestTimeout: 30000,
      maxRetries: 3,
    },
  },
});
```

## What Gets Traced

Every `messages.create()` and `messages.stream()` call creates a Prefactor span with:

| Field | Description |
|-------|-------------|
| `name` | `anthropic:messages.create` or `anthropic:messages.stream` |
| `spanType` | `anthropic:llm` |
| `inputs.model` | Model used (e.g., `claude-sonnet-4-5-20250929`) |
| `inputs.messages` | Last N input messages (configurable) |
| `inputs.max_tokens` | Max tokens parameter |
| `outputs.content` | Response content blocks |
| `outputs.stop_reason` | Why generation stopped (`end_turn`, `max_tokens`, etc.) |
| `tokenUsage` | `{ promptTokens, completionTokens, totalTokens }` |
| `error` | Error details if the call failed |

Token usage includes:
- Base input/output tokens
- Cache creation tokens
- Cache read tokens

## Streaming Support

Both streaming methods are fully supported:

### Raw Streaming (`stream: true`)

```typescript
const stream = await tracedClient.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const event of stream) {
  // Events pass through normally
  // Token usage captured automatically at the end
}
```

### Helper Streaming (`messages.stream()`)

```typescript
const stream = tracedClient.messages.stream({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Tell me a story' }],
});

stream.on('text', (text) => {
  console.log(text);
});

const finalMessage = await stream.finalMessage();
// Span is automatically ended with full token usage
```

## Environment Variables

Instead of passing config explicitly, you can use environment variables:

```bash
PREFACTOR_API_URL=https://api.prefactor.ai
PREFACTOR_API_TOKEN=pk_your_token_here
PREFACTOR_AGENT_ID=my-agent
```

Then call without config:

```typescript
const tracedClient = wrapAnthropicClient(client);
```

## Error Handling

The wrapper is designed to **never break your Claude API calls**:

- If Prefactor initialization fails → error is thrown at setup time (so you know config is wrong)
- If span creation fails → falls through to original Anthropic call
- If span ending fails → error is swallowed silently
- If Prefactor API is unreachable → your Claude calls work normally

Your application's reliability is never compromised by observability failures.

## Graceful Shutdown

To ensure all spans are sent before your process exits:

```typescript
import { shutdown } from '@prefactor/anthropic';

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});
```

The package also registers a `beforeExit` handler automatically.

## TypeScript Support

Full TypeScript support with all types exported:

```typescript
import type {
  PrefactorAnthropicConfig,
  Span,
  SpanStatus,
  TokenUsage,
} from '@prefactor/anthropic';
```

## License

MIT

## Support

- Issues: [GitHub Issues](https://github.com/prefactor/prefactor-anthropic/issues)
- Documentation: [Prefactor Docs](https://docs.prefactor.ai)
