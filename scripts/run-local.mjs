#!/usr/bin/env node
/**
 * Local QA Runner
 *
 * Convenience wrapper for npm run qa
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const qaAgentPath = join(__dirname, 'qa-agent.mjs');
const args = process.argv.slice(2);

console.log('🚀 Running Prefactor QA Agent...\n');

const child = spawn('node', [qaAgentPath, ...args], {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code);
});

child.on('error', (error) => {
  console.error('❌ Failed to run QA agent:', error.message);
  process.exit(1);
});
