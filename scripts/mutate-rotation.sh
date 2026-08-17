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

restore() { git checkout -- "$OWNER"; }
trap restore EXIT

run_reds() {
  npm run test:exercise-rotation 2>/dev/null | grep -E "^  FAIL" | sed 's/^  FAIL /    RED: /'
}

mutate() {
  local label="$1" find="$2" repl="$3"
  echo ""
  echo "── MUTATION: $label"
  restore
  python3 - "$OWNER" "$find" "$repl" <<'PY'
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

# 1. Main lifts keyed by the WEEK again — the original defect, restored.
mutate "main lifts rotate weekly again (the original defect)" \
  "  if (args.isMainLift) return block % args.length;" \
  "  if (args.isMainLift) return (block * WEEKS_PER_BLOCK + Math.max(0, args.weekInBlock - 1)) % args.length;"

# 2. The deload advances the accessory cadence instead of holding it.
mutate "the deload advances the cadence instead of holding the block" \
  "  const heldWeek = args.isDeloadWeek
    ? WEEKS_PER_BLOCK - 1        // the last BUILD week of this block
    : Math.max(1, args.weekInBlock);" \
  "  const heldWeek = Math.max(1, args.weekInBlock);"

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

restore
echo ""
echo "=================== TREE RESTORED ==================="
npm run test:exercise-rotation 2>/dev/null | grep -E "passed=|^  FAIL"
