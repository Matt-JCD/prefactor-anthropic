# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-14

### Added
- Initial release of `@prefactor/anthropic`
- `wrapAnthropicClient()` function to wrap Anthropic SDK clients
- Automatic tracing for `messages.create()` (both streaming and non-streaming)
- Automatic tracing for `messages.stream()`
- Token usage extraction including cache tokens
- Graceful error handling - Prefactor failures don't break Anthropic calls
- Full TypeScript support
- Comprehensive README with examples
- Unit tests for token usage extraction

### Features
- Drop-in replacement for Anthropic client - same interface, zero code changes
- Captures model, inputs, outputs, token usage, latency, and errors
- Supports both raw streaming (`stream: true`) and helper streaming (`messages.stream()`)
- Configurable input/output capture and message limits
- Environment variable support for configuration
- Automatic graceful shutdown on process exit
