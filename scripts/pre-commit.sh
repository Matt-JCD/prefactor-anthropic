#!/bin/sh
#
# Prefactor QA Gate — Pre-commit Hook
#
# This hook checks that the QA agent was run before allowing a commit.
# It doesn't re-run the full agent (too slow for a hook), but verifies
# that a recent QA report exists and didn't FAIL.
#
# Install: cp scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
#

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

REPORT_FILE="qa-report.md"
VERDICT_PATTERN="Verdict"

# Check if QA report exists
if [ ! -f "$REPORT_FILE" ]; then
  echo ""
  echo "${RED}╔══════════════════════════════════════════════════╗${NC}"
  echo "${RED}║  ❌ QA GATE: No qa-report.md found              ║${NC}"
  echo "${RED}║                                                  ║${NC}"
  echo "${RED}║  Run 'npm run qa' before committing.             ║${NC}"
  echo "${RED}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
  exit 1
fi

# Check report age (must be less than 30 minutes old)
if [ "$(uname)" = "Darwin" ]; then
  # macOS
  REPORT_AGE=$(( $(date +%s) - $(stat -f %m "$REPORT_FILE") ))
else
  # Linux
  REPORT_AGE=$(( $(date +%s) - $(stat -c %Y "$REPORT_FILE") ))
fi

MAX_AGE=1800 # 30 minutes

if [ "$REPORT_AGE" -gt "$MAX_AGE" ]; then
  echo ""
  echo "${YELLOW}╔══════════════════════════════════════════════════╗${NC}"
  echo "${YELLOW}║  ⚠️  QA GATE: Report is stale (>30 min old)      ║${NC}"
  echo "${YELLOW}║                                                  ║${NC}"
  echo "${YELLOW}║  Run 'npm run qa' again before committing.       ║${NC}"
  echo "${YELLOW}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
  exit 1
fi

# Check for FAIL verdict
if grep -qi "verdict.*fail\|fail.*❌" "$REPORT_FILE"; then
  echo ""
  echo "${RED}╔══════════════════════════════════════════════════╗${NC}"
  echo "${RED}║  ❌ QA GATE: Report verdict is FAIL              ║${NC}"
  echo "${RED}║                                                  ║${NC}"
  echo "${RED}║  Fix critical issues and run 'npm run qa' again. ║${NC}"
  echo "${RED}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
  exit 1
fi

# Check for WARN verdict
if grep -qi "verdict.*warn\|warn.*⚠️" "$REPORT_FILE"; then
  echo ""
  echo "${YELLOW}╔══════════════════════════════════════════════════╗${NC}"
  echo "${YELLOW}║  ⚠️  QA GATE: Report has warnings                ║${NC}"
  echo "${YELLOW}║                                                  ║${NC}"
  echo "${YELLOW}║  Proceeding with commit. Review warnings soon.   ║${NC}"
  echo "${YELLOW}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
  # Allow commit but warn
  exit 0
fi

# PASS
echo ""
echo "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo "${GREEN}║  ✅ QA GATE: Passed — safe to commit             ║${NC}"
echo "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
exit 0
