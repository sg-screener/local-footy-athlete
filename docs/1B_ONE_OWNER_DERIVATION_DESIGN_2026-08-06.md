# Ruling 1 + 2 — the one-owner derivation, designed and measured, NOT built

Written at a clean stop with the tree green. **Totals-or-red applies: what is not
listed as done is not done.** Nothing in the batch's production work is
implemented; this document exists so the next session executes rather than
re-derives.

Rulings being implemented: `docs/1B_FLUSH_OFFER_RULINGS_2026-08-06.md` ("1a, 2a").

## State

| thing | where | state |
|---|---|---|
| Sam's rulings + seat handoff | `feat/stage-b-stage2` `60a40f92` | committed as authored |
| cell 8 (ruling 2's test) | this branch | **written, declared red** |
| cells 5 + 7 | this branch | declared red, unchanged |
| declare-then-place + core-selection flush refusal | `fix/1b-flush-offer` `5bf74a8e` | **approved, still held** |

Branch green: `test:phase-structure` 8 passed / 0 failed, three declared reds.
The three declared-red entries are the ratchet — they force their own deletion in
the commit that pays them.

**Why the approved work is still held:** landing it alone reds
`test:athlete-session-deletion` (16 failures), because the promotion defect it
exposes is fixed by ruling 1, not by itself. It lands ON TOP of the derivation,
in the same commit or after it — never before.

## The measured baselines (do not re-measure, do not assume)

World: `phaseStructureConformanceTests`, `reachWorldByActing()` then
`shiftTo('In-season')`, target week `NEXT` (2026-08-10 … 2026-08-16).

**Game week, no 1b** — no conditioning anywhere:
```
Mon Team Training + Upper Pull | Tue Lower Body Strength | Wed Team Training +
Upper Push | Thu Prehab & Accessories | Fri Gunshow | Sat Game Day | Sun (typed rest)
```

**Game week, with declare-then-place** — the flush lands on Tue as a component:
`Tue Lower Body Strength` becomes `workoutType: Mixed`, 3 → 4 exercises, the 4th
being an authored **"Short Flush"** (`exerciseType: Cardio`,
`nameProvenance: authored`), `section18ConditioningRole: optional_flush`,
`conditioningCategory: aerobic_base`, `hasCombinedConditioning: true`.

**After removing the game and rebuilding (`rebuildLocalWeek`, `newGameDay: null`,
`scope: 'weekOverlay'`, target 2026-08-15) — THE NO-1b BASELINE ruling 2 restores:**
```
Mon Team Training + Upper Pull | Tue Lower Body Strength | Wed Team Training +
Upper Push | Thu Prehab & Accessories | Fri Gunshow
Sat Hard Conditioning   role=required_core  cat=glycolytic
Sun (typed rest)
```
Every other day unchanged, **Tuesday clean, no flush anywhere**. Cell 8 asserts
exactly this.

## THE FINDING THAT SHAPES THE DESIGN

**The content signal for "this is a flush" is too weak to derive from the workout
alone.** Measured: a flush attached to a strength day carries
`sessionTier: 'core'` (it inherits the strength day's tier), `conditioningVariant`
is null on the *workout* (it is set on the allocation and not carried through),
and `hasCombinedConditioning: true`.

So the existing content fallback in `section18WorkoutEvidence.ts:73`
(`tier === 'optional' && category === 'aerobic_base' → optional_flush`) **cannot
classify it** — the tier is core. Any derivation that reads only the workout will
misclassify the flush as core conditioning, which is the exact defect ruling 1
exists to remove.

**Therefore the derivation must be POSITIONAL — contract + week, as the ruling
says, not workout content alone.** That is also what the evaluator already does
for anchors (`section18EffectiveWeekEvaluator.ts:350`):
`creditedAnchorIndex < requiredMinimum ? 'required_core' : 'planner_selected_core'`.
The app sessions simply continue that same count.

## The design

### Where

`src/rules/section18EffectiveWeekEvaluator.ts`, in `buildLedger`. Insert a
derivation pass **after** the anchor block (ends `:392`) and **before** the day
loop (`:394`), producing `Map<Workout, Section18ConditioningRole>`. Then change
`workoutConditioning(workout)` (`:261`) to take the derived role instead of
reading `workout.section18Evidence.conditioningRole`.

This is contained: the day loop's only use of the role is at `:433-466`.

### The rule

```
anchorCoreCredits = creditedAnchorIndex            // anchors already took theirs
requiredMinimum   = contract.conditioning.core.requiredMinimum
plannerTarget     = contract.conditioning.core.plannerSelectedTarget ?? requiredMinimum
appCoreCapacity   = max(0, max(requiredMinimum, plannerTarget) - anchorCoreCredits)
flushAllowance    = contract.conditioning.optionalFlush.permitted
                      ? contract.conditioning.optionalFlush.preferredRange.max : 0
```

Walk the week's app conditioning sessions in training order; for each:

1. an explicit recovery session (`workoutType === 'Recovery'` or
   `sessionTier === 'recovery'`) → `optional_recovery_aerobic`
2. else if `appCoreUsed < appCoreCapacity` →
   `anchorCoreCredits + appCoreUsed < requiredMinimum ? 'required_core'
   : 'planner_selected_core'`; increment
3. else if `flushUsed < flushAllowance` → `optional_flush`; increment
4. else → `optional_noncore`

Check it against both baselines:

- **Game week.** Anchors = 2 team trainings + game = 3 credits;
  `requiredMinimum` 3, so `appCoreCapacity` 0. Tuesday's aerobic work is surplus
  → step 3 → `optional_flush`, `flushAllowance` being 1 under Sam's min/max 1.
  **Correct, and it cannot be promoted — step 2 is exhausted before it is
  reached.** That alone kills the defect that held 1b.
- **Rebuilt bye week.** Anchors = 2 team trainings; `appCoreCapacity` 1.
  Saturday's conditioning → step 2 → `required_core`. **Correct — matches the
  measured baseline.**

### RULINGS 1 AND 2 ARE INTERDEPENDENT — this is the trap

The bye-week case above is only correct **because Tuesday comes back clean**. If
the flush CONTENT survives the rebuild, it is earlier in training order, so
step 2 gives *Tuesday* the `required_core` slot and Saturday falls through to
`optional_flush` — the baseline inverted, and a worse bug than the one being
fixed.

So **ruling 2 is not optional polish and must land in the same batch.** Ruling 2
is a content question, not a role question: the fixture-change rebuild must not
carry derived flush content forward. Ruling 2's own words — "derived content
re-derives", the same reason `weekScopedOverlays` were never migrated.

Do NOT order the walk to dodge this (e.g. preferring hard conditioning for core).
That would be a second heuristic re-deciding what the contract already declares —
the exact shape both rulings retire.

### Writers to retire (ruling 1, verbatim)

| file | site | action |
|---|---|---|
| `src/utils/fixtureMinimalReplan.ts` | `:1090` role stamp + its conditioning shortfall arithmetic (`:1069-1095`) | RETIRE |
| `src/utils/postGenerationConstraintValidation.ts` | `:1012` `?? 'planner_selected_core'` | RETIRE |
| `src/utils/canonicalPlanChangeCandidateMaterializer.ts` | `:96`, `:205` | stop authoring; read the derivation |
| `src/utils/coachRevisionOverrideWriter.ts` | `:541` | stop copying |
| `src/rules/section18AcceptedWeekGateway.ts` | `:518` | stop copying |

`src/utils/coachingEngine.ts:7020` keeps stamping for now — it is the planner's
own placement pass and the field remains as the planner's INTENT. The evaluator
simply stops treating that stamp as authority. Retiring the engine's stamp too is
a larger question and no ruling asks for it.

## Order of work

1. Evaluator derivation (above). Expect wide chain movement — the evaluator feeds
   the gateway, acceptance and repair.
2. Ruling 2 — stop the fixture-change rebuild carrying flush content forward.
3. Land `fix/1b-flush-offer` (`git checkout fix/1b-flush-offer -- src/rules/weeklyExposureContractV2.ts src/utils/coachingEngine.ts`).
4. Retire the writers in the table.
5. Cells 5, 7, 8 green; **delete all three declared-red entries in the greening
   commit** (ratchet law — a declared red that stops redding owes its deletion).
6. Full `npm run test:bible` EXIT 0, read from the TRUE exit line.

## Standing gates

Run the chain bare and read the real exit line — `npm run test:bible; echo $?`
into a file. A piped `tail` reports the pipeline's last command, not the chain:
that is how a red run was briefly mistaken for green this session.
`git branch --show-current` before every commit; the tree is shared.

Two suites in the chain are known to be sensitive to what this batch touches and
are the ones to watch first: `test:athlete-session-deletion` (its
`seedExactSundayRegression` precondition needs the bye week's `Hard Conditioning`
to exist — the exact baseline above) and `test:section18-gateway`.
