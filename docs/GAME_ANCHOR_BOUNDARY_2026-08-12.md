# A GAME CAN BE ON ANY DAY — and the app could already READ a Wednesday game, it just could not WRITE one

LOOP CHECK `enforcement-deferred-then-forgotten` — **not a sighting.** This unit
is the opposite shape: nothing here was computed-and-ignored. The value was
never computed at all, because one allowlist turned a midweek answer into
`undefined` before any consumer saw it. Recorded so the count is not inflated —
`a-count-taken-for-a-record` cuts both ways.

LOOP CHECK `one-predicate-grows-copies-in-other-modules` — **sighting 2**, and
this is the payment. Eight private answers to "is this the athlete's game day?"
had grown across resolver, rules, screens, hooks, boot and the generator.
**DISPOSITION: compress, not iterate.** One owner, `src/rules/gameAnchor.ts`,
and a chain gate that reds on a ninth.

**Order:** `docs/HOW_TO_BUILD_THIS_APP_2026-08-12.md` §5 item 1 (and item 2,
which fell out of the same lines — see §4), on Sam's words, 2026-08-12: *"games
should be able to be placed any day of the week - i can't know when every single
club in aus is going to play a game so I want to be prepared for everything"*.

**Status: BUILT, GATED, MUTATION-TESTED TWICE. Not on a device.**
Athlete-visible, so by Process Law L10 this is **"gates green, awaiting Sam
device acceptance"** — never "done".

---

## §1 WHAT THE DEFECT ACTUALLY WAS — THE WRONG WEEK, NOT A MISSING PREFERENCE

A Tuesday game did not merely fail to be offered.
`resolveEffectiveGameDay` returned `undefined` for anything outside
Friday/Saturday/Sunday, so **every consumer downstream built the week as if
there were no game at all** — no G-1 taper, no G-2 spacing, no G+1 recovery.
An athlete whose club plays midweek got a week that protected nothing, silently.

**MEASURED, and it corrected the seat's own framing while the suite was being
written.** The first draft asserted a `Game` workout in the generated
microcycle. It failed — and so did the control arm. **Generation does not draw a
`Game` for ANY day, Saturday included.** The fixture is virtual and lives at
`effectiveGameDatesAround` / `computeGameDatesForBlock`. Asserting on the
generated week would have been a cell green against the wrong layer. The cell
now reads the two owners that actually produce the athlete's fixtures.

## §2 WHY AN OWNER AND NOT A WIDER ENUM — the two options, compared

**Option A — widen `GameDay` to seven strings, keep everything else.** Smallest
diff. Leaves all eight copies of the predicate and a legacy literal parsed in
nine files, any of which can disagree with the other seven. **Rejected.**

**Option B — delete the `gameDay` field entirely; `usualGameDay` is the only
anchor.** Correct destination, wrong unit: ~20 non-test sites, 278 test
literals, and it changes onboarding COMPLETENESS for a stored legacy profile
(an athlete who is complete today would be bounced back into onboarding).
**Deferred, named in §6.**

**Option C — CHOSEN. One owner.** `GameDay` deleted, `gameDay?: DayOfWeek`, and
one predicate every reader asks. **Three of the eight copies already accepted
all seven days** — `profileSetupChange.storedGameDay`,
`ProfileScreen.dayFromGameFields`, and an inline expression in
`useSeasonPhaseControl`. That is the finding worth keeping: **the app could
already read a Wednesday game and could not write one.** This was a duplicated
representation, not a missing feature, and the north star says remove the
representation.

## §3 NO DEVICE MIGRATION IS OWED, AND THAT IS PROVEN RATHER THAN ASSUMED

`HOW_TO_BUILD_THIS_APP` §5 item 1 closes *"Check for persisted `'Varies'` on
device first — migration may be owed."* **It is not owed.**

`'Varies'` was never a day. It meant "no usual game day", which is exactly what
`undefined` already means. The owner PARSES the stored string — the same shape
`normalizeRoleBucket` already uses for stored positions — so a profile still
holding it resolves to `null` and **behaves precisely as it does today**: no
virtual game, no seeded fixture, nothing lost. A cell asserts this directly, and
a second asserts the dangerous variant: `'Varies'` sitting beside a real
`usualGameDay` must not suppress the real one.

The type is what the app WRITES from now on; the owner is what it READS. Whether
any real device holds a `'Varies'` profile remains OPEN-UNKNOWN and **no longer
matters**, which is why this unit did not spend a device pass finding out.

## §4 ITEM 2 FELL OUT OF THE SAME LINES, AND IS DECLARED RATHER THAN CLAIMED

`HOW_TO_BUILD_THIS_APP` §5 item 2 is the live loss-on-relaunch at
`quiescentBoot.ts:337-338`. It is fixed here, in this unit, and that is stated
plainly instead of being banked as a separate delivery.

**THE SHAPE, now that the cause is visible:** `mapToLegacyGameDay` narrowed the
athlete's answer on the way into storage, so an athlete who told the phase sheet
"Wednesday" had `usualGameDay: 'Wednesday'` and `gameDay: 'Varies'`.
`deriveBootFixtureMarks` wipes every game/noGame mark and re-seeds from the
anchor — **and it read `gameDay` alone.** The wipe happened, the re-seed found
nothing, and the athlete's whole fixture list was gone on next launch.

It could not be fixed without touching the same line the owner replaces, so
splitting it into its own commit would have been ceremony, not honesty.

## §5 WHAT LANDED

- **New owner** `src/rules/gameAnchor.ts` — `DAYS_OF_WEEK`, `isDayOfWeek`,
  `storedGameAnchor`. No imports back into the app; readable from a screen, a
  rule, a store and the node harness alike (a cell holds that).
- **Deleted:** the `GameDay` enum; `mapToLegacyGameDay` and its three call
  sites; the Fri/Sat/Sun allowlist; `GAME_DAY_MAP` (a character-for-character
  duplicate of `DOW_TO_NUM` in the same file); two duplicate weekday lists,
  now aliases.
- **Opened: BOTH pickers, not one.** `HOW_TO_BUILD_THIS_APP` §5 named
  onboarding. The profile sheet had its own three-day list at
  `ProfileScreen.tsx:74`, and it was not in the plan.
- **Fourteen readers** now delegate to the owner.
- **New guard** `test:game-anchor`, in the `test:bible` chain, 14 cells.
- **THE SWEEP CAUGHT THIS UNIT'S OWN TEST, and that is worth recording.** The
  first full arm went red on `test:profile-mirror-narrowing` — a suite in the
  BASELINE-GREEN set, so a genuinely new red. The relaunch cell reached the
  world with `setState({ onboardingData })`, copied from `quiescentBootTests`,
  which declares that as debt in the census. **The one-door law reaches test
  sources and the census is exact, so a suite may not quietly join it.** Fixed
  by obeying the law — the cell now writes through `updateOnboardingData` —
  rather than by adding a row to the debt list. The arm was restarted; a sweep
  measured against a tree that has since changed is not a measurement.
- **New registry row** `LAW-game-anchor-any-day-one-owner`, born `guarded`.
  Registry moved 95/63 → **96 rows, 64 guarded, 32 UNENFORCED** — the unguarded
  count did not move, which is the only direction it may not.

## §6 THE DEBT THIS LEAVES, NAMED

1. **`gameDay` and `usualGameDay` are still two fields for one fact.** After
   this unit they are the same type and always written together. Collapsing
   them is Option B above and carries the onboarding-completeness question.
2. **~18 hand-rolled weekday lists remain** across the app, most of them
   Sunday-first `getDay()` index tables. This unit removed two.
3. **TWO WRITERS IN ONE CHECKOUT CORRUPTED `docs/SEAT_INBOX.md`, and the file
   warns about exactly this.** While this unit was editing order 2, the seat
   inserted its merge-leftovers block **into the middle of STAND-DOWN B's
   sentence** — the two halves of "see AWAITING SAM'S EYE below" ended up 93
   lines apart with a whole section wedged between them. **A stand-down that
   reads as a broken fragment is a stand-down nobody obeys**, and this one exists
   to stop a question being put to Sam for the fourth time. Repaired here:
   the sentence is whole and the seat's block is its own section, content
   unchanged (six M-items, eight orders, every section present).
   **The mechanism, not the incident, is the finding** — the inbox's own "SAFE
   FOR A PARALLEL AGENT" section says two agents in one checkout share a git
   index and a test chain. **It should say they also share this file, and
   nothing detects a mid-sentence splice.** `test:seat-inbox-hook` and
   `test:repo-law-guards` both passed over the corrupted file.
4. **`test:compile` was RED at HEAD and the sweep cannot see it** —
   `scripts/sweep.sh` filters `test:compile` out of the chain by construction.
   `section18CraftTierTests.ts` arrived with `2db1b8ce` missing a required
   `persistenceProvenance` field and was never added to the typecheck baseline.
   **Cleared here in passing, with the receipt in a comment at the site.** The
   instrument gap — a chain suite no sweep measures — is the finding, and it is
   larger than the one-line fix.

## NOT COVERED

- **Nothing ran on a device or a simulator.** Athlete-visible, so this is
  explicitly NOT done under Process Law L10. What Sam should check is in
  `docs/NOW.md`.
- **N games in one week is untouched.** `derivedWeekContract.ts:90` still
  collapses a fixture list to its first entry. That is §5 item 4, the
  architectural one, and this unit deliberately did not start it.
- **The ±7 invention (§5 item 3) is untouched** and is still a live correctness
  defect: `section18CraftTier.ts:161` fabricates neighbouring games the
  validator then trusts as real. **It is now MORE reachable, not less** — a
  midweek athlete can exist for the first time, and an irregular fixture list is
  exactly what that invention gets wrong. **This is the next unit.**
- **Whether a midweek week is GOOD programming was not judged.** The cells prove
  the anchor is consumed and the game day is kept clear. They do not assess the
  quality of what surrounds it, and the probe showed a Strength session on G-1
  for BOTH a Wednesday and a Saturday anchor — symmetric, pre-existing, and not
  this unit's to rule on.
- **The baseline sweep was measured over 155 of 189 suites, not all 189.** It
  agreed name-for-name and in order with the 14-red set recorded at `bc3700fb`
  (`.sweep/fails-craft-tier-final.txt`); the arm was stopped there rather than
  hold the tree idle, and the FINAL sweep is the arm that carries the verdict.
- **`test:qa` was not run for this unit.**
- **HEAD moved under this work** — the seat committed `7ae0d6f5` and `be69d51d`
  (docs-only) mid-unit. The final sweep ran at `be69d51d`, the baseline at
  `bc3700fb`.

**NORTH STAR: toward.** Eight representations of one question become one; a
four-value enum and a seven-value type become one type; two weekday lists become
aliases of one; two duplicate day-number tables become one. Nothing new is
stored — `gameDay` holds the athlete's actual answer instead of a narrowed
version of it.
