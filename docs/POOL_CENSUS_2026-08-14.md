# POOL CENSUS — the authorised exercise universe, 2026-08-14

**Slice B0. Seat `baseline`. MEASUREMENT + PRODUCT CLARIFICATION ONLY.** No pool,
equipment sheet, production code, registry, test, ratchet or allow-list was
changed. `slice1bc-parked` was not merged, cherry-picked, read for
implementation, or modified. Every probe was temporary and has been discarded.

**WHY IT EXISTS.** Composer slice B1 will draw composed strength rows only from
an authorised pool universe, so that universe has to be settled first. **Sam is
asked only about gaps that genuinely block B1** — everything else valid-but-absent
or weakly corroborated is listed here, visible, and left alone.

**THE HEADLINE.** **There are no blocking questions.** Every zero in the coverage
table is `KIT-UNACHIEVABLE` under R-083, every one-option cell is either already
ruled (R-084, R-086) or is concentration rather than a defect, and **not one
`POOL-GAP` exists anywhere in the ten ladder slots across the three kit tiers.**

---

# 1. MEASUREMENT METHOD AND CANONICAL-IDENTITY OWNER

## 1.1 The canonical-identity owner

**`canonicalExerciseName` — `src/utils/exerciseCanonicalisation.ts:241`.** It is
the app's own declared *"single boundary that resolves ANY incoming exercise name
onto Sam's curated vocabulary before any athlete-visible layer reads it"*, and it
is the same function `projectVisibleWeek.rowName` calls before an athlete reads a
row. **No second normaliser was written and no alias was invented.**

Its resolution order, as the module states it: exact curated key → case-insensitive
curated key → the load-alias resolver `resolveExerciseName` → token signature →
bounded superset match → otherwise the raw name unchanged.

**THE MAPPING IT APPLIES TO THIS CENSUS.** Five raw names across the four sources
collapse onto another identity. Three of them are the pairs the baseline measured:

| raw name | canonical identity | which source held the raw spelling |
| --- | --- | --- |
| `Pallof Press` | **`Band Pallof Press`** | authored template |
| `Romanian Deadlift` | **`RDLs`** | authored template |
| `Face Pulls` | **`Face Pull`** | authored template |
| `Bicep Curls` | **`Bicep Curl (Dumbbell)`** | authored template |
| `Tricep Pushdowns` | **`Tricep Pushdown`** | authored template |

Every join and every distinct count below is on the canonical identity. Counting
either half of those five pairs as a separate exercise would have inflated the
authored universe by five and put three of them into table (a) as false
"authored but absent" rows.

**IDEMPOTENCE AND COLLISION CHECK — both clean.** Over all 494 raw names in the
four sources: **0 names where `C(C(x)) ≠ C(x)`**, and **0 cases where two curated
names resolve onto each other**. One subordinate-owner disagreement was found; it
is in §9 with its exact numeric effect, and it changes no cell classification and
no question.

## 1.2 The four sources, and how each was read

| source | read from | raw names | canonical identities |
| --- | --- | --- | --- |
| **Cue layer** | `EXERCISE_CUES` keys (`src/data/exerciseCues.ts`) | 176 | **176** |
| **Equipment-requirement sheet** | `EXERCISE_EQUIPMENT_REQUIREMENT` keys (`src/data/exerciseEquipmentRequirement.ts`) | 127 | **126** |
| **Exercise pools** | `selectableExerciseNames()` (`src/data/selectableExerciseVocabulary.ts`) — the app's own single owner of *"which exercises exist"*, spanning `STRENGTH_POOLS`, `POOL_REGISTRY`, `CONDITIONING_META` and `POWER_EXERCISE_POOL` | 249 | **249** |
| **Authored strength templates** | the `name: '…'` literals inside `fallbackExercisesForPlanEntry` (`src/data/defaultProgram.ts:1065-1319`), plus `FALLBACK_PATTERN_EXERCISE` (`src/utils/workoutCanonicalisation.ts:172`) | 30 | **29** |

**Why the template layer is read as source text.** `fallbackExercisesForPlanEntry`
is not exported, and with the AI severed it is the layer that authors **every**
composed strength row (via `completeCoachWorkoutsFromPlan`). Comment lines were
excluded so a name discussed in a docstring cannot be counted as authored. The
extraction was validated against the 2026-08-14 baseline's observed corpus: every
name that sweep delivered and that no pool holds appears in this extraction.

**The 30 authored template literals**, in full:

```
Back Squat · Barbell Row · Bench Press · Bicep Curls · Bulgarian Split Squats
Calf Raises · Chest Supported Row · Conditioning · Dips · Face Pulls
Goblet Squat · Hamstring Curl · High Box Squat · Hip Thrusts · Incline DB Bench
Lateral Raise · Leg Extension · Mobility Flow · Nordic Lower · Overhead Press
Pallof Press · Pull-Ups · RDLs · Reverse Lunges · Romanian Deadlift
Single-Arm DB Row · Single-Leg RDL · Tricep Pushdowns · Vertical Jump · Walking Lunges
```

## 1.3 The legality owner, and Sam's three corrected answers

**Legality is asked of `exerciseAllowedByEquipment`** (`src/data/exercisePoolsStrength.ts:885`)
— the owner the pool's own selection uses, which reads Sam's sheet where the
sheet has a row and falls back to the load classifier where it does not.

**On top of it, for census purposes only, Sam's three corrected answers are
applied.** Recorded verbatim at `docs/MISSION_THREE_FIXES.md:743-745`, his words
of 2026-08-14: *"Chest Supported Row, needs a bench and dumbbels / Romanian
Deadlift needs barbell or dumbbells / Pallof Press needs a band."*

| canonical identity | census requirement |
| --- | --- |
| `Chest Supported Row` | `bench` **AND** `dumbbells` |
| `RDLs` (= `Romanian Deadlift`) | `barbell` **OR** `dumbbells` |
| `Band Pallof Press` (= `Pallof Press`) | `bands` |

**The sheet on `main` was not modified**, and no implementation from
`slice1bc-parked` was read beyond confirming these three recorded values.

## 1.4 The slot join

A canonical identity's ladder slots come from **`slotsForExerciseName`**
(`src/rules/sessionSlotCoverage.ts:252`) — the same function the ladder oracle
and `slotIsTrainableOnKit` use. No second definition of "what fills a slot" was
written.

---

# 2. EXACT KIT-TIER DEFINITIONS

Each tier is defined by its **resolved tags**, not by a label. Tags are whatever
`resolveEquipmentCapabilities` returns for the stated input.

### Tier 1 — Full Gym
**Input:** checklist `equipment: ['Full Gym']`, `equipmentSelectionCompleteness: 'complete'` — the exact profile `ladderCoverageWideCensusTests` uses as `KITS[0]`.
**Resolver source:** `complete_selection` · **completeness:** `complete`
**Resolved tags (19):**
```
bodyweight · dumbbells · barbell · cables · bands · bench · foam_roller
bike_or_treadmill · pullup_bar · kettlebell · machine · plyo_box · rack
trap_bar · swiss_ball · ab_wheel · back_extension_bench · dip_bars · rings_trx
```

### Tier 2 — Dumbbells + Bands
**Input:** checklist `equipment: ['Dumbbells', 'Bands']`, `equipmentSelectionCompleteness: 'complete'` — the exact existing census profile, `ladderCoverageWideCensusTests` `KITS[2]`, verbatim.
**Resolver source:** `complete_selection` · **completeness:** `complete`
**Resolved tags (3):**
```
bodyweight · dumbbells · bands
```

### Tier 3 — Temporary Bodyweight / Away
**Input:** an **exhaustive `equipmentAnswer`** — all 17 askable tags
(`EQUIPMENT_TAG_LABELS`) explicitly `do_not_have`, and all 5 conditioning
modalities explicitly `do_not_have`.
**Resolver source:** **`athlete_answer`** · **completeness:** `complete`
**Resolved tags (1):**
```
bodyweight
```

**THE CONTROL THAT PROVES TIER 3 IS NOT THE FLOOR.** An empty profile — nothing
answered — also resolves to `tags: ['bodyweight']`, but with
**`source: 'unanswered_floor'`**. The two are identical in tags and
**distinguishable only by `source`**, which is exactly why this census names the
source beside the tags. Tier 3 is the answered one.

---

# 3. AUTHORED BUT ABSENT FROM EVERY POOL

Canonical identities present in the cue layer, the equipment sheet or an authored
strength template, and absent from every pool.

**Count: 5.** **Relevant to a B1 control: 0.**

| canonical identity | pattern / slot | authored source(s) | kit tiers that can legally perform it | relevant to a B1 control? |
| --- | --- | --- | --- | --- |
| `Speed Trap Bar Deadlift` | `hinge` | cue, equipment sheet | Full Gym | **No** — `POWER_POOL_PENDING`; and `hinge` is `ADEQUATE-COVERAGE` on Full Gym without it |
| `Speed Bench` | `horizontal_push` | cue, equipment sheet | Full Gym | **No** — `POWER_POOL_PENDING`; `horizontal_push` is `ADEQUATE-COVERAGE` on Full Gym without it |
| `RFE Split Squat Jump` | *(no ladder slot — plyometric)* | cue, equipment sheet | Full Gym, Dumbbells + Bands, Temporary Bodyweight | **No** — `POWER_POOL_PENDING`; power is never a ladder slot |
| `Mobility Flow` | *(none)* | authored template | all three | **No** — a session-block label the template emits as a row, not an exercise |
| `Conditioning` | *(none)* | authored template | all three | **No** — a session-block label the template emits as a row, not an exercise |

**All three real exercises are covered by an existing typed exemption.**
`POWER_POOL_PENDING` (`src/data/selectableExerciseVocabulary.ts:170`) names
exactly these three with the recorded reason: *"These three are NOT in the spec's
pool tables. They are speed-lift and contrast entries whose placement the spec
does not decide, so they stay pending. Each HAS a curated cue and video; what
they still lack is a pool."*

**`Mobility Flow` and `Conditioning` are not exercises.** They are the row names
`fallbackExercisesForPlanEntry` emits for a mobility day (`:1073`) and a
conditioning day (`:1079`). They are counted here because the extraction is
mechanical and they came out of the authored layer; they are not pool candidates
and no pool should hold them.

**So the authored-but-absent count of genuine exercises is 3, all exempt by a
recorded ruling, and none of them is needed by any B1 control.**

---

# 4. POOL ENTRIES NOT CORROBORATED ELSEWHERE

Pool entries mentioned by **none** of the cue layer, the equipment sheet or the
authored strength templates.

**Count: 76. These are review candidates, not defects, and this census makes no
claim that any of them is unauthorised or invalid.**

**ALL 76 ARE CONDITIONING FORMATS, AND ALL 76 CARRY THE SAME RECORDED TYPED
EXEMPTION.** Measured: every one belongs to the `Conditioning` selectable group
and `exemptionsFor()` returns **`conditioning_format`** for all 76 — the typed
kind whose recorded ruling is *"A session format, not a movement. Nothing to demo
(Sam, locked-list NOTES: 'Conditioning formats: no videos by design'), and it
renders the conditioning family cue rather than a per-movement one."* **Zero of
the 76 lack an exemption.**

| | |
| --- | --- |
| Canonical identity | all 76 are conditioning formats |
| Pool pattern/slot and role | **none** — not one is a `STRENGTH_POOLS` entry, and not one fills any of the ten ladder slots |
| Cue layer mentions it? | **no** (waived by `conditioning_format`) |
| Equipment sheet mentions it? | **no** (waived) |
| Authored strength templates mention it? | **no** — they are not strength rows |
| Kit tiers that can legally perform it | **all three**, for all 76 — a format carries no equipment requirement of its own |

The 76, in full:

```
1 km Repeats · 1 min On / 1 min Easy Tempo · 10 m Acceleration Reps
10 s Max Sprint Repeats · 10 s Repeat Efforts · 150–200 m Hard Repeats
1km Repeat Intervals · 2 min On / 1 min Easy · 20 m Acceleration Reps
20 m Shuttle Repeats · 20 s Max Sprint — Small Dose · 200m/400m Repeat Runs
30 m Acceleration Reps · 30 m Repeats · 30 s Very Hard Repeats
30:30 Controlled Tempo Blocks · 30:30 Hard Intermittent · 30:30 Tempo Blocks
400 m Repeats · 45 s Hard Repeats · 45-Degree Cut Reps · 4x4 VO2
60 s Max Sustained Effort · 6x1km · Aerobic Shuttles · Air Bike Accelerations
Assault Bike Intervals · Bike/Row/Ski Tempo Intervals
Bodyweight Circuit (no-equipment fallback) · Classic 4×4 · Continuous Aerobic Run
Controlled 10–20 min Blocks · Cruise Intervals · Deceleration and Landing Work
Easy Aerobic Flush · Easy Swim · Erg Flush Blocks
Erg Short-Burst Repeats (15–20 s) · Extensive Tempo (100 m repeats)
Flush Intervals 1:1 (1 min / 1 min) · Flush Intervals 2:1 (2 min / 1 min)
Flush Intervals 30:30 · Fly 20 (20+20) · Fly 30 (30+30) · Flying Sprints
Footy Fartlek · Footy Shuttles · Free Sprint Session
Hard Assault Bike Intervals · Hard Row Intervals · Hard SkiErg Intervals
Hill Acceleration · Hill Repeats — hard sustained · Inverse Tabata
Long Aerobic Intervals · Long Nasal Run · Low-Intensity Deceleration Drills
MAS 15:15 Blocks · MAS Training · Max Effort Sprint Accumulation
Nasal-Paced Easy · Off-Season Speed Reintroduction · Progressive Sprint Exposure
Return-to-Speed Ladder · Short Flush · SkiErg Intervals · Sprint Sets (3×5×6 s)
Steady 5 min Blocks · Steady Blocks (3×8 min or 4×6 min) · Tabata Finisher
Tabata Intervals · Team-Training Warm-Up Dose
Tempo Intervals (1min on / 1min easy) · Three-Minute Intervals
Two-Minute Repeats · Up-Back Shuttle
```

**NOT ONE STRENGTH POOL ENTRY IS UNCORROBORATED.** Every entry that fills a
ladder slot is mentioned by at least one authored layer.

**The weaker signal, reported separately and unasked: 147 pool entries are
mentioned by some layers and not others** — 97 have a cue and a sheet row but no
template mention, 49 have a cue only, 1 has a cue and a template mention but no
sheet row. A missing template mention is expected: the template layer authors 29
identities and the pool holds 249. These are in §8.

---

# 5. PATTERN × KIT-TIER COVERAGE

For each of Sam's ten ladder slots (`SessionSlot`, `src/rules/sessionSlotCoverage.ts:44`):
**distinct legal canonical pool exercises** under each exact kit tier, over a
denominator of **distinct canonical pool entries filling that slot**.

Classification, as the slice defines it:
- **KIT-UNACHIEVABLE** — `slotIsTrainableOnKit` is false: the whole tagged
  exercise universe contains no legal movement for this kit. Governed by
  R-083/R-090; not a pool defect.
- **POOL-GAP** — the kit *can* train the slot, and the pool exposes zero.
- **SINGLE-OPTION** — exactly one. Concentration, reported as such.
- **ADEQUATE-COVERAGE** — two or more.

| slot | denominator | Full Gym | Dumbbells + Bands | Temporary Bodyweight / Away |
| --- | --- | --- | --- | --- |
| `squat` | 7 | **7** ADEQUATE | **2** ADEQUATE | **1** SINGLE-OPTION — `Bodyweight Squat` |
| `hinge` | 6 | **6** ADEQUATE | **2** ADEQUATE | **1** SINGLE-OPTION — `Glute Bridge` |
| `single_leg_knee` | 9 | **9** ADEQUATE | **5** ADEQUATE | **5** ADEQUATE |
| `single_leg_hip` | 1 | **1** SINGLE-OPTION — `Single-Leg RDL` | **1** SINGLE-OPTION — `Single-Leg RDL` | **1** SINGLE-OPTION — `Single-Leg RDL` |
| `accessory_or_core` | 37 | **36** ADEQUATE | **27** ADEQUATE | **18** ADEQUATE |
| `horizontal_push` | 11 | **11** ADEQUATE | **4** ADEQUATE | **3** ADEQUATE |
| `horizontal_pull` | 10 | **10** ADEQUATE | **4** ADEQUATE | **0** **KIT-UNACHIEVABLE** |
| `vertical_push` | 8 | **8** ADEQUATE | **3** ADEQUATE | **0** **KIT-UNACHIEVABLE** |
| `vertical_pull` | 8 | **8** ADEQUATE | **0** **KIT-UNACHIEVABLE** | **0** **KIT-UNACHIEVABLE** |
| `arm_or_shoulder` | 46 | **46** ADEQUATE | **25** ADEQUATE | **3** ADEQUATE |

**POOL-GAP count across all 30 cells: ZERO.**

## 5.1 The zero and one cells, named

**Every zero is KIT-UNACHIEVABLE.** `slotIsTrainableOnKit` was asked separately
of each and returned `false` in every case — the tagged library holds no legal
movement, so the pool cannot be short of one.

| cell | identities | ruling that permits it |
| --- | --- | --- |
| `horizontal_pull` @ Temporary Bodyweight | none legal | **R-083** — *"ya can't do much with overhead pushing or pull or even horizontal pulling without equipment"*. Removed, not substituted. |
| `vertical_push` @ Temporary Bodyweight | none legal | **R-083**, same clause |
| `vertical_pull` @ Temporary Bodyweight | none legal | **R-083**, same clause |
| `vertical_pull` @ Dumbbells + Bands | none legal | **R-083** — every pool entry needs a `pullup_bar`, `cables` or `machine`; a dumbbell-and-band kit has none |
| `single_leg_hip` @ **all three tiers** | `Single-Leg RDL` | **R-084** — *"The single-leg hip pool is ONE exercise, the Single-Leg RDL, and Sam is not adding more … the slot checker must not report a one-exercise pool as a coverage defect, and the variety-rotator must not treat 'the same exercise every leg day' as a fault — it is meant to repeat."* Deliberate, ruled, closed. |
| `squat` @ Temporary Bodyweight | `Bodyweight Squat` | **R-086** closes `BODYWEIGHT_CAPABLE` at two and rules that *"every other exercise follows the authored sheet verbatim"*. The one option is what the sheet permits; no ruling requires more. Bible `:1096`'s *"a zero-equipment option always exists for every family"* is **satisfied** here. |
| `hinge` @ Temporary Bodyweight | `Glute Bridge` | same as above; Bible `:1096` satisfied |

## 5.2 The one cell short of its own denominator on Full Gym

`accessory_or_core` is **36 of 37** on Full Gym. The single exclusion is
**`Bear Carry`**, whose sheet requirement is `sandbag` — a tag that is **not in
the askable equipment vocabulary** (`EQUIPMENT_TAG_LABELS` has no `sandbag`), so
no athlete can ever answer that they own one. **Out of scope for B1** —
`accessory_or_core` is `ADEQUATE-COVERAGE` on all three tiers without it. One
ledger line only.

---

# 6. EXISTING RULINGS APPLIED

Grepped before any question was formed, as the slice requires.

**`docs/RULINGS_REGISTRY.md`** — searched for the apparent gaps, their patterns,
their exercises and their kit conditions (`R-083`, `R-084`, `R-086`, `R-090`;
*variety*, *rotation*, *same exercise*, *bodyweight*, *pool*):

| ruling | what it settles here |
| --- | --- |
| **R-083** (`:1455`) | A kit that cannot train vertical push, vertical pull or horizontal pull gets the pattern **REMOVED, not substituted**. Every `KIT-UNACHIEVABLE` cell in §5 is this ruling's own answer. |
| **R-084** (`:1574`) | The single-leg hip pool **is one exercise and is meant to repeat**; a one-exercise pool is explicitly *not* a coverage defect. Settles three `SINGLE-OPTION` cells. |
| **R-086** (`:1614`) | `BODYWEIGHT_CAPABLE` is **closed at two** — `Walking Lunges` and `Single-Leg RDL`. *"This is a CLOSURE, NOT a backlog. Do not add a third by inference."* Settles why the bodyweight squat and hinge cells are one option each and forbids widening them by inference. |
| **R-090** (`:1796`) | A kit-caused gap is a **typed, disclosed shortfall, never a refusal**, and required patterns are judged against the kit-achievable set. Settles what a `KIT-UNACHIEVABLE` cell should do to a B1 week. Status `UNENFORCED`, built and not shipped. |

**`docs/LFA_PROGRAMMING_BIBLE.md`** — searched for *variety*, *rotation*, *same
exercise*, *bodyweight*, *no equipment*, *zero-equipment*, and the two named
bodyweight lifts:

| Bible | what it settles here |
| --- | --- |
| `:1096` | *"A zero-equipment option always exists for every family, phase and experience level."* **Satisfied** for `squat` and `hinge` on the bodyweight tier — one option each — and superseded by R-083 for the three patterns R-083 removes. |
| `:3192` | *"New athletes need consistency and confidence more than variety."* |
| `:1085` | The power pick is deliberately **block-stable** — *"the same exercise every week within a training block"*. |
| *(no clause found)* | **NO Bible clause requires strength-slot variety, a minimum option count, or forbids a one-exercise slot.** Combined with R-084, the "an existing ruling requires variety" trigger for a question is **not met** by any cell in §5. |

---

# 7. BOUNDED QUESTIONS FOR SAM

**THERE ARE NONE.**

A cell becomes a question only when all four hold: the slot is required by one of
B1's exact controls; the slot is kit-achievable under existing rulings; the
authorised pool exposes **zero** legal options; and no existing Bible or registry
ruling already answers what to do.

**The third condition is never met.** Across the ten ladder slots × three kit
tiers, `POOL-GAP` count is **0**. Every zero is `KIT-UNACHIEVABLE` and governed by
R-083 with R-090 naming what the week should then do.

Checked against each B1 control explicitly:

| B1 control | slots its days require | pool exposure | question? |
| --- | --- | --- | --- |
| two-day pre-season + club night × **Full Gym** × w1, w2 | all ten | every slot `ADEQUATE` except `single_leg_hip` (1, ruled by R-084) | **No** |
| two-day pre-season + club night × **Dumbbells + Bands** × w1, w2 | all ten | `vertical_pull` KIT-UNACHIEVABLE (R-083); `single_leg_hip` 1 (R-084); everything else ADEQUATE | **No** |
| two-day pre-season + club night × **explicit temporary Bodyweight/Away** × w1, w2 | all ten | `horizontal_pull`, `vertical_push`, `vertical_pull` KIT-UNACHIEVABLE (R-083); `squat`, `hinge`, `single_leg_hip` SINGLE-OPTION (R-086, R-084); everything else ADEQUATE | **No** |
| **Dumbbells + Bands in-season non-refusing control** | all ten | identical to the Dumbbells + Bands row above | **No** |

**On the "one legal option" trigger.** The slice permits a question about a
single-option cell only if an existing ruling requires variety, or if B1 cannot
compose a lawful week using that option. **No ruling requires variety** (§6), and
**R-084 explicitly forbids treating a one-exercise slot as a fault.** Whether a
bodyweight week can be composed *lawfully* is a separate, already-recorded matter
and is **not a pool question** — see §9.

---

# 8. OUT OF SCOPE FOR B1

**Visible, unasked, unactioned. None of this is to be converted into a question
or into follow-up work.**

| # | Item | Count |
| --- | --- | --- |
| 1 | **Canonical valid-but-absent exercises** — authored somewhere, in no pool: `Speed Trap Bar Deadlift`, `Speed Bench`, `RFE Split Squat Jump`. All three carry the recorded `power_pool_pending` exemption. | **3** |
| 2 | Non-exercise row labels the authored template layer emits (`Mobility Flow`, `Conditioning`), which surface in the same extraction. | 2 |
| 3 | **Uncorroborated pool entries** — all conditioning formats, all carrying the recorded `conditioning_format` exemption, none filling a ladder slot. | **76** |
| 4 | **Partially corroborated pool entries** — mentioned by some layers, not others: 97 cue+sheet without a template mention, 49 cue-only, 1 cue+template without a sheet row. Expected, since the template layer authors 29 identities against a pool of 249. | 147 |
| 5 | `Bear Carry` requires the tag `sandbag`, which is not in the askable equipment vocabulary, so it is illegal on every tier including Full Gym. | 1 |
| 6 | `arm_or_shoulder` on the bodyweight tier is three push-up variants (`Push-ups`, `Explosive Push-up`, `Scap Push-Up`). `ADEQUATE-COVERAGE` by count; concentrated by kind. | 1 cell |
| 7 | **Legality-owner divergence** — `exerciseAllowedByEquipment` and `exerciseIsAvailableWith` disagree on 4 (identity × tier) pairs, all where the name is absent from the sheet so the pool owner falls back to the load classifier while the sheet owner answers "unknown, allow": `Chest Supported Row` @ bodyweight, `Chest-Supported DB Row` @ bodyweight, `Seated Cable Row` @ bodyweight and @ Dumbbells+Bands. The census used the pool owner throughout. | 4 |

---

# 9. NOT ESTABLISHED

1. **ONE CANONICAL AMBIGUITY, AND ITS EXACT EFFECT IS MEASURED.**
   `canonicalExerciseName` keeps **`Single-Arm Pulldown`** and **`Single-Arm Lat
   Pulldown`** as two identities; the subordinate load-alias owner
   `resolveExerciseName` maps the first onto the second. **Both are pool entries
   and both fill `vertical_pull` and `arm_or_shoulder`.**
   **The effect if they were one identity, stated rather than chosen:**
   `vertical_pull` denominator 8 → 7 and its Full Gym count 8 → 7;
   `arm_or_shoulder` denominator 46 → 45 and its Full Gym count 46 → 45.
   **No cell changes classification** (both stay `ADEQUATE-COVERAGE`), the other
   two tiers are unaffected (both entries need `cables`/`machine`), and **no
   question changes.** This census reports the stated owner's answer and does not
   choose between the two owners. **Not a hard stop, because it changes no
   table's conclusion — only two denominators by one.**

2. **R-084's bodyweight clause and R-086 disagree in prose, and the code
   implements R-086.** R-084 says *"A bodyweight athlete therefore cannot fill
   the single-leg hip slot"*; R-086, ruled the same day, puts `Single-Leg RDL`
   into `BODYWEIGHT_CAPABLE`, which makes it legal on a bodyweight kit. **The
   census measures `single_leg_hip` as SINGLE-OPTION and legal on all three
   tiers**, which is what the code does. **This changes no B1 question** — either
   reading gives a non-`POOL-GAP` cell. Recorded, not resolved.

3. **Whether a lawful B1 week can be composed on the bodyweight tier is not a
   pool property and was not measured here.** The 2026-08-14 baseline and the
   1B-final-2 receipt both record that a bodyweight week's lifts classify
   `strength_accessory` with `mainStrengthPattern: null`, so §18 sees zero main
   lifts regardless of what the pool exposes. **That is a row-classification
   property, already recorded, and no pool change addresses it.** It is named
   here so nobody reads §7's empty question list as a claim that the bodyweight
   B1 control will publish.

4. **Whether `POWER_POOL_PENDING`'s three entries should ever reach a ladder
   slot.** Their exemption records that the spec does not decide their placement.
   Not asked, because no slot is short without them.

---

# 10. NOT COVERED

1. **`POOL_REGISTRY`'s internal role structure.** Table (b) uses
   `selectableExerciseNames()`, which spans every pool the app selects from, so
   membership is complete — but the (slot, role) columns in table (b) are
   populated only from `STRENGTH_POOLS`. No entry needed them: all 76 rows are
   conditioning formats with no strength pool membership.

2. **Injury, exclusion and athlete-pin filters.** Legality here is kit only.
   A B1 week also passes through exclusion, injury and pinned-exercise filters,
   which can narrow any cell further. Not measured.

3. **Whether the pool would actually *select* a legal entry.** This census counts
   what is legally available per slot; `applyPoolRotation`'s group narrowing,
   anchor/accessory cadence and no-back-to-back rule can expose fewer at a given
   moment. The 2026-08-14 baseline measured that separately (47 of 52 eligible
   entries delivered over six blocks for a full-gym athlete).

4. **Conditioning, power, mobility and recovery slot coverage.** The ten ladder
   slots are strength slots. The conditioning universe appears here only as
   table (b)'s 76 uncorroborated entries.

5. **The 2026-08-14 baseline's finding that composed rows come from the authored
   template layer rather than the pool.** That is why a kit-illegal row can reach
   an athlete even though §5 shows no pool gap: **the pool's legality is not the
   template layer's legality.** Measuring the template layer's own kit behaviour
   is B1's subject, not this census's.
