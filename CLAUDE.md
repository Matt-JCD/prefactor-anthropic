# ============================================================
# QA GATE — MANDATORY PRE-COMMIT WORKFLOW
# ============================================================
# This section defines the required quality gate process.
# NEVER skip these steps. NEVER commit without running QA.
# ============================================================

## Commit Workflow (MANDATORY — follow every time)

When you are ready to commit code, you MUST follow this exact sequence:

### Step 1: Self-check
Before running QA, do a quick self-review:
- [ ] Does the code do what Matt asked for?
- [ ] Did you explain what you built in plain English?
- [ ] Are there any `console.log` debug statements left in?
- [ ] Are there any hardcoded API keys, secrets, or credentials?
- [ ] Are there any `any` types you added as shortcuts?
- [ ] Did you add/update tests for new functionality?

### Step 2: Run the QA Agent
```bash
npm run qa
```
This runs the full AI quality gate (security, error handling, types, performance, architecture, tests). Wait for it to complete. Do NOT proceed until it finishes.

If the project doesn't have the QA agent installed yet, tell Matt:
"This project doesn't have the QA agent set up yet. Want me to add it?"

### Step 3: Review the QA Report
Read the generated `qa-report.md` file. Present Matt with:
1. The **verdict** (PASS / WARN / FAIL)
2. A **plain English summary** of any issues found
3. Your **recommendation** on whether to fix issues now or commit as-is

### Step 4: Act on the verdict

**If FAIL:**
- Do NOT commit
- Tell Matt: "QA found critical issues that need fixing before we commit. Here's what's wrong: [summary]"
- Fix all CRITICAL and HIGH issues
- Run `npm run qa` again
- Repeat until PASS or WARN

**If WARN:**
- Tell Matt: "QA passed with warnings. Here's what it flagged: [summary]. Do you want me to fix these now or commit and address them later?"
- If Matt says fix → fix them, run QA again
- If Matt says commit → proceed to Step 5

**If PASS:**
- Tell Matt: "QA passed clean. Ready to commit."
- Proceed to Step 5

### Step 5: Commit
- Create a clear commit message describing what changed and why
- If there were WARN issues that Matt chose to defer, note them in the commit message
- Ask Matt before pushing to main (existing rule still applies)

## Quick QA (for small changes)

For very small changes (typos, config tweaks, single-line fixes), you can run quick mode:
```bash
npm run qa:quick
```
This only runs security and error handling checks. Use your judgment — if in doubt, run the full QA.

## QA Agent Troubleshooting

If the QA agent fails to run:
- Check that `ANTHROPIC_API_KEY` is set
- Check that `scripts/qa-agent.mjs` exists
- Check that `@anthropic-ai/sdk` is installed
- Tell Matt what went wrong in plain English

## NEVER DO (QA-related)

- Never commit without running QA first
- Never ignore a FAIL verdict
- Never delete or modify the QA agent scripts without asking Matt
- Never skip QA because "it's a small change" — use quick mode instead
- Never mark a FAIL as PASS in the report
