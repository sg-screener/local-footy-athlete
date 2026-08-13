# MISSION THREE FIXES

## MISSION

Make the program respect equipment, athlete authorship, and training history;
four slices; nothing else.

## SLICES

| # | Slice | Status |
| --- | --- | --- |
| 1A | Equipment probe — the pool refuses a slot no kit can fill | **DONE** — `bad0bfc1` |
| 1B | Equipment class — every route asked, not just the pool walk | **PARTIAL** — item 5 shipped (`116bf886`); items 1–4 built and measured, not shipped |
| 1B-completion | R-090 lands; all four routes closed | **HARD STOP AT BUDGET** — every acceptance criterion met on the six printed scenarios, but 20 kit-limited worlds in the 180-world sweep are newly REFUSED. Not shipped; parked on `slice1bc-parked` (`375f32ce`). |
| 1B-final | Find the lost record, fix that one site | **STOP — STEP 1 INCONCLUSIVE.** Both named suspects killed with receipts. **The record is not lost anywhere.** No fix written. |
| 1B-final-2 | Name why the gateway refuses a week its evaluator accepts | **STOP — THE PREMISE IS FALSE AND THREE MECHANISMS CONTRIBUTE.** The evaluator never accepted it; my 1B-final receipt was wrong. Measurement only, no code. |
| 1B-ship | Fix M1/M2/M3 and ship | **STOP — SHIP GATE NOT MET.** Sheet + M3 + M1 all built and green (8 new cells); sweep refusals unchanged at 26 vs baseline 6, a new blocking code appeared, and the census breadth floor reds. Parked at `81ba20f9`. |
| 1B-ship-2a | Diagnosis: what blocks the 26 | **ANSWERED. The requirement set HAS one owner — and changing it clears 6 of 26.** 32 of 38 blocking findings are not about kit-impossibility. Docs only. |
| 1C-A | Remove the AI from program construction (R-091) | **SHIPPED.** One door severed, 528 lines deleted, corpus byte-identical, same six worlds refused. |
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

### Slice 1B — HARD STOP. The removal is right and §18 refuses the week for it

**REGISTRY GREP:** `R-083` (unchanged from 1A — removed not substituted, and the
app must SAY the kit is the cause), plus `R-084` (a bodyweight athlete cannot
fill the single-leg hip slot and that is the kit's answer, not a defect) and
`R-072` (three equipment scopes, no fourth). Nothing re-asked.

#### 1. Baseline — the tree as 1A left it (`bad0bfc1`)

| Instrument | Baseline |
| --- | --- |
| `print:week` | 16 findings; scenario 6 = 6 findings, **5 `impossible_without_kit`** |
| `row_restored` | **12** across six weeks (4 Romanian Deadlift, 4 Pull-Ups, 4 Overhead Press) |
| `test:qa` | 168 passed, 10 failed (RED, as at HEAD) |
| `test:scenarios` | 1 failed, `G+1_RECOVERY` (RED, as at HEAD) |
| `test:ladder-wide` | 8/9, **178 deficient of 318** (ceiling 88, 19 shapes) |
| `test:compile` | 459 (35/51/373) PASSED |
| pools suite | 504 passed, 0 failed |

#### 2. What I built, measured, and did NOT ship

All four routes were closed and run end to end. The diff is preserved at
`scratchpad/slice1b/` and is described here so the next prompt starts from
measurement rather than from scratch.

| Item | file:line | Result |
| --- | --- | --- |
| **1. Restore loop** | `workoutCanonicalisation.ts` restore branch — `exerciseAllowedByEquipment` on both the reference row and the `FALLBACK_PATTERN_EXERCISE` row; illegal → pattern stays removed, `row_removed_equipment` with `pattern_not_restorable_on_kit:<pattern>` | **WORKS, AND IS THE HARD STOP.** Removed `Pull-Ups`, `Overhead Press`, `Romanian Deadlift`. `row_restored` 12 → **0**. |
| **2/3. Every row, pool or not** | `workoutCanonicalisation.ts` triage — the same public test applied to every row bound for `strengthAndSupportRows`; scoped there because conditioning and power already have owners | **PARTIAL.** Removed `Face Pulls` ×4. **Did NOT catch `Band Pallof Press`** — see §5. |
| **4. The saying** | `types/domain.ts` `EquipmentRemoval` + `Workout.equipmentRemovals` (writer: canonicaliser; reader: `projectVisibleWeek.partDetail`; test: canonicalisation cells) · `projectionCopy.ts` `part.detail.kit_cannot_train` · `projectVisibleWeek.ts` `partDetail()` — first non-null `detail` the projection has ever emitted | **BUILT, UNVERIFIABLE.** Scenario 6 stopped generating, so the line could not be seen on glass. |
| **5. Ladder census** | `ladderCoverageWideCensusTests.ts` — passes the athlete's resolved kit to `sessionSlotCoverage` and counts `unavailable` in its own printed category with its own floor | **SHIPPED.** |

#### 3. THE HARD STOP, with the log

With the restore route closed, `print:week` **exits 1 and scenario 6 does not
generate at all**:

```
FAILED 6-bodyweight-only — Section18WeekAcceptanceError: Section 18 final-week rejection
  (pattern_restore_failure:strength_patterns:0|pattern_restore_failure:strength_patterns:0
  |pattern_restore_failure:strength_patterns:0|required_minimum_shortfall:main_strength:1)

Six weeks asked for, 5 written.
1 scenario(s) did not generate at all.
```

**ATTRIBUTED EMPIRICALLY, NOT ASSUMED.** I disabled the restore guard alone and
re-ran: scenario 6 generates normally (5 findings). Re-enabled: refused. **The
restore guard is the sole trigger.** The canonicaliser's own record shows why —
`effective_pattern_removed` fires for `hinge`, `pull` and `push`, and
`section18EffectiveWeekEvaluator.ts:1440` then raises
`pattern_restore_failure` for every `requiredSafePattern` with no meaningful
main lift.

**TWO LAWS, DIRECTLY OPPOSED, AND NEITHER IS WRONG.** R-083 says a pattern the
kit cannot train is REMOVED. §18 says a required safe pattern must be restored
or the week is rejected. For a bodyweight athlete both cannot hold, and §18 has
the last word — so the athlete gets **no week at all**, which is strictly worse
than five impossible rows they can see and skip.

**WHY I STOPPED INSTEAD OF FIXING IT.** The fix would be to teach §18 that a
kit-untrainable pattern is not a `requiredSafePattern` — the same shape as its
existing injury `prohibitedPatterns`. That is a change to the safety contract's
acceptance behaviour, it is not one of the five items this prompt names, and
**Sam has not ruled it.** The fence's hard stop is explicit: safety break → stop,
never ship around it. `SEAT_INBOX` item 48 records two prior commits reverted for
this exact rejection code, with the terminal's judgement that *"a kit-impossible
lift is visible and survivable; a week §18 REFUSES is not."* I agree with it.

The other candidate — restoring a LEGAL exercise for the pattern instead of
`Overhead Press` — is **explicitly out of scope**: that is filling a thin day,
and this prompt parks it.

#### 4. Instrument deltas — what shipped (item 5 only)

| Instrument | Before (1A) | After | Cause |
| --- | --- | --- | --- |
| `test:ladder-wide` deficient | **178** of 318 | **126** of 318 | the census now judges each day against the KIT-ACHIEVABLE ladder (R-083) |
| `test:ladder-wide` shapes | 19 | 9 | the ten kit-shaped ones moved to their own category |
| **R-083 kit-blocked census** | did not exist | **86 laddered days** — `vertical_pull` 52, `vertical_push` 42, `horizontal_pull` 26 | new visible category; nothing disappears by redefinition |
| `test:ladder-wide` verdict | 8/9, 1 failure | **10/11, 1 failure** — the SAME cell (126 > ceiling 88) | +2 new cells, both passing; **ceiling NOT raised** |
| `print:week` | 16 findings, 5 impossible | **16 findings, 5 impossible** | production unchanged from 1A |
| `test:qa` | 168/10 | **168/10** | unchanged |
| `test:scenarios` | 1 failed | **1 failed** | unchanged |
| `test:compile` | 459 PASSED | **459 PASSED** | unchanged |
| pools suite | 504/0 | **504/0** | unchanged |

**THE CEILING WAS NOT TOUCHED AND MUST NOT BE.** 126 is still above 88, so that
cell stays red exactly as it was at HEAD before any of this work (92 > 88). The
two new cells are what stop the narrowing from being a free win: one reds if the
oracle ever stops being told the kit (the count would go to 0 and the deficient
count would silently rebound), and one reds if a **full-gym** athlete is ever
kit-blocked, which is the only way this exemption could hide a real composer gap.

**AND 126 IS STILL 34 ABOVE THE ORIGINAL 92 — that difference is real and is not
the kit.** `slotIsTrainableOnKit` asks the whole tagged library; the pool asks
only its own entries. **A slot can be kit-trainable while the pool holds nothing
legal for it**, so 1A's refusal empties slots the athlete could in fact train.
That is a composer gap 1A exposed rather than caused, and it is in the ledger.

#### 5. What fought me — and one thing quietly did not

- **The restore loop fought me and won**, above. Answering the 1A question
  directly: it did not merely resist, it escalated — closing it turns a visible
  bad row into no week at all.
- **`Band Pallof Press` slipped BOTH gates.** The triage gate removed
  `Face Pulls` on the same day and left this one. It is in no pool
  (`classifyPoolSlot` → `null`), and it is not in the workout at triage time
  either — Monday's only action is the hinge restore. **So a third route adds
  rows after canonicalisation, and neither slice has found it.** It is the last
  unexplained row and the next slice should start there.
- **`RDLs` turned out not to be a separate route at all.** It is the restored
  `Romanian Deadlift`, renamed at the projection. 1A's report listed it as "a
  route that never asks the pool"; **that was wrong and is corrected here** — it
  is the restore route, and item 1 covers it.
- The kit-blocked census came out at 86 days against a corpus where only one of
  three kits is bodyweight — `vertical_pull` alone is 52. The exemption is large,
  which is exactly why it is printed rather than folded into the deficient count.

**NOT DONE, DELIBERATELY:** §18 untouched; no legal-substitute restoration; no
thin-day filling; the scenarios exit-code bug and the rows-vs-usable-rows check
left in the ledger untouched.

### Slice 1B-completion — everything asked for works, and I am not shipping it

**NOT SHIPPED. The tree is at `116bf886`.** The whole change is preserved at
`scratchpad/slice1bc/` (9 files). The reason is at §5 and it is the same class of
reason that stopped 1B: a state where an athlete gets NO WEEK is worse than the
defect being fixed, and I reached the budget fence before I could close it.

**⚠ A CORRECTION FIRST: there was no `slice1b-parked` branch.** I never created
one — the 1B fence's allowed-outputs list did not include a branch, and my report
said the diff was in session scratch. Re-landed from `scratchpad/slice1b/`.

#### 1. Instruments, baseline → after

Baseline is `116bf886` (1A + 1B item 5). "After" is the unshipped tree.

| Instrument | Baseline | After | |
| --- | --- | --- | --- |
| `print:week` scenarios written | **5 of 6** (scenario 6 refused) | **6 of 6** | ✅ |
| scenario 6 `impossible_without_kit` | 5 | **0** | ✅ |
| scenario 6 findings total | 6 | **1** (the unrelated `1 × 1` prescription) | ✅ |
| `row_restored` resurrections | 12 | **0** | ✅ |
| athlete copy naming the kit | none | **on glass** — see §4 | ✅ |
| `test:section18-v2` | 135/0 | **141/0** (+6 new cells) | ✅ |
| `test:workout-canonicalisation` | 41/0 | **47/0** (+6 new cells) | ✅ |
| `test:section18-gateway` | 91/0 | **91/0** | ✅ |
| pools suite | 504/0 | **504/0** | ✅ |
| `test:compile` | 459 PASSED | **459 PASSED** | ✅ |
| `test:qa` | 168/10 | **168/10** | unchanged |
| `test:scenarios` | 1 failed | **1 failed** | unchanged |
| `test:ladder-wide` kit-blocked census | 86 days | **96 days** (vertical_pull 66, vertical_push 38, horizontal_pull 20) | reported |
| `test:ladder-wide` deficient | 126 / 318 | 137 / 312 (ceiling 88, untouched) | reported |
| **`test:ladder-wide` worlds refused** | **6 of 180** | **26 of 180** | ❌ **THE STOP** |

#### 2. The third route — it was never a route

**`Band Pallof Press` was a NAME, not a pipeline.** I instrumented the triage to
print every row it sees:

```
[PROBE-TRIAGE] saw "Pallof Press" kind=trunk_support reason=registry_trunk_support
               role=undefined linkedCond=false kit=["bodyweight"]
```

The row is built as **`Pallof Press`**. Sam's sheet is keyed
**`Band Pallof Press`**. The printer judges the canonical spelling; the oracle was
judging the raw one — and with no sheet row under `Pallof Press`,
`equipmentRequiredFor` returned null and the whole question fell through to the
load classifier, which said yes. Two slices called this "a route nothing checks".

**RECEIPT:** fixed in `exerciseAllowedByEquipment` (`exercisePoolsStrength.ts`),
not at the three callers — `resolveExerciseName(rawName)` before the sheet
lookup. Scenario 6's last impossible row went with it.

**⚠ AND THE OBVIOUS FIX WAS THE WRONG ONE.** `canonicalExerciseName` is the app's
full canonicaliser and was the first attempt; it imports the selectable
vocabulary, which reads `STRENGTH_POOLS` from that same module at import time.
The cycle left `STRENGTH_POOLS` undefined and `print:week` died on
`Cannot read properties of undefined (reading 'squat')` before building a single
week. `resolveExerciseName` is the alias table that canonicaliser consults first
and already lives in a dependency.

#### 3. What §18 did after being taught the kit — THE HEADLINE

**It fought back three times, each in a different voice, and I did not find them
by reading.**

1. **`pattern_restore_failure` ×3** — the site the ruling names. Fixed by
   judging `requiredSafePatterns` against the kit-achievable set, read from the
   week's own `equipmentRemovals`. Severity → `advisory`, domain → `equipment`.
   The finding is still RAISED; the gap is disclosed, not deleted.
2. **`required_minimum_shortfall:main_strength:1`** — the SESSION minimum, a
   different code in a different function. Same ruling, same treatment, gated
   tightly: it downgrades only when every required pattern with no main lift is
   one the removals NAME as impossible.
3. **`planner_selected_target_miss:main_strength:3`** — a THIRD code, the branch
   immediately below the second in `evaluateNumeric`, for the planner's selected
   target rather than the hard floor. It did not appear in `print:week` at all;
   `test:section18-gateway` found it. **§18 says "not enough main strength" in
   three voices and the kit has to answer all three.**

**And a fourth thing bit before any of them, from my own side.**
`resolveEquipmentCapabilities` returns `['bodyweight']` for BOTH *"the athlete
owns nothing"* and *"nobody ever asked them"* — the typed `source` field
(`unanswered_floor` / `legacy_positive_lift` / `athlete_answer` /
`complete_selection`) is what tells them apart, and I was not reading it.
Handing the floor to a REMOVAL gate reads silence as a declaration: it emptied a
pools fixture that passes no profile at all and took the census from 6 refused
worlds to 30. Only an exhaustive declaration may delete.

#### 4. The hydration proof

**What I did:** stamped the removals, serialised with `JSON.stringify`, revived,
and re-canonicalised **with no kit** — the way `canonicaliseHydratedWorkout`
actually calls it. Held by two cells in `test:workout-canonicalisation`.

**What it found, and it changed the design.** Stamping only what THIS pass
removed **erased the record on the very next pass**: §18's gateway
re-canonicalises the week without the kit, and by then the illegal rows are gone,
so a recomputation finds nothing and writes `undefined` over the reason the day
is short. §18 then read an empty set and refused the week it had just been taught
to publish. **A removal that happened is a fact about the workout, not a quantity
to re-derive** — it is merged forward, and clears only on regeneration.

**What survives:** the reason, through serialise → revive → kit-less
re-canonicalisation, and the removed lift is not resurrected on the way back.
Persistence itself is `JSON.stringify` of the whole state, so no field mapper
drops it. And the line reaches glass — this is the published bodyweight Monday:

```
**Lower Squat**
Some of this needs gym kit you don't have, so it's been left out rather than
swapped for something easier. Training these properly needs a gym.
```

That is `part.detail`, the first non-null `detail` the projection has ever
emitted, read from `Workout.equipmentRemovals` and signed as
`part.detail.kit_cannot_train` under R-083.

#### 5. WHY IT IS NOT SHIPPED

`test:ladder-wide` sweeps 180 worlds. Refusals go **6 → 26**, and the ~20 new
ones are almost entirely `Bodyweight Only` and `Dumbbells` —
**exactly the athletes R-090 exists to serve.** They are refused with
`pattern_restore_failure ... domain=strength_patterns`, which means
`kitUnachievablePatterns` was EMPTY there: the removal record is not reaching the
evaluator on those paths. Nearly every off-season case is `w2`, and the gateway
log names a `safe_fallback_candidate` — *"Safe deterministic fallback entered the
same gateway"* — so the strong hypothesis is a second week-builder
(`section18AcceptedWeekGateway.ts`) that constructs workouts without carrying
`equipmentRemovals`. **Stated as a hypothesis because I did not measure it** —
I had already been wrong twice today by reasoning instead of probing.

**Three reasons to stop rather than continue:**
1. **Budget.** 437 changed production lines against a ~300 fence, 10 files
   against ~10.
2. **The next file is `section18AcceptedWeekGateway.ts`** — the file
   `SEAT_INBOX` item 48 records as having eaten two reverted commits.
3. **Publishing a week with an impossible row beats publishing no week.** That
   is the standard I applied in 1B and agreed with then; it applies against me
   now.

**One targeted step remains:** find why `equipmentRemovals` does not reach the
evaluator on the fallback/second-week path, and carry it. Everything else in this
slice is measured and green.

### Slice 1B-final — Step 1 says the premise is wrong: nothing is lost

**PRESERVED FIRST, as the fence allows.** Branch **`slice1bc-parked`**, commit
**`375f32ce`**, 9 files, 569 insertions — committed from a temporary worktree by
explicit pathspec, stamped `Agent: kit`. The shared checkout never left `main`,
and both temporary worktrees are removed. The branch is the artefact.

**NO FIX WAS WRITTEN.** The fence's hard stop applies: *"If it is neither, stop
and report what it actually is before writing any fix."*

#### The architecture measurement you asked for: **ZERO**

You asked, if the record is lost in more than one place, for the count. **It is
lost in no places.** The slice's premise does not survive measurement.

#### Step 1 verdict, with receipts

World traced: **`Off-season / 4d / club / Bodyweight Only / w2`** — one of the
newly-refused set. Executed against `slice1bc-parked` with the evaluator
instrumented to print what it receives and what it returns; the identical world
was run against `main@11e9eb66` as a control.

**KIT RESOLUTION IS CORRECT.** `resolveEquipmentCapabilities` →
`source = complete_selection`, `tags = ["bodyweight"]`. An exhaustive
declaration, so the removal gate is entitled to act. **The
`unanswered_floor` ambiguity is NOT the mechanism here** — it stays a ledger
line, untouched, as instructed.

**SUSPECT (a) — the weeks-2-4 build path never threads the record: KILLED.**
The w2 week reaching the evaluator carries it on every session:

```
evaluator sees [ Upper Push(r4,REM) | Tempo Intervals(r1,REM)
               | Lower Body Strength(r5,REM) | Lower Squat(r4,REM) ]
   -> ACCEPTED
```

`REM` is a populated `equipmentRemovals`. Week 1's is fully typed, patterns
included — `{"item":"Back Squat","requires":["barbell","rack"],"pattern":"squat"}`,
`…"Pull-Ups"…"pattern":"pull"`, and so on. **The record is written, threaded and
read. And the athlete's real w2 week is ACCEPTED by
`evaluateSection18EffectiveWeek`.**

**SUSPECT (b) — the gateway's fallback loses the kit or the record: KILLED AS
STATED.** The candidates that carry no record carry no record because **they
contain no strength rows at all** — there was nothing to remove, so nothing was
lost. The sequence after the real week is accepted:

```
(EMPTY WEEK)                                                  -> refused
Hard Conditioning(r2,none) x3                                 -> refused
Hard Conditioning(r2,none) x2 / x1 / x3 …                     -> refused
```

Stack for the empty one, which names the owner:

```
evaluateSection18EffectiveWeek        (section18EffectiveWeekEvaluator.ts)
finaliseSection18SafetyWeek           (section18SafetyFinaliser.ts:640)
resolveCandidate                      (section18AcceptedWeekGateway.ts:1391)
runSection18AcceptedWeekGateway       (section18AcceptedWeekGateway.ts:1678)
section18TierFour                     (sessionResolver.ts:1023)
resolveWeekWithConditioning           (sessionResolver.ts:1927)
resolveFinalVisibleSection18Week      (section18AcceptedWeekGateway.ts:431)
assess                                (section18AcceptedWeekGateway.ts:1505)
searchWholeWeekRepairCandidates       (wholeWeekRepairEngine.ts:69)
```

These are **repair candidates being explored**, not the athlete's week, and they
are expected to fail. **The reported `failureSignature` belongs to the LAST
candidate tried, not to the week that actually failed.** That is why three
slices have been chasing `pattern_restore_failure` — it is the exhaust, not the
cause.

**THE THIRD THING, characterised but NOT isolated.** With R-090 code the w2 week
is composed *differently*, not merely stripped: `Upper Pull` is absent entirely
(the kit cannot train pull, correctly) and a `Tempo Intervals` day takes its
place. The control at `main` never enters repair at all — it churns ~270
reorderings of a 4–5 session strength week that still contains `Upper Pull`, and
succeeds. So the divergence is real and it is upstream of anything about the
record.

**WHAT I CANNOT YET NAME, AND WILL NOT GUESS:** which gate turns
*"`evaluateSection18EffectiveWeek` accepted this week"* into *"the gateway
refused the world"*. The evaluator is not the refuser. Until that gate is named
with an executed receipt, any fix is a hypothesis, and this campaign has already
paid twice for reasoning where it should have measured.

**THE NEXT STEP IS ONE QUESTION, NOT A FIX:** instrument
`runSection18AcceptedWeekGateway`'s own accept/reject decision (not the
evaluator's) for this one world, and report which candidate it rejects and under
which signature. That is cheap, and it converts this from "R-090 breaks 20
worlds" into a named site.

#### What fought me

- **The failure signature lied for three slices.** It names the last repair
  candidate. Every `pattern_restore_failure:strength_patterns:0` chased since
  slice 1B came from evaluating a week that had no strength in it *by
  construction*.
- **The evaluator accepting is not the gateway accepting.** I had assumed one
  verdict; there are at least two, and only the outer one throws.
- Nothing about the record itself resisted at any point. It is written where it
  should be, survives every pass, and reaches the evaluator intact.

### Slice 1B-final-2 — measurement only. The question's premise was mine, and it was wrong

**⚠ FIRST, A CORRECTION TO MY OWN 1B-FINAL RECEIPT.** I reported that
`evaluateSection18EffectiveWeek` **ACCEPTS** the athlete's real w2 week. **It does
not.** That was inferred from a printer that only emitted *changed* verdicts, so
an unprinted line was read as "accepted". Instrumenting the gateway directly
shows the primary candidate's evaluation blocking with all six findings. The
question this slice was given — *"why does the gateway refuse a week its own
evaluator accepts"* — rests on that error. **Nothing accepts this week.**

World: **`Off-season / 4d / club / Bodyweight Only / w2`**, run against
`slice1bc-parked` (`375f32ce`) in a temporary worktree. Probes discarded with the
worktree; nothing committed but this report.

#### 1. The candidate table

Four gateway entries for week `2026-07-27`, each `hasRegenerate=false
hasSafeFallback=false` at the inner level. 13 `resolveCandidate` resolutions.

| # | Arm | Input sessions | main_strength rows IN | removals IN | Selected candidate | Selected `main_strength` rows | Selected removals | Search | Evaluator blocking | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| w1 ×4 | primary | Upper Push, Lower Squat, Full Body Strength | **1** | 3 days | same | 1 | 3 | accepted | none | **repaired → PUBLISHED** |
| 1 | primary | Upper Push, Tempo Intervals, Lower Body Strength, Lower Squat | **0** | 4 days | Hard Conditioning ×3 | 0 | **0** | impossible (2 evaluated) | 6 findings | impossible |
| 2 | primary (+HC) | …, Hard Conditioning, … | **0** | 4 days | Hard Conditioning ×3 | 0 | **0** | impossible | 6 | impossible |
| 3 | displaced_capacity_reduced | same 4 | **0** | 4 days | input + Hard Conditioning | 0 | 4 | impossible | 6 | impossible |
| 4 | regenerated | same 4 | **0** | 4 days | input + Hard Conditioning | 0 | 4 | impossible | 6 | impossible |
| 5 | safe_fallback | same 4 | **0** | 4 days | input + Hard Conditioning | 0 | 4 | impossible | 6 | impossible |

The six findings are identical on every arm:
`required_minimum_shortfall:main_strength:0`,
`required_minimum_shortfall:sprint_high_speed:0`, and
`pattern_restore_failure:strength_patterns:0` **×4** — one per pattern.

#### 2. The refusal mechanism — THREE, and they are independent

Per the fence, they are named and **not fixed**.

**M1 — THE DIRECT CAUSE, AND IT IS NOT R-090's.** The composed w2 week contains
**zero rows classified `main_strength`**. Every surviving lift —
`Bodyweight Squat`, `Walking Lunges`, `Single-Leg RDL`, `Glute Bridge`,
`Push-ups` — carries `section18Evidence.role = 'strength_accessory'` and
`mainStrengthPattern = null`. With no main lift anywhere, §18 correctly reports
`main_strength:0` and all four patterns unrestored. Predicate:
`section18EffectiveWeekEvaluator.ts` `ledger.strengthPatterns.meaningfulMainLiftCount[pattern] > 0`,
and `evaluateNumeric`'s `args.actual < args.required` for `main_strength`.
**A bodyweight week has no main lift by classification, independent of any
equipment removal.** Week 1 published because it retained exactly **one**.

**M2 — R-090's DOWNGRADE DOES NOT FIRE, AND I CANNOT SAY WHY FROM THIS WORLD.**
All four patterns *are* named across the week's removals (push on Mon, pull on
Tue, squat + hinge on Thu, squat on Fri), so `kitUnachievablePatterns` should be
complete and every finding should come back `domain: 'equipment'`, advisory. They
come back `domain: 'strength_patterns'`, blocking — on arms 3–5 where the
selected candidate *does* carry removals. Candidate selection and the visible
projection (`resolveFinalVisibleSection18Week`, which is what the evaluator is
handed) are both plausible, **and I am not guessing between them.**

**M3 — A DEFECT IN THE PARKED IMPLEMENTATION, found by looking at the week.**
Three removals name exercises whose `requires` is `[]`, which under Sam's sheet
convention means *"bodyweight — needs nothing"*: **`Chest Supported Row`,
`Romanian Deadlift`, `Pallof Press`. The gate removed work this athlete can
actually do**, and the record it wrote says the exercise needs nothing. The
likely mechanism is the alias step added in 1B-completion —
`resolveExerciseName(rawName)` before the sheet lookup — resolving these to
barbell-requiring names while `requires` is reported from the raw name, so the
test and the reason disagree about which exercise they are talking about.
**Unproven, and not fixed.**

#### 3. The thrown signature vs an honest one

- **What actually caused the refusal:** the athlete's own composed w2 week
  (`primary`), which has zero main-strength rows. Arm 1 is already impossible.
- **What `failureSignature` currently describes:** `selectedEvaluation` — the
  repair search's *selected* candidate, which on arms 1–2 is a synthesised
  **`Hard Conditioning ×3`** week the athlete never had and which carries no
  removals at all.
- **Why that matters even though the codes coincide here:** `main_strength:0` is
  true of both weeks, so the signature *looks* right and has misled three
  slices. It is right by coincidence, not by construction. **I must also correct
  my 1B-final claim that the signature "reports the last repair candidate, not
  the week that failed": the primary arm carries the identical signature, so the
  thrown text is not wrong about this world — it is merely uninformative.**
- **What an honest signature should report for this world:** the arm that failed
  (`primary`), the identity of the week evaluated (composed vs synthesised
  repair candidate), and the discriminating fact — *"composed week contains 0
  rows classified main_strength; patterns squat/hinge/push/pull all absent; 4 of
  4 named kit-impossible by the week's own removal record"*. Specification only;
  no code touched.

#### 4. The composed w2 week, in plain athlete language

**This is the ORIGINAL composed week — the `primary` candidate, not a repair
candidate.** It is what R-090 would publish if §18 let it through.

> **Monday — "Upper Push"** *(the app has retyped this day as Conditioning)*
> - Warm-up
> - 20 m Acceleration Reps — 8 sets
> - Push-ups — 3 × 8-15
> - Bodyweight Conditioning Circuit
> - *Left out: Overhead Press (needs barbell + rack), Lateral Raise (needs dumbbells)*
>
> **Tuesday — "Tempo Intervals"** *(this is the day that was Upper Pull)*
> - Bodyweight Conditioning Circuit — 13 sets
> - *Left out: Pull-Ups (needs a bar), Face Pulls (needs cables), Chest Supported Row (**needs nothing — see M3**)*
> - **There is no pulling of any kind left on this day, and no upper-body work at all.**
>
> **Thursday — "Lower Body Strength"** *(retyped Conditioning)*
> - Bodyweight Squat — 3 × 8-15
> - Single-Leg RDL — 2 × 8-15
> - Walking Lunges — 3 × 8-15
> - Glute Bridge — 2 × 8-15
> - Bodyweight Conditioning Circuit
> - *Left out: Back Squat (needs barbell + rack), Romanian Deadlift (**needs nothing — M3**), Pallof Press (**needs nothing — M3**)*
>
> **Friday — "Lower Squat"**
> - Bodyweight Squat — 3 × 8-15
> - Single-Leg RDL — 3 × 8-15
> - Walking Lunges — 3 × 8-15
> - Glute Bridge — 2 × 8-15
> - *Left out: Back Squat (needs barbell + rack), Leg Extension (needs a machine)*

**For Sam's judgement, three things this week actually is:** Thursday and Friday
are **near-duplicates** of each other; Tuesday is a session in name only; and
**the whole week contains no upper-body pulling and one push movement.** Whether
that is the best achievable week for a floor-and-bodyweight athlete is his call,
not mine — but the app currently refuses to publish it at all, and the athlete
gets nothing instead.

#### 5. What fought the measurement

- **My own previous measurement.** A transition-only printer made an unprinted
  verdict look like an acceptance, and I reported it as fact. Corrected above and
  in the R-090 receipt.
- **The signature is right for the wrong reason.** It matches the true cause here
  by coincidence, which is exactly why three slices trusted it.
- Nothing else resisted. The gateway instrumented cleanly on the first attempt.

#### 6. Confirmation

- **No production code was changed.** All probes lived in the temporary worktree
  and were discarded with it (`git worktree remove --force`, uncommitted).
- **No ruling was added.** No R-091. No composer/AI principle recorded.
- **No fix was attempted**, including none to `failureSignature`.
- **The shared checkout never left `main`** (`85b3d698` before and after).
- **The parked implementation remains unmerged** — `slice1bc-parked` still at
  `375f32ce`.

### Slice 1B-ship — all three mechanisms fixed, and it still does not ship

**PARKED, NOT MERGED.** `slice1bc-parked` **`81ba20f9`** (on top of `375f32ce`),
7 files, +282/−38. The shared checkout never left `main` (`12b8242b` before and
after). **Nothing in this slice reached production.**

#### 1. Instruments, before → after

| Instrument | Before (`375f32ce`) | After (`81ba20f9`) | |
| --- | --- | --- | --- |
| `print:week` scenarios written | 6 of 6 | **6 of 6** | held |
| scenario 6 `impossible_without_kit` | 0 | **0** | held |
| scenario 6 findings total | 1 (`1 × 1`) | **1** | held |
| `test:workout-canonicalisation` | 47/0 | **57/0** (+10 cells) | ✅ |
| `test:section18-v2` | 141/0 | **141/0** | held |
| **180-world sweep refusals** | **26** | **26** | ❌ baseline is **6** |
| sweep laddered days | 312 | **290** | ❌ floor is 300 — **new red** |
| sweep deficient | 137 | 133 (ceiling 88) | pre-existing red |
| kit-blocked census | 96 days | **70 days** (v_pull 44, v_push 32, h_pull 18) | fell — fewer slots now unfillable |
| census cells | 10/11, 1 failure | **9/11, 2 failures** | ❌ **new red** |

#### 2. Per-mechanism receipts

**SHEET — Sam's authority, applied to the one oracle.** His words, 2026-08-14:
*"Chest Supported Row, needs a bench and dumbbels / Romanian Deadlift needs
barbell or dumbbells / Pallof Press needs a band."*
`exerciseEquipmentRequirement.ts` — `Chest Supported Row: ['bench','dumbbells']`,
`Pallof Press: ['bands']`, and **`RDLs` and `Romanian Deadlift` now carry ONE
answer**, `[['barbell','dumbbells']]`. The OR is expressed **in the sheet**: a
nested array is an OR-group, a bare tag is required — `exerciseIsAvailableWith`
gained one `satisfied()` predicate. **No second lookup.** A rule that "knew"
barbell and dumbbells are interchangeable would be a second authority on his
answers, and the first exercise where that is false would split them. Verified:
`Romanian Deadlift` legal on dumbbells, illegal on bodyweight; `Chest Supported
Row` legal only with bench+dumbbells; `Walking Lunges` and `Single-Leg RDL` still
legal on bodyweight via `BODYWEIGHT_CAPABLE`.

**M3 — the gate never removes what the sheet permits.** The bug was in the
REASON, not the removal: `equipmentRequiredFor(name) ?? []` flattened *"not on
the sheet"* into `[]`, which under Sam's own convention means **needs nothing**.
So a record said `Romanian Deadlift` needs nothing while removing it for needing
a barbell. `EquipmentRemoval.requires` is now the sheet's own words
(`"barbell or dumbbells"`) or `null` for unknown —
`equipmentRequirementLabel()` in the same module, one table, two views.
**4 cells**, including both directions: the hinge survives a dumbbell kit and
still goes on bodyweight, and the reason is never an empty list.

**M1 — Sam's ruling, verbatim.** *"i think any push pull hinge squat single leg
knee single leg hip get the main lift role there."* Implemented as
`promoteUncreditedPrimaryLifts` in `section18WorkoutEvidence.ts` — the one place
the role is stamped, immediately after the existing pass that DEMOTES surplus
main lifts. For each **planned** pattern the day delivers but no row was credited
with, the **first** matching row is promoted. **It promotes, it does not
choose**: no ranking, no new exercise, no reorder.
It reads `plannedPatterns`, not `effectivePatterns`, deliberately — `effective`
is derived from what the content was CLASSIFIED as, so asking it would be asking
the answer to grade itself.
**6 cells:** (a) a bodyweight day carries main-strength rows, one per delivered
pattern; (b) **a full-gym day is untouched** — its anchors already credit their
patterns so nothing is uncredited, and its accessory count is unchanged;
(c) a dumbbell athlete gets the role on the loaded primaries its kit supports;
(d) four lower lifts across two patterns yield exactly **two** main lifts, not
four.

**M2 — PARTLY MOOT, AND I DID NOT FIX THE UNPROVEN SITE.** With M1 in, the
evaluator reports `kitUnachievablePatterns = ["push","squat","hinge"]` and the
downgrade has nothing left to downgrade for those three — they now have main
lifts. **The symptom is gone for them without touching either named site.**
It is **not** fully moot: `pull` still blocks, and the reason is measured —
the week evaluated no longer contains the day that carried the pull removals.
That day (`Tempo Intervals`, the ex-`Upper Pull`) has been replaced by a
`Hard Conditioning` day with `equipmentRemovals: []`. **That is neither of the
two sites I named**, so per the fence I left both untouched.

#### 3. The sweep's remaining refusals

**26, unchanged.** M1 fixed classification; it did not reduce refusals. The
traced world (`Off-season/4d/club/Bodyweight Only/w2`) now fails on three codes:

```
pattern_imbalance:strength_patterns:{squat:2, hinge:1, single_leg_knee:0,
                                     single_leg_hip:0, push:1, pull:0}
pattern_restore_failure:strength_patterns:0          ← pull
planner_selected_target_miss:main_strength:3
```

- `pattern_restore_failure` for **pull** — the removal record is on a replaced
  day (M2 above).
- `planner_selected_target_miss:main_strength:3` — the planner wants more
  main-strength SESSIONS than the kit-limited week has days for.
- **`pattern_imbalance` IS NEW TO THIS WORLD AND M1 CAUSED IT.** Creating main
  lifts pattern-by-pattern makes squat 2 / hinge 1 / pull 0, which
  `balanceExpectation: 'equal_or_near_equal'` blocks. **Balance policy for a kit
  that cannot reach every pattern is unruled**, and week QUALITY is explicitly
  parked, so I did not touch it.

And the census breadth floor now reds — **290 laddered days against a floor of
300** — because refused worlds contribute no laddered days.

#### 4. Registry rows as landed

**Unchanged: R-083 `UNENFORCED`, R-090 `UNENFORCED`.** No main-lift-role row was
added: the registry's rule is that a ruling lands with the commit that enforces
it, and nothing enforces it in production — it is parked. Adding a `BUILT` row
pointing at an unmerged branch would be the false receipt this campaign has
already corrected twice. **The UNENFORCED ceiling was not raised.** No R-091, no
gym-access ruling.

#### 5. What fought me

- **M1 worked and bought nothing at the gate.** Main lifts now exist —
  `squat 2, hinge 1, push 1` where there were zero — and the refusal count did
  not move by one. Fixing the named cause is not the same as fixing the failure.
- **My own fix created the next blocker.** `pattern_imbalance` fires *because*
  M1 succeeded: a kit that can reach three patterns and not the fourth is, by
  §18's balance rule, an unbalanced week. That is not a bug in M1 — it is the
  next unruled question, and it was invisible until M1 landed.
- **A `git checkout -- src/__tests__` I typed while meaning to run `git status`
  discarded two cell edits.** Caught immediately by re-reading the diff, redone.
  Noted because it is the same class of shared-tree write this repo has paid for
  before, and I did it inside a worktree only by luck of where I was standing.
- The sheet, M3 and M1 themselves resisted nothing. Every cell passed first run.

### Slice 1B-ship-2a — diagnosis. The requirement set has an owner, and it is worth 6 worlds

**DOCS ONLY.** Measured on `slice1bc-parked` (`81ba20f9`) and on `main`
(`12b8242b`) as the control, both in temporary worktrees, both discarded. The
shared checkout never left `main`. No code, no registry change, no gate, census,
floor or ratchet touched.

#### Q1 — what blocks the 26 worlds

All 26 captured; none sampled. 38 blocking findings, **three kinds only**:

| Blocking finding | Domain | Subject shape | Occurrences | Worlds |
| --- | --- | --- | ---: | ---: |
| `pattern_imbalance` | `strength_patterns` | **distribution** across the required set | 20 | 20 |
| `pattern_restore_failure` | `strength_patterns` | **one pattern** | 18 | 12 |
| `planner_selected_target_miss` | `main_strength` | **session count** (expected 4, actual 3) | 6 | 6 |

By world family:

| Phase | Kit | Refused |
| --- | --- | ---: |
| Pre-season | Bodyweight Only | 12 |
| Pre-season | Dumbbells | 6 |
| Off-season | Bodyweight Only | 6 |
| **Pre-season** | **Full Gym** | **2** |

Three whole-world shapes: 14× imbalance alone; 6× two `pattern_restore_failure`;
6× all three together.

#### Q2 — how many are genuinely kit-impossible

Judged by asking the **corrected sheet oracle over the entire tagged library** —
"does any exercise of this pattern pass for this kit" — not pools, not removal
records.

| Classification | Findings | What they are |
| --- | ---: | --- |
| **KIT-IMPOSSIBLE** | **6** | `pull` on Bodyweight Only — **0 legal lifts in the whole library** |
| **ACHIEVABLE-BUT-MISSING** | **12** | `squat` ×6, `hinge` ×6 — the category a lazy fix would wrongly silence |
| **NOT-PATTERN-SHAPED** | **26** | 20 distribution + 6 session count |

Library trainability per kit, corrected sheet:

| Kit | squat | hinge | push | pull |
| --- | ---: | ---: | ---: | ---: |
| Full Gym | 16 | 8 | 20 | 18 |
| Dumbbells + Bands | 7 | 3 | 7 | 4 |
| Bodyweight Only | 6 | 2 | 3 | **0** |

**Only `pull` on bodyweight is impossible anywhere.** Every
achievable-but-missing finding names `squat` or `hinge` — including on **Full
Gym, where 16 squats and 8 hinges are legal.** Those are composition failures
wearing an equipment costume.

#### Q3 — where the requirement set is constructed

**ONE CONSTRUCTOR.** `buildSection18WeeklyExposureContractV2`,
`src/rules/weeklyExposureContractV2.ts:1262`:

| What | file:line |
| --- | --- |
| `requiredSafePatterns` = `ALL_PATTERNS` minus `prohibited` | `weeklyExposureContractV2.ts:1268` |
| `balanceExpectation` / `permittedCountDifference: 1` | `weeklyExposureContractV2.ts:1357-1358` |
| `plannerSelectedTarget` (main strength) | `weeklyExposureContractV2.ts:675`, fed from `input.plannerSelected` at `:1277-1279` |

**Three post-construction narrowers, all feeding from that one contract:**

| Site | What it narrows | Why it matters |
| --- | --- | --- |
| `section18SafetyPolicy.ts:165-177` | injury `prohibitedPatterns` → recomputes `requiredSafePatterns` | the existing kit-shaped hole |
| `userRemovalConstraints.ts:246-266` | athlete deletions → drops unachieved patterns **and sets `balanceExpectation = 'not_applicable'`** | **the exact precedent** for an achievability-relative set |
| `reversibleAdjustmentTransaction.ts:503-509` | restores both on undo | |

**Four production callers of the constructor:** `coachingEngine.ts:794`,
`derivedWeekContract.ts:305`, `weeklyExposureContractV2.ts:1587` (legacy
migration), `programStore.ts:737`.

**EXECUTED CONFIRMATION** on the traced world
(`Off-season/4d/club/Bodyweight Only/w2`):

```
[CONTRACT] buildSection18WeeklyExposureContractV2
  mode=mid_offseason  prohibited=[]  requiredSafePatterns=["squat","hinge","push","pull"]
  balance=true  strengthRequired=3  plannerSelected.mainStrength=4
```

The bodyweight athlete is required to produce a pull. `prohibited` is empty and
is the only channel that has ever narrowed the set.

#### Q4 — is there one central place? Yes. It is worth 6 worlds.

**There is a single owner**, and a kit-relative requirement set would be a clean,
small change at `weeklyExposureContractV2.ts:1268` with `userRemovalConstraints`
as its precedent. **And it does not solve this.**

Recomputed over the captured findings — dropping kit-impossible patterns from
`requiredSafePatterns`, which also re-bases the imbalance comparison:

| | Worlds |
| --- | ---: |
| Would CLEAR | **6** |
| Would STILL refuse | **20** |

**Attributed against the `main` control (executed, not inferred):** baseline is
**6 refused**, and they are exactly `Pre-season/2d/club` across **all three
kits** — `pattern_restore_failure` for squat + hinge, identical on Full Gym.
Kit-independent: two training days cannot carry four patterns.

So after a perfect requirement-set fix, the 20 survivors are:

| Survivors | Cause | Pre-existing? |
| ---: | --- | --- |
| 6 | `pattern_restore_failure` squat + hinge, `Pre-season/2d/club`, all kits | **YES — the baseline 6** |
| 8 | `pattern_imbalance`, `rel=[0,2,2]` / `[0,2,2,2]` — **squat count 0** on kits with 6–7 legal squats | no — introduced by this slice |
| 6 | `planner_selected_target_miss` — 4 main-strength sessions wanted, 3 delivered | no — introduced by this slice |

**MY READ.** The requirement set does have an owner, and I am not going to shade
that into a recommendation. Changing it is worth six worlds and is the *correct*
change for those six — `pull` on bodyweight is genuinely unrequirable, and the
`userRemovalConstraints` precedent shows the codebase already agrees that an
unachievable requirement should be dropped rather than failed. But **32 of 38
blocking findings are not about kit-impossibility**, fourteen worlds would still
be newly refused after the fix, and the survivors say plainly what they are: a
composer that leaves `squat` at zero on a kit with seven legal squats, and a
planner asking for four main-strength sessions from a week that composes three.
**The gate is not the thing that is wrong.** One more gate change buys six worlds
and leaves the campaign exactly where it is; the decision belongs to the composer.

#### The fifth question, which turned out to be the real one

*"Does the composer build a complete, balanced week for a kit-limited athlete?"*
**Measured: no, and not only for kit-limited athletes.** Eight worlds compose a
week with **zero squats** while carrying two hinges and two pushes, on kits with
six or seven legal squat options. Six worlds — **including full gym** — cannot
place four patterns across two training days. Neither fact involves equipment.

#### What fought me

- **Nothing, and that is the finding.** Every probe landed first try; the
  baseline control reproduced 6/174 exactly; the recomputation is arithmetic over
  captured data rather than another hypothesis. After three slices of wrong
  guesses, the measurement that finally settled it took two sweeps and no
  cleverness — which is an argument for measuring first, not an argument about
  §18.
- The one thing I nearly did wrong: my first instinct was to report "one owner,
  therefore fixable". The recomputation is what stopped that, and it only exists
  because the prompt asked for the achievable-but-missing count precisely.

### Slice 1C-A — the AI no longer builds anything. Nothing else moved.

**SHIPPED.** Three files: `src/services/api/generateProgram.ts` (−523/+31),
`src/__tests__/onboardingGenerationOutcomeTests.ts` (+69),
`docs/RULINGS_REGISTRY.md` (+37). Built in a worktree off `1202ca5c`; all git run
from inside it; worktree discarded.

#### 1. Severed sites

**ONE DOOR, NOT FOUR.** Every production caller arrives at the same function, so
reachability is removed there rather than argued at each site:

| Caller | file:line | Now lands on |
| --- | --- | --- |
| Onboarding — `CompleteScreen` | `screens/onboarding/CompleteScreen.tsx:302` | deterministic builder |
| Rebuild — `useProgramRebuild` | `hooks/useProgramRebuild.ts:118` | deterministic builder |
| Coach — `coachTurnController` | `utils/coachTurnController.ts:3460` | deterministic builder |
| Coach — `coachProgramEdit` (injected) | `utils/coachProgramEdit.ts:1881` | deterministic builder |
| **The door** | **`services/api/generateProgram.ts:1505`** | `return generateProgramLocally(...)` |

`useHomeScreen.ts` and `CoachScreen.tsx` import the same symbol; both are covered
by the same severance. **Grep receipt:** zero production `fetch` to the coach
endpoint remains in `generateProgram.ts`.

#### 2. Deleted vs reported

**DELETED — 528 lines, proven exclusive:** the body of
`generateProgramFromProfile` from "Step 2: Build AI prompt" onward — prompt
construction, the generate-mode payload post, and the response parsing that built
a week out of the reply. Nothing else called it.

**⚠ THE ENDPOINT IS SHARED AND WAS NOT TOUCHED.** Generation posted to
`env.coachChatEndpoint` — the same edge function `CoachScreen.tsx:1856` uses for
conversation. **Only the generation MODE is gone.** Coach chat keeps its
endpoint, its plumbing and its own caller.

**REPORTED, NOT CHASED** (ledger lines below): `buildGenerationPrompt` and
`buildProgramGenerationEdgePayload` are now reachable only from
`buildProgramGenerationRequestDiagnostics`, which **`CompleteScreen` still uses
for failure diagnostics** — shared, therefore ambiguous, therefore not deleted.

#### 3. The no-shadow-path guard

`test:onboarding-generation-outcome`, **49 passed / 0 failed**. It drives the one
door with `fetch` replaced by a throw, and asserts four things:

- a week is built with the network removed;
- **nothing reached the edge function** (a flag the stub would have set);
- the week **IS** `generateProgramLocally`'s — compared on days, names, types and
  every prescribed row, **not** on raw JSON, because ids and `createdAt` stamps
  are minted per call and comparing them fails on a timestamp while saying
  nothing about the week;
- non-vacuity: the week is not empty. Without it, a builder returning nothing
  would satisfy all three above.

#### 4. Identity table — the acceptance

| Instrument | Before | After | |
| --- | --- | --- | --- |
| `print:week` corpus digest | `0cca0f63` | **`0cca0f63`** | **byte-for-byte identical** |
| `print:week` findings | 16 | **16** | identical |
| 180-world sweep | 174 built / **6 refused** | 174 built / **6 refused** | identical |
| `test:ladder-wide` | 126 deficient / 318, kit-blocked 86, 10/11 | **identical** | unmoved |
| `test:qa` | 168 / 10 | **168 / 10** | unmoved |
| `test:scenarios` | 1 failed | **1 failed** | unmoved |
| `test:compile` | 459 PASSED | **459 PASSED** | unmoved |
| `test:pools` | 504 / 0 | **504 / 0** | unmoved |
| `test:ruling-registry` | 6 pass / 2 fail | **6 pass / 2 fail** | unmoved; R-091 lands BUILT |

**THE SAME SIX WORLDS, NAME FOR NAME, BEFORE AND AFTER:**

```
Pre-season/2d/club/Full Gym/w1          Pre-season/2d/club/Full Gym/w2
Pre-season/2d/club/Bodyweight Only/w1   Pre-season/2d/club/Bodyweight Only/w2
Pre-season/2d/club/Dumbbells/w1         Pre-season/2d/club/Dumbbells/w2
```

**NOTHING WAS RE-BASELINED.** No gate, ceiling, floor, census, contract, pool or
sheet was touched. The sole builder's defects are the evidence base for the
composer and every one of them is still visible.

#### 5. Onboarding receipt, and the week it now produces

`CompleteScreen.tsx:302` calls `generateProgramFromProfile`, which is now the
deterministic builder. Driven with `fetch` throwing — a full-gym in-season
athlete, 4 training days, Tuesday/Thursday club, Saturday game:

> **Mon — Lower Body Strength** · Back Squat 3×2-4 · Deadlift 3×2-4 · Walking
> Lunges 3×6-8 · Single-Leg RDL 2×6-8 · Pallof Press 2×8-12 · Short Flush
> **Tue — Team Training + Upper Pull** · Pull-Ups 3×4-6 · Barbell Row 3×4-6 ·
> Face Pulls 2×10-20
> **Thu — Team Training + Upper Push** · Overhead Press 3×3-5 · DB Bench Press
> 3×8-15 · Lateral Raise 2×10-20
> **Fri — Gunshow** *(optional)* · Concentration Curl · Chin-Up Negative ·
> Dumbbell Kickback · Banded Tricep Pushdown · Single-Arm Shrug · Lateral Raise

**⚠ THE BEFORE/AFTER CONTENT DIFFERENCE IS NOT ESTABLISHED AND I DID NOT
MANUFACTURE ONE.** The old path's output came from a model over the network and
was nondeterministic; no frozen baseline of it exists. What is established is
that onboarding now reaches the deterministic builder and what that builder
hands the athlete. I did not call the network to invent a comparison.

#### 6. Coach conversation still works

| Suite | Result |
| --- | --- |
| `test:coach-plan` | 9 pass / 0 fail |
| `test:coach-tab-slice2` | 76 / 76, 0 failures |
| `test:coach-clarifier-advance` | 12 pass / 0 fail |

#### 7. What fought me

- **The equality assertion failed first run, and it was right to.** Comparing
  `JSON.stringify(built) === JSON.stringify(local)` reds on `createdAt` stamps
  and row ids minted per call. The fix was to compare the *week* — days, names,
  types, prescriptions — not the object. A weaker cell would have compared
  microcycle counts and passed while proving nothing.
- **The endpoint turned out to be the chat endpoint.** Generation posted to
  `env.coachChatEndpoint`. Had I deleted the endpoint or its plumbing as "AI
  generation machinery", coach chat would have gone with it. The fence's warning
  was load-bearing, not decorative.
- Nothing else. The severance was one function and the corpus digest was
  unchanged on the first measurement.

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
- §18 (`section18EffectiveWeekEvaluator.ts:1440`) has no R-083 exemption: a kit-untrainable pattern is still a `requiredSafePattern`, so honouring R-083 makes it reject the whole week. Needs a Sam ruling, not a code decision.
- A third route adds rows to a generated week AFTER canonicalisation — `Band Pallof Press` reaches a bodyweight athlete having passed neither the pool nor the canonicaliser triage.
- The pool is narrower than the tagged library: a slot can be kit-trainable while the pool holds no legal entry for it, which is ~34 of the wide census's remaining deficient days.
- `Workout.equipmentRemovals` (built in 1B, unshipped) is not yet carried through store hydration — a persisted week would lose the reason its day is short.
- 1A's report called `RDLs` a non-pool route; it is the restored `Romanian Deadlift` renamed at the projection. Corrected in the 1B report.
- `resolveEquipmentCapabilities` returns `['bodyweight']` for both "owns nothing" and "never asked"; only the typed `source` field separates them, and callers that delete work must read it.
- §18 reports "not enough main strength" under three separate finding codes (`pattern_restore_failure`, `required_minimum_shortfall`, `planner_selected_target_miss`); any rule about strength sufficiency has to answer all three.
- `canonicalExerciseName` cannot be imported by `exercisePoolsStrength` — the selectable vocabulary reads `STRENGTH_POOLS` at module-init and the cycle leaves it undefined.
- A second week-builder path (likely `section18AcceptedWeekGateway.ts`'s safe deterministic fallback) appears not to carry `Workout.equipmentRemovals`; unproven, and it is what blocks R-090.
- `test:ladder-wide` swallows §18 refusals into a bare counter, so a refusal-rate regression is invisible without instrumenting the `catch`.
- `Section18WeekAcceptanceError.failureSignature` reports the LAST repair candidate tried, not the week that failed — three slices chased findings raised against conditioning-only and empty candidate weeks.
- `evaluateSection18EffectiveWeek` accepting a week does not mean the gateway accepts it; there are at least two verdicts and only the outer one throws.
- `wholeWeekRepairEngine.searchWholeWeekRepairCandidates` assesses an EMPTY week as a candidate (`section18AcceptedWeekGateway.ts:1391` → `section18SafetyFinaliser.ts:640`).
- One `Off-season/4d/club/Bodyweight Only` world takes ~270 evaluator calls at HEAD and ~51 with kit-limited composition — the repair search's cost scales with how thin the composed week is.
- Every bodyweight lift classifies `strength_accessory`, never `main_strength`, so a bodyweight week has zero main lifts by construction — §18's main-strength floor is unreachable for that athlete regardless of equipment removals.
- The parked R-090 gate removes exercises whose sheet entry is `[]` ("needs nothing"): `Chest Supported Row`, `Romanian Deadlift`, `Pallof Press` — the alias step and the reason-reporting disagree about which exercise is being judged.
- The canonicaliser retypes `Upper Push`, `Lower Body Strength` and the ex-`Upper Pull` day to `workoutType: 'Conditioning'` once their strength content thins, so a day's name and its type disagree on the athlete's screen.
- A kit-limited week composes Thursday and Friday as near-duplicate lower-body days (same four bodyweight lifts) — the variety rotator has nothing left to vary.
- `resolveFinalVisibleSection18Week` is what the evaluator is handed, not the composed workouts; whether `equipmentRemovals` survives that projection is unestablished.
- §18's `balanceExpectation: 'equal_or_near_equal'` blocks any week whose kit can reach three main patterns but not the fourth — unruled for kit-limited athletes.
- `planner_selected_target_miss:main_strength` asks a kit-limited week for more main-strength SESSIONS than its training days can carry once impossible patterns are removed.
- The ex-`Upper Pull` day is replaced by a freshly composed `Hard Conditioning` day whose `equipmentRemovals` is empty, so the reason the pull vanished does not travel with its replacement.
- `test:ladder-wide`'s breadth floor (300 laddered days) falls when worlds are refused, so a refusal regression reds the floor cell rather than the refusal counter.
- The pre-existing 6 refusals are `Pre-season/2d/club` on ALL THREE kits including Full Gym: two training days cannot carry four required patterns, and nothing about equipment is involved.
- Eight worlds compose a week with ZERO squats while carrying two hinges and two pushes, on kits with 6–7 legal squat options — a composer gap that `pattern_imbalance` reports as a balance failure.
- `planner_selected_target_miss` asks for 4 main-strength sessions from Off-season bodyweight weeks that compose 3, on 4/5/6 training days alike.
- `userRemovalConstraints.ts:246-266` already drops unachieved patterns from `requiredSafePatterns` AND sets `balanceExpectation = 'not_applicable'` — the codebase's own precedent for an achievability-relative requirement set.
- `hinge` has only 2 legal lifts in the whole library on a bodyweight kit and 3 on dumbbells+bands, so hinge coverage is one authoring decision away from impossible for those athletes.
- `buildGenerationPrompt` and `buildProgramGenerationEdgePayload` are now reachable only from `buildProgramGenerationRequestDiagnostics`, which `CompleteScreen` still uses for failure diagnostics — shared, so not deleted.
- `generateProgramFromProfile` stays `async` purely so four screens keep their signature; it now does no asynchronous work at all.
- Program generation and coach chat post to the same edge function (`env.coachChatEndpoint`), distinguished only by payload shape — one endpoint serving two products.
- `getProgramGenerationProfileFieldDiagnostics` still reports "profile fields missing for program generation" in onboarding failure diagnostics, though generation no longer consumes a profile the way the prompt did.

**SLICE 1C-BASELINE — what the sole deterministic builder actually produces, re-measured at `1fce185f` across all seven dimensions, with the printed weeks and the composer-owned defect list: [`docs/SOLE_BUILDER_BASELINE_2026-08-14.md`](SOLE_BUILDER_BASELINE_2026-08-14.md).**
