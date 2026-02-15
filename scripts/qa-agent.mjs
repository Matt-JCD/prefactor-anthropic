#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
import { readFile, readdir, stat, writeFile } from 'fs/promises';
import { join, relative } from 'path';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const CHECKS = process.argv.includes('--quick')
  ? ['security', 'error-handling']
  : ['security', 'error-handling', 'types', 'performance', 'architecture', 'tests'];

const MAX_FILE_SIZE = 100_000;
const RELEVANT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.next', 'coverage', '.qa-tmp']);

async function getSourceFiles(dir, fileList = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          await getSourceFiles(fullPath, fileList);
        }
      } else if (RELEVANT_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        const stats = await stat(fullPath);
        if (stats.size < MAX_FILE_SIZE) {
          fileList.push(fullPath);
        }
      }
    }),
  );

  return fileList;
}

async function buildContext(files) {
  const contents = await Promise.all(
    files.map(async (file) => {
      try {
        const content = await readFile(file, 'utf-8');
        const relativePath = relative(process.cwd(), file);
        return `## File: ${relativePath}\n\`\`\`\n${content}\n\`\`\``;
      } catch (error) {
        console.warn(`⚠️  Could not read ${file}: ${error.message}`);
        return null;
      }
    }),
  );

  return contents.filter(Boolean).join('\n\n');
}

function sanitizeError(error) {
  // Comprehensive API key sanitization
  const message = error.message.replace(/sk-[a-z]+-[a-zA-Z0-9_-]+/g, 'sk-***');
  const stack = error.stack?.replace(/sk-[a-z]+-[a-zA-Z0-9_-]+/g, 'sk-***');
  return { message, stack };
}

async function runQACheck(context, checks) {
  const checkList = checks.map((c) => `- ${c.toUpperCase()}`).join('\n');

  const prompt = `You are a code quality reviewer for a TypeScript/JavaScript project. Analyze the codebase and check for issues in these categories:

${checkList}

For each category, identify:
- CRITICAL issues (must fix before commit)
- HIGH issues (should fix soon)
- MEDIUM issues (good to address)
- LOW issues (minor improvements)

Provide a verdict at the end: PASS, WARN, or FAIL.
- FAIL = 1+ CRITICAL issues found
- WARN = No CRITICAL, but HIGH/MEDIUM issues found
- PASS = No significant issues

Format your response as a markdown report with:
1. Executive Summary (verdict + brief summary)
2. Issues by Category (grouped by severity)
3. Recommendations
4. Final Verdict

Here is the codebase:

${context}`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    return message.content[0].text;
  } catch (error) {
    const { message, stack } = sanitizeError(error);
    console.error('❌ Error calling Claude API:', message);
    if (stack) console.error(stack);
    throw new Error(message);
  }
}

async function main() {
  console.log('🔍 Prefactor QA Agent');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const mode = process.argv.includes('--quick') ? 'QUICK' : 'FULL';
  console.log(`Mode: ${mode}`);
  console.log(`Checks: ${CHECKS.join(', ')}\n`);

  console.log('📂 Scanning files...');
  const files = await getSourceFiles(process.cwd());
  console.log(`   Found ${files.length} source files\n`);

  if (files.length === 0) {
    console.log('⚠️  No source files found');
    process.exit(0);
  }

  console.log('📖 Building context...');
  const context = await buildContext(files);
  const contextSize = Math.round(context.length / 1024);
  console.log(`   Context size: ${contextSize}KB\n`);

  console.log('🤖 Running QA check with Claude...');
  const report = await runQACheck(context, CHECKS);

  const reportPath = join(process.cwd(), 'qa-report.md');
  const fullReport = `# QA Report - ${new Date().toISOString()}\n\n${report}`;
  await writeFile(reportPath, fullReport);

  console.log('\n✅ QA report generated: qa-report.md\n');

  const verdictMatch = report.match(/verdict[:\s]*(\w+)/i);
  const verdict = verdictMatch ? verdictMatch[1].toUpperCase() : 'UNKNOWN';

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (verdict === 'FAIL') {
    console.log('❌ VERDICT: FAIL');
    console.log('   Fix critical issues before committing');
    process.exit(1);
  } else if (verdict === 'WARN') {
    console.log('⚠️  VERDICT: WARN');
    console.log('   Review warnings before committing');
    process.exit(0);
  } else {
    console.log('✅ VERDICT: PASS');
    console.log('   Ready to commit');
    process.exit(0);
  }
}

main().catch((error) => {
  const { message } = sanitizeError(error);
  console.error('\n❌ QA Agent failed:', message);
  process.exit(1);
});
