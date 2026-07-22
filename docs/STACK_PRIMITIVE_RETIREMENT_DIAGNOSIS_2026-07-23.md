# Stack-Primitive Retirement Diagnosis — 2026-07-23

**Status: Design/diagnosis only — no code until this is approved.** This is a
draft for Sam's review, not an approved plan. It follows the Q1–Q7 format and
gate discipline of
`docs/SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md` (modelled closely on
that document's Stage 2 and Stage 5 diagnoses) and closes out the four
residuals its "Stage 3 landed" retirement ledger recorded so they are not
quietly dropped. All `file:line` references are at `main` HEAD `86750c9`.

---

## 0. What this continues

`docs/SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md` migrated Move, Bin,
Swap (including anchor-day) and empty-day Add off the legacy single-date
override writer onto the accepted-state transaction (`src/store/acceptedStateTransaction.ts`).
Its "Stage 3 landed" section (lines 691–707) left four residuals explicitly
un-migrated:

1. **Occupied-day STACK adds** — `add_category`/`add_template` onto a day
   that already has a session.
2. **`add_defers_to_legacy_stack`** — the shared error code both (1) and (4)
   return.
3. **`no_template_for_category`** — a category pick (swap or add) with no
   resolvable template.
4. **The removal-constraint re-add / restoration defer** — an add onto a day
   emptied by an active whole-DAY removal (`remainingWorkout: null`).

The exact code is `resolveAthleteMutation` in
`src/utils/planChangeProducer.ts:1058-1216`, with the two defer-sets at
`:1007-1020`.

---

## 1. Reproduction / current behaviour

### Target 1 — occupied-day stack add
`resolveAthleteMutation({ change: { kind: 'add_category', date, category }, ... })`
on a day that already has a session hits:

```ts
// planChangeProducer.ts:1142-1143
if (addDay.workout) return { ok: false, error: 'add_defers_to_legacy_stack' };
```

`ADD_DEFERS_TO_LEGACY.has('add_defers_to_legacy_stack')` is `true`
(`:1017-1020`), so both `previewPlanChangeRisk` (`:1328-1330`) and
`applyPlanChangeWithinTrace` (`:1652-1654`) fall through to
`buildPlanChangeProposal` → `applyCoachRevisionDateOverrides` → the legacy
single-date writer — the exact chain the main reassessment retired for
Swap/empty-day-Add (`SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md` Q6,
lines 234–241). Consequences carried over unchanged from that chain (Q4/Q6 of
the same doc): §18 is validated with `maxRepairAttempts: 1`
(`postGenerationConstraintValidation.ts:1477`), so a stack add can be
rejected for an off-target pre-existing condition, and no reversible
adjustment is recorded (no ledger entry, no typed Undo).

The tap menu already legalises exactly this action today
(`PlanChangeSheet.tsx:453-472`): `startAdd` allows an add while
`visibleSessionCount < 2`, `chooseAddKind` blocks a duplicate kind. The menu
believes stacking is safe; the resolver has no opinion of its own and defers.
This is the same "menu offered it, resolver/gate never validated it its own
way" shape the main reassessment's Q3 already named (`PlanChangeSheet.tsx:667-698`
discussion, lines 294-298 of that doc) — see §5 below for a related gap this
migration should close, not just paper over.

### Target 2 — `no_template_for_category` (shared code, swap and add)
Both branches call the identical function before doing anything ownership-specific:

```ts
// planChangeProducer.ts:1103-1104 (swap)         // planChangeProducer.ts:1155-1156 (add)
const template = resolveTemplatePlanChange(...)   const template = resolveTemplatePlanChange(...)
if (!template) return { ok:false, error:'no_template_for_category' };
```

`resolveTemplatePlanChange` (`:455-474`) is the **single** category→template
resolver in the file — `pickTemplateForCategory` (`:429-451`) is the only
thing that can return `null` (empty candidate pool for the category,
`:439`). The **legacy** proposal builder calls the exact same function at the
exact same failure point:

```ts
// planChangeProducer.ts:596-598 (buildPlanChangeProposal, legacy)
const resolved = resolveTemplatePlanChange({ change, visibleWeek: ctx.visibleWeek });
if (!resolved) return { error: 'no_template_for_category' };
```

There is one template-resolution function in the codebase, not two — see §4.

### Target 4 — restoration defer
```ts
// planChangeProducer.ts:1149-1154
const hasActiveRemoval = useProgramStore.getState().userRemovalConstraints.some(
  (constraint) => constraint.status === 'active' &&
    constraint.targetDate === change.date &&
    constraint.scope === 'whole_session' &&
    !constraint.remainingWorkout);
if (hasActiveRemoval) return { ok: false, error: 'add_defers_to_legacy_stack' };
```
This guard exists to stop the addition primitive from fighting an active
whole-day Bin. If it is simply deleted without anything else changing, the
addition primitive **crashes** rather than silently misbehaving — see §6,
this is not cosmetic, it is the load-bearing finding for this target.

---

## 2. The seven required questions

### Q1 — What is the current source of truth?
Same answer as the main reassessment (Q1 there): the accepted visible
snapshot (`AcceptedMaterialContext` + `userRemovalConstraints` +
`dateOverrides`), with the accepted-state transaction as the one already-correct
writer for Move/Bin/Swap/empty-day-Add. For the three targets here, the
**source of truth for "what happened to this day" is `UserRemovalConstraint`**
(`src/types/domain.ts:793-820`) when a typed constraint exists, and the legacy
`dateOverrides` entry otherwise. Nothing new is required at this layer — the
work is entirely in getting `resolveAthleteMutation` to route into it instead
of deferring.

### Q2 — How many representations of the user request exist?
Unchanged by this diagnosis; these three targets are trapped in
representation #2/#3 of the main reassessment's Q2 table
(`PlanChange` tap command, still capable of reaching the legacy override
writer) instead of graduating to #9 (accepted-state transaction). No new
representation is proposed — the fix reuses #9 for all three targets (see §4,
§6).

### Q3 — Where can intent, domain, date, target, or scope be reinterpreted?
One reinterpretation point is added by the **current** guard, not removed by
it: `hasActiveRemoval` (target 4) silently reinterprets an "add" tap as
"defer to legacy," discarding the fact that the day's Rest state is itself an
artefact of a prior athlete action (a Bin) with its own typed history. The tap
door never learns this — it just sees "That change isn't possible here
(add_defers_to_legacy_stack)" or a silent legacy-writer fallback. §6 below
traces exactly what state that reinterpretation is hiding.

### Q4 — Which layer should own the decision?
**The accepted-state transaction, via the constraint shape Swap already
uses — not a new primitive.** Concretely:

- Occupied-day stack add: same shape as `swap_session`
  (`resolveAthleteMutation:1116-1131`) — a whole-session
  `UserRemovalConstraint` whose `originalWorkout` is the day's **existing**
  workout and whose `remainingWorkout` is the merged/stacked workout — riding
  `commitAthleteSessionDeletionTransaction`, the same function Swap already
  calls (`applyPlanChangeWithinTrace:1693-1725`). See §4.
- `no_template_for_category`: no layer needs to "own" this differently. It is
  a business-logic hard stop reached identically by both writers today. See
  §5.
- Restoration defer: owned by the **existing** constraint-supersession logic
  already inside `stageAthleteMutationConstraint`
  (`acceptedStateTransaction.ts:2341-2349`), not a new mechanism. See §6.

### Q5 — What simpler architecture removes representations instead of adding guards?
Delete the two defer-set entries that gate targets 1 and 4
(`ADD_DEFERS_TO_LEGACY` at `:1017-1020`) once the resolver builds a legal
`swap_session`-shaped resolution for both cases, rather than adding a third
transaction primitive or a second guard layer. This is strictly subtractive:
two `Set` entries removed, zero new Sets, zero new gates. `no_template_for_category`
needs no change to be "correct" (see §5) — leaving it in the defer-sets is
inert, not wrong, but removing it is the tidier option per Q6 below.

### Q6 — Which legacy paths should be bypassed or retired rather than patched?
- The single-date override writer's remaining claim on occupied-day adds
  (`buildPlanChangeProposal` → `applyCoachRevisionDateOverrides`, reached via
  the target-1 defer) — retire in favour of
  `commitAthleteSessionDeletionTransaction`.
- The single-date writer's remaining claim on the restoration case
  (target 4) — retire; it collapses into whichever of the now-migrated
  branches (stack add, or plain empty-day add) the day's **true** state calls
  for once the stale constraint is superseded (§6).
- `no_template_for_category` is **not** a legacy-path retirement candidate —
  see §5 for why patching or migrating it changes nothing observable.

### Q7 — What tests prove the new ownership boundary?
See §7 — invariants **#11, #12, #13**, continuing the numbering already in
`src/__tests__/section18OwnershipInvariantTests.ts` (`1`..`10`, with `8a/8b/8c`
sub-letters for closely-related variants of one invariant).

---

## 3. Mechanism deep-dive — what "occupied-day stack" means in this codebase

Before proposing a constraint shape, the exact data shape a "stack" produces
has to be nailed down, because the answer determines whether anything new is
needed at all.

**A day is one `Workout` with a `sections[]` array; a "second session" is a
second section kind on the same `Workout`, not a second `Workout`.**
Evidence:

- `visibleSessionKindsForWorkout` (`planChangeProducer.ts:179-185`) derives
  the day's kinds from `workout.sections.map(s => s.kind)`.
- The menu caps stacking at exactly two kinds
  (`MAX_VISIBLE_SESSIONS_PER_DAY = 2`, `:175`) and blocks a repeated kind
  (`chooseAddKind`, `PlanChangeSheet.tsx:461-472`; `canAddOnTop` /
  `addOnTopCategories`, `planChangeProducer.ts:322-347`). Two visible kinds is
  the maximum shape a stack ever produces; a stack never touches a kind that
  is already present.
- **The merge logic already exists and is already exercised by the legacy
  writer today.** `materializeCanonicalPlanChangeCandidate`'s `rawCandidate`
  (`canonicalPlanChangeCandidateMaterializer.ts:192-198`):
  ```ts
  if (change.kind === 'add_template') {
    if (!source) return template;
    return stackTemplate({
      base: source, template,
      preservesTeamTraining: getTeamTrainingWorkoutState(source).hasTeamTraining,
    });
  }
  ```
  `stackTemplate` (`:112-171`) concatenates `exercises`, sums
  `durationMinutes`, keeps the base `Workout.id`, and preserves whichever of
  base/template owns strength vs conditioning metadata — including Team
  Training anchor preservation, generically, for adds as well as swaps. This
  is called by `materializeAthleteSwapSession`
  (`planChangeProducer.ts:1028-1051`, itself invoked by the add branch at
  `:1159`) — **the exact function the typed resolver already calls for the
  empty-day add case.** The occupied-day branch is one `if` away from reusing
  it; the merge behaviour needs no new code, only a path to reach it.
- Because a stack never removes the existing kind (menu-enforced today,
  see §7 invariant #12 for closing the enforcement gap at the resolver), the
  existing session's content is **never displaced** — it survives byte-identical
  inside the merged `Workout.exercises`. This directly answers the task's
  central question: **stacking displaces nothing and must never trigger
  relocation search or an authorised reduction.**

### Constraint shape for occupied-day stacking
Same whole-session pin shape Swap already uses
(`AthleteSessionDeletionTransactionInput`, `acceptedStateTransaction.ts:2036-2044`),
with one field flipped relative to Swap:

| Field | Swap (`swap_session`, existing) | Occupied-day stack (proposed) |
|---|---|---|
| `scope` | `'whole_session'` | `'whole_session'` |
| `originalWorkout` | the day's pre-swap workout | the day's pre-add workout (**same** — real, existing content, not a Rest placeholder) |
| `remainingWorkout` | materializer's full-replacement candidate | materializer's **merged/stacked** candidate (already produced by the same call when `source` is non-null, §3 above) |
| `equivalentExposureMayRelocate` | `true` — comment at `AthleteMutationResolution` (`:978-980`): *"the displaced session triggers the same relocation → authorised-reduction → disclosure path as Bin"* | **`false`** — nothing is displaced; the base session's exposure credit survives unchanged inside the merged workout |

Why `equivalentExposureMayRelocate: false` is not optional: this flag is the
only thing gating the relocation/reduction search in
`fixtureMinimalReplan.ts:596` (`if (constraint.scope !== 'strength_component'
|| !constraint.equivalentExposureMayRelocate) return [];` — a `strength_component`-scope
check, but the whole-session reduction fallback in the same file
(`:1258-1338`) is likewise a **last resort when the gateway is otherwise
`impossible`**, and adding content can only ever increase available exposure,
never create a shortfall on its own). Leaving it `true` on a stack would be
harmless in practice (there is no way to trigger it) but would misdescribe
the constraint's own semantics to any future reader — the reversible-adjustment
type comment for `remainingWorkout` already anticipates this shape verbatim:
*"remainingWorkout preserves the exact component semantics of a stacked-day
deletion"* (`src/types/domain.ts:790-791`).

`wholeDayRestOwned` and `markedDays` need **no new logic**: both already fall
out correctly from the existing computation because `remainingWorkout` is
non-null (`stageAthleteSessionDeletionTransaction:2498`,
`wholeDayRestOwned = scope === 'whole_session' && !remainingWorkout` →
`false`; `markedDays[date] === 'rest'` is never true on an occupied day to
begin with).

### The one genuinely new piece: honest ledger labelling
`stageAthleteSessionDeletionTransaction` derives its
`ReversibleAdjustmentKind` internally: `scope === 'whole_session' ?
'session_delete' : 'session_component_delete'`
(`stageAthleteMutationConstraint` caller at `acceptedStateTransaction.ts:2410-2414`).
For a stack, nothing was deleted — recording `session_delete` would mislabel
the ledger entry (wrong Undo copy, wrong audit trail) for an action that is,
semantically, an add. `stageAthleteMutationConstraint` already accepts an
`adjustmentKind` override for exactly this reason — it is how the empty-day
addition primitive records `'session_add'` while reusing the removal
machinery (`acceptedStateTransaction.ts:2331-2333`, `:2774`). The additive fix
is to thread that same optional override through
`stageAthleteSessionDeletionTransaction`/`commitAthleteSessionDeletionTransaction`'s
public signature (default unchanged, so every existing Move/Bin/Swap caller
is untouched) so a stack can pass `adjustmentKind: 'session_add'` — the enum
value already exists (`reversibleAdjustmentLedger.ts:29-30`), only its doc
comment ("onto a previously empty/rest day") would need widening to also
cover "onto an occupied day, merged."

### Duplicate-kind / cap enforcement must move into the resolver, not stay menu-only
Today, **nothing but the tap menu** enforces "no duplicate kind" or "max two
kinds." `stackTemplate` merges unconditionally; `buildPlanChangeProposal` /
`applyCoachRevisionDateOverrides` have no kind check either. A caller that
reaches `add_category`/`add_template` without going through
`PlanChangeSheet.chooseAddKind` (a future coach-door caller, in particular —
see the main reassessment's Stage 5 diagnosis, which found exactly this "menu
validates, nothing else does" shape for a different action) would silently
double-stack today. Migrating occupied-day adds to the typed resolver is the
right moment to close this, by having `resolveAthleteMutation` call the
**already-existing** pure helpers directly —
`visibleSessionKindsForSnapshot`/`categoryAddsSessionKind`/
`MAX_VISIBLE_SESSIONS_PER_DAY` (`:175-209`) — the same functions
`listPlanChangeOptionsForDay` already uses to build the menu
(`:322-347`). No new rule is invented; an existing rule that currently lives
in exactly one UI screen gets a second, independent enforcement point at the
layer that actually commits the mutation — closing a latent gap, not adding a
guard to a parallel door (the CLAUDE.md escalation rule's forbidden move is
adding a *new* guard to work around a *different* layer's mistake; this is
the owning layer enforcing its own precondition with logic that already
exists).

---

## 4. Elegant Solution comparison — Target 1 (occupied-day stack add)

### Option A — a new dedicated transaction primitive
Build `commitAthleteSessionStackTransaction`, duplicating
`stageAthleteMutationConstraint`'s repair/disclosure/ledger wiring for a third
time (Move, Bin/Swap, and now Stack each get their own top-level commit
function).

- **Verdict: reject.** Everything this primitive would need — the whole-session
  pin, the repair call, the disclosure derivation, the `already_applied`
  short-circuit — already exists verbatim in
  `commitAthleteSessionDeletionTransaction`. A new primitive duplicates
  logic that is otherwise identical, purely to get a different label on the
  ledger entry, which the existing `adjustmentKind` override parameter
  already solves without duplication.

### Option B — reuse `commitAthleteSessionDeletionTransaction` (recommended)
Extend `resolveAthleteMutation`'s add branch: when `addDay.workout` exists,
independently check duplicate-kind/cap (§3), and if legal, build a
`swap_session`-shaped resolution (`AthleteMutationResolution` already has
this variant, `:978-987`) with `equivalentExposureMayRelocate: false` and
(via the additive `adjustmentKind` passthrough, §3) `'session_add'` recorded
on the ledger. `applyPlanChangeWithinTrace`'s existing `swap_session` branch
(`:1693-1725`) and `previewPlanChangeRisk`'s existing handling need **no
change** beyond accepting the same resolution kind for this new source; only
the done-message needs a small `athleteStackDoneMessage` variant (mirroring
`athleteAdditionDoneMessage`'s "added" voice, `:1913-1928`, rather than
`athleteSwapDoneMessage`'s "is now on" voice, `:1875-1906`, since a stack adds
alongside rather than replacing).

- **Verdict: recommend.** Zero new mutation primitives, zero new repair
  logic, zero new §18 interaction paths. It reuses the exact mechanism Swap
  already proved out in Stage 2/3 of the main reassessment, changing only a
  boolean flag or a message-copy branch — precisely the "reduce
  representations, don't add a resolver" outcome CLAUDE.md's Elegant Solution
  Requirement asks to prefer.

---

## 5. Target 2 verdict — `no_template_for_category` is not a residual

**Conclusion: this is a genuine business-logic hard stop, identical under
both writers, and does not need migration.**

Evidence, not assertion:

- `resolveTemplatePlanChange` (`:455-474`) is called by the typed resolver
  (`:1103`, `:1155`) and by the legacy proposal builder (`:597`) — **the same
  function**, not two independent implementations that could drift.
  `pickTemplateForCategory` (`:429-451`) is the only source of `null`, and it
  is unconditional on which writer calls it.
- The user-facing failure is byte-identical regardless of which writer
  reaches it: the typed-resolver early exit produces
  `` `That change isn't possible here (${resolution.error})` `` (`previewPlanChangeRisk:1343-1350`,
  `applyPlanChangeWithinTrace`'s equivalent at `:1655-1665`); the legacy path
  produces the same template from the same string
  (`previewPlanChangeRisk:1430-1437`, driven by `buildPlanChangeProposal`'s
  `{ error: 'no_template_for_category' }` at `:598`). Neither path creates a
  constraint, a transaction, or a ledger entry — both are pure early returns.
  `blockedAssessmentForBuildError` (`:1218-1251`) does not special-case this
  code either way (it only intercepts `protected_anchor_day`/`protected_game_day`).
- Therefore whether `no_template_for_category` stays in
  `SWAP_DEFERS_TO_LEGACY`/`ADD_DEFERS_TO_LEGACY` (deferring to the identical
  legacy code path) or is removed from those sets (the typed resolver's own
  early return handles it directly, which it already does at `:1104`/`:1156`
  before the defer-set is even consulted) is unobservable to the athlete and
  to the ledger. There is no ownership asymmetry to close here — both writers
  already agree, via one shared function.

**Recommendation:** treat this as **not** a fourth residual requiring a
primitive decision. Purely as Q5 tidiness (not required for correctness),
remove `'no_template_for_category'` from both defer-sets once targets 1 and 4
land, since at that point it is dead weight (the typed resolver's own
early-return at `:1104`/`:1156` fires first regardless, so the defer-set
membership is never actually consulted for this code — see the ordering in
`resolveAthleteMutation`, template resolution happens before either add-specific
guard). No test is proposed for this target; there is no behaviour change to pin.

---

## 6. Target 4 — the restoration defer, worked through mechanically

### Why "just delete the guard" would crash, not misbehave
The instinct to test first: what does `commitAthleteSessionAdditionTransaction`
actually see if the `hasActiveRemoval` guard (`:1149-1154`) is simply removed?

`stageAthleteSessionAdditionTransaction` (`acceptedStateTransaction.ts:2690-2776`)
derives its Rest placeholder from `accepted.composedWorkouts`
(`rebaseAcceptedEffectiveWeek`'s output, `:2708-2712`):
```ts
const restPlaceholder = accepted.composedWorkouts.find(
  (workout) => workout.dayOfWeek === dayOfWeek) ?? null;
if (!restPlaceholder?.id) {
  throw new Error('Athlete addition requires a base day placeholder to pin against');
}
```
`composedWorkouts` is `applyUserRemovalConstraintsToWeek`'s output
(`acceptedEffectiveWeek.ts:128-132`). For a whole-day removal with
`remainingWorkout: null`, that function's loop (`userRemovalConstraints.ts:37-63`)
does this:
```ts
workouts = workouts.filter((workout) => workout.dayOfWeek !== dayOfWeek);
if (constraint.remainingWorkout) { workouts.push(...) } // false here — nothing pushed
```
**The day is filtered out of `composedWorkouts` entirely — it is not
represented as a synthetic `Rest` `Workout`, it is simply absent.** So
`restPlaceholder` would be `null`, and the addition primitive throws its own
malformed-identity error immediately. Removing the guard alone does not
produce a subtly-wrong add; it produces a hard crash on the very first line
of the addition primitive that touches this day. This rules out the naive
fix outright and is why the task's framing ("this is a restoration, not a
net-new add") is the right frame, not a stylistic one.

### Why inventing a "fall back to the raw base workout" fix would still be wrong
Suppose the addition primitive were patched to fall back to the day's
`base_microcycle` workout (from `rebaseAcceptedEffectiveWeek`'s
pre-removal-constraint `dates` array, `acceptedEffectiveWeek.ts:112-125`) when
`composedWorkouts` omits the day. That produces a **second** active
`UserRemovalConstraint` on the same date. Follow what happens to the **old**
one: `stageAthleteMutationConstraint`'s constraint-list rebuild
(`acceptedStateTransaction.ts:2341-2349`) already has a same-date replacement
rule:
```ts
const userRemovalConstraints = [
  ...state.userRemovalConstraints.filter((candidate) =>
    candidate.id !== args.constraint.id && !(
      candidate.status === 'active' &&
      candidate.targetDate === args.constraint.targetDate &&
      (args.constraint.scope === 'whole_session' || candidate.scope === args.constraint.scope)
    )),
  args.constraint,
];
```
Because the new constraint's `scope` is `'whole_session'`, this filters the
**old** removal constraint out of `userRemovalConstraints` unconditionally —
but it does **not** touch `reversibleAdjustmentLedger.adjustments`. The old
Bin's ledger entry stays `status: 'active'`, `linkedUserRemovalConstraintIds:
[<old id>]`, pointing at a constraint id that no longer exists anywhere in
the store. That is an **orphaned, still-"active," still-Undo-able-looking**
ledger record: if the athlete later taps Undo on the (now-invisible) old Bin
adjustment, `stageClearReversibleAdjustment` → `restoreOwnedSurfaces`
(`reversibleAdjustmentTransaction.ts:594-684`) restores `dateOverrides`/
`weekScopedOverlays` back to the pre-Bin state and tries to flip
`constraint.status` to `'restored'` for an id that is not in
`surfaces.userRemovalConstraints` — a silent no-op on the constraint side
while the day's *content* gets reverted out from under whatever the new add
just placed there. This is exactly the "undisclosed side effect" bug class
(Bug 3) the main reassessment retired Bin for — reintroducing it here for Add
would be a regression of the same shape the whole migration exists to close.

### The correct route: this is genuinely "restoration," and it is already owned
The existing same-date constraint-replacement rule quoted above
(`:2341-2349`) is **already the general mechanism** for "a new athlete
mutation on this date supersedes whatever typed constraint was here before" —
it is not new machinery, it already runs for every Move/Bin/Swap/Add commit
today. The bug is not that this mechanism is missing; it's that it
**silently orphans the reversible-ledger side** of the superseded constraint
whenever the constraint being replaced is not the ledger-linked one the
caller expects (this is a **pre-existing sharp edge in the shared primitive**,
not something specific to Add — it would equally mishandle a Bin re-issued
on top of another active Bin, which the identity check at
`stageAthleteSessionDeletionTransaction:2476-2488` currently avoids only by
returning `already_applied` for an **exact identity match**, not for an
overlapping-but-different one like this case).

The fix that closes target 4 without inventing anything new:
**before staging the add, explicitly clear the stale whole-day removal
constraint through the existing typed restoration path**
(`stageClearReversibleAdjustment`, found via
`linkedUserRemovalConstraintIds.includes(oldConstraintId)` —
the same function the Undo button already calls,
`programControlActions.ts`/`useHomeScreen.ts`). That call is exactly what
"restoring" means everywhere else in this codebase: it reverts the day to its
pre-Bin state, reverses any authorised reduction the Bin recorded (if
relocation had been impossible), and marks both the constraint and its ledger
entry consistently (`status: 'restored'` / `'cleared'`) — no orphan, no
double-bookkeeping.

**What the day looks like immediately afterward determines which
already-migrated branch finishes the job — no new primitive is needed either
way:**
- A whole-day Bin, by construction, can only ever apply to a day that had
  real content (`resolveAthleteMutation`'s remove branch requires
  `sourceDay.workout`, `:1183-1185`; the menu's Bin entry point requires
  `hasSession`, `PlanChangeSheet.tsx:336`). So clearing it **always** reveals
  an occupied day underneath, never an empty one.
- Therefore the restoration case, once the stale constraint is cleared, is
  **always** exactly Target 1 (occupied-day stack add) — never the
  already-shipped empty-day add path. Target 4 does not need its own
  mechanism at all: it needs (a) the explicit typed clear as its first step,
  then (b) whatever Target 1's resolution produces.

### Elegant Solution comparison — Target 4
- **Option A — teach the addition primitive to tolerate a missing placeholder.**
  Patch `stageAthleteSessionAdditionTransaction` to fall back to the raw base
  workout when `composedWorkouts` omits the day. **Reject** — shown above to
  orphan the old removal's ledger entry; a guard/fallback of exactly the kind
  CLAUDE.md's Stop-Patching Trigger names ("fallback to legacy" cousin:
  fallback inside the primitive to paper over a stale constraint it was never
  meant to see).
- **Option B — explicit clear-then-resolve (recommended).** Before resolving
  an `add_category`/`add_template` whose target date carries an active
  whole-day removal constraint, stage the existing typed clear for that
  constraint's linked ledger entry, then re-run `resolveAthleteMutation` against
  the now-current visible week (which will resolve as Target 1's occupied-day
  stack, or — if for any reason the day is not occupied post-clear — the
  already-shipped empty-day add). Zero new primitives; reuses the Undo
  mechanism and Target 1's mechanism, in sequence.

---

## 7. Tests-first invariants (RED, continuing the existing numbering)

The suite is `src/__tests__/section18OwnershipInvariantTests.ts` (numbered
`1`–`10`, with `8a/8b/8c` as closely-related sub-variants of one invariant —
confirmed by grep, no other numbering scheme is in use). These continue the
sequence as `11`–`13`. Per repo convention (see the suite's header comment),
these describe **correct post-migration behaviour** and are expected to FAIL
against the current architecture — that failure is what proves each one pins
the residual it targets.

- **#11 — occupied-day stack: no displacement, transaction-owned.**
  Seed a day with exactly one visible kind (e.g. MON, Lower Body Strength —
  `strength` only). `add_category` a `conditioning_light` session onto it.
  Assert: (a) the result succeeds; (b) the day now has both kinds
  (`strength` and `conditioning`); (c) every exercise row that was on the day
  **before** the add is still present, byte-identical, after; (d) no
  `authorisedReductions` entry with `reason: 'explicit_user_override'` exists
  for that date; (e) a reversible-adjustment ledger entry exists for that
  date (transaction-owned, mirroring invariant #10's ownership assertion).

- **#12 — duplicate-kind is resolver-owned, not menu-only.**
  Same seed. `add_category` a **second** `strength_*` category onto MON
  (already `strength`-only) via `resolveAthleteMutation`/`applyPlanChange`
  directly — i.e. bypassing `PlanChangeSheet.chooseAddKind`'s menu-level
  block entirely. Assert the typed resolver itself rejects it (a stable,
  named rejection — not a silent double-stack, and not a crash), proving the
  duplicate-kind rule is enforced by the layer that commits the mutation, not
  only by the tap screen. (RED today: neither the typed resolver's occupied
  branch — currently a blanket defer — nor the legacy writer it defers to
  enforces this at all; a direct call double-stacks silently.)

- **#13 — restoration collapses to the stack path, no orphaned ledger entry.**
  Seed a day with content, Bin it whole-day (`remove_session`, `scope:
  'whole_day'`), confirming an active `reversibleAdjustmentLedger` entry and
  `UserRemovalConstraint` exist for that date. Then `add_category` onto the
  same (now-Rest) date. Assert: (a) the add succeeds (no
  `add_defers_to_legacy_stack`, no crash); (b) the **original** Bin's ledger
  entry is `status: 'cleared'` (not left dangling `'active'` with a
  constraint id that no longer resolves); (c) exactly one **active**
  constraint exists for that date afterward, matching the add; (d) the
  resulting day and ledger entry are indistinguishable from directly running
  invariant #11's stack scenario against the day's pre-Bin content (i.e.
  "Bin then Add" and "stack-add directly" converge on the same accepted
  state) — proving Target 4 needed no mechanism of its own.

No invariant is proposed for `no_template_for_category` (§5): there is no
behavioural difference to pin between the two writers, so a test asserting
"they behave the same" would not be falsifiable in a way that matters — both
already call the one shared function.

---

## 8. Retirement ledger update (post-diagnosis, pending approval)

Carrying forward `SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md`'s "Stage 3
landed" ledger (lines 691–707). If this diagnosis is approved and implemented
as recommended (§4 Option B, §6 Option B):

**What would move onto the accepted-state transaction (retired off the
legacy writer):**
- Occupied-day STACK adds — via `commitAthleteSessionDeletionTransaction`
  (reused, not a new primitive), `equivalentExposureMayRelocate: false`,
  ledger-labelled `session_add` via the additive `adjustmentKind` override.
- The removal-constraint re-add/restoration case — via the existing typed
  clear (`stageClearReversibleAdjustment`) followed by the now-migrated stack
  path; no new mechanism.

**What would remain on the legacy writer:**
- Nothing from this diagnosis's three targets. `no_template_for_category`
  is not a legacy-writer claim to retire — both writers already reach it via
  one shared function with identical observable behaviour (§5).
- Everything the main reassessment's Stage 5 diagnosis already tracked as
  open (the dev-gated active coach-revision-proposal route,
  `SECTION18_OWNERSHIP_REASSESSMENT_2026-07-22.md` §"Stage 5 diagnosis") is
  untouched by this document and remains a separate, already-recorded item.

**If approved, this closes the Stage-3 retirement ledger in full** — after
`#11`/`#12`/`#13` land green, the legacy single-date override writer would no
longer own any Swap/Add case; its remaining callers would be limited to
non-athlete-owned `PlanChange` kinds this document does not touch (registry/coach
free-text revisions, tracked separately under the Stage 5 item above).

---

## 9. Recommendation summary

| Target | Owning mechanism | New primitive? | New guard/resolver? |
|---|---|---|---|
| 1. Occupied-day stack add | `commitAthleteSessionDeletionTransaction` (reused) | No | No — reuses existing kind/cap helpers, moved one layer down |
| 2. `no_template_for_category` | Already single-owned (`resolveTemplatePlanChange`) | N/A — not a residual | No |
| 3. (shared code with #1) | — | — | — |
| 4. Restoration defer | Existing typed clear (`stageClearReversibleAdjustment`) → Target 1's path | No | No — sequencing only |

Per the Elegant Solution Requirement, every recommended fix in this document
is subtractive or additive-and-optional (removing defer-set entries,
threading one optional passthrough parameter, calling existing helper
functions from a new call site) — none introduces a new transaction
primitive, a new resolver, or a new guard layer. This is consistent with the
main reassessment's Q5/Q6 direction and, if approved, fully closes the Stage-3
retirement ledger.

**This diagnosis is not an approved plan.** Per `CLAUDE.md`'s escalation rule,
no implementation should begin until Sam approves the ownership routes in §4
and §6 (in particular: the `adjustmentKind` passthrough signature change to
`stageAthleteSessionDeletionTransaction`/`commitAthleteSessionDeletionTransaction`,
and the explicit clear-then-resolve sequencing for Target 4) and the
tests-first invariants in §7 are written RED before any of §4/§6 is
implemented.
