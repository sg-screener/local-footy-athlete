# MISSION THREE FIXES

## MISSION

Make the program respect equipment, athlete authorship, and training history;
four slices; nothing else.

## SLICES

| # | Slice | Status |
| --- | --- | --- |
| 1A | Equipment probe — the pool refuses a slot no kit can fill | **DONE** — `bad0bfc1` |
| 1B | Equipment class — every route asked, not just the pool walk | **PARTIAL** — item 5 shipped (`116bf886`); items 1–4 built and measured, not shipped |
| 1B-completion | R-090 lands; all four routes closed | **HARD STOP AT BUDGET** — every acceptance criterion met on the six printed scenarios, but 20 kit-limited worlds in the 180-world sweep are newly REFUSED. Not shipped. |
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
