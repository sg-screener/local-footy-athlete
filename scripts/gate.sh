#!/usr/bin/env bash
# gate.sh — run a command, tee its output, and write the LITERAL exit line
# to a file. Stage 1 item 1 of docs/PARALLEL_GATE_SHADOW_UNIT_2026-08-07.md.
#
# WHY THIS EXISTS. Two measurement defects in one unit, both the same shape:
# a pipeline reports the exit status of its LAST stage, so
# `npm run test:x 2>&1 | tail` prints TRUE_EXIT=0 over a red suite; and a
# completion notification has reported exit 0 on a run that exited 1 five or
# more times. A gate that can lie about its own result is not a gate.
#
#   scripts/gate.sh <log-file> <command...>
#
# Exits with the COMMAND's status, never the tee's. Read the last line of
# <log-file> for the verdict; nothing else in this repo is evidence of one.
set -uo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: scripts/gate.sh <log-file> <command...>" >&2
  exit 2
fi

LOG="$1"
shift
mkdir -p "$(dirname "$LOG")"

"$@" 2>&1 | tee "$LOG"
# PIPESTATUS[0] is the command's status. ${PIPESTATUS[*]} would be tee's.
EXIT="${PIPESTATUS[0]}"

printf 'GATE_EXIT=%s CMD=%s\n' "$EXIT" "$*" | tee -a "$LOG"
exit "$EXIT"
