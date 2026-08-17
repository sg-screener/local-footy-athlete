#!/usr/bin/env bash
# MUTATION RECEIPTS for `src/rules/exerciseRotation.ts`.
#
# A green suite is a claim. Each mutation below breaks ONE clause of the contract
# in the owner and records which cells go red. A mutation that reddens nothing is
# a hole in the suite, not a harmless edit.
#
# The file is restored from git after every mutation, and the suite is re-run
# green at the end to prove the tree came back.
#
# Run: bash scripts/mutate-rotation.sh
set -uo pipefail
cd "$(dirname "$0")/.."

OWNER=src/rules/blockExerciseSelection.ts
COMPOSER=src/rules/composeWeek.ts
COVERAGE=src/rules/sessionSlotCoverage.ts
HISTORY=src/store/blockSelectionHistoryStore.ts

# ⚠ **RESTORE FROM OUR OWN BACKUP, NEVER FROM GIT.**
#
# This script used to `git checkout -- "$OWNER" "$COMPOSER"`, and on 2026-08-17
# that DESTROYED a session's worth of uncommitted work in both files the moment
# it ran: a checkout is a WRITE, and it writes whatever HEAD says over whatever
# you had. The mutation harness must be able to run on a dirty tree, because the
# whole point is to mutate code you are still writing.
BACKUP_DIR="$(mktemp -d)"
cp "$OWNER" "$BACKUP_DIR/owner.ts"
cp "$COMPOSER" "$BACKUP_DIR/composer.ts"
cp "$COVERAGE" "$BACKUP_DIR/coverage.ts"
cp "$HISTORY" "$BACKUP_DIR/history.ts"
restore() {
  cp "$BACKUP_DIR/owner.ts" "$OWNER"
  cp "$BACKUP_DIR/composer.ts" "$COMPOSER"
  cp "$BACKUP_DIR/coverage.ts" "$COVERAGE"
  cp "$BACKUP_DIR/history.ts" "$HISTORY"
}
cleanup() { restore; rm -rf "$BACKUP_DIR"; }
trap cleanup EXIT

# ⚠ **A SUITE THAT DIES REPORTS ZERO FAILURES.** Removing the experience gate's
# ruling-6 fallback makes generation REFUSE outright, so the suite crashed, wrote
# no `FAIL` lines, and this harness read that as "nothing went red" — the exact
# opposite of the truth. So the totals line is checked first: no totals means the
# mutation KILLED the suite, which is the loudest red there is.
run_reds() {
  local out
  out="$(npm run test:exercise-rotation 2>&1)"
  if ! grep -qE "passed=[0-9]+ failures=[0-9]+" <<<"$out"; then
    echo "    RED (SUITE KILLED): the mutation made the suite die before it could report"
    grep -oE "Error: [^\"]{0,110}" <<<"$out" | head -2 | sed 's/^/      /'
    return
  fi
  grep -E "^  FAIL" <<<"$out" | sed 's/^  FAIL /    RED: /'
}

mutate() { mutate_in "$OWNER" "$@"; }

mutate_in() {
  local target="$1" label="$2" find="$3" repl="$4"
  echo ""
  echo "── MUTATION: $label"
  restore
  python3 - "$target" "$find" "$repl" <<'PY'
import sys
path, find, repl = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(path).read()
n = s.count(find)
if n != 1:
    print(f"    !! pattern matched {n} times — mutation NOT applied")
    sys.exit(2)
open(path, 'w').write(s.replace(find, repl))
PY
  if [ $? -ne 0 ]; then return; fi
  local out
  out="$(run_reds)"
  if [ -z "$out" ]; then
    echo "    ⚠ NOTHING WENT RED — the suite does not hold this clause"
  else
    echo "$out"
  fi
}

echo "=================== MUTATION RECEIPTS ==================="

# 1. THE BLOCK-NUMBER CURSOR RESTORED — selection by index instead of by record.
mutate "block-number cursor selection is restored" \
  "    leastRecentlyUsed(phaseOrdered, inputs.recentSelections)," \
  "    phaseOrdered[Math.max(0, inputs.blockNumber - 1) % phaseOrdered.length],"

# 2. PREVIOUS-SELECTION HISTORY DROPPED — the owner stops reading the record.
mutate "previous-selection history is dropped" \
  "  const previousIdentity = inputs.previousSelection?.identity ?? null;" \
  "  const previousIdentity = null;"

# 3. RECENT-USE AVOIDANCE REMOVED — always take the authored first option.
mutate "recent-use avoidance is removed" \
  "  let best = candidates[0];
  let bestAge = blocksSinceLastUse(best, recent);" \
  "  return candidates[0];
  let best = candidates[0];
  let bestAge = blocksSinceLastUse(best, recent);"

# 4. PHASE PREFERENCE IGNORED.
mutate "phase preference is ignored" \
  "  const phaseOrdered = inputs.slot === 'hinge'" \
  "  const phaseOrdered = false"

# 5. IN-SEASON RDL ROTATED MERELY BECAUSE TIME PASSED.
mutate "the in-season anchor is dropped, so RDLs rotate with age" \
  "  if (phasePinsSlot(inputs)) {" \
  "  if (false) {"

# 6. A PIN OVERRIDES ILLEGALITY.
mutate "a pin can reach an illegal exercise" \
  "  const legalPin = phaseOrdered.find((id) => inputs.pinnedIdentities.includes(id));" \
  "  const legalPin = inputs.pinnedIdentities[0];"

# 7. ACCESSORY CADENCE FROZEN — the slot keeps whatever it had.
mutate "the accessory cadence is frozen" \
  "  return decide(
    leastRecentlyUsed(phaseOrdered, inputs.recentSelections),
    'rotated',
    'structured_variety',
  );" \
  "  return decide(previousIdentity, 'retained', 'structured_variety');"

# 8. THE TWO-BLOCK MAXIMUM REMOVED.
mutate "the two-block maximum is removed" \
  "    if (heldTwice) {" \
  "    if (false) {"

# 9. RESTORE-BEFORE-DECIDE DROPPED — a boot re-derives instead of restoring.
mutate "boot re-derives instead of restoring the recorded selection" \
  "  if (recorded !== null && inputs.legalCandidates.includes(recorded)) {" \
  "  if (false) {"

# 10. THE RESTORE IGNORES LEGALITY — an impossible exercise is handed back.
mutate "the restore ignores legality" \
  "  if (recorded !== null && inputs.legalCandidates.includes(recorded)) {" \
  "  if (recorded !== null) {"

# 11. SINGLE-LEG RDL COUNTS AS THE BILATERAL HINGE.
mutate_in "$COVERAGE" "Single-Leg RDL counts as the bilateral hinge" \
  "      if (unilateral) out.push('single_leg_hip');
      else out.push('hinge');" \
  "      out.push('hinge');"

# 12. THE HISTORY CARRIER DROPS ITS ROWS ON WRITE.
mutate_in "$HISTORY" "the history carrier drops the rows it is given" \
  "    const next = [...selections, ...withoutThisBlock];" \
  "    const next = [...withoutThisBlock];"

# 13. RE-RECORDING A BLOCK APPENDS INSTEAD OF REPLACING — one block becomes many.
mutate_in "$HISTORY" "re-recording a block appends instead of replacing" \
  "    const withoutThisBlock = state.selections.filter(
      (entry) => entry.blockStartISO !== blockStartISO,
    );" \
  "    const withoutThisBlock = state.selections;"

# 14. A TEMPORARY SUBSTITUTE BECOMES THE RECORDED SELECTION.
mutate_in "$COMPOSER" "a temporary substitute is recorded as the base selection" \
  "          identity: selection.identity,
        });
      }" \
  "          identity: legal[0],
        });
      }"

# 15. THE DAY-SCOPED EXCLUSION REACHES THE BASE SELECTION.
mutate_in "$COMPOSER" "a today-only exclusion replaces the base block selection" \
  "      const baseLegal = legalUnder(excluded);" \
  "      const baseLegal = legalUnder(excludedToday);"

# 16. THE EXPERIENCE GATE IS NOT CONSUMED.
mutate_in "$COMPOSER" "the experience gate is not consumed" \
  "  return admitted.length > 0 ? admitted : candidates;" \
  "  return candidates;"

# 17. THE EXPERIENCE GATE REFUSES INSTEAD OF FALLING BACK.
mutate_in "$COMPOSER" "the experience gate refuses instead of falling back" \
  "  return admitted.length > 0 ? admitted : candidates;" \
  "  return admitted;"

restore
echo ""
echo "=================== TREE RESTORED ==================="
npm run test:exercise-rotation 2>/dev/null | grep -E "passed=|^  FAIL"
