# BUILD THE BEST SMALLER LEGAL WEEK — 2026-08-16, seat `core`

Branch `slice-weekly-scheduler`. Worktree-isolated. **No merge.** Planner deleted.
**G-2 not weakened. No illegal week restored. No thresholds reset.**

---

## 0. RESULT

    180 worlds   80 built / 100 refused  ->  140 built / 40 refused
    GAINED 60 occurrences (30 setups)     LOST 0

**The entire `WC-043` refusal family is gone** — 60 occurrences across 30 setups.
The other three families are untouched, occurrence for occurrence.

Those 30 setups were never hard impossibilities. **They were failures to meet a
preferred session count, reported as impossibilities.**

---

## 1. THE REDUCTION LADDER

Tried in preference order; the **first legal rung wins**, so a full-count week is
always preferred to a substituted one, and a substituted one to a shorter one:

| rung | what it offers |
| --- | --- |
| 0 | the approved layout exactly as authored |
| 1 | same count, lower-ish purposes offered as `upper` where a constrained day can legally hold nothing else — fewest swaps first |
| 2+ | one fewer session at a time, down to a single session |

**Every rung is filtered by the same `assignmentIsLegal`.** Heavy lower still
cannot touch G-2; G-1 and G+1 stay closed. The ladder changes WHAT is offered,
never WHERE it may go — no prohibition was touched.

Refusal is now reserved for a true hard minimum: *"could not place even one
strength session… every arrangement breaks a prohibition."*

`authoredStrengthSessions` and `reductionDisclosure` are fields on the schedule, so
an omission is declared rather than silent.

---

## 2. IT IMMEDIATELY EXPOSED AN ILLEGAL DELIVERY — I NEARLY SHIPPED IT

The scheduler authored Friday `upper`. The athlete's Friday came out with
**Deadlift and Bulgarian Split Squats — heavy lower on G-2.** I had the printed
week in front of me as the proof of success.

**Cause:** R-093's full-body A/B pair is a **week-level** shape for the athlete
whose every gym night is a club night. It overrode the scheduler's per-day purpose.

**R-093 is a week shape; G-2 is a day prohibition; the prohibition wins on that
day.** R-093 now skips a day the scheduler explicitly typed `upper` — which it only
does when a prohibition leaves no alternative. Nothing R-093 decides for its own
athlete is narrowed: the displaced work moves earlier, it does not disappear.

### And that exposed a second one: a displaced pair is not a pair

With Friday forced upper, Wednesday stayed on the fixed A shape and the week
trained **no hinge at all** — refused `required_safe_patterns_present:hinge`.
R-093's shapes only work as a pair covering the body between them. When a
prohibition displaces one, the survivor reverts to **R-087 coverage** and fills
what the week is missing — which is what R-087 exists for, and is exactly
*"place lower/full-body work on the best earlier legal day"*.

---

## 3. THE SUNDAY-GAME WORLD, COMPLETE

In-season · gym Mon/Wed/Fri/Sat · club Wed+Fri · **recurring Sunday fixture**
Scheduler: `authored=2, delivered=2`, disclosure *"1 lower session offered as upper
— the remaining legal day(s) may not hold heavy lower work (G-2)"*.

| Day | G | Type | Exercise | Role | Sets × Reps |
| --- | --- | --- | --- | --- | --- |
| Sun | GAME | Game | — | | |
| Mon | G+1 | Rest | — | | |
| Tue | G-5 | Rest | — | | |
| **Wed** | **G-4** | **Team Training** | Back Squat | main | 3 × 2–4 |
| | | | Deadlift | main | 3 × 2–4 |
| | | | Bulgarian Split Squats | accessory | 3 × 6–8 |
| | | | Single-Leg RDL | accessory | 3 × 6–8 |
| | | | Ab Wheel | accessory | 2 × 8–12 |
| | | | Continuous Aerobic Run | conditioning | 30–50 min · `aerobic_base` · **offFeet=true, bike** |
| Thu | G-3 | Rest | — | | |
| **Fri** | **G-2** | **Team Training** | Bench Press | main | 3 × 3–5 |
| | | | Barbell Row | main | 3 × 4–6 |
| | | | DB Shoulder Press | accessory | 2 × 8–10 |
| | | | Lat Pulldown | accessory | 2 × 8–12 |
| | | | Band Pull-Apart | accessory | 2 × 12–15 |
| | | | 30:30 Controlled Tempo Blocks | conditioning | 13 blocks · `tempo` · **rower** |
| Sat | G-1 | Rest | — | | |

Loads read **RPE-led**: this path prescribes sets, reps and intensity guidance, not
absolute kilograms.

**G-2 (Friday) proof:** every row is upper — horizontal press, horizontal pull,
vertical press, vertical pull, band. No squat, hinge, single-leg or lower
accessory. Conditioning is `tempo`, not `sprint`, and resolves to a **rower** — off
the feet entirely. No power primer.

**Anchors preserved:** both club nights are Team Training with gym work on them;
the fixture is a Game. **All lower work consolidated onto Wednesday, the best
earlier legal day.**

---

## 4. WORLD ACCOUNTING

| | built | refused | lost | gained |
| --- | ---: | ---: | ---: | ---: |
| before | 80 | 100 | — | — |
| after | **140** | **40** | **0** | **60** |

Units: generation **occurrences** of 180 (90 setups × 2 run lengths).
Setups refusing: **50 → 20 of 90.**

### Refusal-family deltas

| family | before | after | delta |
| --- | ---: | ---: | --- |
| `no_legal_arrangement_within_spacing_rules` (WC-043) | 60 occ / 30 setups | **0** | **−60, eliminated** |
| `main_strength_planner_selected_target` | 20 occ / 10 setups | 20 / 10 | unchanged |
| `hard_day_permitted_maximum` + `main_strength_permitted_maximum` | 16 occ / 8 setups | 16 / 8 | unchanged |
| `hard_day_permitted_maximum` | 4 occ / 2 setups | 4 / 2 | unchanged |

The 20 remaining setups are the bodyweight-only strength target and the off-season
ceiling families — **neither is a spacing or game-proximity refusal**, and both were
out of scope.

---

## 5. GATES

    clause-enforcement    107/107 cells     weekly-scheduler    84/84 cells
    cyclic-proximity      124/124 cells     anchor-survival     12/12 cells
    weekday-index          85/85 cells      readiness-dose      105/105 cells
    weekly-dose-ownership  21/23 cells (2 red)

    full sweep     93 of 414 SUITES failing — 0 newly red, 0 newly green
    test:compile   35 file/scope PAIRS worse, ALL [tests]; zero product, zero devtools

**No threshold, floor, ceiling, ratchet or baseline was reset.**

### ⚠ One red I introduced and did NOT finish

`the contract records every target it lowers` — pre-season reduced weeks report
`target=2 vs 4, unexplained`. A reduced week must record its reduction in the
contract's own ledger, and I wired `withExposureTarget` to do exactly that, but the
entry is not landing for those worlds.

**I ran out of cap to find out why rather than guess**, and guessing at a ledger
entry is how a reduction becomes invisible. It is named here, not papered over.
The second red — *"hard-day maxima are one number"* — is the pre-existing "prefer 4,
allow 5" item, deliberately untouched.

---

## 6. MERGE RECOMMENDATION — **DO NOT MERGE YET, and the gap is now small**

The product blocker I raised last session is **closed**: the 30 setups that were
being refused now receive a legal reduced week, with G-2 enforced more strictly
than before, not less. 140 of 180 matches the pre-G-2 baseline of 142 within 2
occurrences — and those 140 are now contract-legal, which the old 142 were not.

**One thing stands between here and merge:** the unexplained-reduction red above.
A reduced week that does not declare its reduction is exactly the silent-omission
shape this slice exists to remove, so it should not ship. It is a contained,
well-localised fix.

Agent: core
