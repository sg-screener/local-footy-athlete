#!/usr/bin/env bash
# THE LAUNCH-AUDIT REGRESSION PACK, ONE COMMAND, TEXT REPORT.
#
# Runs every flow in .maestro/audit/ on the booted simulator through the
# guarded Maestro runner (never bare `maestro test` — see
# .claude/skills/lfa-dev) and prints one PASS/FAIL line per flow. Wired as
# `npm run qa:audit-flows`; documented in CLAUDE.md's command table and
# docs/QA_RUNBOOK.md. Each flow reseeds itself, so order does not matter and
# a failure leaves nothing for the next flow to trip on.
#
# Prerequisites: the app built on a booted simulator and Metro from THIS
# checkout on the port below (`npm run lfa:dev` does both).
set -uo pipefail
cd "$(dirname "$0")/.."

METRO="${E2E_METRO_URL:-http://127.0.0.1:8081}"
pass=0
fail=0
results=()

for flow in .maestro/audit/*.yaml; do
  echo ""
  echo "════ ${flow} ════"
  if E2E_METRO_URL="${METRO}" scripts/dev-e2e/run-maestro-ios.sh "${flow}"; then
    results+=("PASS  $(basename "${flow}")")
    pass=$((pass + 1))
  else
    results+=("FAIL  $(basename "${flow}")")
    fail=$((fail + 1))
  fi
done

echo ""
echo "AUDIT FLOWS — ${pass} passed, ${fail} failed"
printf '%s\n' "${results[@]}"
[[ ${fail} -eq 0 ]]
