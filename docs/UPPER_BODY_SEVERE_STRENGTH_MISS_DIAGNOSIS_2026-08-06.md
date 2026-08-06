# `planner_selected_target_miss:main_strength` — upper_body 9/10 — MEASURED DIAGNOSIS

**STOP FOR RULING. No fix code is written.** R5.1 stays in `stash@{0}` until
this is ruled and paid.

Subject: the five `test:injury-authority` cells that red when R5.1's
switchover makes the derive path authoritative. Every number below is printed
by a temporary instrument run against `6cabd5d8` (green `HEAD`); the
instrument has been deleted and the tree is clean.

---

## §1 What the athlete's week actually does

World: `spent-week-friday` (Pre-season shape — MON strength, TUE team
training, THU team training, FRI optional, **SAT game**), a 9/10 shoulder
declared through the guided injury door.

| stage | main-strength count vs target | the week |
|---|---|---|
| healthy | 3 / 3 | MON Lower Body Strength · TUE Team + Upper Pull · THU Team + Upper Push · FRI Gunshow · SAT Game |
| **after the door (REPLAN — what ships today)** | 3 / 3 | **byte-identical to healthy** |
| **after re-derive (RESOLVE — what R5.1 makes authoritative)** | **2 / 3 → REJECTED** | MON Lower Body Strength · TUE Team + **Lower Squat** · THU Team + **Upper Push (0 rows)** · FRI Gunshow · SAT Game |

Two separate things are visible here, and only the second is the §18 miss.

**(a) The shipping path leaves affected work in the week.** After the door
reports *"Injury restrictions are active and affected sessions were safely
recomposed"*, the week still contains Upper Pull, Upper Push and Gunshow (an
arms session) for a 9/10 shoulder. It passes §18 only because it changed
nothing. Bible `:4108` — *"Do not keep affected work in the program when the
athlete rates the issue 8-10 / 10"* — and `:2200` — *"8-10 / 10: pause
affected upper work"*. **The replan path is not the correct week; it is the
unchanged one.** R5.1 is what makes the app stop showing it.

**(b) The derive path pauses the affected work and then strands the day.**
TUE is correctly substituted (Upper Pull → Lower Squat). THU is stripped to
**zero rows** and left on the athlete's week still titled *"Team Training +
Upper Push"*. It is a husk: it carries no work, and it earns no
main-strength credit. Hence 2 achieved against a selected target of 3.

## §2 The root cause: two authored rules intersect, and nothing owns the intersection

Printed from the rejected contract:

```
authorisedReductions:
  { metric: "strength_pattern_count", originalApprovedTarget: 4, reducedTarget: 2,
    reason: "injury_restriction", scope: "pattern", change: "frequency",
    detail: "Active injury restrictions remove affected strength patterns: push, pull." }

mainStrength.exposure:
  { requiredMinimum: 2, defaultTarget: 3, plannerSelectedTarget: 3,
    plannerSelectionKind: "core", achievedCount: 2,
    unresolvedMinimumShortfall: 0, unresolvedPlannerSelectedShortfall: 1 }
```

**Rule 1 — the injury.** A 9/10 shoulder blocks **push AND pull**, leaving
`squat, hinge` as the only safe patterns (4 → 2). Authored correctly by
`weeklyExposureContractBuilders.ts:308`.

**Rule 2 — the game.** THU is **G-2** (Saturday game).
`BIBLE_ANCHOR: lower_strength_g3` — *"lower strength stops at G-3"* — and
`BIBLE_ANCHOR: g_minus_2_no_heavy_lower_or_speed`, quoting Section 2:
*"Rules around G-2: no heavy lower body work or speed work (TT will often be
2 days before game)"*. `coachingEngine.ts:1877` classifies G-2 as `lateWeek`,
the slot upper work goes in.

**So THU can legally hold nothing.** Upper is paused by the injury; heavy
lower is barred by G-2. Both rules are correct and both are Sam-authored.
Their intersection empties the slot, and **no layer owns what happens next.**

**Why the frequency target does not follow.** The contract's own comment at
`weeklyExposureContractBuilders.ts:319` states the ruling correctly — *"Bible
`:4755` — substitute before reducing frequency. The week keeps its count and
fills the freed days with safe work; only a whole-body restriction removes
the work itself"* — and implements exactly one reduction trigger:

```ts
if (allowed.length === 0) { reduceAllocationTarget(contract, 'main_strength', 0, ...) }
```

`allowed.length` is **2**, not 0, so the target stays 3 and the week is
expected to fill the freed day. It cannot, because of Rule 2. The reduction
that is genuinely warranted is never authorised, and §18 blocks on a
shortfall the rule set itself produced.

`hasFrequencyReduction` (`section18EffectiveWeekEvaluator.ts:823`) confirms
the gap from the other side: it authorises a miss only for
`main_strength_frequency`. The reduction on file is
`strength_pattern_count` — a different metric — so it lowers neither the
ceiling (`effectiveFrequencyCeiling`) nor the block. Pattern space and
frequency space never speak.

## §3 The coordinate check — this is NOT what finding 3 covered

Finding 3's own boundary report (`docs/FINDING_3_STEP2_BOUNDARY_REPORT_2026-08-06.md`)
describes its severe-upper cell in its own words:

> `46 severe upper injury produces a valid safe late-off-season S3/C4 week`
> … a Severe SHOULDER restriction, **which prohibits `push` alone and leaves
> three patterns safe**

| | finding 3's witnessed world | this world |
|---|---|---|
| patterns blocked | `push` only | **`push` AND `pull`** |
| patterns safe | 3 (squat, hinge, pull) | **2 (squat, hinge)** |
| week shape | late off-season S3/C4, standalone sessions | Pre-season, 2 team days + **a Saturday game** |
| G-relative constraints | none in play | **G-2 bars lower strength on the stranded day** |
| result | holds 4/4 by doubling squat | 2/3, one day stranded |

Finding 3 proved the filler CAN double a pattern to hold frequency — that is
exactly how its world reached 4 from 3 patterns. What it never met is a week
where the safe patterns exist but **no eligible day can carry them**. Sam's
read is confirmed by the measurement: finding 3's witnessed worlds were
lower-body restrictions plus one push-only shoulder, and here the frequency
question does run the other way round — squat/hinge are the safe patterns,
and the binding constraint is the CALENDAR, not the pattern pool.

## §4 Which layer authors the miss

Not the evaluator: §18 is right to reject a week that misses a core target it
was told to hit. Not the injury policy: the pattern reduction is correct. Not
the G-2 anchor: it is a quoted Bible rule.

**The miss is authored by the absence of an owner for "substitutes were
considered and exhausted" in the main-strength domain.** The repo already has
this concept, typed, for exactly one domain:

```
contract.equipment.substitutionStatus: 'not_attempted' | 'substituted' | 'exhausted' | 'legacy_unknown'
```

`coachingEngine.ts:806` sets it, `section18EffectiveWeekEvaluator.ts:1570`
blocks on `not_attempted`, and `derivedSessionProvenance.ts:178` reads it.
Main strength has no equivalent. So when substitution is genuinely exhausted
it cannot say so, a legitimate reduction cannot be authorised, and an
illegitimate shortfall cannot be told apart from it. That is one missing
statement, not a missing guard.

## §5 Proposed fix shape — for ruling, NOT built

1. **Give main strength the substitution proof equipment already has.** The
   placer records, per week, whether a safe substitute was placed, or was
   sought and no eligible day could carry it. Exhaustion is a measured
   outcome of placement, never an assumption.
2. **Exhaustion authorises the frequency reduction.** When the safe-pattern
   set is non-empty but no eligible day can hold it, emit a typed
   `main_strength_frequency` reduction (`reason: 'injury_restriction'`, with
   the G-2 protection named in its detail). `applyReductionProjections`
   already lowers `plannerSelectedTarget` off that metric, and
   `hasFrequencyReduction` already authorises the miss — both work today and
   neither is touched. The week becomes 2/2 and is accepted for the right
   reason.
3. **The husk must not reach the athlete** (separate, and true regardless of
   1–2). A stripped session must not remain on the week titled by the work it
   no longer contains. It is removed, or it becomes what it now is. Under the
   copy law any new sentence ships PROPOSED.
4. **The Coach Note owes the athlete the reason.** Bible `:4108` — *"Do not
   hide injury restrictions. If it affects the program, it must show in Coach
   Notes."* The athlete is training twice, not three times, because of their
   shoulder and their game. PROPOSED copy.

**Deliberately NOT proposed:** widening `hasFrequencyReduction` to accept
`strength_pattern_count`. It would green the gate by making a pattern
statement stand in for a frequency one — the two are different facts, and
collapsing them would also green a week that lost frequency for no reason.

## §6 A citation correction worth making while we are here

`weeklyExposureContractBuilders.ts:319` cites Bible `:4755` for the
substitute-before-reduce rule on INJURY. Line 4755 sits under **Equipment**
(*"Substitute before reducing frequency"* — running, walking, ergs …). The
injury bands are authored separately at `:1920–1926` (*"Pause affected
training … Use rest, recovery, or clearly unaffected training only"*),
`:2200` and `:4108`. Both point the same way here, so no behaviour rests on
it — but the load-bearing citation for injury is not the one in the comment.

## §7 NOT-COVERED

- **Why TUE substituted and THU did not is inferred from the G-2 anchors, not
  from stepping the placer.** The anchors are quoted and the day arithmetic is
  certain (SAT game → THU = G-2), but I did not read the placement function
  that consumes them. If the ruling favours fix shape 1, that function is the
  first thing to instrument.
- Only `upper_body` was measured at 9/10, against a `lower_body` 9/10 control
  (which passes: it needs ONE substitution — MON → Upper Push — and the two
  pre-existing upper sessions already satisfy the target). `back_midline` was
  not probed.
- One world only (`spent-week-friday`). Whether a week with no game, or a game
  on a different day, strands the same slot is unmeasured — and it is the
  obvious matrix question for whoever builds the gate.
- No device pass. Static instrument plus suite output.
