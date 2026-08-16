# G-2, THE DOSE, AND THE CONTRACT TABLE — 2026-08-16, seat `core`

Branch `slice-weekly-scheduler`. Worktree-isolated. **No merge.** Planner deleted.

---

## 0. THE HEADLINE — **FRIDAY VIOLATED THE CONTRACT. YOU WERE RIGHT TO ASK.**

The week I offered as coach-ready put **Deadlift and Bulgarian Split Squats on
Friday**, which is G-2 for a Sunday fixture. §3: *"G-2 — **No** heavy lower-body or
added speed work."*

**The rule existed in code only as a −25 score.** A week short of legal days simply
paid the penalty and placed the lower session anyway. A rule a placement can buy
its way past is a preference, and the contract does not word this one as one.

It is **legality** now, and the world I showed you **no longer builds** — it
returns a typed refusal, which is the outcome you sanctioned.

---

## 1. THE NINE DISAGREEMENTS — RESOLVED BY THE CONTRACT

The deleted planner is not an authority anywhere below; every verdict cites the
approved source. **Two rows were my own defects and are FIXED. The rest are
decided. No row needs you.**

| # | world / input | old | scheduler | approved-contract clause | verdict |
| --- | --- | ---: | ---: | --- | --- |
| 1 | In-season, low cap, 0–3 club, 3–6 days, game (12 worlds) | target 2–3 | core **4** | §Selection: 2 gym days → Option 3 (2 sessions); 3 → Option 1 (3) | **BOTH WRONG — my bug.** `coreSessions` counted every core-tier DAY, incl. authored rest, the fixture and club nights, against a target expressed in *strength sessions*. **FIXED** — counted off the typed identity. |
| 2 | In-season, 2 club, 5 days, high capacity (H-IS-3) | 3 | 4 | §Selection: *"Option 2 when the athlete is 27 or younger, or … consistently complete Option 1 comfortably with high readiness and low fatigue"* | **RESOLVED by row 1's fix** — the count was inflated, not the layout. Now 3. |
| 3 | In-season, low cap, game week (safety rail) | 3 | 4 | §Selection: *"Low readiness never triggers Option 2"* | **RESOLVED by row 1's fix.** Now 3. |
| 4 | Pre-season, 5–6 days, ±club, game | 3 | **4** | §Weekly layouts, Pre-season 5–6: ***"Four required strength sessions: Upper ×2 + Lower ×2."*** | **SCHEDULER CORRECT.** The contract says four. §18's target of 3 is the wrong number and is the thing to change. |
| 5 | Pre-season, 2 club, 5 days, high cap (B3) | 3 | **4** | Same clause as row 4 | **SCHEDULER CORRECT.** Identical cause. |
| 6 | Pre-season, 4 days | 3 | **4** | §Weekly layouts, Pre-season 4: *"Upper ×2 + Lower ×2."* | **SCHEDULER CORRECT.** Four. |
| 7 | Off-season early, all capacities, 3–6 days, no game (12 worlds) | max 4 | built **5** | §Global: ***"Hard-day total — Prefer 4 hard days; allow 5. … The app does not program 6."*** Also §Tensions: *"Maximum 4 hard days versus permission for 5 → Prefer 4; allow 5."* | **SCHEDULER CORRECT, SUITE'S PREMISE WRONG.** The contract is deliberately a *two*-number rule; the cell demands built == contract == §18 be "one number". §18's permitted maximum should be **5**, preference 4. This is causing real off-season refusals. |
| 8 | Club day the athlete did not select | contract 1 | counted **5** | §Anchors: club nights are the athlete's declared facts (WC-062); §18 anchors are the authority | **SCHEDULER WRONG.** `demand.hardDays` counts `clubNights`/`gameDay` off the raw scheduler inputs, not the contract's filtered anchors. |
| 9 | Off-season profile with a stale onboarding game day | contract 0 | counted **3** | Same clause | **SCHEDULER WRONG.** Same cause: a stale profile fixture is counted as a hard day although the contract carries no such anchor. |

**Summary: 3 fixed this session (1–3), 3 decided in the scheduler's favour with
§18 to be corrected (4–7), 3 decided against the scheduler (8–9 plus the
"committed hard days" cell, one defect). Zero rows escalate.**

The two remaining code changes — §18's pre-season target and hard-day maximum, and
counting anchors from the contract rather than the raw profile — are **specified
above but not implemented**: this session's budget went to the G-2 violation, and
I will not ship an unverified change to hard-day counting.

---

## 2. FRIDAY — THE COMPLETE DOSE, NOT A SUMMARY

### 2a. The world you were shown now REFUSES

    ANCHOR WORLD — Sunday game, gym Mon/Wed/Fri/Sat, club Wed+Fri

    TYPED REFUSAL: no_legal_arrangement_within_spacing_rules (WC-043)
      "WC-100 could not place 2 session(s) on 2 legal day(s) without
       breaking lower spacing or the consecutive-plane rule"

Why: Monday is **G+1**, Saturday is **G-1**, Friday is **G-2**. That leaves
Wednesday alone for a two-session layout. **This athlete's gym availability cannot
support a program alongside a Sunday fixture** — and saying so is the correct
answer, not placing Lower on a recovery day to keep the count.

### 2b. A world that DOES build, printed in full, G-2 proved

In-season · Saturday game · gym Mon/Tue/Wed/Thu · club Tue+Thu

| Day | G | Type | Exercise | Role | Sets | Reps | Load |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| Sun | G+1 | Rest | — | | | | |
| Mon | G-5 | Mixed | Back Squat | main | 3 | 2–4 | RPE-led |
| | | | Deadlift | main | 3 | 2–4 | RPE-led |
| | | | Bulgarian Split Squats | accessory | 3 | 6–8 | RPE-led |
| | | | Single-Leg RDL | accessory | 3 | 6–8 | RPE-led |
| | | | Ab Wheel | accessory | 2 | 8–12 | bodyweight |
| | | | Continuous Aerobic Run | conditioning | 1 | 30–50 min | `aerobic_base`, **offFeet=true, modality=bike** |
| Tue | G-4 | Team Training | Barbell Row | main | 3 | 4–6 | RPE-led |
| | | | Lat Pulldown | accessory | 3 | 8–10 | RPE-led |
| | | | Band Pull-Apart | accessory | 2 | 8–10 | band |
| | | | 30:30 Controlled Tempo Blocks | conditioning | 13 | — | `tempo`, modality=bike |
| Wed | G-3 | Rest | — | | | | |
| **Thu** | **G-2** | **Team Training** | **Bench Press** | **main** | **3** | **3–5** | RPE-led |
| | | | **DB Shoulder Press** | **accessory** | **3** | **8–10** | RPE-led |
| | | | **Banded Bicep Curl** | **accessory** | **2** | **8–10** | band |
| | | | **30:30 Controlled Tempo Blocks** | **conditioning** | **13** | — | **`tempo`, modality=row** |
| Fri | G-1 | Rest | — | | | | |
| Sat | GAME | Game | — | | | | |

**G-2 PROOF, item by item:**

- **No heavy lower-body.** Every G-2 row is upper: horizontal press, vertical
  press, elbow flexion. No squat, hinge, single-leg or lower accessory.
- **No added speed work.** The conditioning category is **`tempo`**, not `sprint`.
  The contract's own vocabulary separates the two, and `sprint` appears nowhere on
  this day.
- **No jumping, plyometric or lower-body power.** No power primer on G-2 at all in
  this week; the scheduler marks the day power-ineligible for any lower family.
- **Zero running impact.** The tempo block resolves to **row** — off the feet
  entirely, two days before the game.
- **Loads read RPE-led** rather than as kilograms: this generation path prescribes
  sets/reps/intensity guidance, not absolute weights. Stated plainly rather than
  presented as a load table with blanks.

---

## 3. WORLD ACCOUNTING — THE COST IS LARGE AND IT IS REAL

    before this session   140 built /  40 refused   (90 setups, 20 refuse)
    after G-2 enforced     80 built / 100 refused   (90 setups, 50 refuse)

The 60 lost occurrences are 30 setups: every **2-day** world, and **Pre/Off-season
4-day** worlds, whose gym access cannot avoid G-2. **They were building an illegal
week before.** A typed WC-043 refusal is the sanctioned outcome.

⚠ Worth naming: the corpus gives **Off-season** a Saturday fixture, which is
artificial — a real off-season has no game, so some of those refusals are a fixture
artefact rather than an athlete who would ever exist.

---

## 4. REMAINING REDS

    full sweep   93 red — 0 newly red, 0 newly green vs the last sweep
    typecheck    35 file/scope pairs worse, ALL [tests]
                 ZERO product, ZERO devtools

    scheduler 84/84 · anchors 12/12 · weekday-index 85/85 · cyclic 124/124
    readiness-dose-sweep GREEN · readiness-structure-law 100/100

| red | state |
| --- | --- |
| `test:weekly-dose-ownership` | rows 4–9 above; **all contract-decided, two fixes specified, not implemented** |
| `test:rules-kernel` | 1 cell — unclassified ("other") units in the live week |
| 91 others | unchanged from the pre-deletion rollback point; not investigated |
| 35 test files | reference symbols the deletion removed |

**Two suites moved this session, neither weakened.** The anchor fixture went
Sunday → Monday game (its subject is anchors, not G-2; club stays Wed/Fri). The
scheduler suite's G-2 world *no longer exists* — it was built purely to put a lower
day on G-2 — so the cell now asserts the **stronger** fact that a lower purpose
cannot reach G-2 at all. **No threshold, floor, ceiling or baseline was reset.**

---

## 5. MERGE RECOMMENDATION — **DO NOT MERGE**

Not because of a disagreement needing your ruling — there isn't one left — but
because **G-2 enforcement halved the corpus**, and the two §18 corrections that
would restore much of it (rows 4–7: pre-season target 4, hard-day maximum 5) are
**specified and unimplemented**. Merging now would ship a correct rule alongside
§18 numbers the contract contradicts, and refuse 50 of 90 athletes.

**The next slice is those two §18 numbers plus the contract-anchor counting in
rows 8–9.** I expect that to recover most of the 30 lost setups; the genuine
G-2 collisions (2-day athletes whose only days straddle the fixture) should stay
refused.

Agent: core
