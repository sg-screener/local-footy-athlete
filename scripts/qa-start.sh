#!/usr/bin/env bash
# One command to a testable app. Wraps what already exists — adds nothing new.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${QA_METRO_PORT:-8081}"
SIM_NAME="${QA_SIM_NAME:-iPhone 17 Pro}"

cd "$REPO_DIR"

# 1. Env sanity — worktrees don't inherit .env (see QA_RUNBOOK.md).
if [[ ! -f .env ]]; then
  echo "ERROR: no .env in $REPO_DIR (worktrees don't inherit it — copy from main repo)" >&2
  exit 64
fi
if ! grep -q "EXPO_PUBLIC_SUPABASE_URL" .env; then
  echo "ERROR: .env missing EXPO_PUBLIC_SUPABASE_URL" >&2
  exit 64
fi

# 2. Boot simulator if not already booted.
if ! xcrun simctl list devices | grep -q "$SIM_NAME (.*) (Booted)"; then
  echo "[qa-start] Booting $SIM_NAME..."
  xcrun simctl boot "$SIM_NAME" 2>/dev/null || true
  open -a Simulator
else
  echo "[qa-start] $SIM_NAME already booted."
fi

# 3. Start Metro from THIS checkout unless one already serves this port.
if curl -fs "http://127.0.0.1:${PORT}/status" 2>/dev/null | grep -q "packager-status:running"; then
  echo "[qa-start] Metro already running on :${PORT} — verify it serves THIS checkout: $REPO_DIR"
else
  echo "[qa-start] Starting Metro on :${PORT} (logs: /tmp/qa-metro.log)..."
  nohup npx expo start --dev-client --port "$PORT" > /tmp/qa-metro.log 2>&1 &
  for i in $(seq 1 30); do
    sleep 2
    if curl -fs "http://127.0.0.1:${PORT}/status" 2>/dev/null | grep -q "packager-status:running"; then
      break
    fi
    [[ $i -eq 30 ]] && { echo "ERROR: Metro didn't come up; see /tmp/qa-metro.log" >&2; exit 69; }
  done
fi

echo
echo "[qa-start] Ready. Next:"
echo "  E2E_METRO_URL=http://127.0.0.1:${PORT} scripts/dev-e2e/run-maestro-ios.sh \\"
echo "    .maestro/common/reset-seed.yaml -e SEED_ID=standard-in-season-week"
echo
echo "Rules: docs/QA_RUNBOOK.md · Test surface: docs/SUPPORTED_ATHLETE_ACTIONS.md"
