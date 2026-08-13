# WHAT THE SOLE DETERMINISTIC BUILDER PRODUCES — BASELINE, 2026-08-14

**Slice 1C-BASELINE. Seat `baseline`. MEASUREMENT ONLY — no production code was
changed, no gate, ceiling, floor, census, ratchet, pool or sheet was touched, and
nothing was re-baselined.** Every probe used to take these numbers was temporary
and lives in the session scratchpad; nothing was added to the repo but this
document and one pointer line in `docs/MISSION_THREE_FIXES.md`.

**WHAT THIS IS FOR.** As of `1fce185f` the AI authors nothing and every route
into program construction lands on one deterministic builder. That builder still
contains many internal branches, fallbacks and repair candidates. **This document
measures what the route as a whole hands the athlete**, so the composer work that
follows has a specification and a number to beat on every line.

**RE-MEASURED, NOT COPIED.** Every figure below was executed in this session at
committed `HEAD` (`1fce185f`). Where a figure disagrees with something previously
reported, the disagreement is stated in its own section rather than reconciled
away.

**THE STANDARD.** `docs/LFA_PROGRAMMING_BIBLE.md` was grepped before any
judgement. The three clauses that do most of the judging here:

| Bible | What it says |
| --- | --- |
| `:226` | **ONE MAIN PER PATTERN PER SESSION.** *"Deadlift + RDL is two heavy hinges and is illegal."* |
| `:227` | **The lower ladder, in fill order** — heavy squat → heavy hinge → single-leg knee → single-leg hip → accessories. *"An athlete is better served by a squat and a hinge than by two squats."* |
| `:770`, `:4936` | **The prescription-display law** — ranges are the generation source, *"the athlete is shown a SINGLE MIDDLE NUMBER, not a range. 3x8-12 is written as 3x10."* |

`R-083` (Sam, 2026-08-13) governs kit: vertical push, vertical pull and
horizontal pull are **REMOVED, not substituted**, when the kit cannot train them,
and a short session is that ruling's own answer rather than a defect. Bible
`:1096` (*"a zero-equipment option always exists for every family"*) is the older
text and R-083 supersedes it; nothing below scores a removed slot as a defect.

---

## THE COMMANDS — every number below has one

| # | Dimension | Command |
| --- | --- | --- |
| 1 | Completeness, ladder, refusals | `npm run test:ladder-wide` + the 180-world probe |
| 2 | Legality | the 180-world probe |
| 3 | Prescriptions | the 180-world probe + `npm run print:week` |
| 4 | Responsiveness | `npm run sim:changeover` |
| 5 | Variety | the 6-block variety probe |
| 6 | Agreement | the install-and-project probe |
| 7 | The weeks themselves | `npm run print:week` + the install-and-project probe |

The three probes are described where their numbers appear. Each one calls the
**app's own doors** — `generateProgramLocally`, `sessionSlotCoverage`,
`resolveEquipmentCapabilities`, `exerciseIsAvailableWith`,
`canonicalExerciseName`, `buildProgramTabProjectedWeek`, `project()` — and never
a second copy of one.

**The 180-world sweep** is the same corpus `test:ladder-wide` walks: 3 season
phases × 5 training-day counts (2–6) × club / no-club × 3 kits (Full Gym,
Bodyweight Only, Dumbbells+Bands) × 2 weeks. Profiles are built field-for-field
the way that suite builds them, so the two instruments see the same worlds.

---

# 1. COMPLETENESS

## 1.1 Built or refused

```
npm run test:ladder-wide
```

| | |
| --- | --- |
| Worlds swept | **180** |
| Built | **174** |
| Refused | **6** |
| Sessions composed | **576** |
| Exercise rows composed | **2,688** |

**THE SIX REFUSED WORLDS, NAME FOR NAME** — every one of them is
**pre-season, two training days, with club nights**:

```
Pre-season/2d/club/Full Gym/w1          Pre-season/2d/club/Full Gym/w2
Pre-season/2d/club/Bodyweight Only/w1   Pre-season/2d/club/Bodyweight Only/w2
Pre-season/2d/club/Dumbbells/w1         Pre-season/2d/club/Dumbbells/w2
```

**EVERY BLOCKING FINDING, FOR ALL SIX — they are identical, word for word:**

| Field | Value |
| --- | --- |
| error | `Section18WeekAcceptanceError` / `section18_week_rejected` |
| status | `impossible` |
| attempts | `1` |
| failure signature | `pattern_restore_failure:strength_patterns:0\|pattern_restore_failure:strength_patterns:0` |
| **blocking violation 1** | `pattern_restore_failure:strength_patterns` — *"Safe weekly squat coverage was not restored by a later session."* |
| **blocking violation 2** | `pattern_restore_failure:strength_patterns` — *"Safe weekly hinge coverage was not restored by a later session."* |
| Section 17 craft blocking | **none** (empty) |
| repairs attempted | `weekly_power_budget: Weekly selector kept 0 primers within budget 0.` · `safe_fallback_candidate: Safe deterministic fallback entered the same gateway.` · `weekly_power_budget: Weekly selector kept 0 primers within budget 0.` |

**Not one of the six is a kit finding.** All three kits refuse identically,
including Full Gym. The cause is the two-day pre-season week itself: the plan
cannot place a safe squat and a safe hinge across two sessions that are both club
nights, the safe deterministic fallback re-enters the same gateway and is
refused the same way, and the athlete is told *"We couldn't safely build your week
from your current settings."*

**The refusal is wider than the sweep shows.** Driven through the real onboarding
door, a pre-season athlete with **two training days and only ONE club night**
refuses with the same signature (§7, week W3). So the boundary is not
"two club nights" — it is a two-day pre-season week with any club night in it.

## 1.2 Does each strength day satisfy Sam's pattern ladder

```
npm run test:ladder-wide
```

| | |
| --- | --- |
| Laddered days in the corpus | **318** |
| Days that miss or duplicate a rung | **126 (39.6%)** |
| Worlds holding at least one such day | **98 of 174 (56%)** |
| Distinct deficient shapes | **5** |
| Days blocked by kit (R-083 — removed by ruling, not owed) | **86** — `vertical_pull` 52, `vertical_push` 42, `horizontal_pull` 26 |

**THE 126, BY SHAPE, WITH COUNTS.** The suite prints the shapes; the counts are
the probe's, and they sum to exactly 126:

| Count | Day | Shape |
| --- | --- | --- |
| **40** | `Lower Squat` | `missing=[squat] dup=[single_leg_knee]` — **a squat day with no squat**, its knee work doubled instead |
| **34** | `Lower Body Strength` | `missing=[squat] dup=[hinge, single_leg_knee]` — no squat, two hinges *(Bible `:226`: illegal)*, two single-leg knee |
| **22** | `Upper Push` | `missing=[arm_or_shoulder]` |
| **18** | `Lower Body Strength` | `dup=[hinge]` — **two heavy hinges in one session**, Bible `:226`'s named illegal case |
| **12** | `Team Training + Upper Push` | `missing=[arm_or_shoulder]` |

**52 of the 126 are two hinges in one session** — the single case the Bible names
as illegal by example. **74 of the 126 are a lower day with no squat at all.**

**126 of 318 laddered days ship into a five-slot ladder from a builder that
mostly ships three rows.** Row counts per session across all 576 sessions:

```
rows:   0    1    2    3    4    5    6    7    8    9
count: 16    6  102   76   52  102   82  100   20   20
```

## 1.3 Which achievable patterns are absent week-wide

Judged per week, over the union of what that athlete's kit **can** train
(`sessionSlotCoverage.required`, which already excludes kit-blocked slots), minus
what the week actually filled:

| | |
| --- | --- |
| Worlds missing an achievable pattern for the WHOLE week | **80 of 174 (46%)** |
| `squat` absent all week | **74 worlds** |
| `arm_or_shoulder` absent all week | **14 worlds** |
| Both absent | 8 worlds |

**No other pattern is ever absent week-wide.** The composer's whole week-level
completeness problem is two slots, and one of them — the squat — is 74 of the 80.

## 1.4 Do composed session counts match what was asked for

**The denominator here is the ATHLETE'S OWN ANSWER** (`preferredTrainingDays`),
not a re-derived plan — see NOT MEASURED for why the planner's internal request
could not be read honestly.

| | |
| --- | --- |
| Worlds where a requested training day carries **no work at all** | **120 of 174 (69%)** |
| …of those, where the empty day is **game day** (correct — the game is the session) | 36 |
| **Worlds short on a NON-game requested day** | **112 of 174 (64%)** |

**THE SHAPE IS ONE DAY: FRIDAY.**

| | Off-season | Pre-season | In-season |
| --- | --- | --- | --- |
| Full Gym | 16 worlds | 16 worlds | — |
| Dumbbells | 16 worlds | 16 worlds | — |
| Bodyweight Only | 16 worlds | 16 worlds | 16 worlds |

- **96 worlds — the day simply is not there.** No session object of any kind on
  the requested Friday. Off-season and pre-season, every kit.
- **16 worlds — the day is there and named `Rest` with zero rows.** In-season,
  bodyweight only.
- `Rest` is the only session name in the whole corpus that ships zero rows
  (16 of 576 sessions). **No block is named and then left empty** — the
  "named block with nothing in it" finding does not occur in this corpus.

An athlete who asks for three training days in the off-season is given two.

---

# 2. LEGALITY — rows the athlete's kit cannot do

Judged by the app's own owner (`exerciseIsAvailableWith`), against the kit the
generator itself resolved (`resolveEquipmentCapabilities`). **2,688 rows.**

## 2.1 The two columns Sam asked for

| | Column (a) — the equipment sheet as it stands on `main` | Column (b) — with Sam's corrected answers |
| --- | --- | --- |
| **Impossible rows** | **538 of 2,688 (20.0%)** | **538 of 2,688 (20.0%)** |

**Neither is averaged away, and the identical total is a coincidence of
composition, not agreement.** Sam's corrections were: *Chest Supported Row =
bench + dumbbells*, *Romanian Deadlift = barbell OR dumbbells*, *Pallof Press =
band*. What moves:

| Row | (a) main sheet | (b) Sam corrected | why |
| --- | --- | --- | --- |
| Overhead Press | 122 | 122 | unchanged |
| Back Squat | 68 | 68 | unchanged |
| Pull-Ups | 62 | 62 | unchanged |
| Band Pallof Press | 62 | 62 | unchanged (already `bands`) |
| Face Pull | 56 | 56 | unchanged |
| Leg Extension | 40 | 40 | unchanged |
| Stir the Pot | 4 | 4 | unchanged |
| **RDLs** | **124** | **62** | the 62 dumbbell worlds become legal |
| **Chest Supported Row** | **0** | **62** | not on the sheet today, so today it is never refused |

**The 62 that leave RDLs and the 62 that arrive at Chest Supported Row cancel
exactly.** That is why both columns read 538.

## 2.2 A third number, and it is an instrument disagreement worth keeping

**The same corpus measures 352 impossible rows if you judge the name the program
STORES, and 538 if you judge the name the athlete SEES.** The projection
canonicalises before it renders (`projectVisibleWeek.rowName` →
`canonicalExerciseName`), and three names change on the way to the screen:

| Stored name | Shown to the athlete | rows | on the equipment sheet? |
| --- | --- | --- | --- |
| `Pallof Press` | **`Band Pallof Press`** | 186 | stored: no · shown: **yes, `bands`** |
| `Romanian Deadlift` | **`RDLs`** | 124 | stored: no · shown: **yes, `barbell`** |
| `Face Pulls` | **`Face Pull`** | 84 | stored: no · shown: **yes, `cables`** |

**A row stored under a name the sheet does not know is never refused, and is then
printed under a name the sheet does know and would have refused.** 186 of the
2,688 rows are exactly that. **538 is the athlete's number and is the one that
counts**; 352 is what the sheet sees from where the builder stands.

**10 of the 68 distinct row names in the corpus are absent from the equipment
sheet altogether** (`equipmentRequiredFor` returns `null`, which means "unknown,
allow"): Pallof Press (186 rows), Bodyweight Conditioning Circuit (184), Romanian
Deadlift (124), Chest Supported Row (62), 30:30 Controlled Tempo Blocks (41),
Short Flush (32), Warm-up (16), Side Plank Row (10), Mobility Flow (6), Classic
4×4 (3).

---

# 3. PRESCRIPTIONS — rows an athlete cannot act on

## 3.1 Across the 180-world sweep

A row is unreadable when it resolves to no dose at all — the same test
`projectVisibleWeek.prescriptionCopy` applies before falling through to
`row.prescription.unspecified`, plus Sam's own reading that `1 × 1` is not a
prescription.

| | |
| --- | --- |
| Unreadable rows | **144 of 2,688 (5.4%)** |
| Rows with no sets/reps and no duration at all | **0** |
| All 144 are the literal string **`1 × 1`** | |

| Row | count |
| --- | --- |
| Bodyweight Conditioning Circuit | 96 |
| Short Flush | 32 |
| Warm-up | 16 |

**It is one class, not 144 bugs**: conditioning rows that carry a real
prescription somewhere else and reach this surface with sets=1, reps=1.

## 3.2 The range-versus-midpoint law, on the printed weeks

```
npm run print:week
```

The Bible (`:770`, `:4936`) says the athlete sees **one middle number**. The day
screen obeys it; the projection emits the range.

| | |
| --- | --- |
| Printed weeks | 6 |
| **Sets written as a range instead of a midpoint** | **99** (20 + 13 + 21 + 15 + 13 + 17) |
| Findings across the six weeks | **16** — 5 kit-impossible, 9 unreadable (`1 × 1`), 2 named-block-with-nothing-in-it |
| `[NO COPY]` — words the app does not have | **0** |

**The unreadable-prescription mirror agrees with the projection.** The three
names the sweep's mirror flags (`Short Flush`, `Bodyweight Conditioning Circuit`,
`Warm-up`) are the same three the projection flags on its own corpus; the counts
differ only because the corpora differ.

---

# 4. RESPONSIVENESS — does what an athlete DID change what they are given

```
npm run sim:changeover
```

Five athletes, same starting answers, same start date, five weeks walked one day
at a time, every session recorded through the app's real completion path
(`commitSessionOutcomeTransaction`).

| athlete | sessions recorded | feedback days stored | loads typed | soreness > none | week 5 |
| --- | --- | --- | --- | --- | --- |
| Does everything | 30 | 30 | 0 | 0 | — |
| …and writes down every weight | 30 | 30 | **67** | 0 | **identical** |
| Misses every Friday | 25 | 25 | 0 | 0 | **identical** |
| Away for week 3 | 24 | 24 | 0 | 0 | **identical** |
| Declares sore in week 2 | 30 | 30 | 0 | **6** | **identical** |

**NOTHING AN ATHLETE DID CHANGED WHAT THEY WERE NEXT GIVEN.**

**Verified independently of the script's own claim.** I extracted the `Week 5`
section of all five reports and hashed them: **one MD5 across all five**
(`2f4de5e5…`), 238 lines each. Refusals 0, throws 0, rollover problems 0 for
every athlete.

**Two things rule out a dead instrument:**

1. **The comparison can see a change.** Week 1 and week 5 of the *same* athlete
   differ — 5 of 7 days differ, in sessions and in prescriptions.
2. **The training was really recorded.** The logging athlete stored 67 loads
   across 23 days; every athlete's sessions reached storage through the real
   door.

**WHAT DOES CHANGE between week 1 and week 5** — and it is the block rolling
over, not the athlete:

- Monday `Lower Body Strength` 6 exercises → 7
- Tuesday same session, Pull-Ups → Chin-Ups, Barbell Row 92.5 kg → Chest
  Supported Row 40 kg
- Wednesday, Thursday, Friday: same session names, rotated exercises
- Saturday and Sunday unchanged

**WHAT DOES NOT CHANGE: anything traceable to the athlete.** Missing every Friday
for five weeks, being away a whole week, and reporting high soreness for a week
all produce the identical week 5 as doing every session perfectly.

---

# 5. VARIETY

**The athlete:** full gym, in-season, 5 training days (Mon–Fri), club Tuesday and
Thursday, Saturday game. **6 blocks, 24 generated weeks** — `blockNumber` 1…6
through `generateProgramLocally`, which is what drives rotation cadence.

## 5.1 How the eligible set was computed

For every delivered row: `canonicalExerciseName` → `classifyPoolSlot` gives the
`(slot, role)` pair → `getSlotSiblings(slot, role)`. **A pool `group` is an
interchangeability claim** — rotation varies within a group and never across one
(R-080) — so a grouped row's eligible set is its own group. Every candidate is
then filtered by the app's own gate, `exerciseAllowedByEquipment`, with this
athlete's resolved kit. **The denominator is therefore: everything the rotation
is allowed to reach for this athlete, this pattern and this role.**

## 5.2 The ratio

| | |
| --- | --- |
| **Distinct exercises delivered ÷ exercises ELIGIBLE** | **47 / 52 = 0.90** |
| across | 13 pool-owned `(slot, role[, group])` classes |

Per class:

| class | delivered | eligible | ratio | never delivered |
| --- | --- | --- | --- | --- |
| `squat/anchor` | 4 | 4 | 1.00 | — |
| `squat/accessory/single_leg_knee` | 6 | 6 | 1.00 | — |
| `squat/accessory/bilateral_squat` | 3 | 3 | 1.00 | — |
| `hinge/anchor` | 3 | 3 | 1.00 | — |
| `hinge/accessory/single_leg_hip` | 1 | 1 | 1.00 | — |
| `horizontal_pull/anchor` | 3 | 3 | 1.00 | — |
| `horizontal_push/accessory` | 6 | 6 | 1.00 | — |
| `vertical_pull/anchor` | 2 | 2 | 1.00 | — |
| `vertical_push/anchor` | 2 | 2 | 1.00 | — |
| `isolation_upper/accessory/shoulder` | 7 | 7 | 1.00 | — |
| `isolation_upper/accessory/tricep` | 5 | 6 | 0.83 | Tricep Circuit (Dirty 30) |
| `isolation_upper/accessory/bicep` | 4 | 7 | 0.57 | Bicep Curl (Barbell), Bicep Curl (Dumbbell), Lying Dumbbell Curl |
| `isolation_upper/anchor` | 1 | 2 | 0.50 | Skull Crushers |

**THE WEAKER DENOMINATOR, LABELLED AS SUCH:** distinct pool names delivered ÷
every name in `STRENGTH_POOLS`, ignoring pattern, role, group and kit —
**47 / 86 = 0.55**. It is the weaker number because it counts as "missing" every
exercise this athlete's day never asks for. **66 distinct row names** were
delivered in total across the 24 weeks.

## 5.3 Rows that never rotate

**One class froze inside its own pool:**

- **`isolation_upper/anchor` — always `Shrugs`, in all 6 blocks**, with
  `Skull Crushers` eligible and never selected.

**Four classes never rotated because the delivered row is not in the pool at
all.** These 8 rows are classified into a `(slot, role)` by the tag heuristic,
but are absent from that pool's entries, so `applyPoolRotation` can never reach
them:

| class | delivered every block | eligible pool entries, none of which ever appeared |
| --- | --- | --- |
| `squat/accessory` | Cossack Squat | 9 |
| `vertical_push/accessory` | Bottoms-Up KB Press | 5 |
| `vertical_pull/accessory` | Chin-Up Negative (Slow), Scap Pull Ups | 4 (all Lat Pulldown variants) |
| `isolation_lower/accessory` | Copenhagen Plank (Half), Seated Calf Raise, Single-Leg Calf Raise, Swiss Ball Hamstring Curl | 7 (Back Extension, Calf Raises, Hamstring Curl, Leg Extension, Nordic Lower, Single-Leg Hip Thrust, Tib Raises) |

**A full-gym athlete never once sees a Lat Pulldown, a Nordic Lower, a Hamstring
Curl or a Leg Extension in 24 weeks** — not because they were rotated past, but
because whatever ships those slots does not consult the pool.

**11 further row names are outside every pool** and therefore outside this
measurement entirely: Band Pallof Press (24 rows), Side Plank Row, Bird Dog,
Woodchop (Standing), Hanging Leg Raise, Short Flush, Easy Aerobic Flush,
Nasal-Paced Easy, Erg Flush Blocks, Flush Intervals 30:30, Flush Intervals 1:1.

---

# 6. AGREEMENT — does the printed week match the stored program

Two named worlds, each installed through the real doors (fresh install →
onboarding → `generateProgramLocally` → `commitRebuiltProgram`), then read back
two ways: the **stored** program's own rows, and the **projection**
(`buildProgramTabProjectedWeek` → `project()`) that the athlete's screen reads.

| world | days agreeing | days disagreeing |
| --- | --- | --- |
| Full gym, in-season, 5 days, club Tue/Thu | 5 of 7 | **2** |
| Dumbbells + bands + bench, in-season, 4 days, club Tue/Thu | 5 of 7 | **2** |

**PRESCRIPTIONS AGREE EVERYWHERE.** Every set count and rep range in the stored
program is the set count and rep range the projection prints. Not one number
disagrees on either world.

**NAMES DISAGREE, ON EXACTLY THREE ROWS:**

| stored | printed |
| --- | --- |
| `Pallof Press` | `Band Pallof Press` |
| `Romanian Deadlift` | `RDLs` |
| `Face Pulls` | `Face Pull` |

**The surface that disagrees is the projection**, and it disagrees on purpose:
`projectVisibleWeek.rowName` canonicalises before rendering so the name traces to
the locked vocabulary. **The consequence is §2.2** — the equipment check that
matters runs against the stored spelling, and the athlete reads the canonical
one.

No other surface disagreed. Day structure, session names, part structure and row
membership were identical on all 14 days.

---

# 7. THE WEEKS THEMSELVES

Every word below is the app's. The layout is the printer's; the vocabulary,
prescriptions and warnings are `project()`'s and `renderWeekAsPlainEnglish`'s.

---

## W1 — Full gym, in-season, 5 training days, two club nights

*(Freshly generated and projected this session. Sam: this is the best case — a
gym athlete with everything.)*

## Monday 10 August — Training Day

**Lower Body Strength**

- Walking Lunges — 3 × 6-8
- Deadlift — 3 × 2-4
- Bulgarian Split Squats — 3 × 6-8
- Single-Leg RDL — 2 × 6-8
- Band Pallof Press — 2 × 8-12

**Conditioning**

- Short Flush — 1 × 1  ⚠ **"1 × 1" IS NOT A PRESCRIPTION**

## Tuesday 11 August — Training Day

**Upper Pull**

- Pull-Ups — 3 × 4-6
- Barbell Row — 3 × 4-6
- Face Pull — 2 × 10-20

**Team Training** — *(the club runs this one — the app lists nothing for it)*

## Wednesday 12 August — Training Day

**Accessories**

- Dragon Flag — 2 × 4-6
- Cossack Squat — 3 × 6-8
- Bottoms-Up KB Press — 2 × 6-8
- Single-Leg Calf Raise — 3 × 12-15

## Thursday 13 August — Training Day

**Upper Push**

- Landmine Press — 3 × 3-5
- DB Bench Press — 3 × 8-15
- Lateral Raise — 2 × 10-20

**Team Training** — *(the club runs this one)*

## Friday 14 August — Training Day

**Gunshow**

- Incline Dumbbell Curl — 3 × 10-12
- Banded Bicep Curl — 3 × 15-20
- Tricep Pushdown — 3 × 12-15
- Overhead Tricep Extension — 2 × 10-12
- Rear Delt Fly — 3 × 12-15
- Shrugs — 3 × 10-12

## Saturday 15 August — **Game Day** · Sunday 16 August — Rest Day

**What is wrong with this week:** 21 sets written as a range instead of a middle
number. 1 line with no dose (`Short Flush`). **Monday has no squat** — a lower
day built from a deadlift and two single-leg knee movements.

---

## W2 — Dumbbells + bands + bench, in-season, 4 training days, two club nights

*(Freshly generated and projected this session.)*

## Monday 10 August — Training Day

**Lower Body Strength**

- Walking Lunges — 3 × 6-8
- Single-Leg RDL — 2 × 6-8
- Bulgarian Split Squats — 3 × 6-8
- Glute Bridge — 2 × 6-8
- Band Pallof Press — 2 × 8-12
- RDLs — 3 × 6-10  ⚠ **CANNOT BE DONE — needs barbell, which this athlete does not have.**

**Conditioning**

- Treadmill Aerobic Work — 1 × 1  ⚠ **"1 × 1" IS NOT A PRESCRIPTION**

## Tuesday 11 August — Training Day

**Upper Pull**

- Chest Supported Row — 3 × 4-6
- Face Pull — 2 × 10-20  ⚠ **CANNOT BE DONE — needs cables, which this athlete does not have.**

**Team Training** — *(the club runs this one)*

## Wednesday 12 August — Rest Day · *(nothing on this day)*

## Thursday 13 August — Training Day

**Upper Push**

- DB Shoulder Press — 3 × 8-15
- DB Bench Press — 3 × 8-15
- Lateral Raise — 2 × 10-20

**Team Training** — *(the club runs this one)*

## Friday 14 August — Training Day

**Gunshow**

- Incline Dumbbell Curl — 3 × 10-12
- Banded Bicep Curl — 3 × 15-20
- Banded Tricep Pushdown — 3 × 15-20
- Dumbbell Skull Crusher — 3 × 10-12
- Single-Arm Shrug — 3 × 10-12
- Lateral Raise — 3 × 12-15

## Saturday 15 August — **Game Day** · Sunday 16 August — Rest Day

**What is wrong with this week:** 17 sets written as a range. 2 exercises this
athlete cannot do. 1 line with no dose. **Monday has no squat and two hinges**
(`Single-Leg RDL` and `RDLs`) — the two-hinge case Bible `:226` names as illegal,
and one of the two is the barbell lift he does not own. **Tuesday is two
exercises, one of which is impossible** — a one-exercise pull day in practice.

---

## W3 — Full gym, **pre-season**, two training days — **THE APP REFUSES**

*(Freshly driven this session, through the real onboarding door.)*

There is no week to print. The athlete is told:

> **We couldn't safely build your week from your current settings. Please review
> your availability, readiness and injury information.**

The reason, in the app's own words:

> *Safe weekly squat coverage was not restored by a later session.*
> *Safe weekly hinge coverage was not restored by a later session.*

**This happens with a full gym.** It is not about equipment. It happens with two
club nights and it happens with one.

---

## W4 — In-season, **no equipment at all**

*(`docs/printed-weeks/6-bodyweight-only.md`, regenerated byte-for-byte this
session.)*

## Monday 10 August — Training Day

**Lower Body Strength**

- Walking Lunges — 3 × 6-8
- Single-Leg RDL — 2 × 6-8
- Reverse Lunges — 3 × 6-8
- Glute Bridge — 2 × 6-8
- Band Pallof Press — 2 × 8-12  ⚠ **CANNOT BE DONE — needs bands.**
- RDLs — 3 × 6-10  ⚠ **CANNOT BE DONE — needs barbell.**

**Conditioning**

- Bodyweight Conditioning Circuit — 1 × 1  ⚠ **"1 × 1" IS NOT A PRESCRIPTION**

## Tuesday 11 August — Training Day

**Upper Pull**

- Face Pull — 2 × 10-20  ⚠ **CANNOT BE DONE — needs cables.**
- Pull-Ups — 3 × 6-10  ⚠ **CANNOT BE DONE — needs pullup_bar.**

**Team Training** — *(the club runs this one)*

## Wednesday 12 August — Training Day

**Accessories**

- Side Plank — 30-45s
- Cossack Squat — 3 × 6-8
- Scap Push-Up — 2 × 10-15
- Single-Leg Calf Raise — 3 × 12-15

## Thursday 13 August — Training Day

**Upper Push**

- Push-ups — 3 × 8-15
- Overhead Press — 3 × 6-10  ⚠ **CANNOT BE DONE — needs barbell + rack.**

**Team Training** — *(the club runs this one)*

## Friday 14 August — Rest Day · Saturday 15 — **Game Day** · Sunday 16 — Rest Day

**What is wrong with this week:** **5 of the 19 exercises are impossible.**
Tuesday's entire pull day is two exercises and neither can be done — the athlete
opens the app and there is nothing there. Thursday is one real exercise plus one
impossible one. Under R-083 the removal itself is correct; **these rows were not
removed, they were printed.**

---

## W5 — Early off-season, no club, full gym

*(`docs/printed-weeks/1-early-off-season.md`, regenerated byte-for-byte this
session.)*

## Monday 10 August — Training Day

**Full Body Strength**

- Deadlift — 3 × 8-12
- Pull-Ups — 3 × 8-12
- Nordic Lower — 2 × 3-5
- Face Pull — 2 × 10-20
- Band Pallof Press — 2 × 10-12

## Tuesday 11 August — Training Day

**Upper Push**

- Overhead Press — 3 × 8-12
- DB Bench Press — 3 × 10-20
- Lateral Raise — 2 × 10-20

## Wednesday 12 August — Rest Day

## Thursday 13 August — Training Day

**Lower Squat**

- Back Squat — 3 × 8-12
- Deadlift — 3 × 8-12
- Walking Lunges — 3 × 10-20
- Single-Leg RDL — 2 × 10-20
- Leg Extension — 2 × 10-20

## Friday 14 August — Training Day

**Conditioning**

- Warm-up — 1 × 1  ⚠ **"1 × 1" IS NOT A PRESCRIPTION**
- Short Flush — 1 × 1  ⚠ **"1 × 1" IS NOT A PRESCRIPTION**

## Saturday 15 August — Rest Day · Sunday 16 August — Rest Day

**What is wrong with this week:** 13 sets written as a range. 2 lines with no
dose. **This is the strongest week in the corpus** — Thursday carries a squat, a
hinge, a single-leg knee and a single-leg hip movement, which is Sam's ladder in
order.

---

## W6 — Away trip

Not embedded, to keep this readable: **`docs/printed-weeks/5-away-trip.md`**,
regenerated byte-for-byte this session. 3 findings, all of them `1 × 1`
(`Short Flush`, `Warm-up`, `Warm-up`). No impossible exercise; the away flow
holds.

---

# DISAGREEMENTS WITH PREVIOUSLY REPORTED FIGURES

**Everything in the 1C-A identity table reproduced exactly** — 174 built / 6
refused, 126 deficient of 318 laddered days, kit-blocked 86, `test:ladder-wide`
10/11, `print:week` 16 findings, the same six refused worlds name for name. **No
disagreement.** Below are the four places where something previously written no
longer matches what the code does.

| # | Previously reported | Measured now | |
| --- | --- | --- | --- |
| 1 | `ladderCoverageWideCensusTests` header: *"laddered days 216 · DEFICIENT: 50 of 216 (23%) in 5 distinct shapes"*, and a later note *"LOWERED 50 → 36 … of the SAME 216 laddered days"* | **318 laddered days, 126 deficient, 5 distinct shapes** | **The header's prose is stale.** The corpus was widened (216 → 318) and the ceiling now stands at 88 with 126 against it. The suite's executable numbers are current; its narrative is not. |
| 2 | Same header: **"`Upper` days are clean at HEAD."** | **34 of the 126 deficient days are `Upper Push` / `Team Training + Upper Push`, all `missing=[arm_or_shoulder]`** | **This claim is now false.** It was true when written and the corpus widening broke it. It matters because it told the next reader the composer's job was one session kind. |
| 3 | Findings ledger: *"`Band Pallof Press` is in no pool at all, so no pool-layer fix can ever reach it; only the equipment sheet can."* | **Confirmed, and it is bigger than one row.** 8 further rows are delivered into a `(slot, role)` whose pool does not contain them (§5.3), and 11 more are outside every pool. | Widened, not contradicted. |
| 4 | Findings ledger: *"Some route into a generated week never calls `applyPoolRotation` — `RDLs` arrives unrewritten though the pool answers `Single-Leg RDL`."* | **Confirmed and named.** `RDLs` is the **projection's** rendering of a row stored as `Romanian Deadlift` (§2.2, §6). The stored spelling is what the pool and the equipment gate see. | The mechanism is now identified: a rename between the store and the screen, not a missed rotation call. |

---

# NOT MEASURED, AND WHY

1. **The planner's own requested session count, compared against what was
   composed.** With the AI severed, every planned day is built by
   `completeCoachWorkoutsFromPlan`, which warns with the full list of days it had
   to build — I tried to read the planner's request out of that warning. **It
   fires per repair candidate, not per microcycle**: 20 worlds emitted between 28
   and 184 warnings for 4 microcycles, so the k-th warning is not the k-th week
   and any number taken that way would be an artefact. Reading the plan a second
   way (rebuilding `coachingInputs` outside `generateProgramLocally`) would have
   been a second authority judging a world the builder never saw. **§1.4 uses the
   athlete's own answer instead**, which is a weaker but honest denominator.
   *(A first pass of this probe DID pool the warnings and reported 16 worlds
   dropping planned days. That number was wrong and is retracted here rather than
   quietly corrected.)*

2. **Whether the missing Friday is law or defect.** §1.4 measures that 112 worlds
   give the athlete less than they asked for and names the exact shape. Which
   owner decided it — the allocation, the phase policy or the composer — is not
   established, and I did not read production code to guess.

3. **Whether the UI can produce a pre-season or in-season athlete with no club
   nights.** `completeOnboarding()` refuses `teamTrainingDays: []` for those
   phases (`onboardingSteps.ts:127`, `filled()` requires a non-empty array), so
   the 90 `noclub` pre/in-season worlds in the sweep may be worlds the onboarding
   door cannot produce. The generator builds them; the onboarding door refuses
   them. **Whether a screen offers a "none" answer that satisfies the check is
   not measured.**

4. **Whether the range-versus-midpoint difference reaches the athlete's day
   screen.** `DayWorkoutScreenV2` runs its numbers through `displayReps` and the
   projection does not. **The two surfaces disagree** — that is measured. Which
   one an athlete sees more often is a UI question and needed a device pass this
   slice does not have.

5. **Any coach-initiated or athlete-initiated change.** The mission's slice 2 and
   3 are not started; nothing here touches authorship or the loop.

---

# MEASURED DEFECTS BY OWNER

Each line: **defect → instrument → current number.**

## COMPOSER-OWNED

| # | Defect | Instrument | Number |
| --- | --- | --- | --- |
| C1 | A lower day is built with no squat in it | `test:ladder-wide` · 180-world probe | **74 of 318 laddered days** |
| C2 | Two heavy hinges are placed in one session — Bible `:226`'s named illegal case | `test:ladder-wide` | **52 of 318 laddered days** |
| C3 | An upper push day carries no arm or shoulder work | `test:ladder-wide` | **34 of 318 laddered days** |
| C4 | A whole week goes by with an achievable pattern never trained | 180-world probe | **80 of 174 worlds** (squat 74, arm_or_shoulder 14) |
| C5 | A row the athlete's kit cannot do is placed in the week | 180-world probe, shown-name basis | **538 of 2,688 rows (20.0%)** |
| C6 | Laddered days ship too few rows to cover a five-slot ladder | `test:ladder-wide` · 180-world probe | **130 of 318 laddered days ship ≤3 rows** (54 ship 2, 76 ship 3) |
| C7 | The rotation never reaches a pool because the row it ships is not a pool member | 6-block variety probe | **8 rows across 4 classes**; **16 pool entries never delivered** in 24 weeks |
| C8 | A pool entry is eligible and never selected across 6 blocks, inside a class the composer DOES draw from | 6-block variety probe | **5 entries** (47 of 52 delivered); `isolation_upper/anchor` froze on `Shrugs` |
| C9 | A two-day pre-season week with a club night cannot be built at all | 180-world probe · onboarding probe | **6 of 180 worlds refuse**; both blocking findings are squat and hinge restoration |
| C10 | Nothing the athlete did over five weeks changed what they were next given | `sim:changeover` | **5 of 5 athletes get an identical week 5** (one MD5) |

## PROJECTION / PRESENTATION-OWNED

| # | Defect | Instrument | Number |
| --- | --- | --- | --- |
| P1 | Sets are printed as a range where the Bible says one middle number | `print:week` | **99 sets across 6 weeks** |
| P2 | A conditioning row prints as `1 × 1`, which is not a dose | 180-world probe · `print:week` | **144 of 2,688 rows**; 9 of 16 printed findings |
| P3 | The projection renames a row on the way to the screen, so the name checked is not the name shown | agreement probe · 180-world probe | **3 names, 394 rows**; **2 of 7 days disagree** per world |

## PERSISTENCE-OWNED

**None measured.** Prescriptions, day structure, session names and row membership
agreed between the stored program and the projection on all 14 days examined
(§6). Every `sim:changeover` session reached storage: 0 refusals, 0 throws, 0
rollover problems across 139 recorded sessions.

## TEST-INSTRUMENT-OWNED

| # | Defect | Instrument | Number |
| --- | --- | --- | --- |
| T1 | `ladderCoverageWideCensusTests`'s header states a corpus and a deficient count the suite no longer produces | reading the suite against its own run | header says **216 days / 50 deficient**; the run says **318 / 126** |
| T2 | The same header asserts *"`Upper` days are clean at HEAD"* | `test:ladder-wide` | **34 deficient upper days** |
| T3 | `completeCoachWorkoutsFromPlan` warns *"AI omitted weekly plan days"* on every build now that the AI is severed, and fires per repair candidate — it cannot be read as a per-week planner receipt | 180-world probe | **28–184 warnings for 4 microcycles** in 20 worlds |

## OWNER NOT ESTABLISHED

| # | Defect | Instrument | Number |
| --- | --- | --- | --- |
| U1 | A requested training day carries no work at all | 180-world probe | **112 of 174 worlds** on a non-game day; 96 have no session, 16 have a zero-row `Rest` |
| U2 | 10 of 68 row names in the corpus are absent from the equipment sheet, so the availability gate cannot refuse them | 180-world probe | **10 names, 664 rows** |
| U3 | The generator builds pre/in-season athletes with no club nights; the onboarding door refuses to create one | 180-world probe · onboarding probe | **90 of 180 sweep worlds** are in that shape |

---

# THE COMPOSER-OWNED DEFECTS — the list on its own

*This is the job specification. Nothing else in this document is the composer's.*

1. **C1 — a lower day with no squat: 74 of 318 laddered days.**
2. **C2 — two heavy hinges in one session: 52 of 318 laddered days.**
3. **C3 — an upper push day with no arm or shoulder work: 34 of 318 laddered days.**
4. **C4 — an achievable pattern untrained for a whole week: 80 of 174 worlds.**
5. **C5 — a row the kit cannot do, placed in the week: 538 of 2,688 rows (20.0%).**
6. **C6 — three or fewer rows into a five-slot ladder: 130 of 318 laddered days.**
7. **C7 — rows shipped from outside the pool, so rotation cannot reach them: 8 rows, 16 pool entries never delivered in 24 weeks.**
8. **C8 — eligible pool entries never selected across 6 blocks: 5 entries.**
9. **C9 — a two-day pre-season week with a club night cannot be built: 6 of 180 worlds refuse.**
10. **C10 — five weeks of different training produce an identical next week: 5 of 5 athletes.**
