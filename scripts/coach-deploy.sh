#!/usr/bin/env bash
# ONE COMMAND FROM "SAM SAID DEPLOY" TO A RECEIPT (plan slice S2, 2026-09-10).
#
# Order: rebuild the knowledge bundle from the current registry and Bible,
# prove it fresh (the integration cell reds on a stale bundle), deploy the
# function, then write the receipt row. The deploy is still Sam's call every
# time; this removes the forgotten step, not the decision.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[coach-deploy] 1/4 rebuilding the knowledge bundle"
npm run -s coach:knowledge:build
HIGHEST=$(grep -o 'R-[0-9]\{3\}' supabase/functions/coach-chat/canonicalCoachKnowledge.generated.ts | sort -u | tail -1)

echo "[coach-deploy] 2/4 proving the bundle fresh and the contract green"
npm run -s test:coach-chat-integration > /tmp/coach-deploy-integration.log 2>&1 || {
  tail -20 /tmp/coach-deploy-integration.log
  echo "[coach-deploy] refused: test:coach-chat-integration is red"; exit 1;
}
npm run -s test:coach-retrieval-regression > /tmp/coach-deploy-retrieval.log 2>&1 || {
  tail -20 /tmp/coach-deploy-retrieval.log
  echo "[coach-deploy] refused: test:coach-retrieval-regression is red"; exit 1;
}

echo "[coach-deploy] 3/4 deploying coach-chat"
supabase functions deploy coach-chat
VERSION=$(supabase functions list 2>/dev/null | awk -F'|' '/coach-chat/ {gsub(/ /,"",$6); print $6}')
SHA=$(git rev-parse --short HEAD)
DIRTY=$(git status --porcelain -- src supabase docs/RULINGS_REGISTRY.md docs/LFA_PROGRAMMING_BIBLE.md | grep -v '^??' | wc -l | tr -d ' ')
STAMP=$(date -u '+%Y-%m-%d %H:%M:%S')
WHO=${COACH_DEPLOY_AGENT:-unknown}

echo "[coach-deploy] 4/4 writing the receipt"
python3 - "$STAMP" "$VERSION" "$SHA" "$DIRTY" "$HIGHEST" "$WHO" <<'PY'
import sys
stamp, version, sha, dirty, highest, who = sys.argv[1:7]
path = 'docs/COACH_DEPLOY_RECEIPTS.md'
lines = open(path).read().split('\n')
row = f"| {stamp} | coach-chat v{version} | {sha}{' + ' + dirty + ' uncommitted tracked change(s)' if dirty != '0' else ''} | {highest} | via scripts/coach-deploy.sh | {who} |"
for i, line in enumerate(lines):
    if line.startswith('| --- |'):
        lines.insert(i + 1, row); break
open(path, 'w').write('\n'.join(lines))
print(row)
PY
echo "[coach-deploy] done — commit docs/COACH_DEPLOY_RECEIPTS.md with your own pathspec"
