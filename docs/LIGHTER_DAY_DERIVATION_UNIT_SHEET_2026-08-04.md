# Lighter-day derivation — unit sheet, 2026-08-04

**Ruled:** Option C item 4 (Sam, 2026-08-03) — *"Lighter-day converts to a
derived effect of its recorded readiness fact through the ruled deriving lane
(the decision is already in the ledger; the stored trim becomes a
derivation)."*

**Status:** scouted, not started. Sam ruled 2026-08-04 that it is **a unit, not
filler** — two test conversions plus new walker vocabulary under L11 — and
assigned it to Stage B stage 1 Task D rather than tonight.

**This sheet exists so the executing session does not re-scout.** Every receipt
below was read this session on `main` `936bbf7`.

---

## 1. What the flow does today

**The one UI trigger.** The offer appears inside the week-readiness sheet, and
only after a *today-scoped* readiness report:

- `src/screens/home/HomeScreenV2.tsx:896-923` — `WeekReadinessSheet` props.
  `onApply` (`:899-909`) commits the readiness tier, then sets
  `lighterDayOffer` **only** when the kind is
  `tired_today | poor_sleep_today | sore_today | illness_mild` **and**
  `result.ok`.
- `:910-921` — `onAcceptLighterDay` calls
  `applyLighterDayForToday({ date, todayISO: date })`.
- `:2323-2344` — the offer block. TestIDs
  `home-week-readiness-lighter-offer`, `readiness-lighter-accept`,
  `readiness-lighter-decline`. Promise text: *"I'll keep your main lift but trim
  the volume, drop any finisher, and ease hard conditioning. Nothing permanent
  — you can undo it anytime."*

**The writer.** `src/utils/lighterDayTransaction.ts:62-103`
(`applyLighterDayForToday`):

| Step | Lines | What |
|---|---|---|
| resolve today | `:66-70` | `resolveDateWithConditioning(date, buildScheduleStateImperative())` — reads the **live resolved** day, not the accepted week |
| compute trim | `:72-75` | `applyLighterDayTrim(...)`; empty changes → refuse |
| **the write** | `:77-84` | `captureAcceptedLoadEditLedgerBaseline()` then `applyProgramOverrideWrite({ date, workout: trimmed, writer: 'lighter_day' })` |
| record decision | `:86-95` | `commitExplicitLoadEditLedgerFromBaseline({ sourceActionOrIntentId: 'readiness_lighter_day:<date>', affectedDates: [date], sourceActor: 'athlete', sourceSurface: 'program_tab', sourceFactId: activeReadinessFactIdForDate(date) })` |
| disclosure | `:35-40` | ends *"You can undo this anytime by clearing \"Not 100% today\"."* |

`activeReadinessFactIdForDate` (`:45-54`) takes the **first** active non-injury
fact of kind `fatigue | soreness | poor_sleep | illness` whose horizon covers
the date (`durableFactHorizon.ts:118-120`). *First match wins; there is no
tie-break if two readiness facts cover the day* — worth a glance during the
build, not a blocker.

## 2. The three facts that make this conversion cheap

**(a) The trim function is already pure and already shared.**
`src/utils/lighterDayTrim.ts:47-97`. Input `Workout`, output
`{ workout, changes: string[] }` (`:24-28`). It imports **only types**
(`:22`) — no store, no clock, no React. **L14-clean already.** Behaviour:
main-strength row byte-identical (`:32-36`, `:58-60`, positional fallback
`:53-57`); accessories halved `ceil(n/2)` floor 1 (`:38-40`, `:61-67`);
finisher dropped (`:73-76`); `high-intensity` conditioning eased to `aerobic`
(`:77-81`); disclosure lines summarised (`:83-86`).

**It already has a second consumer on the other side of the boundary:**
`postGenerationConstraintValidation.ts:375` — the short-on-time time-cap calls
`applyLighterDayTrim(alignedWorkout).workout` plus `durationMinutes: timeCap`
(`:374-378`), anchored days exempt (`:369-373`, `:381-386`). So the very
transformation this unit needs to derive is *already being derived* elsewhere,
by a constraint predicate keyed on a dated fact. **This unit is making the
lighter-day path look like the short-on-time path.**

**(b) The decision is already recorded, and nothing reads it.**
Grep for `readiness_lighter_day` returns **exactly one hit — the construction
site** (`lighterDayTransaction.ts:88`). The id is consumed only generically, in
`reversibleAdjustmentLedger.ts:504` (hashing) and `:173` (the record's own
field). **The visible effect comes entirely from `dateOverrides`** via the live
resolver's Priority 1 (`sessionResolver.ts:951-963`), where `manualOverrides`
is fed from `dateOverrides` (`coachWeekDiff.ts:191`). Note `sessionResolver.ts:918-921`:
`source === 'manual'` days are also **skipped by the injury filter**, so the
stored trim is currently exempt from later injury re-filtering — a behaviour
delta to think about when it becomes an overlay.

**(c) The lane already admits this fact kind.**
`src/store/temporarySourceFactTransaction.ts:573-608` — *"THE FACT'S RULED
EFFECT OWNS ITS COMMIT LANE"*. `isRuledDerivingConstraint` (`:594-601`) already
returns true for `type === 'fatigue'`. The deriving branch is
`commitDerivingSourceFactScopedRegen` (`:438-530+`, called `:684-696`).

**The precedent to copy is TEAM-NIGHT MOVE** (`:474-499`): it authors a
**sparse overlay directly** instead of regenerating the week — which is exactly
what a single trimmed day needs. `buildDerivingSourceFactAdjustment` (`:490`)
is the fact-linked reversible adjustment; commit is atomic with
`operation: 'forward_decision'` (`:512-516`).

## 3. Target shape

- Write a **sparse `WeekScopedWorkoutOverlay`**: `workoutsByDate: { [date]: trimmed }`,
  `reason: 'readiness_reduction'` — **already in the union**
  (`types/domain.ts:981-1007`), no new vocabulary needed.
- Record the fact-linked reversible adjustment (team-night shape), keyed on
  `sourceFactId`.
- **Write nothing to `dateOverrides`.**
- Same trim, same refusal-on-empty-changes, same disclosure copy — this unit
  changes the CHANNEL, not the athlete's experience.
- Emit to the action tape from birth (instrumentation rule). The accept is an
  athlete decision, so the event name also belongs in `DECISION_EVENTS`
  (`athleteActionLog.ts:120-153`) so a transaction's own chatter cannot evict
  it.

**Why the overlay surface is the right target, in the north star's terms:**
`programStore.ts:1179-1190` already declares the overlay *"derived content
authored by a fact, not by the athlete"* — which is precisely what a trim
derived from a readiness fact is. The derived-repair ruling (Sam, 2026-07-30)
put repairs there for the same reason.

**Retire the writer id.** Remove `'lighter_day'` from `ProgramOverrideWriterId`
(`programStore.ts:2577`). After that a lighter-day override write is a
**compile error**, which is the structural guarantee this unit is buying.

## 4. Undo — already generic, should survive unchanged

Two routes, neither lighter-day-specific:

1. **Cascade on fact clear (the promised undo).**
   `programControlActions.ts:1586-1598` — on `clear_fatigue_status`, resolve the
   fact id, then `ledger.adjustments.filter(a => a.sourceFactId === factId && a.status === 'active')`
   and `clearReversibleAdjustment(a.id, revision)` each, before resolving the
   fact. Success copy `:1614` — *"Cleared — today's back to its original
   session."*
2. **Direct clear.** `reversibleAdjustmentTransaction.ts:840-907`
   (`clearReversibleAdjustment`), staged `:612`, committed `:814`.

Because both key on `sourceFactId` and not on the surface, **the cascade should
work unchanged.** Confirm it rather than assume it — that is what R12 below is
for.

## 5. The tests that convert (both in the same commit)

**`src/__tests__/readinessSourceFactOwnershipTests.ts`**

| Cell | Line | What happens |
|---|---|---|
| R4 trim-transform | `:340` (calls at `:356`, `:386`) | Pins the **pure function**. Should NOT change. |
| **R5 progression-guard** | `:401`, comment `:419` | **CONVERTS.** Its comment names the dateOverride channel explicitly. New assertion: overlay entry exists for the date, `dateOverrides` untouched. The progression invariant (next week's strength byte-identical) is unchanged. |
| R6 single-owner | `:459` (asserts `:477-481`, `:487`, `:500-502`) | Semantics unchanged — verify `applied.changes` non-empty, `adjustmentId` present, today lighter, readiness fact survives undo. |
| **R12 cascade-undo** | `:657` (`:676-688`, `:692-701`, `:703-722`) | Semantics unchanged, mechanism changes: restoration is now overlay removal. Byte-identical restore must still hold. |

**`src/__tests__/programOverrideOwnershipTests.ts:291-325`** — **CONVERTS.**
Uses `writer: 'lighter_day'` as its "a normal write must land" case (`:308`,
asserted `:318`). Switch to a surviving writer id when `'lighter_day'` leaves
the closed union.

**Watch out:** `weeklyReadinessCardTests.ts:504` and `:510` are **source-text
assertions** on the sheet's render guard (`HomeScreenV2.tsx:2364`). Brittle to
any JSX reshuffle — this unit should not need to touch the sheet at all, but if
it does, expect these.

## 6. What L11 obliges in the same stage

**The walker has NO lighter-day vocabulary** — grep for `lighter` across
`src/dev/e2e/` returns zero hits; the accept button has no explorer binding and
no walker action kind. The only mention is the declared gap comment at
`athleteActionWalkerTests.ts:2464-2482` (the LR-1 cell), which lists *"the
COACH pipeline …, the lighter-day transaction, and LR-3's §18 residuals"* as
what still writes `dateOverrides`.

So the unit must add an action kind — `accept_lighter_day` — gated on the same
condition the real offer is (`HomeScreenV2.tsx:906-908`: a today-scoped
readiness fact of one of the four kinds, and `result.ok`), performing through
the real `applyLighterDayForToday` door. Both tiers green
(`test:action-walker`, `test:action-walker:deep`).

If random reachability proves too thin to put it in the non-vacuity
required-proposals list (`athleteActionWalkerTests.ts:2532-2565`), cover it
with a deterministic cell instead — declare a fact, accept, laws hold, clear,
restored — and say so rather than listing an action the proposer rarely emits.

**After this unit, the LR-1 cell's claim text (`:2464-2482`) narrows**: with
Task A already done, lighter-day is the last non-coach writer, so the line
becomes *no athlete-reachable door writes `dateOverrides`* — coach pipeline
only. Update it in the same commit.

## 7. Predicted differential movement

**ZERO.** The stage-B generation differential pins **fresh generation only** —
no athlete history, no readiness facts, no overrides. This unit touches the
lighter-day door and the reversible-adjustment lane; it changes no file on the
generation path. If the golden moves, that is unpredicted movement and a STOP.

## 8. Sequencing note

Task A (`0221d4d`) already removed the athlete routes into the legacy override
writer. This unit removes the last *athlete-initiated* writer of
`dateOverrides` outright. **Do it after the stage-1 deep-walker red is
settled**, not beside it — the walker is this unit's own acceptance instrument
and it must be trustworthy before the unit leans on it.

## 9. Left open, deliberately

- **The injury-filter exemption delta (§2c).** A stored override is exempt from
  the injury filter; an overlay is not. Whether a lighter day should survive
  injury re-filtering is a **behaviour question, not a refactor** — surface it
  rather than deciding it inside the conversion.
- **The two-facts tie-break** in `activeReadinessFactIdForDate` (`:45-54`).
- **The hydration-repair in-place branch** (`programStore.ts:1216-1219`) keeps
  re-repairing athlete-authored overrides. Once lighter-day leaves that surface,
  the population it repairs shrinks to coach writes and restores — whether it
  should then narrow is Sam's, already parked from stage 0.
