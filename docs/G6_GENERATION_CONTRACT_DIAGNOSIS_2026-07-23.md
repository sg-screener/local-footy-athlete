# G6 Generation Contract Diagnosis — 2026-07-23

Dogfood finding G6: switching season mode to Pre-season and generating a
program fails with the client-facing error "The server returned a program,
but the app could not read it." Read-only diagnosis per request. No code
changed, no branch switched (stayed on `diagnose/move-occupied-content-loss`).

## 0. Scope of this diagnosis

Compares the coach-chat edge function's `update_program` tool output schema
against the client's parsing/normalisation expectations, traces the exact
throw path for G6, and checks whether the same drift class reaches other
season modes.

## 1. The error's two throw sites (client)

Both throw the identical user-facing string, which is why the symptom looks
like a raw schema/parse failure even though it isn't one.

- `src/services/api/generateProgram.ts:1436-1481` — `generateProgramFromProfile`
  calls `buildGeneratedMicrocycles({ coachWorkouts: result.programUpdate.workouts, ... })`
  inside a `try`. Any throw from that call is caught at `:1455` and rethrown
  at `:1466-1480` as `ProgramGenError('bad_response', 'The server returned a
  program, but the app could not read it. Please try again.', diagnostic, true, ...)`
  — the original error's type and message are demoted to a `diagnostic` string
  buried in `details`, not surfaced to the UI.
- `src/services/api/generateProgram.ts:1483-1505` — if `buildGeneratedMicrocycles`
  returns normally but `microcycles[0].workouts` is empty, the same
  `ProgramGenError` is thrown from a second, independent site.

## 2. Edge function output schema vs. client parser — NOT the mismatch

Compared field-by-field:

- Tool schema: `supabase/functions/coach-chat/index.ts:976-1046`
  (`UPDATE_PROGRAM_TOOL`). Required workout fields:
  `planEntryId, dayOfWeek, name, workoutType, exercises`. `workoutType` enum:
  `["Strength", "Conditioning", "Recovery", "Team Training", "Mixed"]`.
  Exercise required fields: `name, sets, repsMin, repsMax`.
- Client parser type: `src/services/api/generateProgram.ts:929-955`
  (`CoachResponse.programUpdate.workouts`) and acceptance set
  `VALID_APP_WORKOUT_TYPES` at `:957-976`, which is a superset containing all
  five edge-emitted values plus extra client-only types.

The two sides agree on shape and enum values — the raw JSON contract is
sound. The failure is downstream of parsing, inside the client's own
normalisation/acceptance pipeline. This diagnosis therefore treats "the
edge function's program output" more broadly than the JSON schema: the
*effective* contract also includes the prose rules embedded in the
generation prompt (which the edge function receives and the AI is
instructed to follow), because those prose rules shape what the AI puts
inside the schema-valid JSON — and the client's post-parse acceptance gate
checks against a different, stricter, independently-computed contract.

## 3. The actual drift: prompt-shaped AI output vs. independently-computed exposure contract

Causal chain, each link cited on both sides:

1. **Prompt tells the AI to withhold conditioning near team-training days,
   Pre-season only.** `buildGenerationPrompt`,
   `src/services/api/generateProgram.ts:1711-1723`:
   > "NO separate conditioning on a team training day... NO standalone
   > sprint/speed conditioning on the day BEFORE or AFTER a team training
   > day... REDUCED standalone conditioning volume vs off-season."
   No other season phase carries an equivalent freestanding prose
   restriction — Off-season and In-season rely solely on the weekly-skeleton
   pass-through instruction ("This contract and the planEntryId skeleton
   below are authoritative", `:1646`, and "Follow the above tiers EXACTLY",
   `:1680`). The Pre-season block is additive prose layered on top of that
   skeleton, phrased in relative terms ("a team training day", "before/after")
   rather than tied to the concrete `dayOfWeek` values the skeleton already
   encodes.

2. **The independently-computed contract still requires conditioning=3 for
   every Pre-season subphase.** `src/rules/weeklyExposureContractBuilders.ts:687-724`
   — `buildEarlyPreseasonExposureContract`, `buildMidPreseasonExposureContract`,
   and `buildLatePreseasonExposureContract` all set
   `conditioning: { required: 3, preferredMin: 4, preferredMax: 4 }`
   unconditionally. This contract is derived from the plan's placement
   capacity, not from the AI's actual returned content — it does not know or
   care that the prompt just told the model to suppress conditioning around
   team-training anchors.

3. **The client trusts the AI's content verbatim wherever the plan says
   conditioning is plan-owned, with no verification it was actually
   included.** `src/data/defaultProgram.ts:1637-1655`
   (inside `buildWorkoutsFromCoach`'s `feasibleCoachWorkouts` flatMap):
   ```
   const plannerOwnsConditioning = !!planEntry?.conditioningCategory ||
     planEntry?.hasCombinedConditioning === true;
   const conditioningRemoved = planEntry?.conditioningFeasibility?.status === 'removed';
   if (!planEntry || (plannerOwnsConditioning && !conditioningRemoved)) return [workout];
   ```
   When `plannerOwnsConditioning` is true (the normal Pre-season case — the
   plan allocated conditioning to that day), the workout is passed straight
   through with no check that the AI's `exercises` array actually contains
   conditioning content. If the AI omitted or softened it per the prose
   rule, this layer does not catch it — the shortfall only shows up later,
   at the ledger.

4. **The ledger counts what's actually present and finds it short; the
   gateway has no way to manufacture missing content, so it rejects.**
   `src/rules/section18AcceptedWeekGateway.ts:823-828`:
   ```
   export function requireSection18AcceptedWeek(...) {
     const result = runSection18AcceptedWeekGateway(input);
     if (result.status === 'impossible') throw new Section18WeekAcceptanceError(result);
     return result;
   }
   ```
   The gateway's only repair strategies (`repairOptionalRestCandidates`,
   `repairByStackingCandidates`) redistribute rest/strength placement — none
   of them can invent conditioning exercises that were never in the AI's
   output. If the shortfall persists after repairs, `status === 'impossible'`.

5. **The fallback path is not independent of the failure — it reuses the
   same plan and contract.** `src/services/api/generateProgram.ts:417-433`
   — both `regenerate()` and `safeFallback()` callbacks passed into
   `requireSection18AcceptedWeek` call `buildCanonicalCandidate([])`, the
   *same* deterministic-plan/contract machinery with an empty AI input. If
   the underlying plan/contract pairing for this athlete's Pre-season week
   shape cannot be satisfied deterministically either (not confirmed by
   static reading — would need a live repro or a full trace of
   `section18WorkoutEvidence.ts`'s conditioning-role stamping to prove), all
   three attempts return `'impossible'` and the gateway throws.

6. **The specific, more actionable error is discarded by a generic
   catch.** `Section18WeekAcceptanceError` carries its own `userMessage`
   (`src/rules/section18AcceptedWeekGateway.ts:99-100`):
   > "We couldn't safely build your week from your current settings. Please
   > review your availability, readiness and injury information."
   This is swallowed by the blanket `catch (normaliseErr)` at
   `src/services/api/generateProgram.ts:1455-1481`, which has no
   special-case for `Section18WeekAcceptanceError` and always substitutes
   the generic "could not read it" copy. This is why G6 reads as a
   parse/schema failure to the user and in casual log review, when the
   actual rejection reason (`result.failureSignature`,
   `Section18AcceptedWeekGatewayResult`) is already computed and available
   at throw time — it just never leaves the `catch` block.

### Evidence class

Confirmed by direct code reading (not inferred): the full throw chain from
`Section18WeekAcceptanceError` (`section18AcceptedWeekGateway.ts:827`) through
the generic catch (`generateProgram.ts:1466-1480`) to the exact G6 client
string; the Pre-season prompt prose (`generateProgram.ts:1711-1723`); the
hard-coded `conditioning: { required: 3 }` floor for all three Pre-season
subphases (`weeklyExposureContractBuilders.ts:693/708/723`); the
verbatim-trust branch in `buildWorkoutsFromCoach`
(`defaultProgram.ts:1643`); and that `regenerate`/`safeFallback` both call
`buildCanonicalCandidate([])` (`generateProgram.ts:425-432`).

Not confirmed by static reading alone (would need a device repro or a full
trace of `section18WorkoutEvidence.ts` conditioning-role stamping): whether
the deterministic-only fallback candidate *also* fails for the specific
athlete/week shape that reproduces G6, or whether the AI-content shortfall
alone is sufficient to flip `status` to `'impossible'` before the fallback
is even needed. The causal chain in items 1-4 is a strong converging
hypothesis, not a single-line smoking gun for why the fallback doesn't
rescue the week.

## 4. Is this drift class reachable from other season modes?

- **In-season** — structurally similar contract math
  (`buildInSeasonGameWeekExposureContract`,
  `weeklyExposureContractBuilders.ts:452-485`, sets
  `conditioning.required = Math.max(3, anchorCount)` against a placement
  capacity that already excludes G-1/G0/G+1 days), so the contract-vs-capacity
  squeeze is not unique to Pre-season. However, In-season's prompt carries no
  equivalent freestanding prose telling the AI to suppress conditioning
  around anchors — its only guidance is the skeleton pass-through
  instruction. So In-season is exposed to the *contract* side of this class
  but has less of the *prompt-induced AI under-delivery* trigger that makes
  G6 reproduce. Worth a targeted device check, not assumed safe.
- **Off-season** — early weeks (`buildEarlyOffseasonExposureContract`,
  `weeklyExposureContractBuilders.ts:581-612`) set every domain's
  `required: 0`, matching the prompt's "every session is OPTIONAL" note
  (`generateProgram.ts:1683-1684`) — a required floor of zero cannot be
  short. Mid/late off-season do set `conditioning.required: 3`, but without
  team-training anchors consuming placement days, the capacity squeeze
  Pre-season/In-season face is largely absent. Off-season is the least
  exposed of the three.

## 5. Other throw / empty-array sites in the same normalisation chain

Documented for completeness; not believed to be the primary G6 cause:

- `src/services/api/generateProgram.ts:446-463` — legacy
  `evaluateEffectiveWeekExposureContract` path throws `Final effective-week
  exposure contract unresolved (...)` when `exposureContract` exists and
  `exposureContractV2` does not. Reachable only for programs still on the
  legacy (v1) contract; also swallowed into the same generic catch.
- `src/data/defaultProgram.ts:1653-1654` — `if (!strengthRemains &&
  withoutUnselectedConditioning.exercises.length === 0) return [];` drops a
  day entirely when conditioning was removed for feasibility reasons and no
  strength content remains. Normally backfilled by
  `completeCoachWorkoutsFromPlan` (`defaultProgram.ts:1657-1660`), so on its
  own it should not zero the whole week, but it is a real empty-producing
  branch inside the same pipeline.
- `src/rules/conditioningFeasibility.ts:299-308` — `resolveConditioningFeasibility`
  falls back to `removeConditioning(...)` when no substitution family
  resolves. Collapses conditioning app-wide only under a full-pause
  readiness state or an equipment/injury combination that exhausts every
  substitution family — a distinct, season-phase-agnostic zero-conditioning
  path, separate from the prompt/contract mismatch above.

## 6. Recommended systemic fix direction (not implemented)

Per MASTER_PLAN §1.4 (contract test both sides) and the CLAUDE.md
architecture-escalation rule (do not patch the same pipeline twice; find the
layer that should own the decision):

1. **Make the exposure contract and the generation prompt provably the same
   source of truth**, not two independently-authored descriptions of the
   same week. Today the contract (`weeklyExposureContractBuilders.ts`) is
   built from the deterministic plan, and the prompt (`generateProgram.ts`
   prose block) is a second, hand-written description of the same
   constraint aimed at the AI. A contract test that renders the *actual*
   `WeeklyExposureContractV2` for a Pre-season week into the prompt (instead
   of, or in addition to, hand-written prose) would remove the
   representation drift at its root, rather than adding a third
   reconciliation layer between them.
2. **Verify AI-delivered content against the plan's per-day expectation
   before trusting it**, at the exact point that currently trusts it
   verbatim (`defaultProgram.ts:1643`). This is the earliest point where the
   shortfall is knowable and the AI could in principle be asked to retry
   with a corrected day, instead of the shortfall surfacing four layers
   later as an opaque gateway rejection.
3. **Stop discarding `Section18WeekAcceptanceError`'s specific `userMessage`
   and `failureSignature`.** The generic catch in
   `generateProgram.ts:1455-1481` should distinguish this error type (or any
   error carrying a `userMessage`) from an actual parse/shape failure, both
   for user-facing copy and for the `diagnostic` string that reaches logs.
   This alone would have made G6 self-diagnosing rather than requiring this
   trace.
4. **A contract test asserting the prompt's Pre-season prose cannot
   describe a stricter restriction than the contract's own `required`
   floors allow**, so a change to either side (prompt wording or contract
   builder) that reintroduces this class of drift fails CI instead of
   surfacing as a dogfood report.

These are directions, not a plan — no code has been written. Per the
CLAUDE.md Coach Architecture Escalation Rule, the ownership question ("which
layer decides what the week's conditioning content actually is — the prompt
author, the contract builder, or the post-parse verifier — should be
resolved before any of the above is implemented, since #1 and #2 are
alternative ownership placements for the same decision, not additive
patches.

## 7. NOT COVERED (Process Law L2)

- **No live/device repro was run.** This diagnosis is a static code trace
  only; the specific athlete/week shape that reproduces G6 was not
  constructed or executed against the coach-chat edge function or the
  simulator. The "does the deterministic fallback also fail" question in
  §3 evidence-class and the exact `failureSignature` string for a real G6
  occurrence remain unconfirmed.
- **`section18WorkoutEvidence.ts` was not fully traced end-to-end** — how
  `conditioningRole` gets stamped onto a generated workout from raw AI
  exercise content was read only enough to identify it as the ledger's
  input, not verified line-by-line.
- **`stampPlannerDerivedSessionProvenance` / `rebindDerivedSessionProvenance`**
  (`src/rules/derivedSessionProvenance.ts`) were not traced — they run
  between candidate acceptance and final workout assembly
  (`generateProgram.ts:408-414, 434-439`) and were out of scope for this
  pass.
- **In-season and Off-season were assessed for structural exposure only**,
  via reading their contract builders and prompt sections — no device or
  fixture-based test was run against either phase to confirm or rule out
  the same failure actually reproduces there.
- **`coach-intent`, `coach-semantic-program-edit-draft`, and
  `coach-revision-proposal` edge functions were not examined** — this
  diagnosis is scoped to the `mode: 'generate'` / `update_program` path
  only (`coach-chat/index.ts`), not the scoped-edit tool paths.
- **No fix was implemented or tested.** §6 is a direction for review, not a
  plan; per CLAUDE.md this requires an ownership decision before any code is
  written.
- **iOS client build/UI layer not inspected** — this trace stops at the
  TypeScript/JS service layer (`src/services/api/generateProgram.ts`); how
  `ProgramGenError` is rendered in the native UI was not checked.
