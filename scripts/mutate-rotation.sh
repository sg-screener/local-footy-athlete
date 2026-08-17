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

OWNER=src/rules/exerciseRotation.ts
COMPOSER=src/rules/composeWeek.ts
COVERAGE=src/rules/sessionSlotCoverage.ts

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
restore() {
  cp "$BACKUP_DIR/owner.ts" "$OWNER"
  cp "$BACKUP_DIR/composer.ts" "$COMPOSER"
  cp "$BACKUP_DIR/coverage.ts" "$COVERAGE"
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

# 1. A RETAINED BLOCK CONSUMES A ROTATION TURN — the cursor advances anyway, so
#    the candidate list is walked with a hole and Trap Bar becomes unreachable.
mutate "a retained block consumes a rotation turn" \
  "    if (mayRetain) {
      lastWasRetention = true;
      reason = 'progressed_from_own_history';
      continue;                         // identity unchanged, cursor unchanged
    }" \
  "    if (mayRetain) {
      lastWasRetention = true;
      reason = 'progressed_from_own_history';
      cursor = (cursor + 1) % ordered.length;
      continue;
    }"

# 1b. The cursor never advances at all — the control for the mutation above.
mutate "the cursor never advances" \
  "    cursor = (cursor + 1) % ordered.length;
    selected = ordered[cursor];
    lastWasRetention = false;" \
  "    selected = ordered[cursor];
    lastWasRetention = false;"

# 2. Every slot becomes retention-eligible — single-leg and accessories stop
#    rotating at each new block (Sam's ruling 2).
mutate "single-leg and accessory slots become retention-eligible" \
  "    const mayRetain = inputs.retentionEligible" \
  "    const mayRetain = true"

# 3. The two-block maximum is removed.
mutate "the two-block maximum is removed" \
  "      && !lastWasRetention              // the two-block maximum" \
  "      && true"

# 4. A pin outranks the two-block maximum.
mutate "a pin outranks the two-block maximum" \
  "      && !lastWasRetention              // the two-block maximum" \
  "      && (!lastWasRetention || pins.has(selected))"

# 5. Retention ignores the recorded history and always keeps the lift.
mutate "retention ignores history and always keeps the lift" \
  "      && progressed.has(selected);      // the EXISTING progression decision" \
  "      && true;"

# 6. The pin bias is dropped entirely.
mutate "the pin bias is dropped" \
  "  if (pinned.length === 0) return [...candidates];" \
  "  return [...candidates];"

# 7. The empty-slot refusal is replaced by a silent invention.
mutate "an empty legal list silently invents a row instead of throwing" \
  "  if (ordered.length === 0) {
    throw new Error(" \
  "  if (false) {
    throw new Error("

# 8. THE EXPERIENCE GATE IS IGNORED — regressions reach an experienced athlete.
mutate_in "$COMPOSER" "the experience gate is not consumed" \
  "  return admitted.length > 0 ? admitted : candidates;" \
  "  return candidates;"

# 9. THE EXPERIENCE GATE BECOMES A REFUSAL — ruling 6's fallback is removed, so a
#    bodyweight-only athlete loses their only legal squat.
mutate_in "$COMPOSER" "the experience gate refuses instead of falling back" \
  "  return admitted.length > 0 ? admitted : candidates;" \
  "  return admitted;"

# 10. HINGE PRIORITY IS DROPPED — conventional Deadlift returns to the front.
mutate_in "$COMPOSER" "hinge priority is dropped" \
  "  if (slot !== 'hinge') return candidates;" \
  "  return candidates;"

# 11. RETENTION IS OPENED TO EVERY COUNTING SLOT — single-leg stops rotating.
mutate_in "$COMPOSER" "single-leg slots become retention-eligible" \
  "      const retentionEligible = MAIN_BILATERAL_SLOTS.has(slot);" \
  "      const retentionEligible = slotCountsTowardSetBudget(slot);"

# 12. PHASE PRIORITY IS IGNORED — the in-season hinge rejoins the ordinary
#     rotation and RDLs get dropped at the cap.
mutate "the phase anchor is ignored" \
  "  if (inputs.phaseAnchored) {" \
  "  if (false) {"

# 13. THE PHASE ANCHOR OUTRANKS THE ATHLETE'S PIN — ruling order 2 before 3 is
#     inverted, so an explicit preference stops being honoured in-season.
mutate "the phase anchor outranks the athlete's pin" \
  "  const ordered = pinnedFirst(inputs.legalCandidates, inputs.pinnedIdentities);" \
  "  const ordered = inputs.phaseAnchored ? [...inputs.legalCandidates] : pinnedFirst(inputs.legalCandidates, inputs.pinnedIdentities);"

# 14. THE PHASE ANCHOR IS APPLIED IN EVERY PHASE — pre/off-season lose the
#     broader main-lift rotation.
mutate_in "$COMPOSER" "the phase anchor is applied in every season" \
  "  return seasonPhase === 'In-season' && slot === 'hinge';" \
  "  return slot === 'hinge';"

# 15. SINGLE-LEG RDL IS COUNTED AS THE BILATERAL HINGE. The authored law is that
#     a unilateral lift fills its single-leg slot and NOT the bilateral one; this
#     removes the separation so a Single-Leg RDL claims the heavy-hinge exposure.
#     (An earlier version of this mutation added `single_leg_hip` to the
#     retention set instead and reddened NOTHING — with a one-exercise pool,
#     retention eligibility there changes no identity. Inert, not uncaught.)
mutate_in "$COVERAGE" "Single-Leg RDL counts as the bilateral hinge" \
  "      if (unilateral) out.push('single_leg_hip');
      else out.push('hinge');" \
  "      out.push('hinge');"

restore
echo ""
echo "=================== TREE RESTORED ==================="
npm run test:exercise-rotation 2>/dev/null | grep -E "passed=|^  FAIL"
