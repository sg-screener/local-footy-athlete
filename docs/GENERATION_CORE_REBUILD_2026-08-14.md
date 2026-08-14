# GENERATION CORE REBUILD — 2026-08-14

**Base: `slice-b1-pivot` @ `a8b65151`.** Experiments harvested from
`slice-b1-m1-final` @ `9f284730`. All work in a detached worktree; the shared
checkout never left `main`. Phase directive: **BURN THE BOATS — old shit gone.**

**HEADLINE: the sweep goes 61/180 → 120/180 built. 59 worlds gained, ZERO lost.**
Every remaining refusal names a contract clause with a Bible section or an
R-number behind it; not one names builder residue.

---

## 0. THE PROVEN PROBLEM, AND WHY THE PREVIOUS DIAGNOSIS WAS WRONG

The base commit stopped with a composed week that matched an accepted baseline
byte-for-byte and was still refused
`required_minimum_shortfall:sprint_high_speed:0`. It attributed that to the
day-level envelope: baseline carried
`workout.section18Evidence = {conditioningRole:'none', …}`, composed carried
`null`. **Three separate stamping attempts followed and each made the sweep
worse** — 49/131, 42/138, 32/148.

**MEASURED THIS SESSION: that attribution was wrong, and the field is inert.**

| claim | measurement |
| --- | --- |
| `null` vs `conditioningRole:'none'` changes the verdict | **FALSE.** Both return `null` from `conditioningPresence`, `section18EffectiveWeekEvaluator.ts:317-318` |
| the envelope's `provenance` matters | **FALSE.** `workout.section18Evidence.provenance` has **zero readers in the repo** |
| the difference was the envelope | **FALSE.** It was `workout.speedBlock` — the app's ONLY source of app sprint credit (`section18EffectiveWeekEvaluator.ts:670`), which `materialiseComposedWeek` never emitted and `assembleAuthoredWeek`'s merge threw away |

The envelope and the `speedBlock` are **two by-products of the same builder
call**, lost together. The previous sessions measured the inert one.

---

## 1. CLAUSE → AUTHORITY

**GENERATED FROM THE CODE** by `clauseAuthorityTable()`. There is no
hand-written second copy: `ClauseAuthority` is a union of "Bible section" and
"`R-` number" with no free-text and no `none` member, so **a clause with no
authority is a compile error.**

| clause | authority | the authority's own words |
| --- | --- | --- |
| `main_strength_required_minimum` | Bible §18 A/B — phase table | "Required minimum \| The minimum core exposure frequency for the mode." |
| `main_strength_planner_selected_target` | Bible §18 A — phase-owned selected target | "The exposure target chosen from the canonical phase/mode table after typed constraints and before weekday allocation." |
| `main_strength_permitted_maximum` | Bible §18 A — maximum | "Maximum \| The normal programmed ceiling. It is not a target." |
| `required_safe_patterns_present` | Bible §18 D | "Default to push, pull, squat and hinge in every healthy pre-season, mid/late off-season and in-season week." |
| `pattern_balance` | Bible §18 D | "Across each healthy week, default to equal or near-equal numbers of meaningful main lifts…" |
| `prohibited_patterns_absent` | Bible §18 E — injury | "Remove prohibited affected patterns and sprint work." |
| `core_conditioning_required_minimum` | Bible §18 C | "Add only the remaining requirement after genuine anchor credit." |
| `sprint_high_speed_required_minimum` | **R-079** | "yes we do nights - in season that may mean 3 sprint sessions" |
| `full_rest_required_minimum` | Bible §18 G — rest quota | "The rest quota counts days on which nothing was REQUIRED of the athlete." |
| `hard_day_permitted_maximum` | Bible §18 G — hard-day policy | "Hard day budget: PREFER 4 hard days, PERMIT 5. The unit is DAYS, not sessions." |
| `training_paused_means_no_training` | Bible §18 E — full pause | "No training." |
| `prohibited_power_absent` | Bible §18 E/F | "Remove power primers." |
| `prohibited_sprint_absent` | Bible §18 E — injury | "Remove prohibited affected patterns and sprint work." |
| `row_role_is_declared` | **R-092** | "i think any push pull hinge squat single leg knee single leg hip should be counted as a main lift" |

**The contract invents no numbers.** Every target is read out of the Contract v2
the phase table already produced (`generatedWeekContractFrom`), so changing the
table changes the contract and there is nothing to keep in step by hand. A cell
proves this by projecting a synthetic table and asserting each number arrives.

---

## 2. LEGACY RESIDUE DROPPED, AND WHY

Each was read by the old acceptance path and encodes no coaching rule.

| dropped | why it is residue |
| --- | --- |
| `workout.section18Evidence.provenance` | **no reader anywhere in the repo** |
| `conditioningRole:'none'` vs an absent envelope | provably identical at `evaluator:317-318` |
| `conditioningStress` on a day with no conditioning | never read — no map entry exists |
| the `strengthIntent` legacy pattern fallback | a shim for weeks stored before rows carried roles; a generated row now declares itself (R-092) |
| row POSITION feeding row identity | the counting module's own header says this contradicts Sam's "intensity and volume never feed identity" |
| day stress inferred from `workout.name` | text inference over typed facts |
| `legacyReportedFullRestCount` | a migration cross-check; generation never passes it |
| `enforcement: 'observe_only'` | stale marker from when §18 observed |

**Dropping them is what makes the contract satisfiable by construction rather
than by having been built a particular way.**

---

## 3. BASELINE → AFTER, BY WORLD IDENTITY

Instrument: `worldSweep` over the same 180 worlds (3 phases × 5 day-counts ×
club/noclub × 3 kits × 2 weeks). It reproduces the base commit's own 61/119
exactly, which is what calibrates it.

| | built | refused |
| --- | ---: | ---: |
| baseline `a8b65151` | 61 | 119 |
| **after** | **120** | **60** |

| | worlds |
| --- | ---: |
| **RETAINED** (built before and after) | **61** |
| **GAINED** (refused before, built after) | **59** |
| **LOST** (built before, refused after) | **0** |
| content changed among retained | 61 |

**No net figures: every world that built at baseline still builds.** The 61
retained weeks all changed CONTENT, which is the point — the composer now
authors their strength directly instead of having it rebuilt by the legacy
builder.

### The 119 was never 119 §18 refusals — and nobody had split it

| cause at baseline | worlds |
| --- | ---: |
| the `B1-PIVOT` severance **throw** | **48** |
| real §18 refusals | 71 |

Every one of the 48 named `w1:friday:none:optional` — the optional arms/pump
day, which carries `composedOptionalKind: 'gunshow'` and whose content comes
from the **signed pools** via `buildDerivedSession`, not from any strength
template. **The composer never owned an arms day**, so a composed week not
covering one was never a hole in the composer. Fixing that one branch is +24
worlds, all In-season, zero losses.

### Change attribution (every gain and the one behaviour correction)

| step | built | attributed to |
| --- | ---: | --- |
| baseline | 61 | — |
| composed-optional day is adapter-owned, not a strength template | 85 | `+24`, all In-season; the severance throw was catching a non-strength day |
| direct handover (composer sole strength owner; adapter keeps the whole week) | 108 | `+23` net; identity fields must come from the composer or a stripped adapter mistypes the day |
| generated week judged by `GeneratedWeekContract` instead of the repair gateway | **120** | `+12`; the residue-driven refusals (`reduction_contradiction`, envelope-shaped signatures) have no clause and no longer refuse |

**The one intermediate regression, named:** taking the adapter's day wholesale
cost 12 worlds, because an adapter deprived of its lifts types a composed
lower-body day `workoutType: 'Conditioning'` with `conditioningRole:
'optional_flush'` — it describes the seed it was left with. Fixed by making
session identity the composer's; measured back to 108 and then 120.

### Remaining 60 refusals — all contract-named

| signature | worlds |
| --- | ---: |
| `main_strength_planner_selected_target` | 24 |
| `required_safe_patterns_present` (alone or with balance) | 36 |
| `pattern_balance` | 24 (co-occurring) |

These are composition facts: the planner asks for more main-strength sessions
than the composer builds, or a required pattern is untrained. **They are the
composer's remaining work and they now say so in the composer's own terms.**

---

## 4. BOUNDARY FINGERPRINT

Semantic fingerprint = ordered days, session identity, ordered canonical row
identities, declared roles and patterns, prescriptions, speed/conditioning
presence. Ids and timestamps excluded.

| boundary | result |
| --- | --- |
| composer output → materialised rows | identity, order, role, pattern, sets, reps and load **copied, never reinterpreted** (`materialiseComposedWeek`) |
| materialised → assembled week | adapter contributes **typed non-strength only**; `retainedStrengthRows` is a reported number and the gate asserts **0** |
| assembled → validated | validator returns the week **byte-identical**; a cell asserts it |
| validated → stored | store commit unchanged |
| stored → boot regeneration | **semantically identical** (§5) |

---

## 5. BOOT-REGENERATION RECEIPT

The app persists **inputs only** and derives the week at every launch, so the
gate is that a relaunch reaches the new route and rebuilds the same week.

```
onboarding: ok
persisted envelope keys: inputs
  carries currentProgram: false   (inputs only, as designed)
RESULT: PASS — the regenerated week is semantically IDENTICAL.
```

**This gate found a real defect and it is fixed.** The first run differed on
exactly one field: day 1 was `workoutType: 'Strength'` before boot and `'Mixed'`
after, because `programHydrationProjection` retypes a day carrying strength AND
conditioning. Generation now types it `Mixed` at the merge, so the two owners
agree instead of disagreeing on one field forever.

---

## 6. DELETION CENSUS

### Production

| file | net |
| --- | --- |
| `src/store/programStore.ts` | **−470** (legacy hydration/migration pipeline) |
| `src/data/exercisePoolsStrength.ts` | **−122** (`applyPoolRotation`) |
| `src/rules/generatorRecoveryRestLift.ts` | **−122** (whole file) |
| `src/rules/composedWeekToWorkouts.ts` | **−57** (whole file; live half re-homed) |
| `src/services/api/generateProgram.ts`, `src/data/defaultProgram.ts` | rewired |
| **TOTAL** | **850 deleted / 249 added — net −601 lines of production code** |

**What went, and why it was provably dead:**

1. **The legacy structural-migration pipeline** — `canonicaliseHydratedState`,
   `canonicaliseHydratedProgram`, `canonicaliseHydratedMicrocycle`,
   `hydratedWorkoutNeedsIngressCanonicalisation`, `Section18LegacyMigrationError`,
   `legacyModeFor`, `deriveContractlessLegacyContract`, the
   `structuralMigrationRequired` option and its five branches. The whole branch
   runs only when that flag is true; **exactly one function set it and that
   function had no production caller.** `partialize` persists inputs only, so no
   launch ever reads a stored program back.
2. **`liftGeneratorRecoveryAtHydration` + `generatorRecoveryRestLift.ts`.** Its
   own docstring justified it with *"`currentProgram` is persisted whole"* —
   **that premise is now false**, and the generator no longer places recovery at
   all. Obsolete, not merely unreachable. **Where the behaviour went:** nowhere,
   because there is nothing left to lift, from a store that holds nothing to
   lift it from.
3. **`applyPoolRotation`** — the rotation engine that rewrote row identities.
   Bucket A in the interference audit (executed legacy interference); after the
   pivot it had **zero production call sites** and nobody had noticed.
4. **`composedWeekToCoachInputs`** — the composer→old-builder conversion. The
   last thing standing between the composer and the athlete. Its live half
   (`composedPlannedDaysFrom`, planner→composer) is re-homed to
   `src/rules/composerPlannedDays.ts`.
5. **The repair gateway's generation invocation** — `acceptSection18Week`,
   `freshGenerationSurfaces`, `rebindDerivedSessionProvenance` are no longer
   imported by `generateProgram`. **The gateway module itself is retained,
   unchanged, for the editing route.**
6. **~20 orphaned imports** and 5 dead module-level declarations.
7. **Tests:** `legacyMigrationIsUnreachableAtBootTests.ts` (whole subject
   deleted) and its npm script; cells across 9 suites whose subject was the
   deleted pipeline.

### ⚠ A RULING LOST ITS ENFORCER WHEN `applyPoolRotation` WENT — MEASURED, THEN RE-HOMED

`PoolEntry.group` carries Sam's narrowing: **rotation is variety WITHIN a muscle
group, never across one** (R-080; the measured defect was a day getting
`Bicep Curl | Bicep Curl (DB) | Hammer Curl` — three biceps, no triceps).
**`applyPoolRotation` was its only reader**, so deleting the rotation engine left
the ruling enforced by nothing. `selectPoolEntry` / `selectPoolEntryAvoiding`
index straight across a slot and do not narrow.

**MEASURED before deciding anything — 120 built worlds, 378 days:**

| | |
| --- | ---: |
| pool entries declaring a group | 40 |
| slots that MIX groups | 4 (`squat`/`hinge`/`isolation_upper`/`isolation_lower` accessory) |
| max composer rows from ONE (slot, role) on a day | 2 |
| days taking 2 rows from one slot | 200 |
| **days taking both from the SAME group (the R-080 shape)** | **0** |

The composer selects one row per ladder slot off an ordered bench instead of
rotating a list, so the defect is unreachable by construction. **But
unreachable-by-construction is not RECORDED until something checks it (LAW
ZERO)**, so the property is now asserted over the severance suite's own
192-world corpus, with a non-vacuity cell beside it. **Mutation-proven:**
widening the detection to `groups.size >= 1` reds it (72/1), restoring returns
73/0.

**Still gone and reported, not papered over:** the anchor→accessory equipment
role fallback that lived inside `applyPoolRotation` is a CAPABILITY that went
with it, not merely a test. Nothing in the measured worlds needed it, and
nothing now provides it.

### ⚠ ONE THING I DELETED AND HAD TO PUT BACK — CAUGHT BY `test:compile`

`legacyMigrationFallbackProfile` looked like a pipeline member and is not.
`contract.source === 'legacy_migration'` comes from
`migrateLegacyWeeklyExposureContractV2` — the **v1→v2 contract lift**, with
about ten live callers — **not** from the deleted structural pipeline. Restored
with a note at its head. **The lesson is mine: my first reachability grep
excluded the file I was cutting, so an internal caller was invisible. A grep
that hides the subject file cannot prove a symbol dead.**

---

## 7. REMAINING LEGACY CALLERS — REPORTED HONESTLY

| retained | why it stays |
| --- | --- |
| `section18AcceptedWeekGateway` + evaluator + safety finaliser + offer placement + whole-week repair | **the EDITING route still uses them**, and so do store commits and read-time resolution. Generation no longer calls them. Deleting them was never in scope and would have hit the mission's own hard stop. |
| `buildWorkoutsFromCoach` | still the retained adapter for non-strength content, and still called by `section18OfferPlacement` and `fixtureMinimalReplan` (edit routes) |
| `fallbackExercisesForPlanEntry` | now only reachable for **mobility, conditioning and composed-optional** entries; its strength branch still throws by design |
| `selectPoolEntry` / `selectPoolEntryAvoiding` / `classifyPoolSlot` / pools data | used by coach swap resolution, progression, slot coverage and the composer itself |
| `migrateLegacyWeeklyExposureContractV2` | v1→v2 contract lift, ~10 live callers |

---

## 8. QUESTIONS REQUIRING SAM

**None.** Every clause in the contract cites authority that already exists. No
clause needed inventing, and nothing was silently preserved.

---

## 9. WHAT FOUGHT ME

- **My own audit was wrong about the size of the dead set**, in both
  directions: the hydration pipeline was bigger than reported, and
  `legacyMigrationFallbackProfile` inside it was not dead at all.
- **The base commit's diagnosis sent three sessions after an inert field.** The
  only reason this one did not follow is that the inventory traced the sprint
  counter to its source line instead of trusting the attribution.
- **Two intermediate regressions, both from the same mistake** — letting an
  adapter that no longer owns a day's strength keep describing that day.
  Measured, attributed and fixed rather than absorbed.
- The worktree needs the main checkout's `node_modules` symlinked.

---

## 10. NOT ESTABLISHED

- Whether the removed repair machinery was doing necessary work for worlds this
  sweep does not contain. **The sweep has no injuries, no active constraints, no
  deloads and no readiness reductions** — those are exactly the worlds the
  safety finaliser conformed. Under the new route such a week is **refused**
  rather than repaired, which is the mission's stated design but is UNMEASURED.
- Whether `main_strength_planner_selected_target` (24 worlds) is a composer
  shortfall or a planner over-ask. It refuses honestly either way.
- The craft tier (Section 17) no longer runs on the generation route. It has no
  clause in `GeneratedWeekContract`. Its effect on generated weeks is UNMEASURED.

## 11. NOT COVERED

- **Injury, illness, readiness-reduction, deload and active-constraint worlds.**
  None are in the 180-world sweep.
- **Weeks 3 and 4 of a block**; only weeks 1–2 are swept.
- **The editing and coach routes.** Untouched by design, and not re-measured.
- **Any device or simulator pass.** Everything here is headless, through the
  same functions the app calls.
- **`applyOptionalTopUps` / `withCraftSafeTopUps`** still run after validation,
  as before. Not re-examined.
- **The remaining 60 refusals are not fixed.** They are composition work, now
  stated in contract terms.

*Agent: core, 2026-08-14. Measured at `a8b65151` in a discarded worktree.*
