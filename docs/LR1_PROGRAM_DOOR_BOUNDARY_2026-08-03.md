# LR-1 — the last store door. Boundary report, 2026-08-03

Branch `feat/lr1-program-store-door`, from main `cef886f`. Recipe:
`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`, all thirteen lessons read and
applied. Scope: `programStore.setManualOverride` — the raw override primitive,
27 references across 13 files — and the census entries it holds open.

**Process compliance (the binding note).** Every command in this unit ran from
`/Users/samgeurts/Documents/local-footy-athlete/.claude/worktrees/lr1-program-door`,
its own worktree, with `pwd` echoed as the first thing in every shell
invocation — including every destructive one. `node_modules` is a symlink to
the primary checkout and was never removed, reinstalled or `git add`-ed; the
commit staged `src` and `package.json` by name, never `-A`. No `git stash`, and
the one `git checkout --` was on a file whose only edit was the mutation being
reverted (every other revert came from scratchpad backups, per the standing
rule).

---

## North star statement

**TOWARD, and this is the entry that closes the class.** No new stored state.
The unit does not add a representation — it removes an unowned WRITE PATH and
replaces it with a named one. `dateOverrides` is the athlete's decision surface,
the one surface the north star says may hold only inputs; until today anything
in the app could assign it anonymously, which is precisely "two owners of one
fact" and "derived content overwriting athlete decisions" waiting to happen.

The unit also produced the north star's own next question, honestly, in §
"What this found" below: `dateOverrides` may now be **partly a derived-output
store** rather than a decision ledger, and nobody had measured that. Naming it
is the convergence step this unit could take; converting it is not this unit's.

---

## What was built

### The door

`applyProgramOverrideSliceWrite` in `programStore.ts` — one owner of the
override slice — with `applyProgramOverrideWrite` as the single-date builder
every caller actually uses.

- **Every writer named.** `ProgramOverrideWriterId` is a CLOSED union of 16
  ids. An unnamed writer is a compile error, which is the "build failure on a
  second writer" LR-1 asked for, enforced by the type system rather than a
  gate.
- **Two typed refusals**, verbatim from the profile door: an empty override map
  written over one holding decisions is `default_over_answered_overrides`
  unless it carries an act that is IN FLIGHT; a stale id is
  `reset_action_not_in_flight`.
- **Reduction is not the wipe** (lesson 3): removing one of two overrides is the
  athlete editing and is never refused. **Removing the LAST one is their change
  too** (lesson 11): `removeManualOverride` opens its own named act when the
  result is empty, so it lands AND says so.
- **Erasure declares itself.** `clearManualOverrides` (the explicit fresh slate)
  writes as `reset` under `override_clear_all`; `clear()` — the store's total
  erasure — opens `program_store_clear` and reports through the same recorder.
- **The tape.** `program_override_write`, applied or refused, joined
  `DECISION_EVENTS` so a §18 repair search cannot evict it from the ring. Counts
  and labels only; the suite hunts the real date and the real workout name it
  acted in and fails if either reached the log. The act travels as
  `erasureActId`, never `resetActionId` (lesson 12).

**Ownership boundary, stated:** the door owns the DECISION, and
`commitAcceptedStateTransaction` still owns the PUBLICATION. That is one owner
above one owner, not two owners of one thing — the door refuses, records, and
then hands a validated slice to the transaction that already owned publishing
it.

### The 27 references

All routed, none surviving. Per-module writer ids so the census reads a name,
not a category:

| Writer | Where | Was |
|---|---|---|
| `athlete_tap` | `PlanChangeSheet.tsx` | a screen injecting the raw primitive into the producer (**LR-11 closed**) |
| `plan_change_producer` | `planChangeProducer.ts` | seam forwarding |
| `program_control` | `programControlActions.ts` | 3 refs |
| `adjustment_events` | `applyAdjustmentEvents.ts` | 3 refs |
| `lighter_day` | `lighterDayTransaction.ts` | 1 |
| `coach_action` | `coachActions.ts` | 8 refs, one module-level writer now |
| `coach_executor` | `coachCommandExecutor.ts` | rollback restore |
| `coach_program_edit` | `coachProgramEdit.ts` | visible-verifier rollback |
| `coach_turn_controller` | `coachTurnController.ts` | 1 |
| `coach_undo` | `coachUndoEngine.ts` | 2 |
| `coach_revision_writer` | `coachRevisionOverrideWriter.ts` | 3 (LR-3's residual writer) |
| `coach_modality_swap` | `coachModalitySwapOrchestrator.ts` | 1 |
| `dev_seed` | `defaultDevE2ESeedCoordinator.ts` | a dev seam writing product state |
| `store_action` / `reset` | the store's own remove/clear builders | — |
| `harness` | test suites only | 70 seeding call sites |

**Coach-path refs are NAMED, never touched.** Every coach conversion is a call-
shape change with identical behaviour: the same workout, the same context, the
same order, the same transaction. Nothing about what any coach path DECIDES
moved. That is store-ownership work, which the recipe and Sam's sequencing
allow under the LR-6 STOP; changing what a coach path does remains stopped.

**Injection seams renamed off the retired name.** `setManualOverride?:` became
`applyOverride?:` (and `setManualOverrideFn` → `applyOverrideFn`) in six
modules. The seams still exist and tests still spy on them — a seam named after
a retired primitive is a pointer to a thing that no longer exists.

**The dev seam is DECLARED, not excused.** `writer: 'dev_seed'` puts every
seeded override on the tape under a name no athlete path can wear, so a seeded
world is distinguishable from a lived one in the log. Same for `harness`
(`src/__tests__/support/programOverrideHarness.ts`), which cell 6 sweeps out of
product code entirely.

---

## What this found — read this part

**No walked athlete tap door writes `dateOverrides` any more.**

The walker replay cell was written to bin a session and went red with `{}`. It
was right to. Probed directly against a generated week: `remove_session`
records a `UserRemovalConstraint`; `add_category` and `swap_category` land in
`weekScopedOverlays`. Neither touches the override map.

That is the §18 ownership migration having WORKED — the tap doors were moved
off the raw surface one unit at a time over weeks. What nobody had asked is
what was left on it. The answer: **the coach pipeline, the lighter-day
transaction, and LR-3's §18 residuals.** The surface the census called "the
athlete's decision surface" is now written almost entirely by paths the athlete
does not drive directly.

Three consequences, none of them this unit's to act on:

1. **LR-3 gets sharper.** Its residuals are no longer "four legacy call sites";
   they are a meaningful fraction of everything still writing the surface.
2. **The north-star question.** If the athlete's own doors publish decisions as
   overlays and constraints, then `dateOverrides` holding coach output may be a
   stored-derived-output surface wearing a decision surface's name. Worth a
   ruling before Stage B builds the derivation over it.
3. **The walker's vocabulary gap is now load-bearing.** With no coach actions
   in the walker and LR-6 forbidding adding them, the deepest walk cannot reach
   the state most of this door's writers produce. Declared in the cell, not
   hidden.

---

## The gates

**`src/__tests__/programOverrideOwnershipTests.ts`** — 7 cells, in the bible
chain (`test:program-override-ownership`), totals-or-red armed at module top:

1. the door refuses the bare default over authored overrides
2. a stale erasure act is refused
3. the legal erasures land under a named act, and say so (both of them)
4. a reduction is the athlete editing, never the wipe — and the last-override
   removal lands
5. every write is on the tape, refused or not — counts either side, and the
   real date and real workout name are hunted and absent
6. no writer reaches the slice around the owner (sweep)
7. the writer boundary is registered and the door's refusal arms it

**Sweep scope, declared in the cell (lesson 4).** This store's slice is
published by `commitAcceptedStateTransaction`, not by a bare `setState`, so the
sweep is on the RETIRED PRIMITIVE'S NAME and on the harness writer id — not on
`setState`. Word match, never `field:` (lesson 12b). Comments are stripped
exactly the way the census detector strips them, so the retirement can be
narrated in a JSDoc without the sweep reading history as a surviving writer.

**Walker:** one wipe-replay cell added, `test:action-walker` 17/17. Depth
stated per L13: **SHALLOW tier — 3 walked actions, 10 days crossed, one
authored decision.** The decision is acted in through the door after the walk
because the walker has no coach vocabulary and LR-6 forbids this unit adding
one — the same declared gap the coach-prefs and coach-memory cells carry.

**The mutation pass (L-E4; committed first at `453921d`, scratchpad backups):**

| # | Mutation | Caught by |
|---|---|---|
| 1 | the refusal check deleted | 4 ownership cells + walker replay |
| 2 | refusals silenced on the tape | taped-either-way cell + walker witness count |
| 3 | a coach writer bypasses the door (`coachActions` back on the primitive) | sweep cell + 3 census cells |
| 4 | census un-paid (LR-1 declared 0 → 27) | 5 census cells (directions 1/2/3 + retired-declares-zero + detector completeness) |
| 5 | `clear()`'s total erasure goes silent | named-erasure cell |
| 6 | the erasure act is never ended (a later deferred write could ride it) | named-erasure cell |
| 7 | the harness writer leaks into product code (dev seed writes as `harness`) | sweep cell |

---

## The census

- `programStore` registry entry: `owner: 'applyProgramOverrideSliceWrite'`,
  `taped: true`, with the finding above recorded as its caveat.
- **LR-1: `declared` 27 → 0, status `retired`.**
- **LR-2: `declared` 1 → 0, status `retired`.** Eleven to none: the count that
  opened at "eleven of twelve persisted stores have no single write owner"
  closes at zero.
- `LEGACY_DEBT_BASELINE` 104 → 76, in the same commit (directions 1 and 3
  move together). `foundingCount` untouched on both — it records a measurement.
- `UNPROTECTED_STORES_DEBT` needed no change; it was already the empty list and
  `programStore`'s quarantine boundary predates this unit.

---

## L12 — what catches the NEXT defect of this class

Three answers, one per layer, and none of them is "the tests pass":

1. **A new anonymous writer cannot compile.** The writer id is a required field
   of a closed union on the only function that writes the slice. The previous
   generation of this defect — a raw primitive anyone could call — is now a type
   error, not a gate finding. That is the strongest form available here, because
   it fails before a test can run.
2. **A writer that re-opens the raw path is caught twice, independently.** The
   ownership sweep matches the retired NAME repo-wide (comment-stripped, word
   match), and the census detector counts the same idiom from a different file
   with a different regex and a per-unit ceiling of zero. Mutation 3 proved both
   fire. Two instruments that would have to fail together.
3. **The next SEEDING writer is visible rather than silent.** `harness` is a
   first-class writer id swept out of product code, so every seeded override is
   on the tape wearing a name no athlete path can wear. Under the fixture law
   that turns 70 seeding sites from invisible fixture state into declared,
   countable debt — which is the precondition for the walker ever converting
   them.

And the class this unit could NOT close, stated so the next reader inherits it
rather than rediscovers it: **a gate on WHO may write does not test WHAT is
written.** The door refuses the wipe; it does not know whether a coach-authored
override belongs on the athlete's decision surface at all. That question is the
finding above, and it needs a ruling, not a gate.

---

## NOT COVERED

- **No device pass.** Everything here is source-and-gate evidence. Per L4 the
  device is arbiter and per L10 nothing is done until Sam's phone says so.
- **The behaviour-preservation claim for the 27 conversions rests on the
  suites, not on a differential harness.** Each conversion is mechanically the
  same call with a name added, and 43 suites exercise those paths — but no
  A/B run compares override bytes before and after across the coach pipeline.
  A content-conservation differential would be the stronger instrument.
- **The tape's flood risk is unmeasured.** Coach edits can write several
  overrides per turn, each now emitting a decision-class entry into a 200-entry
  ring. Nothing in this unit measured how quickly a busy coach session evicts
  older decisions.
- **`clear()` remains the one raw slice write in the store file.** It cannot
  route through the accepted-state transaction, because the transaction
  validates against a program that very call is removing. It is declared, taped
  and pinned by cell 3 — but it is a decision site outside the door, and cell 3
  is what stands between it and silence.
- **The quarantine cell asserts the refusal path RAN the capture, not that the
  capture landed.** The capture is best-effort and async by design; the
  bare-over-held behaviour itself belongs to
  `test:hydration-refusal-quarantine`, which this unit did not touch.
- **Pre-existing non-bible reds are carried, not inherited silently:**
  `test:block-state`, `fixtureMutationTransactionTests`,
  `programControlActionsTests`, `devE2EDefaultSeedInstallationTests` — all
  LR-14's, all proven at clean main by the previous shift.
- **The `dateOverrides` ownership question raised above is NAMED, not answered.**
  It is parked for Sam.

---

## Parked for Sam

**One question, and it is the finding.**

> `dateOverrides` is documented — in the census, in the store, and in the north
> star — as *the athlete's decision surface*. Measured today: the athlete's own
> tap doors no longer write it. Adds and swaps land in `weekScopedOverlays`,
> deletions in `userRemovalConstraints`. What still writes `dateOverrides` is
> the coach pipeline, the lighter-day transaction, and LR-3's residuals.
>
> Is `dateOverrides` still a decision ledger that the coach happens to write
> to — or has it become a stored-output surface that should converge onto the
> overlay/constraint pair like every other publication shape?
>
> The door is correct either way; it refuses the wipe on whatever the surface
> holds. But Stage B builds the derivation function over these surfaces, and
> the answer changes what it derives FROM. Worth ruling before it starts.
