#!/usr/bin/env bash
#
# ONE COMMAND TO A RUNNING APP — `npm run lfa:dev`.
#
# Wraps what already exists. There is exactly ONE startup script in this repo and
# this is it (seat inbox item 0d(ii), Sam 2026-08-12: "Do not leave several
# startup scripts or temporary variants behind — one"). If you need a variant,
# add a flag here; do not add a second file.
#
# WHAT IT REACHES, AND WHY THAT CHANGED. Until 2026-08-12 this script stopped at
# "simulator booted, Metro up" and printed the rest as homework, so every session
# re-derived the last two steps. It now LAUNCHES the app, because "a running app"
# is the thing that was being rediscovered.
#
# HOW THE SIMULATOR IS CHOSEN — first match wins, and the rule is printed:
#   1. $QA_SIM_UDID                 explicit, wins over everything
#   2. $QA_SIM_NAME                 the old knob, still honoured
#   3. a BOOTED device that has the app installed
#   4. the default device ("iPhone 17 Pro") if it has the app
#   5. any device that has the app
#   6. nothing has it -> FAIL CLOSED naming `npx expo run:ios`
# Rule 3 exists because this machine keeps a dozen "LFA Explorer" simulators and
# the one already on screen is the one the operator means. Booting a second
# device beside it is how a session ends up driving a simulator nobody is looking
# at.
#
# INSTALL DETECTION READS THE BUNDLE, NOT simctl. `simctl get_app_container`
# answers "Unable to lookup in current state: Shutdown" (code 405) for every
# device that is not running, which is indistinguishable from "not installed" —
# and that misreading is exactly how a check like this goes quietly wrong. The
# app bundles are on disk either way, so this reads CFBundleIdentifier out of
# them and works on a shutdown device.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${QA_METRO_PORT:-8081}"
DEFAULT_SIM_NAME="${QA_SIM_NAME:-iPhone 17 Pro}"
DEVICES_ROOT="$HOME/Library/Developer/CoreSimulator/Devices"

cd "$REPO_DIR"

BUNDLE_ID="$(node -p "require('./app.json').expo.ios.bundleIdentifier")"

# 1. Env sanity — worktrees don't inherit .env (see QA_RUNBOOK.md).
if [[ ! -f .env ]]; then
  echo "ERROR: no .env in $REPO_DIR (worktrees don't inherit it — copy from main repo)" >&2
  exit 64
fi
if ! grep -q "EXPO_PUBLIC_SUPABASE_URL" .env; then
  echo "ERROR: .env missing EXPO_PUBLIC_SUPABASE_URL" >&2
  exit 64
fi

# 2. Pick the simulator.
has_app() {
  local udid="$1" app id
  for app in "$DEVICES_ROOT/$udid"/data/Containers/Bundle/Application/*/*.app; do
    [[ -d "$app" ]] || continue
    id="$(plutil -extract CFBundleIdentifier raw "$app/Info.plist" 2>/dev/null || true)"
    [[ "$id" == "$BUNDLE_ID" ]] && return 0
  done
  return 1
}

# "    Name (UDID) (State)" -> "UDID<TAB>State<TAB>Name".
# The trailing `.*` is not decoration: simctl pads these lines with a trailing
# space, and anchoring on `\)$` matched NOTHING while looking exactly right —
# the script then reported "not installed on any simulator" about a simulator
# with the app open on it.
device_rows() {
  xcrun simctl list devices available \
    | sed -nE 's/^ +(.+) \(([0-9A-F-]{36})\) \((Booted|Shutdown)\).*$/\2\t\3\t\1/p'
}

SIM_UDID=""
SIM_WHY=""
if [[ -n "${QA_SIM_UDID:-}" ]]; then
  SIM_UDID="$QA_SIM_UDID"
  SIM_WHY="QA_SIM_UDID"
elif [[ -n "${QA_SIM_NAME:-}" ]]; then
  SIM_UDID="$(device_rows | awk -F'\t' -v n="$QA_SIM_NAME" '$3==n {print $1; exit}')"
  SIM_WHY="QA_SIM_NAME=$QA_SIM_NAME"
  [[ -z "$SIM_UDID" ]] && { echo "ERROR: no simulator named '$QA_SIM_NAME'" >&2; exit 64; }
else
  while IFS=$'\t' read -r udid state name; do
    [[ "$state" == "Booted" ]] || continue
    if has_app "$udid"; then
      SIM_UDID="$udid"; SIM_WHY="already booted with the app: $name"; break
    fi
  done < <(device_rows)

  if [[ -z "$SIM_UDID" ]]; then
    candidate="$(device_rows | awk -F'\t' -v n="$DEFAULT_SIM_NAME" '$3==n {print $1; exit}')"
    if [[ -n "$candidate" ]] && has_app "$candidate"; then
      SIM_UDID="$candidate"; SIM_WHY="default device: $DEFAULT_SIM_NAME"
    fi
  fi

  if [[ -z "$SIM_UDID" ]]; then
    while IFS=$'\t' read -r udid state name; do
      if has_app "$udid"; then
        SIM_UDID="$udid"; SIM_WHY="only device carrying the app: $name"; break
      fi
    done < <(device_rows)
  fi
fi

if [[ -z "$SIM_UDID" ]]; then
  echo "ERROR: $BUNDLE_ID is not installed on any simulator — there is nothing to run." >&2
  echo "       Build it once (Debug, not Release):  npx expo run:ios" >&2
  exit 69
fi
echo "[lfa:dev] Simulator $SIM_UDID — $SIM_WHY"

# 3. Boot it if it isn't already.
if xcrun simctl list devices | grep -q "$SIM_UDID) (Booted)"; then
  echo "[lfa:dev] Already booted."
else
  echo "[lfa:dev] Booting..."
  xcrun simctl boot "$SIM_UDID" 2>/dev/null || true
fi
open -a Simulator

# 4. Start Metro from THIS checkout unless one already serves this port.
if curl -fs "http://127.0.0.1:${PORT}/status" 2>/dev/null | grep -q "packager-status:running"; then
  echo "[lfa:dev] Metro already running on :${PORT} — verify it serves THIS checkout: $REPO_DIR"
else
  echo "[lfa:dev] Starting Metro on :${PORT} (logs: /tmp/qa-metro.log)..."
  nohup npx expo start --dev-client --port "$PORT" > /tmp/qa-metro.log 2>&1 &
  for i in $(seq 1 30); do
    sleep 2
    if curl -fs "http://127.0.0.1:${PORT}/status" 2>/dev/null | grep -q "packager-status:running"; then
      break
    fi
    [[ $i -eq 30 ]] && { echo "ERROR: Metro didn't come up; see /tmp/qa-metro.log" >&2; exit 69; }
  done
fi

# 4b. CLEAR A STRANDED DEV-HARNESS RECEIPT — item 62, 2026-08-13, seat `device`.
#
# THE FAILURE THIS REMOVES, REPRODUCED AND THEN FIXED THE SAME PASS. Sam pastes
# the one command and the app opens on **"The app did not start —
# DevE2EClock reload mismatch: clock receipt has no active checkpoint"**, not on
# his program. It is not a product bug and it is not his to diagnose: a Maestro
# run writes a DURABLE clock receipt, its checkpoint is cleared at the end of the
# run, and `restoreDevE2EClockBeforeHydration` (`devE2EClockPersistence.ts:108`)
# throws on exactly `receipt && !checkpoint && !scenarioSession`.
#
# MEASURED, NOT INFERRED — the simulator's own AsyncStorage manifest held
# `dev-e2e-clock-receipt-v1` and NO `dev-e2e-checkpoint-v2`, which is that
# condition character for character. The law registry already records this as the
# white screen Sam hit at 19:22 after a rebuild; the refusal surface made it
# speak, and this makes it stop happening.
#
# ⚠ IT REMOVES ONLY `dev-e2e-*` KEYS, AND ONLY WHEN THEY ARE STRANDED. The
# athlete's world — `program-store`, `profile-store`, `calendar-storage` and the
# rest — is never touched, because wiping a week to fix a harness is how a
# "reset" becomes the thing nobody dares run. A coherent harness state (both
# halves present, i.e. a real seeded session) is left ALONE.
CONTAINER="$(xcrun simctl get_app_container "$SIM_UDID" "$BUNDLE_ID" data 2>/dev/null || true)"
MANIFEST="$CONTAINER/Library/Application Support/$BUNDLE_ID/RCTAsyncLocalStorage_V1/manifest.json"
if [[ -n "$CONTAINER" && -f "$MANIFEST" ]]; then
  CLEARED="$(node -e "
    const fs = require('fs');
    const p = process.argv[1];
    let m; try { m = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { process.exit(0); }
    const receipt = 'dev-e2e-clock-receipt-v1' in m;
    const checkpoint = 'dev-e2e-checkpoint-v2' in m;
    if (!receipt || checkpoint) process.exit(0);
    const dead = Object.keys(m).filter((k) => k.startsWith('dev-e2e-'));
    for (const k of dead) delete m[k];
    fs.writeFileSync(p, JSON.stringify(m));
    process.stdout.write(dead.join(', '));
  " "$MANIFEST" 2>/dev/null || true)"
  if [[ -n "$CLEARED" ]]; then
    xcrun simctl terminate "$SIM_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
    echo "[lfa:dev] Cleared a STRANDED dev-harness receipt (a Maestro run left it behind):"
    echo "[lfa:dev]   $CLEARED"
    echo "[lfa:dev] Your training data was not touched."
  fi
fi

# 5. Launch the app. This is the step that makes the command's name true.
echo "[lfa:dev] Launching $BUNDLE_ID..."
xcrun simctl launch "$SIM_UDID" "$BUNDLE_ID"

echo
echo "[lfa:dev] Running. To reset to a deterministic week:"
echo "  E2E_METRO_URL=http://127.0.0.1:${PORT} scripts/dev-e2e/run-maestro-ios.sh \\"
echo "    .maestro/common/reset-seed.yaml -e SEED_ID=standard-in-season-week"
echo
echo "Never bare \`maestro test\` — that crash is already recorded."
echo "Rules: docs/QA_RUNBOOK.md · Test surface: docs/SUPPORTED_ATHLETE_ACTIONS.md"
