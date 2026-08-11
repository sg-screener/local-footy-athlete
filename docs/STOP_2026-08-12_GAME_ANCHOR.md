# STOP — THE GAME DAY IS OPEN, AND THE SWEEP CAUGHT THIS UNIT'S OWN TEST

LOOP CHECK `one-predicate-grows-copies-in-other-modules` — **sighting 2, and
this stop is the PAYMENT rather than a new instance.** Eight private answers to
"is this the athlete's game day?" collapsed onto one owner with a chain gate
over it. **DISPOSITION: compressed, not iterated.**

**And a correction to the compression that was reached for first.** The
`LAW-computed-must-be-consumed` gate proposed in `HOW_TO_BUILD_THIS_APP` §4
would **NOT** have caught this class, and saying so is worth more than adding a
sighting to it. That gate hunts values computed and read by NOBODY. These eight
values were all consumed — enthusiastically, by eight different readers who each
answered the question their own way. **"Computed and unread" and "computed eight
times over" are different diseases and want different instruments.** A third
sighting of THIS shape needs a duplicate-predicate gate, which does not exist.

**Order:** `docs/HOW_TO_BUILD_THIS_APP_2026-08-12.md` §5 items 1 and 2. **Both
landed**, in `06401d92`. Full detail: `docs/GAME_ANCHOR_BOUNDARY_2026-08-12.md`.

## THE SWEEP

`SWEEP RESULT: label=gameanchor-final2 failures=14 of 190`.

**ZERO NEW REDS, AND ZERO SUITES NEWLY GREEN — the failing set is IDENTICAL to
the baseline, name for name**, verified by diffing the two files rather than
comparing the two totals (`a-red-count-is-a-claim-too`):
`diff <(sort .sweep/fails-craft-tier-final.txt) <(sort .sweep/fails-gameanchor-final2.txt)`
is empty. **189 → 190 is this unit's own suite joining the chain**, not a suite
appearing from nowhere; a total that moved without that explanation would be the
finding.

**TWO HONESTIES ABOUT THIS ARM.** Its printed `SWEEP WORLD` line says
`head=be69d51d`, because the run began before the work was committed — **the
TREE it measured is the one that became `06401d92`**, and the preamble prints
the HEAD, not the tree. And it is the SECOND arm: the first was discarded, not
massaged (see §1 below).

Baseline for comparison is the 14 recorded at `bc3700fb`
(`.sweep/fails-craft-tier-final.txt`): `legacy-census`, `totals-or-red-law`,
`worn-world-boot`, `onboarding-field-influence`, `action-walker`,
`action-walker:deep`, `device-pass-2026-08-05`(+evening), `fixture-identity`,
`operation-ownership`, `fact-door-inputs`, `dev-e2e-seeds`,
`dev-e2e-scenario-session`, `law-registry`.

`test:game-anchor` — **14 cells, 14 passed**, inside the chain, and
**mutation-tested twice**: restoring the Fri/Sat/Sun allowlist reds the cell
that names all four silenced days; pointing the boot re-seed back at a single
field reds the relaunch cell. Typecheck gate **PASSED**. Law registry
**95 rows/63 guarded → 96/64**, UNENFORCED unmoved at 32.

## WHAT THE INSTRUMENTS CAUGHT THAT NOBODY ORDERED

1. **`test:profile-mirror-narrowing` went red on THIS UNIT'S OWN TEST** — a
   baseline-green suite, so a genuinely new red. The relaunch cell reached the
   world with `setState({ onboardingData })`, copied from `quiescentBootTests`,
   which declares exactly that as debt in a census the gate keeps EXACT. **Fixed
   by obeying the one-door law, not by joining the debt list.** The first full
   arm was discarded and re-run: a sweep measured against a tree that has since
   changed is not a measurement.
2. **`test:compile` was RED at HEAD and NO SWEEP CAN SEE IT.**
   `scripts/sweep.sh` filters `test:compile` out of the chain by construction,
   so a typecheck regression is invisible to the "N of 189" number every stop
   report — including this one — quotes. `section18CraftTierTests.ts` arrived
   with `2db1b8ce` missing a required field and was never added to the typecheck
   baseline. **One line cleared, receipt at the site. THE INSTRUMENT GAP IS THE
   FINDING and is NOT fixed.**
3. **`docs/SEAT_INBOX.md` was corrupted by a concurrent seat write**, landing
   inside STAND-DOWN B's sentence — the stand-down whose whole job is to stop a
   question reaching Sam for a fourth time. Repaired, content unchanged (six
   M-items, eight orders, every section present). **`test:seat-inbox-hook` and
   `test:repo-law-guards` both read the broken file and passed.** Nothing
   detects a mid-sentence splice, and the inbox's own parallel-agent warning
   names the git index and the test chain but not this file.

   **AND THE REPAIR WAS ITSELF WRONG — the seat caught it within the hour, and
   this is the more useful half of the finding.** The rescued block was given a
   `## ` heading; `scripts/seat-inbox-hook.sh` bounds its scan at the next `## `,
   so **every order below it went invisible to the stop hook.** Masked only
   because items 1-8 sat above it. **Repairing by hand a file that has a parser,
   without reading the parser, is the same class of mistake as the corruption.**
   Sub-headings under `## Unprocessed` must be `###`. A guard cell is owed.

   **THE CHECKOUT ALSO CHANGED BRANCH MID-COMMIT.** By the time this report was
   staged, HEAD had moved to `codex/program-week-navigation-bounds` (branched
   from `06401d92`) with another agent's work staged in the shared index. The
   staging was reverted off their index and this commit was written to `main`
   with plumbing, touching neither their index nor their working tree.
   **`git branch --show-current` before every commit is not paranoia here.**

## THE FINDING WORTH KEEPING

**Three of the eight copies already accepted all seven days.** The app could
already READ a Wednesday game and could not WRITE one. This was a duplicated
representation, not a missing feature — which is why the fix removes code
instead of adding it, and why **no device migration is owed**: the legacy
`'Varies'` was never a day, it means what `undefined` means, and the owner
parses it to null. Proven by a cell, not argued.

## WHAT THE NEXT SEAT PICKS UP

1. **THE ±7 INVENTION (`HOW_TO_BUILD_THIS_APP` §5 item 3) — NOW MORE REACHABLE,
   NOT LESS.** `section18CraftTier.ts:161` synthesises `previousGameDate =
   fixture-7d` and `nextGameDate = fixture+7d`, and the validator merges them
   into `gameDates` as real games (`weekStructureValidator.ts:255,272`). **A
   midweek athlete can exist for the first time as of `06401d92`**, and an
   irregular fixture list is exactly what that invention gets wrong. It is a
   live correctness defect, not a gap.
2. **THE WAIST (§5 item 4)** — `derivedWeekContract.ts:90`, untouched.
3. **`gameDay` and `usualGameDay` are still two fields for one fact.** Same type
   now, always written together. Collapsing them is ~20 non-test sites, 278 test
   literals, and it changes onboarding COMPLETENESS for a stored legacy profile.
   Priced as Option B in the boundary report §2.

## NOT COVERED

- **Nothing ran on a device or a simulator.** Athlete-visible, so under Process
  Law L10 this is **"gates green, awaiting Sam device acceptance"**, never
  "done". What Sam should check is the `⚠ SAM` line in `docs/NOW.md`.
- **`test:qa` was not run for this unit.**
- **The baseline arm was measured over 155 of 189 suites**, not all 189. It
  agreed name-for-name and in order with the 14 recorded at `bc3700fb`; the arm
  was stopped rather than hold the tree idle, and the FINAL arm carries the
  verdict.
- **Whether any real device holds a `'Varies'` profile is still OPEN-UNKNOWN**,
  and no longer matters — §3 of the boundary report explains why, which is why
  no device pass was spent finding out.
- **The quality of a midweek week was not judged.** The cells prove the anchor
  is consumed and the game day is kept clear. A probe showed a Strength session
  on G-1 for BOTH a Wednesday and a Saturday anchor — symmetric, pre-existing,
  and not this unit's to rule on.
- **HEAD moved mid-unit** — the seat committed `7ae0d6f5` and `be69d51d`
  (docs-only) while this was being built. The final arm ran at `06401d92`, the
  baseline at `bc3700fb`.
- **`docs/LFA_SYSTEM_ATLAS_CLAUDE_HANDOFF_2026-08-12.docx` was left
  uncommitted** — a binary artifact is the seat's call to commit, not this
  terminal's.

**NORTH STAR: toward.** Eight representations of one question become one; a
four-value enum and a seven-value type become one type; two weekday lists and
two day-number tables become one each. Nothing new is stored.
