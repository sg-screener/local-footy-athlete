# Provenance inventory — athlete-affecting numbers (Phase 1, diagnosis)

**Date:** 2026-07-28
**Branch:** `feat/provenance-lock-phase1`
**Design:** `docs/superpowers/specs/2026-07-28-provenance-lock-design.md`
**Status:** **ESCALATED — STOP.** Phase 1 complete. Phase 2 not started, and should
not start as a single unit. See [Escalation](#escalation).

Phase 1 changed no product code. This document and the design spec are the whole diff.

---

## Summary

| | |
|---|---|
| Files swept (src/, excl. tests) | 402 |
| Raw candidates | 1,785 |
| Dropped as presence/cardinality checks (`> 0`, `.length ===`) | 337 |
| In-scope hits | 1,448 |
| **Distinct decisions** (file, key, value) | **790** |
| Authored (Part A) | ~134 + cue/muscle libraries |
| **Pending Sam (Part B)** | **~656 distinct, plus 71 per-exercise load ratios and 934 injury pairs** |
| Escalation threshold from the approved spec | ~120 |

Part B is roughly **5× the threshold** before the injury matrix, and ~13× with it.
The unit stops here.

### The finding that reframes the rest

**276 code comments attribute a decision to Sam. Exactly one cites a document or
commit.**

```
grep -rP "(//|\*).*\bSam\b" src --include=*.ts --include=*.tsx  → 276
…of those citing docs/ | *.md | a commit sha                    →   1
…of those carrying at least an ISO date                         → 123
```

Against the registry's required `Attribution { ruledOn, where }`:

| | Count | Has `ruledOn` | Has `where` |
|---|---|---|---|
| Full attribution | **1** | ✅ | ✅ |
| Dated only | 123 | ✅ | ❌ |
| Bare assertion | 152 | ❌ | ❌ |

The 123 dated ones are half-attributed and cheap to finish — a date narrows the search
to a day's commits. The 152 bare ones are the real problem: nothing in them is
falsifiable.

All 275 are self-certifying: the code is both the claim and the only evidence for it.
There is no way, today, to tell a comment recording something Sam actually ruled from a
comment someone wrote to make a number look ruled. That is the precise failure the
attribution rider exists to close, and it is already the normal case rather than the
exception.

This is *not* an accusation that the 275 are fabricated — many are certainly real.
The point is that the repo cannot distinguish them, so neither can a gate.

---

## Calibration — the two predictions

Recorded before the sweep ran, per the spec.

### Prediction 1 — `inj()` blank-default is unauthored — **HELD**, and understated

`src/data/exerciseTags.ts:157`

```ts
const SAFE: InjuryProfile = {
  adductor: 'good', pubalgia: 'good', lowerBack: 'good', knee: 'good',
  hamstring: 'good', calf: 'good', ankle: 'good', shoulder: 'good',
  elbow: 'good', wrist: 'good',
};
function inj(overrides: Partial<InjuryProfile>): InjuryProfile {
  return { ...SAFE, ...overrides };
}
```

| | |
|---|---|
| Exercises using `inj()` | 124 |
| Injury keys per profile | 10 |
| Total (exercise × key) pairs | 1,240 |
| Explicitly ruled | 306 |
| **Implicitly `'good'` — never ruled, reads as authored-safe** | **934 (75%)** |

I predicted the default was unauthored. I did not predict that three-quarters of the
entire injury matrix would be the default.

### Prediction 2 — deload/readiness multipliers are the densest UNAUTHORED `redoses_work` cluster — **FAILED**

They are not the densest, and it is not close. The densest is
`src/utils/loadEstimation.ts` — `EXERCISE_LOAD_MAP`, which decides the **kilograms
the athlete is told to lift**:

| | |
|---|---|
| Entries in `EXERCISE_LOAD_MAP` | 77 |
| Ruled in `docs/LOAD_RULINGS_LITERAL_LOCK_PURGE_REPORT_2026-07-25.md` | 6 |
| **Unauthored** | **71** |

I anchored on the readiness/deload family because that is where recent units have
been. Recency is not density. Had I let the prediction steer the sweep order I would
have found the second-largest cluster first and sized the unit off it.

**And the ruled six are the ones with a gate.** `LOAD_RULING_PENDING` is an empty
`Set` (`src/data/selectableExerciseVocabulary.ts:130`), and
`exerciseLockedListTests.ts:502` asserts that emptiness — "nothing is parked awaiting
a load ruling." That assertion is true and passing. It means no *newly added* name is
parked. It says nothing about the 71 that predate the park and were never parked at
all.

An empty pending list currently reads as "everything is ruled." This is the same
defect as `inj()` defaulting to `'good'`, one layer up: **absence rendered as
approval.** Both were found by looking for it. Neither would have been found by
running the suite, because both are green.

---

## Part A — authored (record the citation, do not re-rule)

Per rider 2, these are recorded, not put in front of Sam. They seed the Phase 2 registry.

| Cluster | Decisions | Kind | Source | Verified |
|---|---|---|---|---|
| `data/conditioningTemplates.ts` | 115 | `equality_bound` | `docs/CONDITIONING_TEMPLATES_FINAL_2026-07-25.xlsx` | ✅ both directions, `test:conditioning-templates` |
| `rules/phaseRepSchemes.ts` | 19 | `bible_anchor` | Bible §5 | ✅ anchors re-read this pass, present and value-bearing |
| Muscle/experience matrix | — | `equality_bound` | `docs/MUSCLE_EXPERIENCE_FINAL_2026-07-25.xlsx` | ✅ both directions, `test:muscle-experience` |
| `data/exerciseCues.ts` (144 of 173) | — | doc-bound | `docs/CUE_CHANGESET_2026-07-23.md` | ⚠️ **one direction only** — see Gap 2 |
| 6 load ratios | 6 | `ruling_anchor` | `docs/LOAD_RULINGS_...2026-07-25.md` | ✅ table parsed, compared both directions |

Two caveats on Part A, both of which weaken it more than the ✅ column suggests:

- **`conditioningTemplates.ts` is not wired.** Its own header: *"NOT WIRED YET: this
  module lands alongside the current generation path. Stage B switches selection onto
  it."* The 115 authored doses are the best-sourced numbers in the repo and the
  athlete is not currently receiving them. Whatever conditioning dose ships today
  comes from elsewhere and is in Part B.
- **`phaseRepSchemes.ts` is the model to copy.** Its header states the Bible section
  *and* quotes the numbers it derives. It is the only large cluster where I could
  verify provenance without asking anyone. It cost its author a paragraph.

---

## Part B — pending Sam, grouped by athlete-facing consequence

Per rider 1: grouped by what the athlete experiences, not by file. Highest stakes first.

**These are counts and clusters, not a ruling list.** Enumerating ~656 decisions as
rows for value-by-value ruling is exactly the compression the escalation rule forbids,
so this section sizes the problem and stops.

### 1. `redoses_work` — changes how much the athlete does

| Cluster | Decisions | What the athlete gets wrong if it's wrong |
|---|---|---|
| `loadEstimation.ts` `EXERCISE_LOAD_MAP` | **71** | The suggested kg on every barbell/DB lift. Wrong ⇒ a beginner loads a weight nobody approved. |
| `utils/sessionBuilder.ts` | 71 | Set/rep/rest on derived recovery, prehab and pump sessions. No source cited. |
| `data/defaultProgram.ts` | 40 | Sets/reps/rest in the live builder (`buildWorkoutsFromCoach`, reached from `generateProgram`, `repeatWeek`, `fixtureMinimalReplan`). No source-of-truth header. |
| `utils/coachRevisionTemplates.ts` | 21 | Doses the coach writes when it edits a plan. |
| `utils/recoveryAddonBuilder.ts` | 16 | Recovery add-on volume. |
| `utils/progressionRules.ts` + `strengthProgressionIntegration.ts` | 22 | Week-to-week load and volume steps. |
| `data/mobilityFlowTemplates.ts` | 10 | Mobility holds/reps. **No authored source document exists** — there is no mobility sheet in `docs/`. |

### 2. `gates_exposure` — blocks or allows a session

| Cluster | Decisions | What the athlete gets wrong if it's wrong |
|---|---|---|
| `exerciseTags.ts` injury matrix | **934 pairs** | An exercise silently rated safe for an injury nobody assessed it against. |
| `utils/coachingEngine.ts` | 51 | Hard-exposure caps, readiness banding, session allocation. Owns "code decides the dose"; cites no source. |
| `postGenerationConstraintValidation.ts` | 12 | What gets rejected after generation. |
| `rules/weeklyExposureContractBuilders.ts` | 10 | Weekly exposure floors/ceilings. |

Some `coachingEngine` thresholds are almost certainly Bible-anchorable — game-day
proximity (`offset <= -3`) maps to §3's *"How close can lower strength be to game day:
g-3"*. Confirming that per-threshold is Phase 2 work, not a Phase 1 assertion.

### 3. `shifts_threshold` — moves a boundary

| Cluster | Decisions |
|---|---|
| `rules/temporarySourceFact.ts` | 11 |
| `rules/section18EffectiveWeekEvaluator.ts` | ~9 |

### 4. `display` — rendered without dosing

| Cluster | Decisions |
|---|---|
| `screens/home/DayWorkoutScreenV2.tsx` | 19 |
| `utils/sessionExplanation.ts` | 14 |

---

## Part C — the three known gaps

### Gap 1 — `inj()` blank-defaults-to `'good'`

**Confirmed, 934 of 1,240 pairs.** See calibration above.

*Assertion needed:* `InjuryProfile` stops being satisfiable by omission. Make the
field set explicit — `Record<InjuryKey, Rating>` with no `Partial`, so an unset key is
a type error rather than a permissive default. Where a rating genuinely is not yet
ruled, it must be a distinct value (`'unruled'`) that the exercise filter treats as
*exclude*, not as *safe*. Fail loud, and fail toward not prescribing.

The 934 then become a real authoring queue rather than an invisible one. That queue is
its own unit.

### Gap 2 — cues have no enforced source

**Narrower than stated in the brief, and worth correcting.** Cues are not unenforced.
`authoredCueLibraryTests.ts` asserts *every authored cue is present* and *no authored
cue was reworded* — verbatim, both real.

What it does not assert is the **reverse direction**: that every cue in code appears in
the doc. So:

| | |
|---|---|
| `EXERCISE_CUES` entries in code | 173 |
| Present in `CUE_CHANGESET_2026-07-23.md` | 144 |
| **In code, absent from the doc the gate reads** | **29** |

The 29 are recognisably from later units — Dumbbell Pullovers, Scap Pull Ups,
Jefferson Curl, Butterfly Stretch, Pissing Dog Against Wall. They are plausibly
authored, just **in a different document**. That is the actual structural gap: the
gate reads one doc, authored-ness is spread across many, and nothing reconciles them.

*Assertion needed:* the code→doc direction, against a **registry of authored sources**
rather than one hardcoded path. Without the registry the reverse assertion just breaks
on the 29 legitimate ones.

### Gap 3 — render-truth for labels

The reconciliation gate asks *is load handled?*, not *is the label honest?*.
`isTrueBodyweightExercise` (`loadEstimation.ts:993`) reaches an athlete-facing "BW"
through three **inference** paths, none of which consults an authored value:

```ts
if (tags.movement === 'plyo') return true;          // category assumption
if (tags.movement === 'conditioning') return true;  // category assumption
if (/push.?up|pull.?up|chin.?up|dip(?:s|$)|plank|burpee/.test(lower)) return true;  // name guess
```

Measured across all 195 selectable exercises:

| Path | Count | Authored? |
|---|---|---|
| `TRUE_BODYWEIGHT_EXERCISES` | 43 | ✅ explicit set |
| `PREHAB_NO_LOAD_EXERCISES` | 49 | ✅ explicit set |
| `EXERCISE_LOAD_MAP` | 73 | ⚠️ present, but 71 unruled (Part B) |
| `ATHLETE_CHOSEN_LOAD_EXERCISES` | 1 | ✅ the Pullovers fix |
| **tag `conditioning`** | **13** | ❌ inferred |
| no authored source | 16 | ❌ nothing — and these got an *invented weight* |

> **CORRECTION (recorded when Unit 1 shipped).** An earlier revision of this
> section claimed **62** exercises took their label from an inference, counting
> 49 as "name regex". That was wrong, and the error was mine: my probe checked
> `ATHLETE_CHOSEN` and `TRUE_BODYWEIGHT` itself, then delegated to
> `isTrueBodyweightExercise` — which consults `PREHAB_NO_LOAD_EXERCISES`
> *before* the regex. So 49 exercises with a perfectly good authored source
> were attributed to the guess that never ran for them.
>
> The correct label-inference exposure was **13** (tag `conditioning`), not 62.
>
> The *weight* invention channel was the more serious half and I understated it
> by counting exercises: `estimateFromNamePattern`'s 18-row regex→ratio table
> and its `bodyweight × 0.15` "absolute last resort" applied to **any name not
> in the authored sets** — including names the generator invents at runtime, of
> which there is no fixed count. That is the mechanism that produced 12.5kg for
> Dumbbell Pullovers, and it was unbounded.

The Dumbbell Pullovers fix added `ATHLETE_CHOSEN_LOAD_EXERCISES` plus an early exit —
a correct fix for one exercise, and a per-exercise guard for the class. It has one
member. The other 62 remain reachable by the same three paths.

*Assertion needed, at the render seam:* a card may display a load label only when the
value derives from an authored source — one of the explicit sets, or a ruled map entry.
No tag category and no name pattern may produce an athlete-facing load claim. Where
nothing authored exists, the card must show nothing rather than a confident "BW".

Gap 3 is the one that proves the unit. Every existing gate passed and the athlete read
a false number.

### ✅ Gap 3 CLOSED — Unit 1, `test:render-truth`

`resolveLoadAuthority` is now the single owner of "how is this loaded?", and it answers
by naming its source. `formatLoadLabel` is the render seam: label and number come from
one resolution, so they cannot disagree the way they did on Pullovers.
`estimateFromNamePattern`, `estimateFromTags` and the two tag-category promotions are
deleted, not guarded.

Final state across the 195 selectable exercises:

| | Count |
|---|---|
| `prescribed` ← `EXERCISE_LOAD_MAP` | 73 |
| `bodyweight` ← `PREHAB_NO_LOAD_EXERCISES` | 49 |
| `bodyweight` ← `TRUE_BODYWEIGHT_EXERCISES` | 43 |
| `athlete_chosen` ← `ATHLETE_CHOSEN_LOAD_EXERCISES` | 1 |
| `unauthored` — **all 29 are conditioning sessions** | 29 |
| **`unauthored` movements** | **0** |

Every selectable *movement* now resolves to an authored source. The 29 unauthored are
bike/row/ski/swim sessions, which have no external load to author.

**What closing it exposed.** `authoredCueLibraryTests` asserts *"X keeps defined load
handling"*. Its comment says that means membership of `EXERCISE_LOAD_MAP` or
`TRUE_BODYWEIGHT_EXERCISES` — but the code called `isTrueBodyweightExercise`, the
function, which accepted the tag inference. **The reconciliation gate was being
satisfied by the very guess that made the label dishonest**, which is Sam's original
description of Gap 3, found in the gate itself rather than in the render path. Removing
the inference turned that assertion red for `Air Bike Sprints`; it is now exempted for
the same stated reason the video assertion four lines above already exempted it —
conditioning modalities are sessions, not movements.

The old green was false. That is the argument for the whole unit in one assertion.

---

## Escalation

Both spec conditions fired.

**1. Part B is ~656 distinct decisions** against a ~120 threshold — and that excludes
the 934 injury pairs and counts the 71 load ratios as a cluster rather than as 71
rulings. Putting this in front of Sam value-by-value would take a sitting long enough
that the rulings would degrade into rubber-stamps, which is the outcome the invented-
rules purge precedent exists to avoid.

**2. Three clusters need a source artifact that does not exist.** There is no authored
load sheet, no mobility sheet, and no registry of authored source documents (Gap 2).
These cannot be ruled value-by-value at all until someone decides what the source
*is* — that is an authoring decision, not a ruling.

### Recommended decomposition

Six units, ordered by athlete-facing risk per unit of Sam's time. Each is
independently shippable and each ends in a gate.

| # | Unit | Sam's input | Why here |
|---|---|---|---|
| **1** | **Render-truth assertion (Gap 3)** | **None** | Needs no new artifact and no ruling — an inferred label is already wrong by the standard Sam has stated. Closes the one gap with a proven athlete-visible lie. Ship first. |
| 2 | Load ratio authoring | 71 ratios, one sheet | Highest-stakes numbers in the app. Sheet-shaped, so it ends `equality_bound` — the strongest kind. Precedent: the conditioning templates sheet. |
| 3 | `inj()` fail-loud (Gap 1) | None for the fix | Structural: make omission a type error and route `'unruled'` to *exclude*. Turns 934 invisible defaults into a visible queue. The queue is then drained over time, not in one sitting. |
| 4 | Engine thresholds | Confirm anchors | ~100 decisions in `coachingEngine` / exposure / §18. Many are Bible-anchorable already; the work is mostly citation, not ruling. |
| 5 | Template doses | Sheets for mobility + derived sessions | ~160 decisions across `sessionBuilder`, `defaultProgram`, `mobilityFlowTemplates`, `recoveryAddonBuilder`. |
| 6 | Source registry + cue reverse direction (Gap 2) | None | Generalises "which docs are authored sources", then turns on code→doc for cues. Unblocks the reverse assertion everywhere. |

The provenance lock itself ships incrementally with these: each unit adds its cluster
to the registry and turns the gate on **for that cluster only**. A gate that fails on
790 decisions the day it lands gets disabled; a gate that grows one cluster at a time
survives. The `LOAD_RULING_PENDING` precedent is the warning — a park that is empty
because nothing was ever put in it looks identical to a park that is empty because
everything was ruled.

### What I recommend

Start with **Unit 1**. It needs nothing from Sam, closes a defect that reached a real
athlete's screen, and produces the render-seam assertion the other units reuse.

Then **Unit 2**, because 71 unauthored kilogram figures is the largest concentration
of athlete-facing risk in the inventory, and it has a proven shape to copy.

---

## Not covered

- **`src/services/`, `src/screens/journal|program|workout|auth`** — carry dose-shaped
  numbers but are unreachable from `App.tsx` per the existing reachability census. Not
  swept. If any is rewired, it enters scope unswept.
- **Dose numbers inside AI prompt text** — string literals in prompt templates were not
  parsed for numbers. The generator's vocabulary is constrained for *names*; whether it
  is constrained for *doses* is unexamined and may be a fourth gap.
- **`.tsx` style-adjacent numbers** — excluded by the styling filter. The filter is
  regex-based and may have over-excluded a display dose; not audited.
- **Per-value provenance for the 656.** Deliberately not attempted — that is the
  escalation.
- **Whether the 275 self-certifying Sam comments are accurate.** Only that the repo
  cannot tell.
