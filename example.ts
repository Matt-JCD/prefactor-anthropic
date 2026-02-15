/**
 * Example usage of @prefactor/anthropic
 *
 * This demonstrates how to wrap an Anthropic client to automatically
 * trace all API calls to Prefactor.
 *
 * To run this example:
 * 1. Set environment variables:
 *    - ANTHROPIC_API_KEY
 *    - PREFACTOR_API_KEY
 *    - PREFACTOR_API_URL (optional, defaults to https://api.prefactor.ai)
 *
 * 2. Run: npx tsx example.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { wrapAnthropicClient, shutdown } from './src/index.js';

async function main() {
  // Validate required environment variables
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    console.error('❌ Error: Invalid ANTHROPIC_API_KEY format (expected to start with "sk-ant-")');
    process.exit(1);
  }

  if (!process.env.PREFACTOR_API_KEY) {
    console.error('❌ Error: PREFACTOR_API_KEY environment variable is required');
    process.exit(1);
  }

  if (process.env.PREFACTOR_API_KEY.length < 10) {
    console.error('❌ Error: PREFACTOR_API_KEY appears to be invalid (too short)');
    process.exit(1);
  }

  // Create a normal Anthropic client
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Wrap it to enable automatic tracing
  const tracedClient = wrapAnthropicClient(client, {
    agentId: 'example-agent',
    apiKey: process.env.PREFACTOR_API_KEY,
    apiUrl: process.env.PREFACTOR_API_URL || 'https://api.prefactor.ai',
    captureInputs: true,
    captureOutputs: true,
    maxInputMessages: 3,
  });

  console.log('🚀 Making a non-streaming request...');

  // Non-streaming request - works exactly like normal
  const message = await tracedClient.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France? Answer in one word.',
      },
    ],
  });

  console.log('✅ Response:', message.content[0]);
  console.log('📊 Tokens:', message.usage);

  console.log('\n🌊 Making a streaming request...');

  // Streaming request - also works exactly like normal
  const stream = tracedClient.messages.stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: 'Count from 1 to 5.',
      },
    ],
  });

  stream.on('text', (text) => {
    process.stdout.write(text);
  });

  const finalMessage = await stream.finalMessage();
  console.log('\n✅ Stream complete');
  console.log('📊 Tokens:', finalMessage.usage);

  // Graceful shutdown - ensures all spans are sent
  console.log('\n🛑 Shutting down...');
  try {
    await shutdown();
    console.log('✅ Done!');
  } catch (shutdownError) {
    console.error('❌ Shutdown failed:', shutdownError);
    throw shutdownError; // Re-throw to ensure process exits with error
  }
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
