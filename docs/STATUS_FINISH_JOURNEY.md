# STATUS — seat `finish-journey`

Claimed 2026-08-19. Name checked against `docs/STATUS_*.md`; `FINISH_JOURNEY`
was free. Branch `codex/finish-journey`, isolated worktree based on
`main @ 20cb1422`.

Mission: finish one legal athlete's production journey in this order:

1. canonical onboarding/profile answers survive close/reopen;
2. production session completion and logged results persist;
3. restart reproduces the same accepted program, results, exclusions and decisions;
4. rollover consumes that history, progresses or holds loads under the approved
   contract, rotates legally, and preserves athlete decisions;
5. anything the athlete still cannot see becomes an exact Product-lane handoff.

Owned boundaries are the non-Coach store/journey files and the completion,
history, progression and rollover utilities/tests named in the delegation. Screen,
component, navigation, Coach, dev-e2e, Maestro, programming-composer/scheduler and
`services/api/generateProgram.ts` files are excluded.

## RESULT — THE COMPLETE PRODUCTION-DOOR JOURNEY IS HELD

The existing `test:athlete-journey` tape is the instrument. It starts from a
cold local-storage world, installs Block One through the onboarding door, walks
all 28 calendar dates, records the sessions the generated block really contains,
types real loads, substitutes through the accepted-state door, stores an
exclusion, records soreness, kills and rebuilds the app state, rolls into Block
Two through the production owner, then accepts and declines the optional-session
question in separate worlds. No second simulator and no hand-built store fixture
was added.

Final tape: **64 assertions passed, 0 failed**. The previous tape was 58/0; the
six added assertions are exact boundary comparisons, not new behaviour.

### OPTIONS WEIGHED BEFORE EDITING

1. Incrementally add exact relaunch and visible-week assertions to the existing
   complete-athlete journey.
2. Add another journey runner or a persisted derived-program snapshot as a new
   source of truth.

Option 1 won: the existing tape already drives the production doors and the
canonical stores already contain every allowed input, decision, fact and result.
Option 2 would duplicate the runner and, for a persisted program mirror, violate
the lane's explicit storage boundary without removing any class of bug. The only
small redesign was to expose the app's typed session components on the existing
visible-day snapshot, replacing the false proxy “day has any rows”.

### 1. CANONICAL PROFILE INPUTS

The tape now snapshots the whole canonical `profileStore.onboardingData` object
and `isOnboardingComplete`, then compares them after both the same-block process
death and the Block Two process death. The Block Two comparison also binds the
restored object to the original legal athlete answer object, so corruption during
an earlier relaunch cannot become the new expected value.

Measured in this world: every onboarding/profile field is byte-equal after both
relaunches; onboarding remains complete.

### 2. COMPLETION AND ACTUAL RESULTS

The same athlete records **19 distinct feedback dates**, including **7 distinct
dates with strength logs** and **24 typed load entries across those 7 dates**.
The tape snapshots `sessionFeedback` and `weightOverrides` and proves the exact
objects return after both relaunches. The focused ownership tape is also green:
`test:results-persist` **5/0**.

### 3. RESTART IDENTITY

One assertion compares this whole accepted-input envelope before and after the
same-block relaunch; three assertions compare it again after the Block Two
relaunch:

- canonical profile plus completed-onboarding decision;
- session feedback plus typed weight overrides;
- active exclusions plus decision-ledger entries.

The existing journey assertions separately compare accepted program, visible
week, soreness reduction/explanation, substitution/exclusion, and the extra-
session accept/decline outcomes after relaunch. `test:profile-rehydration-cannot-unfinish`
is **5/0** and `test:block-two-boot-preservation` is **20/0**.

### 4. BLOCK TWO USES THE COMPLETED HISTORY

The real rollover sees **7 completed strength dates against the accepted
requirement of 8** and qualifies at the 75% boundary; the deliberately stale
request of 12 does not qualify. The visible/reloaded result includes:

- `Leg Press` **111 → 113.5 kg**;
- `RDLs` **80 → 82.5 kg**;
- `Single-Arm Lat Pulldown` **30 → 32.5 kg**;
- **7 of 9 distinct prior strength exercises rotate**;
- unseen lifts use their own estimates/bodyweight rather than inheriting another
  exercise's result;
- the active exclusion and athlete decisions remain exact across the boundary.

Adjacent instruments: `test:block-two-progression` **38/0**,
`test:block-two-difficult-missed` **88/0**, and
`test:block-two-boot-preservation` **20/0**.

### 5. THE OPTIONAL SESSION MEASUREMENT WAS GREEN AND EMPTY; IT IS NOT NOW

The old tape rolled into Block Two but kept the clock and visible-week query in
Block One. The current program no longer contained that old week, so before,
after and after-restart all compared as `[]`; the commitment check passed while
the athlete boundary was never observed.

The tape now rolls over at the new block start, queries the new block, and counts
typed `strength` components through the app's own `getSessionComponents` owner.
The accept world measures **2 strength days → 3 → 3 after relaunch** and compares
the complete non-empty visible week after relaunch. The decline world remains
**2 → 2 → 2** and is not asked again.

## MUTATION RECEIPTS — EVERY NEW CLAIM WAS SEEN RED

All mutants were applied one at a time, run through `test:athlete-journey`, then
restored; the production tree is clean.

| mutation | observed red |
| --- | --- |
| force every visible day's typed components to `[]` | non-vacuity and visible-strength acceptance assertions red |
| overwrite the hydrated profile first name | exact canonical-profile assertion red |
| discard persisted `weightOverrides` during program-store merge | same-block exact envelope assertion red |
| discard hydrated exclusions | same-block envelope, Block Two exclusion, and visible-program assertions red |
| discard hydrated decision-ledger entries | same-block envelope and the accept/decline not-re-asked assertions red |

## EXACT PRODUCT-LANE HANDOFF

The offer card says **“Add one session”** / **“add one session each week”**. In
the legal measured world the athlete already has a conditioning-only Friday.
Accepting does not create another training date: it changes Friday into a combined
strength + conditioning day. The ruled commitment does increase from two to
three strength sessions and persists correctly, but the visible wording does not
tell the athlete that the added strength work will share an existing training
day. Product owns whether the card needs a day/component preview or narrower
wording. No screen or copy file was touched by this lane.

## PRE-EXISTING REDS / INSTRUMENT HANDOFFS

These are present at starting checkpoint `20cb1422`; this lane did not absorb or
rewrite them:

- `test:exercise-exclusions` is **52/1**. Its only red expects a legacy bare-name
  exclusion to be migrated into `until_changed`; current canonical exclusions
  survive the real journey exactly. Adding compatibility logic would contradict
  this mission's instruction to remove obsolete owners rather than preserve them.
- `test:block-two-ladder` is **49/3**. Its three cells still require combined
  days to be discarded as ambiguous. The later 2026-08-18 production change at
  `56eff993` deliberately counts separately answered combined strength and
  conditioning components, which is the only way the real extra-session offer
  becomes reachable. The current source comment records that later Sam ruling,
  while R-101's older registry text and the ladder cells still state the former
  interpretation. This is a ruling/guard conflict, not a production change made
  by this lane.
- `test:block-two-extra-session` reaches one failing clubless-preseason assertion,
  then throws because its screen call receives a null model. The same base throw
  is already recorded in `STATUS_RESTART` and `STATUS_VISIBLE`. Screen and this
  glass harness are outside the lane; the production-door journey's non-empty
  accept and decline worlds pass.
- `test:program-control-durable` is **18/2** and calls removed
  `validateWorkoutAgainstActiveConstraints`; its existing short-on-time fixture
  is outside this journey slice and is recorded as baseline red in prior statuses.
- `test:onboarding-reliability` is **23/1** because its source parser does not
  resolve `BLOCK_SELECTION_HISTORY_KEY` as a persist-store name. The journey
  proves the store writes 36 selection records at install and rollover consumes
  them; this is a parser/instrument gap.
- `test:mid-block-restart` reaches its conservation checks, then throws on the
  removed `validateLiveProgramWrite` export. It also prints 0 install-time block
  selections in its own pre-season world, versus 36 in the complete journey;
  that harness needs repair before its count can be treated as journey evidence.
- `test:compile` is broadly red in this worktree while using the main checkout's
  dependency tree; no new type error is attributable to the two changed journey
  test files. Runtime tapes above are the verified instruments for this slice.

## NOT COVERED

- No physical-device or glass claim. Process-death/relaunch is the existing
  production-store bootstrap tape, not an iPhone run.
- No screen, component, navigation, Coach, dev-e2e, Maestro, programming-owner,
  composer/scheduler or `generateProgram.ts` file was edited.
- Product has not yet adjudicated or rendered the optional-session day/component
  preview described above.
- The conflicting combined-day ladder guard and newer production ruling have not
  been reconciled in the registry by this lane.

Agent: finish-journey
