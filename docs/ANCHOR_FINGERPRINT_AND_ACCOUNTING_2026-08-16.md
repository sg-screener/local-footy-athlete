# ANCHOR FINGERPRINT, ACCOUNTING AND GATES — 2026-08-16, seat `core`

Branch `slice-weekly-scheduler`. Worktree-isolated. **No merge.** The legacy
planner stays deleted.

---

## 1. THE OFF-BY-ONE — **IT DOES NOT EXIST. THE INPUT WAS MISREAD.**

Reported: *"INPUT: Tuesday/Thursday club, Saturday game. FINAL: Wednesday/Friday
club, Sunday game."*

**The fixture declares Wednesday/Friday club and a SUNDAY game.** Tue/Thu/Sat is
the *older* corpus world (`scripts/probe-planner-callers.ts`, and every report
before `e66b4868`). The anchor fixtures were deliberately moved off it so the
guards could not pass on the app's historical default weekdays — that change is in
the WS-13 commit message. **Input and output agree; there is nothing to fix.**

### Traced anyway, because "I read it" is not a measurement

`scripts/probe-anchor-fingerprint.ts`. Week start `2026-07-13` (a Monday).

| boundary | club anchors | game anchor | index/date |
| --- | --- | --- | --- |
| 1 scheduler | Wednesday(3), Friday(5) | Sunday(0) | ok |
| 2 connector | Wednesday(3), Friday(5) | Sunday(0) | ok |
| 3 adapter | Wednesday(3), Friday(5) | Sunday(0) | ok |
| 4 assembled | Wednesday(3), Friday(5) | Sunday(0) | ok |
| 5 stored | Wednesday(3), Friday(5) | Sunday(0) | ok |
| 6 projection | Wednesday(3), Friday(5) | Sunday(0) | ok |

    index/date disagreements: 0

Per row it prints ISO date, displayed weekday, numeric `dayOfWeek`, typed
identity and anchor kind, and **cross-checks the index against the weekday the
ISO date genuinely falls on** — so a shift applied consistently at both ends still
shows. Full dates: Mon `2026-07-13` … Sun `2026-07-19`.

> ⚠ The probe's first output printed "six club nights" and warned of an anchor
> defect. **That was a probe artefact** — boundaries 1 and 2 are entered more than
> once per generation. Deduped by weekday. A probe that manufactures findings is
> worse than no probe.

### The guard the order actually wanted — `test:weekday-index`, 85 cells

The fixture walks **all seven weekdays** with the club nights walking with it,
asserting the anchor lands on the declared index, that the index's ISO date really
is that weekday, that no anchor appears on an undeclared day — plus a non-vacuity
arm requiring all 7 rotations to **build** (7/7 do).

**Mutation receipts — and why one suite was not enough:**

    whole DAY_NAMES rotated by one
      anchor-survival   12 -> 8/12    caught
      weekday-index     85 -> 58/85   27 red

    Tuesday <-> Thursday swapped ONLY
      anchor-survival   12/12 GREEN   <- INVISIBLE (both are rest days there)
      weekday-index     78/85         7 red

The second is the justification: **a single-fixture guard is a guard against a
single weekday.**

---

## 2. REFUSAL ACCOUNTING — CORRECTED

    180 generation occurrences — 140 built, 40 refused
     90 distinct athlete setups —  70 build,  20 refuse

**Deduplication key: `seasonPhase / daysPerWeek / club|noclub / kit`.**
`microcycleLimit` (1 or 2) is **excluded**: it is the same athlete generated for
one week and then for two, not a different setup. Every refusing setup refuses in
both run lengths, which is why 20 setups produce exactly 40 occurrences.

My previous phrasing said "20 setups" against a 40/180 denominator without stating
the key. Both numbers were right; the sentence let them be read as one.

| occ | setups | typed finding set | profile |
| ---: | ---: | --- | --- |
| 20 | 10 | `main_strength_planner_selected_target` | **Bodyweight Only**, In-/Pre-season 4–6d |
| 16 | 8 | `hard_day_permitted_maximum` + `main_strength_permitted_maximum` | Off-season 5–6d, Full Gym / Dumbbells |
| 4 | 2 | `hard_day_permitted_maximum` | Off-season 5–6d, Bodyweight Only |

---

## 3. MONDAY'S CONDITIONING — MEASURED, NOT SUMMARISED

    conditioningCategory      aerobic_base
    conditioningFlavour       aerobic
    attachedConditioningKind  component        (attached to the Lower strength day)
    block.modality            bike
    title                     "Continuous Aerobic Run"
    dose   30–50 min continuous · 1 block · rest none
           65–80% MAS / 70–85% HRmax, conversational
           "Run/Bike ONLY (a continuous block far above the 8 min erg cap)"

**Verdict: it is OFF-LEG work.** The resolved modality is `bike`. The approved
source, §Session pairing: *"Lower + conditioning | Prefer off-leg work: bike, ski,
rower or assault bike."* **The rule is satisfied.**

### Two real defects the measurement exposes — reported, not changed

1. **It is labelled a "Run" and prescribed as a bike.** The standalone-conditioning
   branch renames a shifted session to its actual modality; the *combined* path has
   no such rename, so a component that shifted off-feet keeps the run title. The
   description does say "Run/Bike ONLY", so it is misleading rather than wrong.
2. **`conditioningOffFeet` is `undefined` on the workout.** The scheduler's
   intention was not `off_leg` — the specialist's run-load guard chose the bike.
   So the rule is met **by the specialist's own guard, not because the scheduler
   asked**, and the off-leg fact is not carried anywhere a later reader can see it.
   Same ownership class as the anchor defect: a decision taken downstream instead
   of carried from its owner.

---

## 4. THE TEN GATES, NAMED INDIVIDUALLY

### Newly red at the start of this session — cause, and what was done

| gate | cause | now |
| --- | --- | --- |
| `test:strength-answer-authority` | called deleted `buildCoachingPlan` | **GREEN** — re-pointed |
| `test:readiness-structure-law` | census declared 8 readiness edges, 6 remain | **GREEN** — reclassified |
| `test:rules-kernel` | re-pointed; **121 passed, 1 failed** | RED — 1 cell: *"no unclassified (other) units in live week"* |
| `test:readiness-dose-sweep` | re-pointed; throws a typed scheduler refusal | RED — fixture is illegal, see below |
| `test:weekly-dose-ownership` | re-pointed; throws a typed scheduler refusal | RED — fixture is illegal, see below |

**None of the four had the planner as its subject** — it was their door. Their
subjects are real behaviours, so deleting them would delete coverage to make a red
go away. They now go through one shim,
`src/__tests__/support/coachingPlanForTests.ts`, onto
`buildInitialGeneratedCoachingPlan` — the producer generation itself runs. The shim
supplies the required `seasonPhaseClock` and nothing else.

**The two that still throw are not a test bug:**

    WC-043 / WC-100: could not place 2 session(s) on 2 legal day(s) without
    breaking lower spacing or the consecutive-plane rule

`inputsFor` fills gym days *"forward from Monday"*, so a two-day athlete gets
**Monday + Tuesday — adjacent**, and the approved source says Full Body ×2 go on
"the best-separated gym days, **never back-to-back**". **The scheduler is refusing
correctly; the fixture asks for a week the contract forbids.** I did not move the
fixture's days: that is exactly where coverage gets quietly weakened under time
pressure. They should also survive a typed refusal instead of throwing — a suite
that dies cannot report its other combinations.

### Newly green — all five re-verified individually this session

`test:action-log` · `test:coach-add-session-ownership` ·
`test:mobility-accessory-doors` · `test:onboarding-generation-outcome` ·
`test:strength-variants` — **all GREEN.**

**No threshold, floor, ceiling, ratchet or baseline was reset.** The census entry
was reclassified with the reason recorded beside the number, which is what its own
guard demands.

---

## 5. WORLD ACCOUNTING AND THE CORRECTED WEEK

    main @ 0e43fcfd (baseline)   142 built /  38 refused
    after deletion                44 built / 136 refused
    now                          140 built /  40 refused   (90 setups: 70 build, 20 refuse)

    test:anchor-survival    12/12
    test:weekday-index      85/85   (7/7 rotations built)

In-season · 4 gym days · club Wed+Fri · game Sunday · gym access overlaps both club nights

| Day | Date | Type | Club? | Rows |
| --- | --- | --- | --- | ---: |
| Monday | 2026-07-13 | Mixed | | 6 |
| Tuesday | 2026-07-14 | Rest | | 0 |
| Wednesday | 2026-07-15 | Team Training | club | 4 |
| Thursday | 2026-07-16 | Rest | | 0 |
| Friday | 2026-07-17 | Team Training | club | 4 |
| Saturday | 2026-07-18 | Rest | | 0 |
| Sunday | 2026-07-19 | Game | | 0 |

    Monday      Back Squat, Deadlift [main] · Bulgarian Split Squats,
                Single-Leg RDL, Ab Wheel [accessory] · Continuous Aerobic Run
                [conditioning, aerobic_base, component, modality=bike, 30–50 min]
    Wednesday   Barbell Row [main] · Lat Pulldown, Band Pull-Apart [accessory]
                · 30:30 Controlled Tempo Blocks [conditioning]
    Friday      Bench Press [main] · DB Shoulder Press, Banded Bicep Curl
                [accessory] · 30:30 Controlled Tempo Blocks [conditioning]

---

## 6. WHAT REMAINS BROKEN

1. **2 occurrences short of the 142 baseline**, unattributed.
2. **20 setups refuse** — bodyweight-only strength targets; off-season hard-day and
   strength ceilings. Neither family investigated.
3. **`test:rules-kernel`** — 1 cell: unclassified ("other") units in the live week.
4. **`test:readiness-dose-sweep` / `test:weekly-dose-ownership`** — illegal
   fixtures, and they throw rather than reporting a typed refusal.
5. **`test:compile` fails**, all in the `[tests]` scope; zero product, zero
   devtools. 4 of the 39 files are now re-pointed; the rest are not.
6. **Monday's conditioning is labelled a Run and prescribed as a bike**, and
   `conditioningOffFeet` is not carried (§3).
7. **Monday's session is still named "lower"** — a raw purpose token. The composer
   names its own days; outside the anchor class.
8. **No simulator, no device, no relaunch.** Every claim here is headless.

Agent: core
