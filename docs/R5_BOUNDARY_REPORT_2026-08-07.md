# R5 — THE BOUNDARY REPORT (2026-08-07)

**STOP. The next step is the seat's SHORT tap list and Sam's combined device
pass — the merge gate, as always ruled.**

## §0 THE GATE LINE

Full `test:bible` **UNPIPED**, clean tree, at `e202724d`:

```
TRUE_EXIT=1
last suite reached: test:program-control-durable
FAIL lines in the whole run: 1
  FAIL a move committed durably reaches the visible week
```

Full sweep, all 156 suites (world-identity preamble printed):
**2 failures — `test:program-control-durable`, `test:fixture-identity`.**
`test:compile` **EXIT 0**, no file regressed against baseline.

`test:bible` stops at the first failing suite, so the chain covers only up to
`program-control-durable`; the sweep is what covers the other 55.

## §1 WHERE THE BRANCH ACTUALLY IS, vs THE MERGE TARGET

`feat/r53-v3-switchover` vs `feat/stage-b-stage2`: **3 commits behind, 124
ahead.**

**R5.1, R5.2 and R5.8 ARE ALREADY ON THE MERGE TARGET** (`cdb78b48`,
`cf6ea83c`, `2c2b7b55` are ancestors of both). **What this branch carries that
the merge target does not is R5.3 and R5.7.** Any reading of "R5 landed" that
counts 5.1/5.2/5.8 as this branch's work is double-counting, and the tap list
must not.

## §2 WHAT WAS DELETED, AND WHAT WAS NOT

### Landed on this branch

| batch | what moved | measured |
|---|---|---|
| **R5.3 (V3)** | the visible week derives; the contract derives from the athlete's facts at all three selection lines; reduction OWNERSHIP derives; **ten longhand copies of the declaration precedence collapsed to ONE DOOR**, and the four-copy covering-week predicate with them | each step at the control set exactly |
| **R5.7** | the beta coach cut — **9 product files, 218 insertions / 228 deletions** | sweep identical to the control set |

**R5.7's deletions, precisely:** the `CoachTab` tab; all three
`navigate('CoachTab')` doors (`useHomeScreen`, `useDayWorkout`,
`ProfileScreen` — the latter two unnamed in the ruling's own table); the
`onMessageCoach` / `onReviewStale` prop chains through `HomeScreen`,
`HomeScreenV2`, `HomeQuickActionSheet`, `ProfileScreen`; the
`StaleOverrideBanner` fallback; and `DayWorkoutScreenV2`'s
`askCoachForExerciseEdit`, `askCoachForTeamTraining`, `onAskCoachTeam`.

**LR-6 HOLDS.** `CoachStackNavigator`, `CoachScreen` and the ~29k pipeline stay
in the tree, FROZEN. A scope cut, not a retirement — §6's own words. Restoring
the tab is one `Tab.Screen` block.

### Census closures and ceiling movement

`test:legacy-census`, 375/375:

| unit | declared | note |
|---|---|---|
| LR-1 | **0** | founding 27 → 0 |
| LR-2 | **0** | |
| LR-3 | 2 | |
| LR-4 | **71** | |
| LR-8 | 4 | |
| **total declared debt** | **77** | at the baseline, baseline tightened to 77 |
| **founding baseline** | **120** | 77 never exceeds it |

**The ratchet moved DOWN this era and never up.** One attempted upward move was
caught and refused: the flip's arm 2 read the profile MIRROR, which the census
counts **by SOURCE SCAN**, so a parked flag-off scaffold pushed LR-4 to 72. The
scaffold was deleted rather than the number retuned. **That also corrects an
earlier attribution of mine** — `legacy-census` was never a behavioural artefact
of arm 2, it was this static hit.

### NOT deleted, and why — the carve-out

Sam's Option B ruling excludes **the stored-declaration read path and its
writers** from R5; they retire in the LR-29 replay unit. That exclusion rules
out more than R5.3:

| batch | status | why |
|---|---|---|
| **R5.4** — hydration category | **DEFERRED** | hydration validates the declaration's stored SHAPE |
| **R5.5** — reversal by decision | **DEFERRED** | it *is* the replay unit (LR-29, `beforeExposureContract`) |
| **R5.6** — fact/results door bodies | **DEFERRED** | the fact door AUTHORS the declaration |
| **R5.7** — the coach cut | **LANDED** | the only batch touching none of it |

The boundary between R5.4/R5.6 and the replay unit is **argued from the census,
not measured**. It is a claim, and the replay unit's dependency list is where it
gets tested.

## §3 THE NORTH-STAR CONVERGENCE ANSWER FOR THE ERA

`store only decisions, derive everything else.`

**CONVERGED — content and derivation.** What the athlete SEES is derived. The
tier-4 deriver owns the visible week; the week's contract derives from the
athlete's facts; reduction ownership derives from the decision that authorised
it (equality-bound: 45 consumer calls, DIVERGENT 0). Representations went DOWN,
measurably: ten longhand precedence copies to one door.

**NOT CONVERGED — decision-accumulated identity.** The stored declaration is
still the READ authority for state that DECISION doors accumulate onto it:
`authorisedReductions`, and the decision-authored identity (bye-build and
practice-match table selection, illness authoring, in-week authorised changes).
That is stored OUTPUT — exactly what the north star forbids.

**The honest sentence for the era: the derivation half landed and the
accumulation half did not.** Behaviourally sound — undo works, nothing ships
broken — and not yet convergent. Both halves are true; neither is the headline
alone. **V3 is BANKED at the one-door boundary, not closed.**

## §4 THE DECLARED REDS — THEIR DEBTS AND THEIR PAYERS

| suite | cells | status | payer |
|---|---|---|---|
| **`test:fixture-identity`** | 3, 5, 6 | **RED as PLAIN LAWS — no declaration wearing them.** The entries were deleted when V3 was expected to pay them | **the LR-29 replay unit.** Measured: `fixture-identity` is the ONE suite the flip arm FIXES |
| **`test:program-control-durable`** | "a move committed durably reaches the visible week" | RED, the branch's long-standing declared red | not re-attributed this era; carried |

**This is the most important line in the report for the merge decision:**
`fixture-identity` is red *without* a declaration in front of it, because the
ratchet correctly deleted its entries when V3 was expected to pay them and V3
banked short. **It is a real, visible red with a named payer, not a rounding
error, and it does not go green before the replay unit.**

Two further debts stand and are NOT paid:

- the parity gate's `stored_declaration_costs_mondays_power_row` — still firing,
  still owed; it retires **PAID** (measured: byte-equal, comparison still
  non-vacuous) when the replay unit lands;
- the D13 entry `session_list_calls_a_conditioning_day_recovery` — MOVED-shaped,
  **not** claimed paid.

## §5 FOR THE SEAT'S TAP LIST — ATHLETE-VISIBLE CHANGES, **LANDED ONLY**

No parked flags. Everything here is on by default at `e202724d`.

| # | what changed | where Sam sees it | what he should expect |
|---|---|---|---|
| 1 | **The Coach tab is gone** | the bottom tab bar | **two tabs: Program, Profile.** No Coach tab, on any screen, ever |
| 2 | **No "Ask Coach" anywhere** | Home quick-action sheets ("What changed?", missed session, busy week) | the menus keep every real option; the "Ask Coach" row is gone from each |
| 3 | **The "more detail" sheet closes instead of offering chat** | Home → quick action → an option needing detail | *"This one needs more context than the menu can give, so nothing has changed. Use the day or session controls to make the change yourself."* + **Close**. **Nothing changes in his program** |
| 4 | **The stale-override banner has no coach route** | a day whose manual override went stale | **Review still works** (it opens Keep / Clear). Its detail sheet now says nothing changed and closes |
| 5 | **Exercise-edit fallback closes instead of offering chat** | day → session → edit an exercise the deterministic path cannot handle | the existing message, then *"Nothing has changed. You can make this change yourself from the day or session controls."* + **Close** |
| 6 | **Team-training "Ask Coach" is gone** | day → a team-training session | the session shows without the Ask-Coach affordance |
| 7 | **Profile setup sheet has no coach fallback** | Profile → "Something changed? Tell the coach" → the setup sheet | the guided setup flow only; the *"Need to explain something? Ask Coach"* line is gone |

**What must NOT be on the tap list, and why:**

- **Vertical Jump returning to Monday — STRUCK.** It is measured only under the
  parked `LFA_FLIP_DOOR` arm. Nothing the athlete has.
- **The completed-day boundary — LANDED**, and already on the standing flags.
- Everything in R5.3 is engine-internal: the visible week is *intended* to be
  byte-identical. If Sam sees a week CHANGE from R5.3, that is a finding.

## §6 THE PROPOSED STRINGS — FOR SAM'S SIGNING BATCH

Three, all **UNSIGNED**, all shipped PROPOSED per the ruling ("building does not
wait on the signature; showing the athlete final words does"):

1. `HomeQuickActionSheet` — "I need a bit more detail" sheet:
   > This one needs more context than the menu can give, so nothing has changed.
   > Use the day or session controls to make the change yourself.
2. `StaleOverrideBanner` — detail sheet:
   > This one needs more context than we can gather here, so nothing has
   > changed. Keep the session or clear it from the options above.
3. `DayWorkoutScreenV2` — `coach_fallback` step, appended below the existing
   message:
   > Nothing has changed. You can make this change yourself from the day or
   > session controls.

All three say the same two things on purpose: **nothing changed**, and **where
the athlete can act instead**. A fourth affordance ("There are no editable gym
exercises in this session") lost its Ask-Coach button and needed no new words.

## §7 NOT-COVERED, HONESTLY

- **No device evidence for anything in this era.** Sam's combined pass IS the
  merge gate and has not run.
- **`fixture-identity` is red and stays red until the replay unit.** Named, not
  rounded.
- **The PROPOSED copy is unsigned.** It ships as words the athlete can read
  today, which is what PROPOSED means here.
- **R5.4/R5.6's exclusion is argued, not measured.** The replay unit's
  dependency list tests it.
- **Four of arm 2's five new reds remain undiagnosed** (the fifth is now
  explained as the static LR-4 hit).
- **Class B of the eight** (`phase-structure` cell 8, the lighter-day walker
  cells) is characterised by failure text only, in three passes.
- **`validateLiveWeekOverlayWrite` fired 0 times and `current_microcycle` was
  never the answering source** in any taped world — for those two rungs, move
  (ii)'s behaviour-identity rests on code equivalence, not on a measured world.
- **The coach pipeline is frozen, not verified.** LR-6 means nobody has run it
  this era; the cut removes the way in, it does not prove what is behind it.
- **`program-control-durable` was not re-attributed this era.** It is carried.

## §8 THE STOP

R5 is at its boundary. What remains in R5 proper is deferred to the LR-29 replay
unit by Sam's own carve-out, and the next step is the seat's SHORT tap list and
Sam's combined device pass — the merge gate. **Nothing further should land on
this branch before that pass.**
