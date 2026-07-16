#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${E2E_METRO_URL:-}" ]]; then
  echo "E2E_METRO_URL is required (for example, http://127.0.0.1:<port>)." >&2
  exit 64
fi

if [[ ! "${E2E_METRO_URL}" =~ ^https?://[^/:]+:[0-9]+/?$ ]]; then
  echo "E2E_METRO_URL must be an explicit http(s) URL with host and port: ${E2E_METRO_URL}" >&2
  exit 64
fi

metro_status="$(curl --fail --silent --show-error "${E2E_METRO_URL%/}/status")"
if [[ "${metro_status}" != "packager-status:running" ]]; then
  echo "Metro status check failed at ${E2E_METRO_URL%/}/status: ${metro_status}" >&2
  exit 69
fi

echo "[DevE2E Metro] Maestro launch URL: ${E2E_METRO_URL}"
exec maestro test -e "E2E_METRO_URL=${E2E_METRO_URL}" "$@"
