export { wrapAnthropicClient } from './wrap.js';
export { shutdown, getTracer } from './init.js';
export type { PrefactorAnthropicConfig } from './types.js';
export { extractTokenUsage, extractStreamingTokenUsage } from './token-usage.js';
export { spanErrorTracker } from './error-tracker.js';

// Re-exports from @prefactor/core for convenience
export {
  type Config,
  type CoreRuntime,
  type HttpTransportConfig,
  type Span,
  SpanStatus,
  SpanType,
  type TokenUsage,
} from '@prefactor/core';
