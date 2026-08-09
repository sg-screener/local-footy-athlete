# COACH GROUNDWORK — OVERNIGHT BOUNDARY, 2026-08-09

The three-item overnight order, processed in order. **No Sam-facing decision was
made and no athlete-visible coach surface was touched**, per the order's own
mandate.

**LOOP CHECK: `overnight-independent-work-while-design-parks` — sighting 2
(R5-era precedent) — ITERATE.** It paid again and the evidence is specific: the
whole night's work sits UNDER the design questions rather than beside them —
doors, a ledger kind, an import graph — and not one line of it presumes an
answer to the kickoff mock, the privacy opt-in, or the coach's voice. **What
makes it iterate rather than compress is that the ordering was load-bearing
twice**: item 1's reassessment ruled the shape item 2 then built, and item 1's
§8 forced a MEASUREMENT that changed item 2's plan. Had the build come first it
would have been correct by luck.

**STATUS DISCIPLINE.** MEASURED / ATTRIBUTED / OPEN-UNKNOWN throughout. §7 is
the not-covered list. No completeness claim is made about any of it.

---

## §1 ONE LINE

The coach unit's opening law doc is written and ruled — **ten representations of
one athlete sentence, and the ledger is not one of them** — and the first of its
consequences is built: **an athlete's own exercise edit was measured silently
lost on every relaunch, and now survives by being a decision.** Item 3's census
is delivered and **returns zero deletions, for a structural reason the order's
own rule produces.**

Commits: `099904e6` (order as authored) · `d4b20363` (reassessment) ·
`bcb80b98` (the measurement) · `d095b2e0` (the ledger route) ·
`4274e2f0` (undo + the side-writer census).

---

## §2 ITEM 1 — THE SEVEN-QUESTION REASSESSMENT · **PROCESSED IN FULL**

`docs/COACH_ARCHITECTURE_REASSESSMENT_2026-08-09.md`. Written against the
survey's §5 as its §8 directed. The ruling:

> The coach's output becomes a `ProgramControlAction`, the athlete's own door
> executes it, and the ledger records the door's vocabulary verbatim. Ten
> representations collapse to two. **The coach gets undo, replay and durability
> by NOT having a writer.**

**TWO MEASURED CORRECTIONS TO THE SURVEY**, both from a real import graph rather
than a name scan:

1. **57 of 60 `*coach*` modules are REACHABLE from `App.tsx`.** The R5.7 cut
   removed the `Tab.Screen` and left the `import`, so ONE edge holds the whole
   frozen pipeline. "Frozen" was never a property of the modules.
2. **The three off-ledger destinations are NOT alike**, and the survey treated
   them as one. Injury, illness and readiness **persist today**; a ledger kind
   without removing their fact slice would make the representation count
   **worse**. Exercise-level **does not persist** — that one is a data-loss fix.
   This distinction is what staged item 2 and it is the reason nothing was built
   for the fact destinations tonight.

**`a count taken for a record` — ELEVENTH SIGHTING, in this document's own
instrument on its first run:** it counted `import type` as a runtime edge, which
alone made 6,296 lines look load-bearing off a single erased import at
`config/env.ts:2`. An earlier run reported a reachable set of ONE module (a
relative root against absolute resolution) — obviously false, and cheap, which
is the argument for anchor proofs that print loudly.

---

## §3 ITEM 2 — THE LEDGER DOORS · **ONE DESTINATION OF FOUR, DELIBERATELY**

### 3.1 The measurement came first, and it changed the plan

The reassessment's §8 made measuring the first act, because the survey filed
§5.2 as an INFERENCE and its own §9.8 said the three mechanisms behind it had
never been observed together. **They have now** (`npm run
tape:exercise-edit-durability`):

```
BEFORE  Bird Dog | Long-Lever Copenhagen | Band Pull-Apart | ...
ACTED   Long-Lever Copenhagen | Band Pull-Apart | ...        (ok: true)
BOOTED  Bird Dog | Long-Lever Copenhagen | Band Pull-Apart | ...
survived? NO    reverted to the floor? YES    dateOverrides 1 -> 0
```

**This is athlete-facing silent data loss and it is not a coach defect.** The
athlete taps remove on their own session screen and the exercise is back
tomorrow, with nothing shown and nothing logged.

**THE CONTROL IS WHAT MAKES IT READABLE:** a relaunch with nothing edited
reproduces the day exactly, so "the boot diverges" is excluded. **THE PROBE
ASSERTS ITS OWN PRECONDITIONS** — the LR-29 item 1 lesson — and **it ABORTED
rather than lying on its first run**: the row's name lives at
`row.exercise.name`, the probe asked the door to remove `"undefined"`, the door
refused, and the tape stopped. A probe that cannot act must never read as a
probe that acted and lost.

### 3.2 What was built

`{ kind: 'program_control'; action: ProgramControlAction }` — **the door's own
vocabulary, stored unchanged.** One ledger kind for a 26-member union, because a
kind per capability needs a translation per capability and a translation is
where a field is lost by omission.

- **ZERO new stored state.** Nothing entered `partialize`. North star: **TOWARD**.
- **UNDO ARRIVED FREE**, which is the point rather than a bonus:
  `replayableEntries` and `lastUndoableEntry` are kind-agnostic, so an exercise
  edit became undoable the moment it became a decision.
- **AN ALLOW-LIST** (`rules/programControlDecisions.ts`), because one general
  kind is a trap otherwise: recording a type the boot cannot replay is **worse**
  than recording nothing, since the edit would look durable and vanish anyway.

**NEW GATE `test:program-control-decisions`, 11 cells, position 100 — past the
chain's exit at 91, so the sweep is what proves it. 8 MUTATIONS, 8 RED, no
survivors.** Cell [9] went red on its own first run for the right reason and was
re-aimed: it sliced a fixed 2,200-character window and a comment pushed the
guard past it. **A window measured in bytes is a claim about formatting**; it
ends at the next anchor now.

### 3.3 A module cycle that broke innocent code — and the fix is a move, not a cast

Naming `ProgramControlAction` from `types/decisionLedger.ts` closed
`programControlActions → planChangeProducer → decisionLedgerStore →
types/decisionLedger → programControlActions`. `tsc` then reported **four errors
in `programControlActions.ts`, none of them at the edit** — three
`Property 'factId' does not exist on type 'TemporarySourceFact'` at
`:1265-:1300`, where a type guard is correct and has been for months. **The
errors were real as reported and false as diagnoses.**

The alternative was `action: unknown`, which clears them by giving up the entire
claim the kind exists to make. So the union moved to
`types/programControlAction.ts`, below both consumers, re-exported so no caller
moved. **Typecheck totals byte-identical to baseline: 35 / 51 / 373.** Cell [11]
pins the leaf law, and pins it at what actually matters — *every import is
`import type` and none reaches the ledger back* — after the first version of
that module's own header claimed "nothing here imports a store", **which was
false**: it imports `ActiveInjuryConstraint` from `coachUpdatesStore`.

### 3.4 The side-writer class got a CENSUS, not a fourth per-kind fix

The order named the hazard. A per-kind assertion cannot find the NEXT one, so
the tape diffs the **whole persisted envelope** before the edit and after the
undo. Anything that did not come back is, by definition, something the edit
wrote that the ledger does not own.

```
undo target : dl-2 (program_control)   outcome: undone
back to the floor? YES    undo DURABLE across relaunch? YES
persisted keys 9 — UNEXPLAINED: (none)     CENSUS CLEAN
```

Two keys are exempt and **the exemption is argued**: the ledger is append-only
by design (a byte-identical ledger after an undo would mean undo had rewritten
history), and the action log is a diagnostics trace — the athlete did act.

**THE CENSUS FOUND THREE SIDE-WRITERS BEFORE IT FOUND NONE, AND ALL THREE WERE
MINE.** (a) the baseline was photographed before pending writes flushed, so
stores that had not yet persisted read as *absent before, present after*; (b)
the snapshot was taken after a relaunch while the baseline was not, so
rehydration counted as drift; (c) it compared raw strings, and `coach-updates`
differed only in **JSON key order** — identical state. **`a count taken for a
record`, TWELFTH SIGHTING:** the instrument's unit was BYTES, the domain noun is
what the world holds.

### 3.5 What was NOT built, and why it is a stop rather than an omission

**Injury, illness/readiness and setup answers are NOT on the ledger.** They
persist today in their own input slices, so a ledger kind alone would be **two
stored representations of one input** — the north star's own objection. Doing
them correctly means the fact slices LEAVE `partialize` and are rebuilt by
replay, which needs a one-time migration of existing installs.

**A mistake there loses athlete facts that currently survive**, where a mistake
in the exercise destination could only fail to fix a loss already happening.
That asymmetry is why it is staged behind, and why it was not attempted
unsupervised overnight. Cell [6] pins the staging so the list cannot grow
without the migration.

---

## §4 ITEM 3 — DEAD COACH WEIGHT · **CENSUS DELIVERED, ZERO DELETIONS**

### 4.1 The real import graph, replacing the survey's name scan

Value edges only (`import type` is erased and is not a runtime dependency),
rooted at `App.tsx`. Unit: **MODULES with no surviving import edge** — which is
not "code an athlete can run", and the two are not conflated.

| | modules | lines |
|---|---|---|
| cutting `CoachScreen.tsx` makes unreachable | **40** | **41,220** |
| `*coach*` modules that SURVIVE the cut (keep) | 26 | 23,218 |

**Larger than the survey's 28,160 lower bound and above its ~37k estimate.**
**Eight of the 39 dropped modules are not named `*coach*`** and were invisible to
a name scan exactly as survey §9.1 predicted: `semanticProgramEditDraft` (829),
`sessionExplanation` (688), `programAdjustmentRequests` (583),
`constraintResolutionDetector` (465), `llmSemanticProgramEditDraftAdapter` (423),
`smokeVisibleWeekHarnessState` (382), `pendingInjuryResolver` (268),
`constraintSummary` (241), `visibleWorkoutDiff` (214), `smokeNavState` (170).

**The 26 survivors must be kept whatever their names say**, each with a measured
holder outside the coach tree — `coachingEngine` (8,824, the GENERATION engine),
`coachUpdatesStore` (1,345, 27 holders), `coachWeekDiff` (347, the boot's own
state assembler), `deterministicCoachNoteFactory` (382, the live athlete-visible
notes), and `coachActions` (1,053) — **which is held by `programControlActions`
itself, so the athlete's own tap door depends on a `*coach*`-named module.**

### 4.2 Why zero modules were deleted — the order's rule has no consistent set

The order authorises deleting modules with **zero importers outside the coach
tree AND no rebuild-salvage role**. Applied to the measured graph it does not
close:

- The 39 downstream modules each have zero importers outside the coach tree, so
  they qualify — **but they are all held alive by `CoachScreen.tsx`**, which has
  an importer outside the coach tree (`AppNavigator.tsx:10`) and therefore does
  **not** qualify. Deleting the 39 while keeping their root does not compile.
- **So the tree is rooted at the one module the rule protects.** The deletion is
  all-or-nothing on a root the order did not authorise cutting, and LR-6 holds
  the pipeline **frozen, not retired**, until the rebuild.

Three modules ARE orphaned at the value-edge level, and each was checked
individually rather than swept:

| module | verdict |
|---|---|
| `coachInjuryTargetResolver` (539) | zero importers; referenced only by its own out-of-chain suite — **but it is injury TARGET RESOLUTION, and the order names target resolution as SALVAGE. KEPT.** |
| `weeklyCoachUpdate` (327) | zero value importers, but referenced by three suites, two of them broader than this module. **KEPT.** |
| `coachReadinessAdapter` (220) | not orphaned — held by `coachTurnController` and `CoachScreen`. Its apparent fourth reference in `rules/timeAvailabilityPolicy.ts:11` **is a comment**; `a comment is not a shipped string`, again. **KEPT.** |

**"When in doubt, keep and list" is the order's own instruction, and this is what
it produces here.** Zero deletions is the correct output of the census, not a
shortfall against it — the shortfall would have been deleting a salvage layer at
2am to make a number move.

---

## §5 THE NORTH STAR

**TOWARD.** Stored state did not grow: one new ledger kind on a ledger that
already stores decisions, nothing added to `partialize`, and an override surface
that was already ephemeral now has a decision behind it. Representations on the
door path went from two writers to one recorder. **The measured direction of the
whole unit is a REMOVAL** — the reassessment's case is that the coach's write
layer should be deleted rather than taught to append, and tonight built the door
that makes deleting it possible.

---

## §6 L12 — WHAT CATCHES THE NEXT DEFECT OF THIS CLASS

The class is **a representation boundary that loses a field by omission** — no
throw, no guard, nothing to catch it.

- **Cell [4] catches it**, and it is the only cell in the set that fails on
  omission rather than on error: the recorded action must be byte-identical to
  the action the door executed. Mutation M2 (drop payload fields) reds it alone.
- **Cell [1] and cell [7] catch its arrival**, because a new representation
  always shows up as a new writer or a new recorded type first.
- **The census in §3.4 is the general instrument** and it is the one worth
  reusing: it does not know what a side-writer looks like, so it can find a kind
  nobody predicted. **It should run for every destination added from here.**
- **What would NOT have caught any of it:** every existing coach suite. 347
  cells of `coach-program-edit` are green while the write layer evaporates,
  because they assert the understanding, which is correct.

---

## §7 NOT COVERED — read before treating anything above as settled

1. **NO DEVICE EVIDENCE. DEPTH 0.** Nothing here has been seen on a phone. The
   exercise-edit fix is proven on one fixture world through one door.
2. **ONE DESTINATION OF FOUR.** Injury, illness/readiness and setup answers are
   untouched (§3.5). "The coach acts through the same doors, undo covers it
   free" is **still half true** — it is now two destinations of five rather than
   one.
3. **ONE ACTION TYPE OF THREE MEASURED.** The allow-list carries
   `swap_exercise`, `add_exercise` and `remove_exercise`; **only
   `remove_exercise` was driven end to end.** The three share one write path,
   which is why the reading generalises — but a swap also passes
   `assessTapSwapCandidateSafety` on replay and **that has not been exercised.**
   A swap whose replacement is refused on a later boot would log and drop.
4. **NO COACH TURN WAS EXECUTED**, here or in the survey. The reassessment's
   central claim — that the coach's vocabulary fits `ProgramControlAction` — is
   a **type-level reading of two unions, not a port**, and is the single most
   likely place the design is wrong.
5. **THE IMPORT GRAPH COUNTS EDGES, NOT CALLS.** A module imported and never
   called reads as reachable. `import type` detection is heuristic (statement
   form and all-inline-`type` form) and **was not mutation-tested.**
6. **THE 7 RED ORPHANED COACH SUITES WERE NOT RE-RUN** after this change. They
   assert the coach wrote an override; nothing here changes that.
7. **THE REASSESSMENT IS UNAPPROVED.** AGENTS.md requires approval before
   further coach **pipeline** code. Tonight was door/engine work under LR-6's
   ratified boundary, which does not need it. **Rewriting a coach module does.**

---

## §8 GATE

- Full unpiped chain **`GATE_EXIT=1` at `test:program-control-durable`, 1 FAIL
  cell** — main's declared red, unchanged, verified at a clean baseline before
  any edit.
- **`test:compile` PASSED**, totals byte-identical to baseline (35 / 51 / 373).
- **Sweep 2 of 171 = the declared set exactly** (`test:program-control-durable`,
  `test:fixture-identity`). **The denominator moved 170 → 171 in the commit that
  earned it.**
- `test:program-control-decisions` **11/11**, 8 mutations 8 red.
- `tape:exercise-edit-durability` — durable YES, undo durable YES, census clean.

---

## §9 PARKED FOR SAM — none of it blocked tonight

1. **The kickoff sign-off**, which is the reassessment's approval (§7.7).
2. **THE NEW ONE, and it is the largest: the frozen coach tree cannot be deleted
   under the order's own rule** (§4.2) — 41,220 lines are rooted at
   `CoachScreen.tsx`, which the rule protects. Cutting that root is a scope
   decision, and LR-6 currently says frozen rather than retired.
3. **Destination 5 (setup answers) as a decision** — named, not started.
4. **An athlete tap on their own session screen is attributed to the coach.**
   `coachActions.writeCoachOverride` stamps `writer: 'coach_action'`
   (`coachActions.ts:246-248`). Any census partitioning override writes by
   writer id is counting athlete taps as coach writes. Found while measuring;
   not fixed, because the writer-id vocabulary is the rebuild's to settle.
5. Carried unchanged: journal notes have **zero reachable writer**; coach reading
   notes = opt-in + App Store label; the acceptance contract's two missing copy
   strings, R5.7's three unsigned fallback sheets, the MetCon rename; and the
   undo toast's parked dwell question.
