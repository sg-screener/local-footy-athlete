#!/usr/bin/env bash
#
# THE COMPLETION GATE — nothing is called finished until the right checks pass.
# Sam approved this 2026-08-12 as step 2 of three; the proposal and the
# measurement behind it are docs/STOP_2026-08-12_COMPLETION_GATE_PROPOSAL.md.
#
# TOOLING ONLY. It runs commands that already exist in package.json and changes
# no app behaviour.
#
# IT LIVES IN `scripts/`, NOT `.claude/hooks/`, because `.claude/` is gitignored
# in this repo — the existing Stop hook already splits the same way: its script
# is `scripts/seat-inbox-hook.sh` (tracked, reviewable) and only the WIRING sits
# in `.claude/settings.json` (local, per-machine). A hook script nobody can read
# in a diff is not a shared instrument. Exit 2 blocks completion and the reason goes back to the
# agent; exit 0 lets it through.
#
# WHY THESE COMMANDS AND NOT THE ONES THE ORDER NAMED. A gate that calls a RED
# command blocks every completion forever, so each candidate was run first:
#
#   npm run typecheck           RED    459 errors, the weak config
#   npm run test:compile        GREEN  the RATCHET over those same errors
#   npm run test:qa             RED    84 pre-existing failures
#   npm run test:law-registry   RED    deliberate — Sam's stop-the-line ruling
#   npm run test:rules-kernel   GREEN
#   npm run test:repo-law-guards GREEN
#
# `test:compile` is not a substitute for the typecheck; it is the instrument
# this repo built for exactly this job — a file may improve but never get worse,
# and a file with no baseline entry may have no errors at all. Failing on NEW
# drift while ignoring a documented backlog is what a completion gate wants.
# Sam ruled "proxies" on 2026-08-12.
#
# `test:law-registry` is NEVER wired in. Its red is a ruling, not a fault.
#
# THE CHANGED-FILE LIST COMES FROM GIT, NOT FROM THE HOOK PAYLOAD, and that is
# deliberate: the payload's shape is undocumented here and a gate that silently
# reads the wrong field would pass everything while looking strict. Git is the
# same question asked of something that cannot be wrong about it.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 0

# Uncommitted work first; if the agent already committed, judge that commit.
CHANGED="$(git --no-optional-locks diff --name-only HEAD 2>/dev/null)"
if [ -z "$CHANGED" ]; then
  CHANGED="$(git --no-optional-locks diff --name-only HEAD~1 HEAD 2>/dev/null)"
fi
# Untracked files are changes too — a brand-new rules file is exactly the case
# a completion gate must not miss.
UNTRACKED="$(git --no-optional-locks ls-files --others --exclude-standard 2>/dev/null)"
CHANGED="$(printf '%s\n%s\n' "$CHANGED" "$UNTRACKED" | sed '/^$/d' | sort -u)"

# NOTHING CHANGED IS NOT A FAILURE. A conversational turn has nothing to prove.
[ -z "$CHANGED" ] && exit 0

# ── Which checks does this change earn? ───────────────────────────────────
CHECKS=""
add() { case " $CHECKS " in *" $1 "*) ;; *) CHECKS="$CHECKS $1" ;; esac; }

if printf '%s\n' "$CHANGED" | grep -qE '\.tsx?$'; then
  add "test:compile"
fi
if printf '%s\n' "$CHANGED" | grep -qE '^src/(rules|store)/'; then
  add "test:repo-law-guards"
fi
# Generation, repair, scheduling and coaching — the kernel the order's "full
# scenario suite" is really protecting. `test:qa` itself is red and cannot gate.
if printf '%s\n' "$CHANGED" | grep -qE '^src/rules/section18|^src/utils/coachingEngine\.ts$|^src/rules/derivedWeekContract\.ts$|^src/utils/fixtureMinimalReplan\.ts$|^src/rules/weekStructureValidator\.ts$'; then
  add "test:rules-kernel"
fi

# DOCS-ONLY AND VISUAL-ONLY CHANGES RUN NOTHING — the order is explicit, and it
# falls out of the rules above rather than needing its own branch: a `.md` edit
# matches no pattern.
[ -z "$CHECKS" ] && exit 0

# ── Run them, and report the FIRST failure with its own words ─────────────
for check in $CHECKS; do
  OUTPUT="$(npm run -s "$check" 2>&1)"
  if [ $? -ne 0 ]; then
    {
      echo "COMPLETION BLOCKED — \`npm run $check\` failed."
      echo
      echo "Changed files that asked for it:"
      printf '%s\n' "$CHANGED" | sed 's/^/  /' | head -20
      echo
      echo "Last 25 lines:"
      printf '%s\n' "$OUTPUT" | tail -25
      echo
      echo "Fix it, or say plainly that you are leaving it red and why."
    } >&2
    exit 2
  fi
done

exit 0
