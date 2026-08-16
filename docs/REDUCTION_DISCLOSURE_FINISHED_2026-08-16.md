# THE REDUCTION DISCLOSURE, FINISHED — 2026-08-16, seat `core`

Branch `slice-weekly-scheduler`. Worktree-isolated. Planner deleted.
No unrelated fixes; bodyweight/off-season refusal families untouched.

---

## 1. THE TYPED REDUCTION RECORD REACHES THE PROGRAM

`WeeklyReductionRecord` carries all four facts Sam asked for.

    intendedStrengthCount -> deliveredStrengthCount -> omittedPurpose -> reason

Observed at the normal program boundary,
`microcycle.exposureContract.reductions`, for the Sunday-fixture athlete:

    { domain: 'main_strength', reason: 'spacing_safety_conflict',
      metric: 'weekly_exposure_count', from: 2, to: 2,
      detail: '1 lower session(s) offered as upper instead — the remaining legal
               day(s) may not hold heavy lower work two days before the game
               (omitted as authored: full_body)' }

**Projection was not redesigned.** The record travels the contract's existing
`reductions` ledger, which the microcycle already carried.

### Two things had to be corrected to get it there

- **A bare string could not say what this week gives up.** The Sunday week delivers
  the SAME count it authored — nothing is dropped — but a lower session is served as
  upper because G-2 may not hold heavy lower. **A count-only ledger records that as
  "no reduction"**, which is exactly the silent omission the field exists to
  prevent. The omitted purpose is now its own typed field.
- **`withExposureTarget`'s silence looked like success.** It early-returns when
  `target >= required`, and for these weeks `required` was already at or below the
  delivered count — so it wrote nothing and the lowered target stood unexplained.
  **The reduction is a statement about the TARGET, not about the floor.** The entry
  is now written from the authored count regardless, deduped against the V1
  builder's own entries so a week never discloses the same fact twice in different
  words.

    test:weekly-dose-ownership   2 red -> 1 red of 23 cells

---

## 2. STRENGTH-COUNT CENSUS — **NO STOP CONDITION**

All 140 built worlds, counting days that actually **delivered** a `main_strength`
row (the declared role, not the workout's name):

| delivered strength sessions | worlds |
| ---: | ---: |
| 2 | 72 |
| 3 | 52 |
| 4 | 16 |
| **1** | **0** |

**Unauthorised one-session weeks (non-early-off-season): 0.**

The ladder's last rung descends to a single session but **never lands there** in
any world in the corpus. 114 of 140 built worlds carry a main-strength reduction
record.

---

## 3. THE SUNDAY-GAME WEEK, COMPLETE

In-season · gym Mon/Wed/Fri/Sat · club Wed+Fri · recurring Sunday fixture
Scheduler: authored 2, delivered 2, omitted purpose `full_body`.

| Day | G | Type | Exercise | Role | Sets × Reps | Load |
| --- | --- | --- | --- | --- | --- | --- |
| Sun | GAME | Game | — | | | |
| Mon | G+1 | Rest | — | | | |
| Tue | G-5 | Rest | — | | | |
| **Wed** | **G-4** | Team Training | Back Squat | main | 3 × 2–4 | RPE-led |
| | | | Deadlift | main | 3 × 2–4 | RPE-led |
| | | | Bulgarian Split Squats | accessory | 3 × 6–8 | RPE-led |
| | | | Single-Leg RDL | accessory | 3 × 6–8 | RPE-led |
| | | | Ab Wheel | accessory | 2 × 8–12 | RPE-led |
| | | | Continuous Aerobic Run | conditioning | 1 block | `aerobic_base` · **offFeet, bike** · 30–50 min continuous, no rest |
| Thu | G-3 | Rest | — | | | |
| **Fri** | **G-2** | Team Training | Bench Press | main | 3 × 3–5 | RPE-led |
| | | | Barbell Row | main | 3 × 4–6 | RPE-led |
| | | | DB Shoulder Press | accessory | 2 × 8–10 | RPE-led |
| | | | Lat Pulldown | accessory | 2 × 8–12 | RPE-led |
| | | | Band Pull-Apart | accessory | 2 × 12–15 | RPE-led |
| | | | 30:30 Controlled Tempo Blocks | conditioning | 10–16 rounds | `tempo` · **rower** · 30 s on / 30 s easy |
| Sat | G-1 | Rest | — | | | |

### The two confirmations asked for

- **Wednesday set ceiling: 14 main/secondary sets against WC-030's hard ceiling of
  16. OK.** (Friday is 12.)
- **Friday G-2 lower-body rows: NONE.** Every row is upper — horizontal press,
  horizontal pull, vertical press, vertical pull, band. No squat, hinge, single-leg
  or lower accessory. Conditioning is `tempo`, not `sprint`, and resolves to a
  **rower** — off the feet entirely. No power primer.

Loads read **RPE-led**: this path prescribes sets, reps and intensity guidance, not
absolute kilograms.

---

## 4. THE 180 WORLDS

| | occurrences built | occurrences refused | setups built | setups refused |
| --- | ---: | ---: | ---: | ---: |
| start of session | 140 | 40 | 70 | 20 |
| end of session | 140 | 40 | 70 | 20 |
| **lost** | **0** | | | |
| **gained** | **0** | | | |

This session was disclosure work only; it was **not** expected to move a world and
did not. Refusal families unchanged: 20 `main_strength_planner_selected_target`,
16 `hard_day_permitted_maximum + main_strength_permitted_maximum`, 4
`hard_day_permitted_maximum` — all bodyweight-only or off-season ceiling, both out
of scope.

---

## 5. GATES

    clause-enforcement    107/107 cells     weekly-scheduler    84/84 cells
    cyclic-proximity      124/124 cells     anchor-survival     12/12 cells
    weekday-index          85/85 cells      readiness-dose      105/105 cells
    readiness-structure   100/100 cells     weekly-dose         22/23 cells (1 red)

    full sweep     93 of 414 SUITES failing — 0 newly red, 0 newly green
    test:compile   35 file/scope PAIRS worse, ALL [tests]; zero product, zero devtools

**No threshold, floor, ceiling, ratchet or baseline was reset.**

The single remaining cell in `weekly-dose-ownership` is the pre-existing
*"the built, contracted and judged hard-day maxima are one number"* — built 5,
contract 4, §18 4. The approved source is explicit that this is deliberately two
numbers (*"Prefer 4 hard days; allow 5"*), so the cell's premise is the thing to
change, not the code. Out of scope and untouched, as instructed.

---

## 6. MERGE RECOMMENDATION — **READY, SUBJECT TO YOUR COACHING JUDGEMENT**

Every engineering blocker I have raised on this branch is now closed:

- the legacy planner is deleted and provably unreachable;
- anchors survive to the athlete's week and are guarded on all seven weekdays;
- game proximity is cyclic, so a Sunday fixture protects Monday;
- G-2 is enforced as a prohibition, stricter than before, and cannot be bought;
- 16 of 20 prohibitions sit in one legality owner, each proven to bind;
- a constrained athlete now gets the best smaller LEGAL week instead of a refusal,
  and the week says what it gave up;
- 140 of 180 occurrences build, against a pre-branch baseline of 142 that were not
  contract-legal.

**What I cannot sign off is whether these are good training weeks.** That is the
one judgement left, and §3's printed week above is the place to make it.

Agent: core
