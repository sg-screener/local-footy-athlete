# Stage 2a report — injury authority ownership

**Status: the upper-body case is fixed and green. Lower-body and back injuries
at 6/10+ remain unrecordable, quarantined RED for the §18 reassessment.**
`test:bible` green, typecheck clean, `test:section18-safety` 28/28. Not merged;
not on a device.

Unit: Sam's D10 ruling, Stage 2a (Addendum A of the durable-athlete-state
reassessment). Tests-first. Run: `npm run test:injury-authority`.

---

## 1. What changed

One line of policy, in `section18SafetyPolicy.ts`:

```
- const hasFieldRestriction = lowerBodyRestriction || upperBodyRestriction || readinessFieldRestriction;
+ const hasFieldRestriction = lowerBodyRestriction || readinessFieldRestriction;
```

Field participation — what the athlete produces at team training and on game
day — is no longer inferred from an **upper-body** restriction. A shoulder does
not stop someone running, which is what the Bible says ("pause the **affected**
work") and what Sam ruled.

That inference was the whole defect. It demoted every anchor to `modified` for a
shoulder injury, silently zeroing their conditioning and sprint production claim,
while no branch has ever authored a conditioning reduction. The contract reached
the gate asserting both "these anchors no longer produce conditioning" and "this
week requires 3 conditioning exposures" — unsatisfiable before the gate ran — and
the single fact+week transaction destroyed the athlete's injury report with the
week.

## 2. Invariants

| # | Invariant | State |
|---|---|---|
| I1 | an upper-body 8-10/10 is recorded (fact, episode, `activeInjury`) | **green** |
| I2 | an upper-body injury withdraws no team-training/game credit, and still prohibits push/pull only | **green** |
| I3 | upper_body 2 / 5 / 7 / 9 recorded | **green** (4/4) |
| I3 | lower_body 2 / 5 · back_midline 2 / 5 recorded | **green** (4/4) |
| I3 | lower_body 7 / 9 · back_midline 7 / 9 recorded | **RED — quarantined** (4) |
| I4 | no contract withdraws a domain's anchor credit without authorising a reduction in it | **RED — quarantined** (4 lower-body/back cells) |
| I5 | the week after an upper-body 8-10/10 carries no blocking violations | **green** |
| I6 | the committed week stops prescribing push/pull | **RED — quarantined** |

**An athlete can now report a shoulder, neck, elbow, wrist or chest injury at any
severity and the app remembers it.** Before this, nothing from 6/10 up was
recorded in any region.

## 3. Why lower-body and back are not included

The same argument applies to them — Sam's ruling says *silently*, and a
lower-body injury withdrawing credit is exactly as much an assumption. It is not
included because for that region the withdrawal is **structurally coupled** to
two other things that assume the same fact:

- the `injury_restriction` reduction of `sprint_high_speed_frequency` to **0**,
  and
- `prohibitedSprintHighSpeed`, which in `buildSafetyPolicy` forces the week's
  **total** high-speed ceiling to 0 — anchor credit included
  (`weeklyExposureContractV2.ts:455`).

Moving anchor participation without those just reverses the contradiction:
authorised 0 versus an athlete who is still playing on Saturday. Three attempts
at decoupling were made and measured:

1. anchors freed for all regions → `reduction_contradiction` (sprint authorised
   0, actual 3);
2. sprint reduction changed to `anchors.length` (the existing `avoidSprint`
   idiom, prior art in the same file) → a second contradiction from
   `prohibitedSprintHighSpeed`;
3. `prohibitedSprintHighSpeed` dropped for injuries → **a real safety
   regression**: the finaliser stops stripping app-authored speed blocks, so the
   app would prescribe a speed session to an 8/10 knee. Caught by
   `section18SafetyBoundaryTests` 15 and P7. Reverted.

A fourth variant (separating "the app prescribes no sprint" from "the week's
ceiling is zero") moved the failure to four other boundary tests.

Each fix surfaced a new failure somewhere else, which is the documented signal to
question the model rather than attempt a fifth. The honest statement is that
`sprint_high_speed_frequency` counts app-authored work and the athlete's own
anchor exposure in **one number**, so "the app prescribes none, the athlete's own
stays theirs" is not currently expressible — the same missing distinction that
owns T4 and I6.

## 4. Quarantine

`test:injury-authority` is **not** in `test:bible` while I3/I4/I6 are red, the
same sequencing Stage 1 used. The four red I3 cells and I4's four offending
contracts are pinned, not hidden: they name exactly which region/severity the app
still cannot record.

---

## NOT COVERED (Process Law L2)

- **No device pass, no simulator run.** L4 stands. "Gates green, awaiting Sam
  device acceptance" — not "done".
- **The injury is recorded but still not VISIBLE (I6).** The injury path
  validates the existing base against a stricter contract and never re-authors
  content, so a shoulder-injured athlete's Monday pressing session is still on
  screen. Stage 2a makes the app *remember*; it does not make the week *change*.
- **`other` region untested.** Only `upper_body`, `lower_body`, `back_midline`.
- **Only the report/create operation.** Injury update, refresh, resolve, and
  severity-lowering recovery (8-10 → 6-7, Bible :2466) are untested.
- **One seed, one profile.** `spent-week-friday` has zero app-authored
  conditioning or sprint — all of it is anchor credit, which is what made the
  defect visible. A profile carrying app conditioning may behave differently and
  was not run.
- **Stage 2b is not started.** No ask-flow, no copy beyond Sam's base wording, no
  typed-fact shape for the athlete's answer.
- **The explicit-participation gap is untested and unfixed.** When an anchor is
  explicitly marked `modified` (which is what Stage 2b's answers will do), credit
  is withdrawn with no matching authorised reduction — the same B4 violation by a
  different route. `section18SafetyBoundaryTests` M3 depends on that gap to kill
  its mutant. Recorded for Stage 2b; not addressed here.
- **No coach-chat path was exercised.**
