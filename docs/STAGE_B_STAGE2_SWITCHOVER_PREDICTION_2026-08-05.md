# Stage B stage 2 — the atomic switchover: differential prediction, written BEFORE the code

Per the stage 1 plan's §P discipline and the addendum's build order. Branch
`feat/stage-b-stage2`. **This prediction is NOT zero** — the athlete's
conditioning and speed sessions change, and every changed class is named here
with its cause. Anything the gates report that this document does not predict
is a STOP, not a `--write`.

Rulings this unit executes: Priority C (gate split already landed `2d33b0c`),
%MAS ruling 4 (`5c46050`), and the 15:15 Blocks re-sign
(`docs/MAS_CELL_RESIGN_RULING_2026-08-05.md`, committed `0e2bf44`).

---

## 1. The design, in one paragraph each

**Selection.** A new owner, `src/rules/conditioningSelection.ts`, maps the
surviving demand vocabulary (`conditioningCategory` /
`conditioningFlavour` / tier) onto pools of **authored template names drawn
from the 8 quality tabs**, filters by the six authored selection properties,
by modality renderability (`templateModalitiesFromNotes` — the gate-proven
reader in `equipmentVocabulary.ts`) against athlete equipment, and picks
deterministically with the SAME seeds the old path used
(`miniCycleNumber` block-stable index, else `conditioningDateHash`). Pool
membership per category and the tier→quality mapping are declared ONCE, in
the owner, as selection policy — they cite quality tabs, never doses.

**Composition.** The only place rows are built from a template. Two rows:
a bare `Warm-up` row (structural role, no invented prescription text) and a
headline row whose `name` is the authored template name VERBATIM (the sheet's
own law: "never rewritten for display"), whose `sets`/`restSeconds` come from
`parseConditioningDose` (`rules/conditioningDose.ts` — the one ingress; a
refusal renders as sets=1/rest=0 with the authored string still visible),
and whose notes are the authored `workPeriod` / `restPeriod` / `setsRounds` /
`intensity` / `effortCue` strings verbatim under minimal labels. **No
cool-down row** (recovery is the flush tab's job, not invented copy).
`workoutType` derives from the selection category
(sprint→`Sprint-Intervals`, tempo→`Tempo-Run`, aerobic_base→`Long-Run`,
flush/recovery→`Recovery`, else `Conditioning`) — the per-name map dies with
`conditioningWorkoutType`.

**Registry derivation.** `CONDITIONING_META` and `EXERCISE_TAGS` gain entries
for the 55 authored names, DERIVED from the sheet at module init (tier from
quality, modality from `modalityNotes`, `movement: 'conditioning'`). One
derivation makes the names selectable vocabulary (locked-list law), resolves
the literal lock, and lets both row classifiers
(`isConditioningExerciseRow`, `classifyGeneratedWorkoutRow`) answer from the
REGISTRY — no regex is widened, which is the move LR-9 forbids.

**Speed.** `SpeedBlock` gains a `templateName` field naming the authored
template. `speedTemplates.ts` selects among `'Hill Acceleration'` /
`'20 m Acceleration Reps'` / `'Off-Season Speed Reintroduction'` by the same
late-offseason position logic; `coachingEngine`'s pre-season fallback becomes
`'20 m Acceleration Reps'` (the pin's named successor); `defaultProgram`
renders speed rows from `templateName` — the `id.startsWith` string-prefix
coupling dies with `buildExercisesForSpeedBlock`.

**Resolver path.** `resolveConditioning` keeps its whole eligibility engine
(tiers, caps, game proximity, injury filters) and swaps ONLY its pools:
tier→authored templates (A → acceleration/top_end_speed/repeat_sprint/
anaerobic, B-high → aerobic_power, B-low → aerobic_capacity, C → flush).
The off-feet/run-cap conversions (`sessionResolver`, run-streak guard in
`defaultProgram`) become a re-selection with an off-feet constraint in the
same category — `switchToOffFeetModality`'s parallel dose library dies.

**The MAS cell.** Workbook `Aerobic Power` tab row 5 cell F5 and
`conditioningTemplates.ts:902` both become plain `110% MAS` in the switchover
commit, cited to `docs/MAS_CELL_RESIGN_RULING_2026-08-05.md`. The accreted
binary in `masCopy.ts` is NOT deleted (ruling 4: it dies when MAS wiring
lands); its five sessionBuilder call sites die with the doomed code, leaving
it caller-less and marked.

## 2. The golden (`test:stage-b-generation-differential`) — predicted movement

Regenerated with `--write` in the switchover commit. Every diff class:

1. **All 117 conditioning components across 12 scenarios** (the two in-season
   zero-conditioning scenarios STAY zero — placement machinery is untouched):
   - row names: composed strings (`"Tempo conditioning component 11 x …"`,
     `"Easy Aerobic Flush (2 x 10min easy SkiErg)"`, `"… zone 2 …"`) →
     authored template names + `Warm-up`;
   - row ids: `cond-<date>-<legacy-suffix>` → the new owner's suffixes;
   - cool-down rows (`"Cool-down jog"`, `"Easy bike"` …) DISAPPEAR — row
     counts per component drop where a cool-down existed;
   - `sets`/`restSeconds`: parsed authored doses replace hand-authored
     numbers; `notes` become labeled authored fields verbatim;
   - `metadata.title` / `presentation.conditioningLabels` /
     workout `displayName`: mirror the new headline names;
   - `workoutType` moves on days where the old per-name map disagreed with
     the new category map (e.g. any old `MAS-Training` day → its category's
     type).
2. **All 26 speed components**: `"Short hills or controlled accelerations
   (10-15m)"` / `"Acceleration build reps"` / `"Smooth build-ups"` /
   `"Speed warm-up"` → `Warm-up` + authored speed template names; SpeedBlock
   `title`/`label`/`prescription`/`durationMinutes` change → session `focus`
   strings composed from them change.
3. **Unchanged, and load-bearing that they stay unchanged**: strength rows,
   power rows, mobility/prehab/recovery rows, `contractDemand` blocks
   (demand side untouched), §18 `visibleCounts` (session-level, not
   row-level), week/day structure (which days carry conditioning), the
   determinism check (same deterministic seeds).
4. **`offseason-no-equipment` ("Brisk Walking" days)** — CONDITIONAL, the one
   diff this prediction cannot fully pin: `Brisk Walking` is produced by
   `conditioningFeasibility` (NOT doomed). If its substitution triggers on
   erg-demand that the new run-renderable selection no longer creates, those
   days become an authored run template; if it triggers upstream of
   selection, they stay `Brisk Walking`. **Both outcomes are explained; any
   THIRD shape there is a STOP.** The reconciliation must state which fired.

## 3. Suite-by-suite prediction (test:bible chain)

| Suite | Prediction |
|---|---|
| `test:pending-lists` | athlete path flips LANDED; all 15 athlete pins' symbols gone from their files in the same commit → green. Coach path stays unlanded, its 5 pins live. |
| `test:stage-b-generation-differential` | moves per §2, regenerated `--write` same commit; determinism cell stays green |
| `test:optional-topup` R7 | **INVERTS by design** (its own comments anticipate this): rewritten in the same commit to assert the headline IS one of the 55 (its `getTemplateCategory` import dies with the symbol) |
| bibleConformance slice 1 `ALL-COND-SECTION-01` | expectation row `'Easy Aerobic Flush (2 x 10min easy Mixed Erg Block)'` updated to the new authored rows for that deterministic scenario, same commit |
| `test:action-walker` + `:deep` | `generated_conditioning_rows_have_no_authored_name` KEEPS reproducing (the `Warm-up` row is still a composed-name Cardio row) → ratchet green, no declared-red deletion, no matrix cell [3] edit. Its prose narrows to warm-up rows (comment update). L16 relaunch cells unaffected (within-process). |
| `test:session-list-combinations` | green — combined-day buckets split on `conditioningBlock` ids FIRST (`sessionComponents.ts:633-636`), stable under renames; declared blind spot / CONTAINED coordinates unchanged |
| `test:g1-landing-ask-flow` | green — seed preconditions and tests 8/9 resolve via the derived registry entries (`movement: 'conditioning'`); test 26 is a coach-path literal, untouched |
| `test:surface-agreement` | (3) green-or-greener (planner phrases leave generation); (5) green (conditioning rows remain `exerciseType: 'Cardio'` → excluded from the signed-copy allowlist as today) |
| `test:session-type-charter` | E0/E2/E3 green via `workoutType` fallback (`Tempo-Run`/`Sprint-Intervals`/`Long-Run`/`Conditioning` all in the taxonomy's type sets). If a category stops firing, that is unpredicted → STOP |
| `test:locked-list`, `test:generation-vocabulary`, `test:content-reconciliation`, `test:exercise-name-lock` | green — the 55 names enter the selectable vocabulary via the derived `CONDITIONING_META` entries under the existing `conditioning_format` exemption kind; composition passes `template.name` as a variable, no new swept literal |
| `test:legacy-census` | green — no census counts change in this unit (LR-9 stays `scheduled`; its regex is not widened, its test 26 does not flip) |
| `test:compile` | no file regresses (ratchet) |
| every hand-built-fixture suite named in the survey (`test:session-template`, `test:deload-law`, `test:rules-kernel`, `test:exercise-canonicalisation`, `test:coach-prefs-ownership`, `test:row-counting`, `test:mobility-flow`, `test:render-truth`, `test:nonstrength-tripwire`, …) | green — fixtures, not generation |

**Outside the chain** (recorded, not gated here): `conditioningRotationTests`,
`finisherEligibilityTests`, `visibleProgramProjectionTests`,
`weeklyPlanDisplayTests`, `conditioningVisibleIdentityTests` and other
unchained suites carry legacy-name dependence and will need their own pass —
several are pre-existing reds on main (`test:row-counting` noted 2026-07-26).

## 4. Known risks, named before the code

1. **Feel variants die.** The old builders had grindy/sharp/flowing dose
   variants. Authored templates carry ONE dose each; `conditioningFeel`
   degrades to a selection-order hint at most. This is the sheet's design
   ("the ranges own intensity"), not a loss this unit may compensate for by
   inventing variants.
2. **Erg pre-picking dies.** Old titles baked a chosen machine ("— Assault
   Bike"). Authored names carry none; the authored `modalityNotes` string
   (verbatim in the row notes) tells the athlete what the session may render
   on. The weekly erg-variety rotation (`usedErgs`/`lastErg`) loses its
   naming surface; its remaining effect is only equipment/off-feet
   filtering. Athlete-visible per-athlete distance for %MAS work arrives
   with MAS wiring (the re-sign ruling records that intent), not here.
3. **Warm-up copy is still unsigned** — deliberately narrow: one bare
   `Warm-up` row, no invented mini-dose text. The walker's L-P2 declared red
   stays alive over exactly this. Authoring warm-up copy is Sam's, parked.
4. **`cod_decel` templates remain unselected** by the athlete conditioning
   path (no demand vocabulary maps to them; the old path never selected COD
   conditioning either). Availability-gated; recorded as NOT-COVERED.
5. **Progression reads** (`primaryConditioningRow`) skip rows whose
   name+notes contain "easy" — authored notes often do (`15 s easy`). The
   fallback (`?? exercises[0]`) plus the headline's higher sets-score keeps
   the read functional; fresh generation (the golden) has no feedback so
   this cannot move the golden. Flagged for the walkers; any red here is
   unpredicted → STOP.

## 5. Reconciliation contract

After implementation: run the FULL chain (`test:bible`), reconcile the
golden diff against §2 class by class, state which branch of §2.4 fired, and
record any suite that moved outside §3 as a STOP with diagnosis — before any
`--write` is kept.
