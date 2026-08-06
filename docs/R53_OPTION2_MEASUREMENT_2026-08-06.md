# R5.3 — OPTION 2 MEASUREMENT — 2026-08-06

Sam ruled "measure option 2 first, don't build" on the STOP filed at
`9043c5c2`. This is that measurement. **Nothing is committed as product code.**
The prototype below was built, measured, and reverted.

Three things were asked. All three are answered, and the third **inverts the
freed-day ruling's stated grounds while leaving its written carve-out exactly
right.**

---

## §1 THE PROTOTYPE THAT WAS MEASURED

Two edits, throwaway, never committed:

1. `weekRebuild.ts` leg (i) — instead of `commitWeekScopedOverlay(null, …)`,
   publish `{...projection.overlay, workoutsByDate: {}}`: the rebuilt
   **declaration**, none of the **content**.
2. `section18OfferPlacement.presentDeclaredOffer` — made symmetric. It already
   placed a shortfall; it now also withdraws a surplus, reusing
   `stripConditioningComponent`'s exact body.

## §2 MEASUREMENT 1 — BLAST RADIUS ACROSS THE CONTRACT-READ SITES

**Cheaper than the reassessment priced. No signature change is needed
anywhere**, and the shape is already a supported one.

- `WeekScopedWorkoutOverlay.workoutsByDate` is `Record<string, Workout | null>`.
  A contract-only overlay is `{}` — every day falls through to base.
- **Sparse overlays are already ruled and already shipped.** The type's own
  doc-comment describes `team_night_move` as a "sparse two-date overlay; every
  other day falls through", and `programStore:1386` already mints a
  contract-carrying overlay whose `workoutsByDate` holds only repaired days.
- `commitWeekScopedOverlay` needs **no change**: it stores whatever overlay it
  is handed.
- Composition falls through correctly. Both readers gate on key presence, not
  on the overlay object: `dayPrecedence.ts:154` and `sessionResolver.ts:937`
  use `hasOwnProperty`.

The two sites that explicitly test for an empty overlay were the named risk.
**Both are safe:**

| site | behaviour on a contract-only overlay | verdict |
|---|---|---|
| `programStore:1117` | the "empty placeholder" branch requires no contract **and** no workouts; a contract-only overlay has a contract, so it takes the normal path and its contract gets safety-applied | correct |
| `programHydrationIngress:159` | `hasWorkouts` is false, so the protocol-version check is skipped and hydration proceeds | safe, but see below |

**One gap found and declared, not fixed:** `programHydrationIngress:159` only
version-checks an overlay's contract when the overlay **has workouts**. A
contract-only overlay would carry an unversioned contract past that gate. It is
latent today (nothing mints one yet); if option 2 lands, that condition must
become "has workouts **or** has a contract".

## §3 MEASUREMENT 2 — DOES ANY SUITE DEPEND ON THE STALE CONTRACT?

**Exactly one assertion fails, and it is the one V3 itself wrote two commits
ago — not a pre-existing law.**

`acceptedStateTransactionTests.ts:1059`, in the property V3 INVERTED at
`0d913c1e`:

```
assert(!useProgramStore.getState().weekScopedOverlays[WEEK_START],
  'the fixture MOVE published a stored week for the week it decided …');
```

Option 2 stores a declaration there, so this fails **by design**. Its honest
option-2 form is "the decided week may carry a DECLARATION, but never
CONTENT" — which is a *third* statement of that property in one day. That is
the cost to weigh: the cell has now moved twice, and
`expectation-edited-to-match-regression` says to ask which side moved. Here the
DESIGN moved, both times, deliberately.

With that one assertion relaxed to option 2's statement — **for measurement
only, and reverted** — the full bible printed:

**`TRUE_EXIT=1`, off the printed line — and it stopped at suite 8 of 156.**

`test:athlete-session-deletion` fails **16 cells** (regressions 16/24,
properties 0/5, mutations 0/3), every one of them on the same seed
precondition:

```
bye-build hard conditioning template missing from both the rebuilt week
and the accepted week
```

That is **the same 16-cell seed precondition V3 alone already failed**
(`0d913c1e`'s own commit message names it). Option 2 does not fix it and does
not make it worse. It is the third defect, arriving from an independent suite.

**Bounded claim, stated plainly: suites 9–156 are NOT measured under option 2.**
A real defect blocks suite 8, and faking the seed to see past it would be a
measurement I could not trust. What is measured is suites 1–8, where option 2's
only cost is the one already-moved assertion in §3.

## §4 MEASUREMENT 3 — THE FREED SATURDAY UNDER A CORRECT BYE CONTRACT

This is the one that matters, and it does not say what the freed-day ruling
assumed.

**The contract half works.** With the door publishing its declaration, the
freed week derives as a real bye week for the first time:

```
[PROBE withdraw] week=2026-08-10 mode=in_season_bye_build declared=0 present=1 withdrew=2
```

`mode=in_season_bye_build` (was `in_season_game_week`), `declared=0` (was 1),
and the Tuesday flush is **withdrawn**. Cell 8's first assertion — no flush
survives — now **passes**. The phantom `game@6` anchor is gone.

**And with it, the ground the ruling stood on.** Re-measuring §18 against the
corrected contract:

```
[PROBE s18] mode=in_season_bye_build  anchors=team_training@1,team_training@3
            coreMin=3  coreCount=2  anchorCoreCount=2  appCoreCount=0
            BLOCKING=1 [required_minimum_shortfall]
```

**The empty Saturday is NOT §18-legal. The week is one core conditioning
session SHORT.** The bye-build contract requires 3; the two team trainings
supply 2; the app supplies none.

The freed-day ruling's grounds said the opposite:

> "§18 passing with ZERO shortfall on the derived week (the required work is
> present, attach-first having stacked it)"

That zero was the cancelled game paying the third core credit. Remove the
phantom and the shortfall is real.

### The ruling does not need withdrawing — it needs its own carve-out applied

The ruling already wrote the exception, and this world is it:

> "Where a mode's authored policy genuinely demands work on that day — **the
> bye-build world** — the deriver builds it, and the cell pinning that stays
> green."

Measured mode: `in_season_bye_build`. Measured demand:
`required_minimum_shortfall`. **This is precisely the carve-out world.** So:

- the freed-day ruling stands **as written**;
- its *general* half (a freed day may derive empty) is untouched;
- its *supersession* of 1b ruling 2's baseline half does **not** apply here,
  because 1b ruling 2's original sentence — "the rebuilt bye week equals
  baseline: **Saturday hard conditioning built**" — describes this world
  correctly;
- **cell 8's second assertion (`freedRole === 'required_core'`) was RIGHT and
  must NOT be rewritten away.** Rewriting it was the instruction I was given,
  and doing it would have been `expectation-edited-to-match-regression` with a
  dated ruling as cover.

### THREE INDEPENDENT WITNESSES NOW SAY THAT SESSION IS OWED

This is the part that should decide the ruling. Three measurements, from three
places that do not share an assertion, all say the bye-build week owes a hard
conditioning session the deriver does not build:

1. **§18 itself** — `BLOCKING=1 [required_minimum_shortfall]`, `coreMin=3`,
   achieved 2. The app's own contract evaluator, on the corrected contract.
2. **`phaseStructureConformanceTests` cell 8** — the freed Saturday comes back
   `role=null` where the measured no-1b baseline built `required_core`
   glycolytic Hard Conditioning.
3. **`athleteSessionDeletionTests`** — 16 cells refusing to seed at all,
   because the "bye-build hard conditioning template" is missing from both the
   rebuilt and the accepted week.

Witness 3 is the strongest, because it is a *different world on a different
week* reached through a *different door*, and it predates this unit.

### What is still unbuilt

Under option 2 the freed Saturday comes back `role=null` — §18 says the week
owes the session and the deriver does not build it. So option 2 fixes the
**contract** and the **flush**, and exposes a genuine third defect underneath:
the derived bye week under-produces against its own contract. That is the
remaining work, and it is **not** measured here — the gateway's repair search
runs at the commit boundary, and why its repair does not reach the read is the
next thing to instrument.

## §5 WHAT THIS MEASUREMENT DOES NOT CLAIM

- No device pass. Static traces plus suite measurements only.
- The prototype is reverted. No product code changed on this branch.
- Why the gateway's repair does not fill the freed Saturday is **unmeasured**,
  and is stated as the open question rather than guessed at.
- Whether option 2 is the right home remains Sam's call. It is now measured as
  **cheap** (§2), **costing one already-moved assertion** (§3), and
  **necessary but not sufficient** (§4).
