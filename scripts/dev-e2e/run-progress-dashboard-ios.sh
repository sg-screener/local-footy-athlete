#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${E2E_METRO_URL:-}" ]]; then
  echo "E2E_METRO_URL is required (for example, http://127.0.0.1:8081)." >&2
  exit 64
fi

device_id="${E2E_SIMULATOR_UDID:-}"
if [[ -z "${device_id}" ]]; then
  device_id="$(xcrun simctl list devices booted | sed -nE 's/.*\(([0-9A-F-]{36})\) \(Booted\).*/\1/p' | head -1)"
fi
if [[ -z "${device_id}" ]]; then
  echo "No booted iOS simulator found." >&2
  exit 69
fi

scripts/dev-e2e/run-maestro-ios.sh \
  .maestro/common/reset-coach-snapshot-journey.yaml
xcrun simctl openurl "${device_id}" \
  "localfootyathlete://e2e/coach-snapshot/populate"
scripts/dev-e2e/run-maestro-ios.sh \
  .maestro/golden/progress-dashboard.yaml
scripts/dev-e2e/run-maestro-ios.sh \
  .maestro/golden/coach-simple-shell.yaml
scripts/dev-e2e/run-maestro-ios.sh \
  .maestro/golden/mobility-completion-tick.yaml
