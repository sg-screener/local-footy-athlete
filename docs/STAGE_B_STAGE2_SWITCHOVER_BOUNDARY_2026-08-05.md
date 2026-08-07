# Stage B stage 2 — the atomic switchover: boundary report

Branch `feat/stage-b-stage2`, UNMERGED. `main` untouched at `936bbf7`.
Commits this unit: `0e2bf44` (MAS re-sign ruling, authored), `cd4824a`
(differential prediction, BEFORE code), `149cc4d` (the switchover — 30 files,
+3350/−5647).

**`test:bible` EXIT 0 END TO END, zero FAIL lines, last link reached**
(`test:stage-b-generation-differential` 3/3 is the chain's final suite).
`test:compile` PASS, no file regressed. `test:pending-lists` 10/10.

---

## 1. The convergence question, answered first

> **Does this move the app toward "store decisions, derive everything"?**

**Toward — this unit is the north star's own sentence for conditioning.**

The athlete's conditioning and speed doses were AUTHORED IN CODE at fifteen
pinned sites: twelve dose builders in `sessionBuilder`, a speed-row builder in
`defaultProgram`, a speed dose table in `speedTemplates`, a micro-dose in
`coachingEngine` — a second, third and fourth dose authority beside Sam's
signed sheet. All fifteen are DELETED (net −2,297 lines). What replaced them
stores nothing and invents nothing: selection picks one of the 55 signed
templates, composition parses the authored dose strings through the ONE
ingress (`rules/conditioningDose.ts`) and renders the authored words verbatim.
The workbook remains the only place a conditioning dose exists.

**Nothing stored was added.** Two typed fields were added to in-memory
generated shapes (`ConditioningOption.modality`, `SpeedBlock.templateName`) —
both are the RESOLVED selection decision made typed, so that no reader has to
keyword-guess it back out of a name. That is the opposite of a second
representation: it deletes the name-sniffing that used to be the
representation.

## 2. What landed

- **Selection + composition owner**: `src/rules/conditioningSelection.ts`.
  Demand categories map to quality-tab pools (the one two-category tab,
  Aerobic Capacity, is split ONCE, name-checked against the sheet at module
  init); the six authored selection properties, the athlete's machine set and
  off-feet constraints filter; the SAME deterministic seeds pick
  (mini-cycle-stable index, else date hash). Composition: structural
  `Warm-up` row + the authored headline (name verbatim, sets/rest parsed,
  authored workPeriod/restPeriod/setsRounds/intensity/effortCue/modalityNotes
  verbatim in the notes). No cool-down row — recovery is the Flush tab's job.
- **The gate**: `conditioningRules` imports the templates module; all 15
  athlete pins retired in the same commit. The 5 coach pins stay live under
  LR-6 — the split's ruled cost, stated in the gate's own words, stands.
- **Registry derivation**: `CONDITIONING_META` entries for the 55 names are
  derived from the sheet (tier ← quality, modality/impact ← modalityNotes);
  curated ruled triples always win. This makes the names selectable
  vocabulary, satisfies the literal lock, lets both row classifiers answer
  from the registry (a REGISTRY CONSULT, not the regex widening LR-9
  forbids), and lets `getExerciseCue` serve Sam's `effortCue` + `intensity`
  verbatim — the supersession the cue sheet's pending-pair note promised.
  No `EXERCISE_TAGS` entries were derived: those carry authored injury
  profiles, which are not derivable.
- **Speed**: `SpeedBlock.templateName` names the authored template; rows
  compose from it by name. The `id.startsWith('late_offseason_…')` string
  coupling died with `buildExercisesForSpeedBlock`. Late-off-season
  progression: position ≤1 → 'Hill Acceleration', 2 → '20 m Acceleration
  Reps', else 'Off-Season Speed Reintroduction'; ruling 0's
  power-weakness hold reaches only the step that leaves accelerations
  (verified by the chained weak-point cells).
- **Resolver path**: `resolveConditioning` keeps its whole eligibility engine
  and selects from the authored sheet (tier ← quality pools). The off-feet
  run-cap conversions re-select an authored template of the SAME quality that
  renders on a machine — `switchToOffFeetModality`'s parallel dose library is
  gone. The sprint family has no off-feet row, so it is never converted,
  which is the old guard's rule falling out of the sheet's own structure.
- **The MAS cell re-sign** (docs/MAS_CELL_RESIGN_RULING_2026-08-05.md):
  workbook Aerobic Power F5 and `conditioningTemplates.ts:902` are both plain
  `110% MAS`, in lockstep, equality gate 51/51. The accreted binary in
  `masCopy.ts` is now CALLER-LESS in product code and still dies when MAS
  wiring lands, per ruling 4. The athlete-visible distance-per-effort
  ("cover ~X m each 15 s", derived at render from athlete MAS) is recorded
  product intent for the MAS-wiring unit — deliberately NOT built here.

## 3. Differential reconciliation — prediction vs measurement

Prediction: `docs/STAGE_B_STAGE2_SWITCHOVER_PREDICTION_2026-08-05.md` (§P
discipline, committed before any code).

**Held exactly:**
- Per-scenario conditioning component counts and speed component counts are
  IDENTICAL old→new across all 14 scenarios (117 conditioning, 26 speed).
- Both zero-conditioning in-season scenarios stayed zero.
- Every generated conditioning row name is now an authored template name
  (plus the structural `Warm-up`); cool-down rows gone; notes/doses are the
  parsed authored fields. Determinism cell green.
- §2.4's conditional resolved to its "stays" branch: `offseason-no-equipment`
  still renders `Brisk Walking` — produced by un-doomed
  `conditioningFeasibility`, whose substitution fires upstream of selection.
- The suite-by-suite table §3 held for: pending-lists, optional-topup R7
  (inverted per its own instruction), bibleConformance ALL-COND-SECTION-01
  (expectation updated to 'Continuous Aerobic Run'), walkers both tiers
  (L-P2 declared red still reproduces over the composed `Warm-up` row —
  ratchet green, no matrix edit), session-list-combinations 6/6,
  g1-landing-ask-flow, surface-agreement, session-type-charter 41/41,
  locked-list family, legacy-census, compile.

**Two UNPREDICTED movements — each treated as the STOP the discipline
requires, diagnosed to a root, and paid typed rather than patched:**

1. **The slice-3 equipment harness and `sessionTaxonomy` read conditioning
   modality out of NAMES.** Authored names carry no machine word, so
   'Continuous Aerobic Run' rendered on a bike read as a RUNNING exposure
   (`runningExposures` 0→2 in the power golden; slice-3 single-owner
   invariant red). Root: the modality decision existed but was never typed.
   Paid: `ConditioningOption.modality` is stamped by the generator from the
   resolved rendering — clamped to what the authored `modalityNotes` admit
   and to machines the athlete owns — and the harness + taxonomy read
   TYPED-FIRST, name sniffing surviving only for stored legacy content.
   After the fix, no §18 count moved anywhere.
2. **A pre-lift speed dose became a phantom third core conditioning exposure
   on a deload week** (`Section18SafetyContradictionError`,
   `conditioning_core_frequency` 3 > 2). Root: canonicalisation classifies
   rows by name; '20 m Acceleration Reps' is now registry-conditioning, so
   the speed rows on a strength day were promoted into a combined VO2
   conditioning block. Paid: SPEED-BLOCK MEMBERSHIP VETOES conditioning
   classification — the block's typed counting fence (`conditioningCredit:
   'none'`) already owned this answer; canonicalisation now honours it.

Both goldens were regenerated in the switchover commit, as their harnesses
instruct, AFTER the two roots were paid — not before.

**The class, named (for the census's vocabulary):** *a name classifier
reading a vocabulary that no longer encodes what it used to.* The old names
smuggled modality and domain ("— Assault Bike", "micro-dose") and half the
repo read them back. Both unpredicted movements, the LR-9 family, and
`primaryConditioningRow`'s 'easy' filter are all this class. What catches the
next one: the two byte-exact differentials (they caught both of these), plus
every typed field this unit added exactly where a sniff used to be.

## 4. NOT COVERED

- **No device pass.** L10 stands open for stages 1+2 together.
- **The coach path is untouched**: 5 coach pins live under LR-6; the coach's
  doses knowingly remain a second authority until the coach rebuild.
- **MAS wiring not built**: the binary survives caller-less; per-athlete
  distance rendering is recorded intent only.
- **Feel variants died with the code-authored doses** — authored templates
  carry ONE dose each; `conditioningFeel` no longer influences composition.
  Selection-time use of feel would be new policy: not built, not ruled.
- **The 'reduced' non-sprint variant now composes the authored dose
  unchanged** — the old halving was an unauthored reduction of an authored
  dose. Sprint-family reduced/micro-dose map to '20 m Acceleration Reps'
  per the pins' own supersession entries.
- **`cod_decel` templates are never selected by the athlete category pools**
  (no demand vocabulary maps to them; the old path never selected COD
  conditioning either). They remain reachable only via the resolver's tier-A
  pool.
- **Warm-up copy is unsigned**: one bare `Warm-up` row, no invented text.
  The walker's L-P2 declared red stays alive over exactly this — honestly.
- **`primaryConditioningRow`'s 'easy' filter** can skip authored headlines
  whose notes carry "15 s easy"; the fallback keeps progression functional
  and fresh generation can't reach it, but the read is the named class.
- **Unchained suites with legacy-name dependence** need their own pass:
  `visibleProgramProjectionTests`, `weeklyPlanDisplayTests`,
  `conditioningVisibleIdentityTests`, `standaloneConditioningOwnershipTests`,
  `coachModalitySwap`/coach revision suites, `deloadWeekGenerationTests`,
  `workoutCanonicalisationTests` — none run in `test:bible`; several were
  already red on main.
- **No mutation testing of the switchover itself.**
- **The erg-variety weekly rotation lost its naming surface**; it survives to
  feed the typed modality stamp, but parts of that machinery are now inert
  and were deliberately not trimmed in the atomic commit.

## 5. PARKED FOR SAM

1. **'Two-Minute Repeats' still cites `masCopy.ts` by FILE** in its signed
   intensity cell (`≈100% MAS (>30 s work = 100% MAS per src/utils/masCopy.ts)`).
   The 15:15 re-sign ruling covered only its own cell. Same question, same
   shape — re-sign as plain `≈100% MAS`?
2. **Muscle-sheet rows for the 53 conditioning templates.** Legacy
   conditioning names have authored muscle/experience rows; the templates do
   not. Recorded as a DERIVED gap (`SELECTABLE_WITHOUT_METADATA`), pinned in
   both directions. Author rows, or rule the gap permanent?
3. **'Up-Back Shuttle'**: removed by the locked list (2026-07-24), re-authored
   as a COD template by the workbook (2026-07-25/27). The removal check now
   treats a template-resolvable name as re-authored rather than surviving.
   Confirm that reading.
4. **Warm-up copy** (§4) — authoring it is yours; until then sessions carry a
   bare `Warm-up` row and the L-P2 red stands.
5. **The category → quality mapping and the Aerobic Capacity tempo/steady
   split** are selection policy declared in `conditioningSelection.ts` —
   review the pools (especially: 'Team-Training Warm-Up Dose' is selectable
   as a standalone sprint pool member because it carries no restricting
   property; if it should be gated, that is an authored property for the
   sheet, not a code filter).

## 6. Where the next session picks up

1. Sam's five parked questions above.
2. Priority D (survey-first opens) per the kickoff.
3. The unchained conditioning suites' own pass (§4).
4. L10 device pass for stages 1+2 together — the standing merge gate.
