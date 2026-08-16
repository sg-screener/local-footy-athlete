# CONDITIONING CREDIT, SET ACCOUNTING AND THE TWO-SESSION FLOOR — 2026-08-16

Seat `core`. Branch `slice-weekly-scheduler`. Worktree-isolated. Planner deleted.
No other work.

---

## 1. THE APP NO LONGER ADDS CONDITIONING TO RAISE A COUNT

Conditioning was attached to **every** strength day unconditionally. Your athlete —
two club nights plus a Sunday fixture, already at WC-045's floor of three — was
given a bike on Wednesday and a rower on Friday purely to raise a number that was
already met. **That is training load with no rule asking for it.**

WC-045: *"club training and games count"*. Bible §18 C: *"Add only the remaining
requirement after genuine anchor credit."*

Anchor credit is now spent first and the app supplies only the shortfall, in day
order so the answer does not depend on which day the loop reaches first.

    Sunday world:  anchors = 3   core conditioning = 3   app conditioning days = 0

Both required blocks are gone. **Optional recovery is untouched by this change** —
it was never part of the required base week and is not counted toward it.

---

## 2. THE SET ACCOUNTING WAS WRONG, AND IT COULD NOT HAVE BEEN RIGHT

Every non-main row arrived as a bare `strength_accessory`. Nothing downstream could
tell a secondary **compound** holding a movement slot (Bulgarian Split Squats, Lat
Pulldown) from **core or band isolation** holding none (Ab Wheel, Band Pull-Apart).
Counting them alike inflated every session's total against the WC-030 ceiling.

The composer knew the slot all along — it was dropped at materialisation. It now
travels, and `slotCountsTowardSetBudget` is the single predicate.

| day | main/secondary sets | outside the budget |
| --- | ---: | --- |
| Wednesday | **12** (was reported 14) | Ab Wheel, 2 sets |
| Friday | **10** (was reported 12) | Band Pull-Apart, 2 sets |

Both against the hard ceiling of 16.

---

## 3. THE TWO-SESSION FLOOR IS A RULE NOW, NOT AN OBSERVATION

The census showed the ladder never lands on one session. **"It does not happen" is
not "it cannot happen."**

`test:clause-enforcement` section [10]: 3 phases × 3 fixture days × 4 day-sets, with
a non-vacuity arm requiring at least 10 accepted weeks, plus a cell keeping the
early-off-season exception (WC-130, *"zero completed is valid"*) reachable.

    MUTATION: force a single-session rung  ->  5+ cells RED

---

## 4. THE WEEK

In-season · gym Mon/Wed/Fri/Sat · club Wed+Fri · recurring Sunday fixture

| Day | G | Type | Exercise | Sets × Reps | Load | In budget? |
| --- | --- | --- | --- | --- | --- | --- |
| Sun | GAME | Game | — | | | |
| Mon | G+1 | Rest | — | | | |
| Tue | G-5 | Rest | — | | | |
| **Wed** | **G-4** | Team Training | Back Squat | 3 × 2–4 | RPE-led | counts |
| | | | Deadlift | 3 × 2–4 | RPE-led | counts |
| | | | Bulgarian Split Squats | 3 × 6–8 | RPE-led | counts |
| | | | Single-Leg RDL | 3 × 6–8 | RPE-led | counts |
| | | | Ab Wheel | 2 × 8–12 | RPE-led | outside |
| | | | *no app conditioning — club training supplies it* | | | |
| Thu | G-3 | Rest | — | | | |
| **Fri** | **G-2** | Team Training | Bench Press | 3 × 3–5 | RPE-led | counts |
| | | | Barbell Row | 3 × 4–6 | RPE-led | counts |
| | | | DB Shoulder Press | 2 × 8–10 | RPE-led | counts |
| | | | Lat Pulldown | 2 × 8–12 | RPE-led | counts |
| | | | Band Pull-Apart | 2 × 12–15 | RPE-led | outside |
| | | | *no app conditioning — club training supplies it* | | | |
| Sat | G-1 | Rest | — | | | |

**Wednesday 12 sets · Friday 10 sets · ceiling 16 · Friday carries no lower-body
row and no added speed work.**

Disclosure surviving to the program boundary
(`microcycle.exposureContract.reductions`):

    3 -> 2   Game-day, G-1 and G+1 protection leave fewer safe gym placements
    2 -> 2   1 lower session offered as upper instead — the remaining legal day(s)
             may not hold heavy lower work two days before the game
             (omitted as authored: full_body)

---

## 5. THE 180 WORLDS

| | occurrences | setups |
| --- | --- | --- |
| built | **140** | **70** |
| refused | **40** | **20** |
| lost | **0** | 0 |
| gained | **0** | 0 |

Unchanged, as expected — this session removed surplus content and corrected
accounting; it was not meant to move a world. Refusal families unchanged: 20
`main_strength_planner_selected_target`, 16 `hard_day + main_strength ceiling`,
4 `hard_day` — all bodyweight-only or off-season, both out of scope.

**Delivered strength sessions across the 140 built worlds:** 2 → 72 worlds,
3 → 52, 4 → 16. **One-session weeks: 0.**

---

## 6. GATES

    clause-enforcement    136/136 cells     weekly-scheduler    84/84 cells
    anchor-survival        12/12 cells      weekday-index       85/85 cells
    readiness-dose        105/105 cells     cyclic-proximity   110/110 cells
    weekly-dose-ownership  22/23 cells (1 red)

    full sweep     93 of 414 SUITES failing — 0 newly red, 0 newly green
    test:compile   35 file/scope PAIRS worse, ALL [tests]; zero product, zero devtools

**No threshold, floor, ceiling, ratchet or baseline was reset.**

⚠ **`cyclic-proximity` fell 124 → 110 cells.** Zero failures, and both non-vacuity
arms still bite — but there are genuinely fewer conditioning pairings left to
assert against now that the app adds none where anchors already cover the floor.
**The coverage is smaller and that is a real cost of this change**, stated rather
than left looking like an unchanged pass.

The one remaining red cell is the pre-existing *"hard-day maxima are one number"*
(built 5, contract 4, §18 4). The approved source is explicit that this is
deliberately two numbers — *"Prefer 4 hard days; allow 5"* — so the cell's premise
is what needs changing, not the code. Out of scope, untouched.

---

## 7. MERGE RECOMMENDATION — **MERGE**

You have approved the strength layout, and this session applied the three
corrections you asked for on top of it. Every engineering blocker I raised on this
branch is closed:

- legacy planner deleted and provably unreachable;
- anchors survive to the athlete's week, guarded on all seven weekdays;
- game proximity cyclic — a Sunday fixture protects Monday;
- G-2 enforced as a prohibition, mutation-proved, and it cannot be bought;
- 16 of 20 prohibitions in one legality owner, each proven to bind;
- constrained athletes get the best smaller legal week, and it says what it gave up;
- no surplus conditioning, correct set accounting, and a two-session floor.

**One caveat I will not bury:** 93 of 414 suites still fail, unchanged from the
pre-deletion rollback point, and 35 test files still reference deleted symbols.
None is a regression from this branch — the sweep has shown 0 newly red at every
step — but they are real debt and merging carries them forward.

Agent: core
