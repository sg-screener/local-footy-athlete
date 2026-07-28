# Batch 0 ruling applied — structure/dose split, sheet reshape, readiness consumer census

**Date:** 2026-07-28
**Supersedes:** §6 of `BATCH0_WEEKLY_DOSE_OWNERSHIP_REASSESSMENT_2026-07-28.md` (its candidate
columns carried a readiness and an injury axis; both are now removed).

## Sam's ruling (2026-07-28)

> Structure comes from phase + schedule facts; capacity/readiness affects DOSE only — "dose down, never block" extends to weekly session counts. The contract varies by schedule inputs (available days, team days, game anchors) as Sam-authored columns; readiness and injury never set structure — injury flows through its own law family.

*(Kept on one line deliberately: `readinessStructureCensusTests` asserts this sentence appears
verbatim, so the census cannot drift from the ruling it enforces.)*

This extends the existing readiness law rather than introducing a new one. That law already
held that *"counts are STRUCTURE, and the deload law holds structure constant while the work
inside shrinks"* — but it scoped itself to the readiness **declaration** and deliberately
exempted the **capacity score**. Three sites say so in their own comments:

- `weeklyExposureContractBuilders.byeRecoveryMode` — *"`readiness === 'low'` is the CAPACITY
  score, a different signal this law does not govern."*
- `workoutCanonicalisation` — *"`readiness === 'low'` STAYS and is not the same signal."*
- `powerPrimerPolicy` — *"the `readiness` homonym, Sam 2026-07-27."*

**The new ruling closes that exemption.** Those three comments are now wrong and must be
corrected as part of the work, not left as documentation of a superseded carve-out. Naming
them here because a reversal that leaves its own counter-argument in the code reads, to the
next person, as an unresolved disagreement.

---

## Part A — the reshaped Batch 2 sheet

**No readiness axis. No injury axis.** Nine week-mode rows, base numbers, plus
schedule-conditioned columns.

### Base block — 9 modes × 14 slots (unchanged in shape)

`in_season_game_week`, `in_season_bye_build`, `in_season_bye_recovery`, `early_offseason`,
`mid_offseason`, `late_offseason`, `early_preseason`, `mid_preseason`, `late_preseason`
× strength {required, preferredMin, preferredMax}, conditioning {×3}, sprintCod {×3},
fullRest {×3}, preferredHardDays, permittedHardDays.

Carry the existing values in as the prefill, with the flags the load-ratio sheet used. Two
prefill facts Sam should see before ruling:

- **The three pre-season rows are numerically identical** across all 14 slots. Either the
  subphase distinction does no programming work, or the numbers are wrong.
- `in_season_bye_recovery` is currently reachable *only* by a readiness trigger. Under this
  ruling it needs a schedule-or-phase entry condition or it becomes unreachable — see A3.

### Schedule-conditioned columns — the new block

Every one of these is a schedule fact. The readiness and injury conjuncts that used to sit
beside them are deleted, not migrated.

| Column | Schedule input | Replaces |
|---|---|---|
| `strengthTargetWithTwoOrMoreTeamDays` | team-day count ≥ 2 | the `>= 2` conjunct in all three engine floors |
| `minimumAvailableDaysForPreferredTarget` | available-day count | the `>= 5` conjunct in all three floors |
| `strengthTargetBelowThatAvailability` | available-day count | the implicit fall-through |
| `earlyOffseasonTargetAtOrBelowThreeDays` | available-day count ≤ 3 | `coachingEngine:1107`, readiness half removed |
| `moderateStrengthAllowance` | game anchor present | `moderateCoreBonus` (+1 for the G−2 upper) |
| `optionalSessionCap` / `recoverySessionCap` | available days minus core | `coachingEngine:1269`, readiness axis removed |
| `hardDayAccounting` | — | **Batch 3's days-vs-exposures question, surfaced as a column** |

**Recommendation: make these per-mode, not a shared modifier table.** The two-team-day floor
already resolves differently by phase — pre-season targets 4, in-season targets 3 — so a shared
table needs a phase axis, which is per-mode under another name. Per-mode costs more cells and
removes a representation.

Sheet size: **9 × 14 base + 9 × 7 conditioned = 189 cells**, against 126 for the base alone.

### A3 — three things the ruling leaves unreachable or unanswered

1. **`in_season_bye_recovery` loses its only trigger.** `byeRecoveryMode` selects it on
   `weekKind === 'deload' || readiness === 'low' || an injury pause`. Strip readiness and
   injury and only the scheduled deload remains. Sam should confirm that is the intended
   entry condition, or the mode is dead.
2. **The sprint/COD floor.** Bible §2: *"the year-round required minimum is 1 genuine
   sprint/high-speed exposure per week except early off-season… Any reduction below the floor
   requires an explicit typed authorised reason."* `preseasonSubphasePolicy` currently sets
   `speedSprint.targetExposures: 0` on low readiness. That was already a reduction below an
   authored floor for a reason the Bible does not list, and this ruling removes it outright.
3. **Contract V2 has its own readiness axis** (see census C1). The designated owner is itself
   a violator; the ruling has to be applied there first or the deletion moves the axis rather
   than removing it.

---

## Part B — readiness consumer census (the Batch 1 sizing answer)

**66 readiness edges across 15 files.** The rubric is 18 numbers; its consumer surface is not.

### Survives — readiness affects dose, selection or display

| File | Edges | Why it survives |
|---|---|---|
| `utils/progressionRules.ts` | 9 | Week-to-week load/volume steps and hold/maintain/build. Pure dose. |
| `utils/conditioningProgressionRules.ts` | 3 | Pauses *progression*, not the session. The exposure still happens. |
| `utils/recoveryRules.ts` | 2 | Chooses recovery category (passive/active/extended) — form, not count. |
| `rules/recoveryAddonCoverage.ts` | 1 | Widens optional recovery add-ons. Adds, never removes. |
| `utils/tapSwapHierarchy.ts` | 1 | Ranks athlete-initiated day-level swaps. Offers alternatives. |
| `utils/feedbackAdapter.ts` | — | Adjusts the readiness value itself; sets nothing. |
| `utils/readiness.ts` | — | The resolver that produces the value. |
| `components/dev/ScheduleDebugPanel.tsx` | 1 | Dev display. |
| `rules/offseasonSubphasePolicy.ts` | *partial* | `strength.targetRpeMax → 7` and `modalityBias` survive. |
| `rules/preseasonSubphasePolicy.ts` | *partial* | `volumeBias: 'controlled'`, `hardDose: 'reduced'` survive. |

**~17 edges survive.** These are what Batch 1's rubric must serve, and they justify keeping
three levels: `progressionRules` and `tapSwapHierarchy` both discriminate all three.

### Dies — readiness sets structure

| File | Edges | What readiness currently decides |
|---|---|---|
| `utils/coachingEngine.ts` | 36 | Hard cap, core counts, three override floors, optional counts, early-off-season target, a conditioning-frequency gate. **Most are already inside Batch 0's 48-decision deletion.** |
| `rules/weeklyExposureContractV2.ts` | 3 | **C1** — `strongByeBuild` (→4 strength), early-off-season strength `high ? 3 : 2`, optional `high ? 2 : 1`. The owner's own readiness axis. |
| `rules/weeklyExposureContractBuilders.ts` | 1 | `byeRecoveryMode` — selects a whole week mode with different structure. |
| `utils/conditioningRules.ts` | 1 | `inferFresh` — feeds bye build-vs-recovery. Reads injury too, so it violates both halves of the ruling. |
| `rules/offseasonSubphasePolicy.ts` | *partial* | Blocks running **and** speed outright, `hardSessionCap: 0`, `coreBias: 'reduced'`. |
| `rules/preseasonSubphasePolicy.ts` | *partial* | `coreSessionCap → 2`, conditioning `targetCap → 1`, `speedSprint.targetExposures → 0`. |

**~45 edges die**, though most are inside code Batch 0 already deletes.

### Needs Sam — the one class the ruling does not settle

| File | Edges | The question |
|---|---|---|
| `rules/powerPrimerPolicy.ts` | 3 | Low readiness returns `null` — no power block at all. Not-high blocks the G−2 primer. |
| `utils/workoutCanonicalisation.ts` | 2 | Low readiness emits `power_removed`. |

A power primer is a component *inside* a session, not a weekly session count — so it is not
obviously "structure" as the ruling defines it. But `return null` and `power_removed` are
**blocks**, and the ruling says dose down, never block. Both readings are defensible and the
answer changes five edges. **Recommend ruling this explicitly rather than letting the
implementation pick.**

### What this does to Batch 1

The rubric is **18 decisions**, not the 17 first reported (the injury penalty is four values:
Severe 1.5, Moderate 0.5, Mild 0, cap 2 — I under-counted it).

| Group | Count | Status after the ruling |
|---|---|---|
| Recent-training-load scores + unknown default | 5 | Rule |
| Conditioning-level scores + unknown default | 5 | Rule |
| Sprint-exposure bonus | 1 | Rule |
| In-season penalty | 1 | Rule |
| Band edges (≤2 low, ≤4 medium) | 2 | Rule — but they now only select dose tiers |
| **Injury penalty** | **4** | **Candidate deletion** |

**Batch 1 arrives at ~14 decisions plus one structural question,** not 18 rulings.

The structural question: **should injury feed the capacity score at all?** The ruling says
injury flows through its own law family. Injury currently also feeds the rubric, so it has two
channels — and since the rubric now only affects dose, the injury penalty is an *injury dose
effect* computed outside the injury law family. That is the same one-fact-two-representations
shape this whole unit exists to remove. If Sam agrees it goes, Batch 1 is 14 numbers and the
injury law family absorbs the dose effect.

## Not covered

- **Per-edge verdicts inside `coachingEngine.ts`.** All 36 are classified at the file level;
  most sit in code Batch 0 deletes, so per-edge work there would be written against code that
  is about to disappear.
- **A gate pinning this ruling.** The natural artifact is a typed census with a declared
  baseline of the ~45 dying edges, each naming its owning batch, ratcheting down as batches
  land — the pattern `bibleThresholdAnchors` already uses for its deferrals. Not built: it is
  its own unit and was not part of this ask.
- **Whether conditioning and sprint/COD targets have the same two-authority split as
  strength.** Suspected, not swept.
