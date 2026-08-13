# MISSION THREE FIXES

## MISSION

Make the program respect equipment, athlete authorship, and training history;
four slices; nothing else.

## SLICES

| # | Slice | Status |
| --- | --- | --- |
| 1A | Equipment probe — the pool refuses a slot no kit can fill | **IN PROGRESS → REPORTED** (this slice; code landed, measured, reported) |
| 1B | Equipment class — every route asked, not just the pool walk | NOT STARTED |
| 2 | Authorship | NOT STARTED |
| 3 | Close the loop | NOT STARTED |

## REPORTS

### Slice 1A — the pool refuses; a later pass puts it back

**REGISTRY GREP FIRST.** `docs/RULINGS_REGISTRY.md` for `R-083` — four hits
(`:1173`, `:1455`, `:1482`, `:1499`). What it already rules, so none of it is
re-asked:

- **R-083** — *"ya can't do much with overhead pushing or pull or even
  horizontal pulling without equipment - i can't account for everyone and if
  they want to train properly they'll sign up to a gym"*. Vertical push,
  vertical pull and horizontal pull are **REMOVED, not substituted**. The app
  must **SAY the kit is the cause**; a short session here is not a defect.
- The row's own status: `BUILT cf77855f` for the LOAD-vs-AVAILABILITY split.
  `EXERCISE_EQUIPMENT_REQUIREMENT` is the availability field and
  `exerciseAllowedByEquipment` reads it. **The row already states its second
  clause is NOT delivered** — `SlotCoverage.unavailable` has no reader outside
  the rule module and nothing athlete-facing says "you'd need a gym for this".
- **R-084** — a bodyweight athlete cannot fill the single-leg hip slot, and by
  R-083 that is the kit's answer, not a defect.
- **R-022** — excluded and pinned are opposites; four signed phrases. Nothing
  requires the raw-pool fallback for an exclusion, so the fallback for
  exclusion/injury was left exactly as it was rather than widened or narrowed.

---

#### 1. Baseline, measured before touching anything (snapshot `382a999e`)

| Instrument | Baseline |
| --- | --- |
| `print:week` | 18 findings across six weeks. **Scenario 6: 8 findings, of which 7 `impossible_without_kit`** — Band Pallof Press, RDLs, Pull-Ups, Barbell Row, Face Pull, Overhead Press, Lateral Raise. (The 8th is `Bodyweight Conditioning Circuit — "1 × 1"`, an unreadable prescription, not a kit finding.) |
| `[pool-override-fallback]` | 16 lines — 4 each for `vertical_pull`, `horizontal_pull`, `vertical_push`, `isolation_upper` |
| `test:qa` | **RED at HEAD** — 168 passed, 10 failed across 17 scenarios |
| `test:scenarios` | **RED at HEAD** — 1 scenario failed (`G+1_RECOVERY`). ⚠ Exit code **0** while the report says `❌ 1 SCENARIOS FAILED`; the totals line is the verdict here, not the exit code. |
| `test:ladder-wide` | **RED at HEAD** — passed 8/9. `92 deficient of 318 laddered days (ceiling 88, 6 distinct shapes)` across 174 worlds, 6 refused |
| `test:compile` | **PASSED** — product 35 / devtools 51 / tests 373 = 459 against baseline |
| `exercisePoolsStrengthTests` | 497 passed, 0 failed |

The control run was taken by restoring **only my five files** to `HEAD` from a
scratchpad extraction and putting my own backups back afterwards — the other
three seats' modified files (`repoLawGuardsTests`, `sessionExecutionChecklistTests`,
`vocabularyCrosswalkCensusTests`) were left untouched, so before and after saw
the same tree.

#### 2. The diff

| file:line | change |
| --- | --- |
| `src/data/exercisePoolsStrength.ts:964-1000` | `PoolRefusalCause` (union of one: `'equipment'`) and `PoolSelection` — the typed result. "No legal entry" is now representable. |
| `src/data/exercisePoolsStrength.ts:1049-1074` | `selectPoolEntryAvoiding` returns `PoolSelection`. Filtered-to-zero **where the kit alone would have emptied the pool** → `{ kind: 'refused', cause: 'equipment' }` + `[pool-slot-refused]`. The raw-pool walk is gone for that case only. |
| `src/data/exercisePoolsStrength.ts:1075-1085` | Exclusion and injury fall through **unchanged**, `[pool-override-fallback]` line and all. The test is *"could the kit alone have emptied it"*, not *"is the equipment count non-zero"* — asking it the second way would refuse a slot an exclusion emptied and equipment merely trimmed. |
| `src/data/exercisePoolsStrength.ts:1120-1180` | `applyPoolRotation` returns `PoolRotationOutcome` (`name` \| `refused`), carrying `suggestedName` so the caller can name the removal. A **group-narrowed** pool that refuses re-asks the whole slot before the refusal becomes the athlete's answer. |
| `src/data/defaultProgram.ts:2569-2593` | The one production caller. A refused slot drops the row **before** it is built (so row ids never number work that does not exist) and logs `[ProgramGen] slot refused`. |
| `src/__tests__/exercisePoolsStrengthTests.ts:33-58` | Two shims (`rotatePoolName`, `pickPoolEntry`) unwrap the outcome for the 48 existing call sites and make an unexpected refusal a loud failure. Mechanical rename only. |
| `src/__tests__/exercisePoolsStrengthTests.ts:1106-1163` | **New cell 14.15** — bodyweight vertical pull is REFUSED with `cause: 'equipment'`, `[pool-override-fallback]` does **not** fire, `[pool-slot-refused]` does. Plus the control: an all-excluded pool still falls through and still logs the original line, so the refusal cannot silently widen to swallow every cause. |
| `src/__tests__/variedProgramPersonaTests.ts:34-49`, `src/__tests__/sessionSlotCoverageTests.ts:327-343` | Same unwrap, local to each file. No kit is passed in either harness, so neither can refuse. |

**⚠ BUDGET BREACH, DECLARED.** 5 files (at the fence) but the diff is ~370
changed lines, well past the ~150 line. The production change is ~135 lines in
`exercisePoolsStrength.ts` + ~25 in `defaultProgram.ts`; the remainder is the
48-site mechanical rename and the new cell. It was already run and measured when
the fence arrived, so it is reported rather than continued.

#### 3. Instrument deltas

| Instrument | Before | After | Verdict |
| --- | --- | --- | --- |
| `print:week` total findings | 18 | **16** | −2 |
| scenario 6 `impossible_without_kit` | **7** | **5** | −2 (Barbell Row, Lateral Raise gone) |
| `[pool-override-fallback]` | 16 | **0** | ✅ zero for equipment cause |
| `[pool-slot-refused]` | — | 20 | new line: 4 `vertical_pull`, 4 `horizontal_pull`, 4 `vertical_push`, 8 `isolation_upper` |
| `collapsed_to_rest` | 4 | **4** | no day was silently deleted |
| `test:qa` | 168/10 | **168/10** | unchanged; the ten failure lines diff **identical**, line for line |
| `test:scenarios` | 1 failed (`G+1_RECOVERY`) | 1 failed (`G+1_RECOVERY`) | unchanged |
| `test:ladder-wide` | 8/9, **92 deficient of 318** (ceiling 88, 6 shapes) | 8/9, **178 deficient of 318** (ceiling 88, 19 shapes) | **MOVED. Cause stated below. Ceiling NOT touched.** |
| `test:compile` | 459 (35/51/373) PASSED | **459 (35/51/373) PASSED** | unchanged |
| `exercisePoolsStrengthTests` | 497/0 | **504/0** | +7 asserts, the new cell |

**THE LADDER MOVEMENT, AND WHY NOTHING WAS RE-BASELINED.** 92 → 178 deficient
days is the removal showing up as exactly what it is: a slot the kit cannot
train is now empty instead of being filled with an impossible lift, and the
ladder census counts an empty slot as deficient. **That is R-083's own answer
being scored as a defect by an instrument that predates the ruling.** The
ceiling stayed at 88, the failing cell stayed failing, and no allow-list was
edited. Two readings are open and this slice does not pick between them: either
the census needs the R-083 exemption `slotIsTrainableOnKit` already computes, or
the removal really is leaving days thinner than Sam intends. **Slice 1B's
measurement should settle it; it is not settled here.**

#### 4. The five remaining impossible rows, and the route each one took

| Row | Pool classification | Pool's answer on a bodyweight kit | Route it actually took in |
| --- | --- | --- | --- |
| **Pull-Ups** | `vertical_pull/anchor` | **REFUSED** | **CANONICALISER RESTORATION** — proven, see below |
| **Overhead Press** | `vertical_push/anchor` | **REFUSED** | **CANONICALISER RESTORATION** — proven, see below |
| **Face Pull** | `isolation_upper/accessory` | **REFUSED** | a route that never asks the pool |
| **RDLs** | `hinge/anchor` | `{kind:'name', name:'Single-Leg RDL'}` — the pool rewrites it to a **legal** lift | a route that never asks the pool |
| **Band Pallof Press** | `null` — in no pool | pass-through by design; only the sheet can catch it | a route that never asks the pool |

#### 5. WHAT FOUGHT ME — and it fought me one for one

**A LATER PASS RESTORES EXACTLY WHAT THE REFUSAL REMOVED. This is the most
valuable output of the slice and it is proven, not inferred.**

`row_restored` actions across the six weeks went **4 → 12**, and the eight new
ones are precisely the two patterns I removed:

```
--- restored items BEFORE ---            --- restored items AFTER ---
   4  item: 'Romanian Deadlift'             4  item: 'Romanian Deadlift'
                                            4  item: 'Overhead Press'
                                            4  item: 'Pull-Ups'
```

The log shows it happening within a few lines of itself, every week:

```
[pool-slot-refused] slot=vertical_pull role=anchor cause=equipment — no exercise in this pool is possible on this athlete's kit
[ProgramGen] slot refused — no exercise this athlete can do { ... }
[WorkoutCanonicalisation] Generated workout finalised {
  actions: [ { kind: 'row_restored', item: 'Pull-Ups', reason: 'restore_missing_plan_pattern:pull' } ] }

[pool-slot-refused] slot=vertical_push role=anchor cause=equipment — no exercise in this pool is possible on this athlete's kit
[ProgramGen] slot refused — no exercise this athlete can do { ... }
[WorkoutCanonicalisation] Generated workout finalised {
  actions: [ { kind: 'row_restored', item: 'Overhead Press', reason: 'restore_missing_plan_pattern:push' } ] }
```

**THE PASS, NAMED:** `src/utils/workoutCanonicalisation.ts:885-905` — the
`intendedPatterns` restore loop, guarded only by
`context.restoreMissingPlanPatterns !== false`. It sources the replacement from
`matchingReferenceRow(...)` or `fallbackPatternRow(...)`, and the fallback table
is `src/utils/workoutCanonicalisation.ts:172-182`:

```ts
const FALLBACK_PATTERN_EXERCISE: Record<MainStrengthPattern, string> = {
  squat: 'Back Squat',  hinge: 'Romanian Deadlift',
  push:  'Overhead Press',  pull: 'Pull-Ups',   // ← the two that came back
};
```

The loop asks the equipment sheet **nothing**, and `fallbackPatternRow` builds
the row with a hardcoded `equipmentRequired: []`. **The pool and the restore
loop are two authorities on "what fills this pattern", and the restore loop
runs last, so it wins.** Left untouched, as instructed.

**HOLLOW SESSIONS — two, and one of them is worse than hollow.**

- **Tuesday, Upper Pull** — was 3 rows (Pull-Ups, Barbell Row, Face Pull), now
  **2 rows: Face Pull and Pull-Ups**. Barbell Row went (`horizontal_pull`
  refused). Pull-Ups came back by restoration; Face Pull never asked the pool.
  **BOTH remaining rows are impossible on this kit — the day reads as two
  exercises and is really zero.** The athlete sees an Upper Pull session
  followed by Team Training.
- **Thursday, Upper Push** — was 3 rows, now **2: Push-ups and Overhead Press**.
  Lateral Raise went (`isolation_upper` refused); Overhead Press came back by
  restoration. **One usable row.**
- No day fell below 2 rows and `collapsed_to_rest` did not move (4 → 4), so
  nothing was silently deleted. But the "under 2 rows" test does not catch
  Tuesday, because **two impossible rows count as two rows.**

**WHAT ELSE SURPRISED ME**

- `RDLs` is the one that should not have needed a fix at all: the pool already
  rewrites it to the legal `Single-Leg RDL`. It reaches the athlete as `RDLs`
  anyway, which means that row was **never put through `applyPoolRotation`**.
  The bypass, not the pool, is the defect there.
- `test:scenarios` exits **0** while printing `❌ 1 SCENARIOS FAILED`. Anyone
  gating on its exit code is reading green off a red run.
- The `isolation_upper` refusal fires **twice** per upper day (8 total, vs 4 for
  every other slot) — the within-session avoidance asks the same emptied pool
  again for the second accessory.

**NOT DONE, DELIBERATELY:** no template-row change, no canonicaliser change, no
top-up change, no Phase B. `R-083` was **not** marked BUILT.

## FINDINGS LEDGER

*One-liners only. Nobody acts on these without a prompt from Sam.*

- `workoutCanonicalisation.ts:885` restore loop and `:172` `FALLBACK_PATTERN_EXERCISE` re-add a pattern the kit cannot train; `fallbackPatternRow` hardcodes `equipmentRequired: []`.
- Some route into a generated week never calls `applyPoolRotation` — `RDLs` arrives unrewritten though the pool answers `Single-Leg RDL`.
- `Band Pallof Press` is in no pool at all, so no pool-layer fix can ever reach it; only the equipment sheet can.
- `test:ladder-wide` counts a slot the kit cannot train as a deficient day, which scores R-083's own answer as a defect; `slotIsTrainableOnKit` already computes the exemption and the census does not read it.
- `test:scenarios` exits 0 while reporting a failed scenario.
- A session can hold two rows the athlete cannot do and still pass every "is this day thin" check, because the checks count rows, not usable rows.
- `SlotCoverage.unavailable` still has no reader outside its own module — R-083's "say the kit is the cause" half is still not delivered anywhere athlete-facing.
- `test:qa`, `test:scenarios` and `test:ladder-wide` were all already RED at `382a999e` before this change.
