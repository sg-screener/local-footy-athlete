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
restore() {
  cp "$BACKUP_DIR/owner.ts" "$OWNER"
  cp "$BACKUP_DIR/composer.ts" "$COMPOSER"
}
cleanup() { restore; rm -rf "$BACKUP_DIR"; }
trap cleanup EXIT

run_reds() {
  npm run test:exercise-rotation 2>/dev/null | grep -E "^  FAIL" | sed 's/^  FAIL /    RED: /'
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

# 1. The cadence is keyed by something that moves inside a block.
mutate "the cadence advances inside a block (the original weekly defect)" \
  "  return Math.max(0, blockNumber - 1) % length;" \
  "  return Math.max(0, blockNumber * 3 - 1) % length;"

# 2. Every slot becomes retention-eligible — single-leg and accessories stop
#    rotating at each new block (Sam's ruling 2).
mutate "single-leg and accessory slots become retention-eligible" \
  "  if (!inputs.retentionEligible) return rotated('accessory_cadence');" \
  "  if (false) return rotated('accessory_cadence');"

# 3. The two-block maximum is removed.
mutate "the two-block maximum is removed" \
  "  if (retainedLastBlock) return rotated('two_block_maximum_reached');" \
  "  if (false && retainedLastBlock) return rotated('two_block_maximum_reached');"

# 4. A pin outranks the two-block maximum.
mutate "a pin outranks the two-block maximum" \
  "  const retainedLastBlock = inputs.blockNumber >= 3" \
  "  const retainedLastBlock = !pins.has(previousCadence) && inputs.blockNumber >= 3"

# 5. Retention ignores the recorded history and always keeps the lift.
mutate "retention ignores history and always keeps the previous lift" \
  "  if (progressed.has(previousCadence)) {" \
  "  if (true || progressed.has(previousCadence)) {"

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

restore
echo ""
echo "=================== TREE RESTORED ==================="
npm run test:exercise-rotation 2>/dev/null | grep -E "passed=|^  FAIL"
