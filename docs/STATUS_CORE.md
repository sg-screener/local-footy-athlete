# CORE — this seat's own status file. ONE WRITER: this seat.

**NAMED 2026-08-14.** Sent in on the GENERATION CORE REBUILD, under the phase
directive **BURN THE BOATS — old shit gone**. `core` because that is the subject:
the generated-week door. `ls docs/STATUS_*.md` and the last 20 commit stamps
showed `core` free (live recently: `tracer`, `baseline`, `kit`, `elegance`,
`seat`).

**EVERY COMMIT FROM THIS SEAT ENDS `Agent: core`.**

Work is in a detached worktree at `a8b65151`. **The shared checkout is never
touched.**

---

## BASE AND BASELINE — MEASURED, NOT RECALLED

- **Base: `slice-b1-pivot` @ `a8b65151`** (`docs(B1-M1-FINAL): HARD STOP — the
  composed week matches the baseline byte for byte and §18 still refuses it`).
- **Experiments: `slice-b1-m1-final` @ `9f284730`**, unmerged, harvested
  selectively.
- **Baseline world sweep, my own instrument, run at `a8b65151`: 61 built / 119
  refused of 180.** Reproduces the commit message's figure exactly, which is
  what calibrates the instrument.

### ⚠ THE 119 IS NOT 119 §18 REFUSALS — AND NOBODY HAD SPLIT IT

| Cause | Worlds |
| --- | ---: |
| **`B1-PIVOT` severance THROW** — a strength plan entry reached the severed `fallbackExercisesForPlanEntry` | **48** |
| Real §18 refusals (`pattern_restore_failure`, `pattern_imbalance`, `planner_selected_target_miss`, `required_minimum_shortfall`) | **71** |

**Every one of the 48 names the same plan entry: `w1:friday:none:optional`** —
the OPTIONAL day (Gunshow/prehab). That is non-strength content the RETAINED
adapter owns, not the composer. **40% of the "refusals" are a handover gap, not
a contract gap**, and fixing the contract alone could never have moved them.

---

## MISSION 1 — DEAD CODE DELETED. GATE: NO BEHAVIOUR CHANGE, PROVEN.

**Receipt: the 180-world sweep after deletion is BYTE-FOR-BYTE identical to the
baseline — same 61/119, same days, same rows, same doses, world for world.**

### What went, and why it was provably dead

The audit named the hydration-canonicalisation pipeline; **at this commit it is
bigger than the audit said**, because the pivot had already severed more.

`canonicaliseAcceptedBoundaryState` runs the whole structural migration only
when `structuralMigrationRequired: true`. **Exactly one function sets it —
`canonicaliseHydratedState` — and that function has no production caller.** So
the entire branch is unreachable. Deleted, 448 lines from `programStore.ts`:

- `canonicaliseHydratedState`, `HydratedStateCanonicalisationOptions`
- `canonicaliseHydratedProgram`, `canonicaliseHydratedMicrocycle`
- `hydratedWorkoutNeedsIngressCanonicalisation`
- `Section18LegacyMigrationError`, `legacyModeFor`,
  `deriveContractlessLegacyContract`
- the `structuralMigrationRequired` option and its five branches
- `liftGeneratorRecoveryAtHydration` + `src/rules/generatorRecoveryRestLift.ts`
- 10 orphaned imports
- `src/__tests__/legacyMigrationIsUnreachableAtBootTests.ts` + its package script

**WHY THE GENERATOR-RECOVERY LIFT WENT, AND WHERE THE BEHAVIOUR WENT.** Its own
docstring justified it with *"`currentProgram` is persisted whole"*. **That
premise is now false** — `partialize` persists inputs only. And the generator no
longer places recovery at all (`attachRecoveryAddonsToWeek` retired). So the
lift had nothing to lift, from a store that holds nothing to lift it from. It is
obsolete, not merely unreachable.

**The deleted guard suite is obsolete BY CONSTRUCTION, not by fiat.** It existed
to catch someone re-persisting `currentProgram` and reactivating a measured
20.4-second launch migration. That migration no longer exists to reactivate.

### ⚠ ONE THING I DELETED AND HAD TO PUT BACK — CAUGHT BY `test:compile`

`legacyMigrationFallbackProfile` looked like a pipeline member and is not.
`contract.source === 'legacy_migration'` is produced by
`migrateLegacyWeeklyExposureContractV2` — the v1→v2 CONTRACT lift, which has
about ten live callers (`weekRebuild`, `postGenerationConstraintValidation`,
`section18ProgramObservation`, this store) — **not** by the deleted structural
pipeline. Restored with a note at its head saying so.

**The lesson, and it is mine: my first reachability grep excluded the file I was
cutting, so an internal caller was invisible.** The compile gate caught what the
grep missed. A grep that hides the subject file cannot prove a symbol dead.

---

## WHAT I FOUND THAT CHANGES MISSION 2's SHAPE

**`materialiseComposedWeek` and `assembleAuthoredWeek` exist, are pure, and have
ZERO production callers.** The live route still runs
`composeWeek` → `composedWeekToCoachInputs` (`generateProgram.ts:705`) →
`buildWorkoutsFromCoach` (`:747`) — the legacy builder — which is exactly where
the acceptance envelope is produced as a by-product. **The handover the base
commit says is built is built but not wired.**

That is why the base's HARD STOP reads the way it does: §18's input contract is
undeclared, so the only way to be acceptable is to have been built by the legacy
builder.

### Carried from `9f284730` — PROVEN ONLY

- `RotationContext.composedStrengthDays`; the adapter receives the COMPLETE
  planner week and authors no lifts on composed days (the day-level filter
  emptied the adapter and cost 22 worlds — deleted, not reapplied).
- a composed day carrying conditioning keeps its conditioning seed instead of
  collapsing to Rest.
- `materialiseComposedWeek` + `assembleAuthoredWeek` wiring.

### NOT carried — deliberately

- **The stamping experiments, all three.** `finaliseWorkoutAfterMutation` with
  `composed: true` measured 32/148, worse than no stamp at 49/131. The envelope
  is an accumulation of builder side effects and cannot be reproduced by calling
  one of its producers.

---

## OUTCOME — 61/180 → 120/180 BUILT, 59 GAINED, 0 LOST

**Full report: `docs/GENERATION_CORE_REBUILD_2026-08-14.md`.**

### ⚠ THE BASE COMMIT'S DIAGNOSIS WAS WRONG, AND THREE SESSIONS PAID FOR IT

It blamed the null `workout.section18Evidence`. **Measured: that field is inert.**
`null` and `{conditioningRole:'none'}` both return `null` from
`conditioningPresence` (`section18EffectiveWeekEvaluator.ts:317-318`), and the
envelope's `provenance` has **zero readers in the whole repo**. The real
difference was **`workout.speedBlock`** — the app's only source of app sprint
credit (`:670`) — which the materialiser never emitted and the merge threw away.
**The envelope and the speedBlock are two by-products of the same builder call;
the previous sessions measured the inert one.**

### The four things that moved the number, each attributed

| step | built | why |
| --- | ---: | --- |
| baseline | 61 | — |
| the composed-optional (Gunshow) day is adapter-owned, not a strength template | 85 | **48 of the 119 "refusals" were the severance THROW, not §18** — every one an optional arms day the composer never owned |
| direct handover — composer sole strength owner, adapter keeps the whole week | 108 | `materialiseComposedWeek` + `assembleAuthoredWeek` wired; no composer row enters the legacy builder |
| the week is judged by `GeneratedWeekContract`, not the repair gateway | **120** | residue-shaped refusals have no clause and no longer refuse |

### TWO REGRESSIONS I CAUSED, BOTH THE SAME MISTAKE

Letting an adapter that no longer owns a day's STRENGTH go on describing that
day. Deprived of its lifts it types a composed lower-body day
`workoutType: 'Conditioning'`, `conditioningRole: 'optional_flush'` — **−12
worlds** — and it under-counted conditioning by reading the stored role
literally when the authored owner assigns roles POSITIONALLY at judgement time
— **−42 worlds**. Both measured, attributed, fixed. Neither was absorbed.

### Deletion score (production)

**850 deleted / 249 added — net −601 lines**, plus two whole files. Dead by
proof, not by assumption: the legacy hydration/migration pipeline (the
`structuralMigrationRequired` branch nothing sets), `applyPoolRotation` (zero
call sites after the pivot), `generatorRecoveryRestLift` (its own premise
"currentProgram is persisted whole" is now false), and
`composedWeekToCoachInputs` (the composer→old-builder round trip).

**AND ONE I GOT WRONG.** `legacyMigrationFallbackProfile` is fed by
`migrateLegacyWeeklyExposureContractV2` — the v1→v2 CONTRACT lift with ~10 live
callers — not by the deleted pipeline. `test:compile` caught it; restored with a
note. **My first grep excluded the file I was cutting, so an internal caller was
invisible. A grep that hides the subject file cannot prove a symbol dead.**

### Gates

- `test:generated-week` — **36 passed / 0 failed.** One red-proven cell per
  clause; plus the purity cells (the validator returns the week byte-identical,
  imports no builder/gateway/repair/canonicaliser, and reads no `provenance`).
- **Provenance-invariance proved:** two weeks with identical meaning and
  different provenance get the same verdict AND the same ledger.
- **Boot regeneration: PASS** — semantically identical. It caught a real
  one-field disagreement (`Strength` vs `Mixed` on a combined day) which is
  fixed, so generation and relaunch now agree.
- Sweep re-run after every deletion: **120/60 unchanged.**
