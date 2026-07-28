# Onboarding / buttons — intended shape for phase, subphase, byes and team breaks

**Date:** 2026-07-28
**Source:** Sam, design notes recorded during the engine-thresholds unit.
**Status:** RECORDED, not built. This is the intended shape for the onboarding/buttons work.

Recorded so nobody builds a **subphase picker**, a **hardcoded week threshold**, or a
**"break mode"**. All three are the wrong shape, and all three are the kind of thing that
looks reasonable in isolation and is expensive to remove once a screen depends on it.

---

## 1. Byes derive from fixture gaps

A bye is **not declared and not scheduled in advance**. It is what a gap in the fixture list
*is*. There is no advance-scheduling requirement and no bye button.

Mid-week declarations follow **the existing mid-week directive rule** — the same path any
mid-week change already takes. Byes do not get their own mid-week mechanism.

**Do not build:** a "declare bye" flow, a bye calendar, or an advance-notice requirement.

## 1a. Build-vs-recovery is the athlete's answer, and it is an ASK

**Ruled by Sam, 2026-07-29.** This is the spec for the ask; it is not built yet.

> A bye is detected from the fixture gap (existing law); build-vs-recovery is the
> ATHLETE'S choice via an ask — a typed schedule-class fact, the only producer of
> `in_season_bye_recovery`. Default is bye_build if unanswered. Facts may inform the ask's
> copy, never decide it.

**Why this one is an ask when §1, §2 and §3 are derivations.** The fixture gap still derives
the BYE. What no fact can answer is what the athlete wants to do with the free week: "use it
to build" and "use it to recover" are both correct for the identical calendar. A derivation
would have to pick one and dress a preference as a fact — which is precisely what capacity
and injury were doing before the readiness law removed them. So the question is asked once,
and its answer is stored as a fact like any other.

### What to build

- **One ask, on the bye week.** Two options, build and recovery. No third state: unanswered
  is build, and it must be a real default rather than a nag.
- **Store the answer as a schedule-class source fact**, week-scoped —
  `TemporaryScheduleFact` in `rules/temporarySourceFact.ts` is the existing family and the
  answer belongs in it (a new `scheduleKind`). Do **not** open a second channel: the whole
  point of the classification is that the athlete's answer is a SCHEDULE fact, which is
  allowed to set structure, and not a health/capacity fact, which is not.
- **Thread it to `CoachingInputs.byeMode`**, which is already the seam and already reaches
  `WeeklyExposureContractInput.byeMode` — the single producer of the recovery mode.
- **Facts may inform the COPY.** If the athlete is cooked, sick or carrying a niggle, the ask
  may say so and may recommend. It must not preselect, and it must not answer.

### What not to build

- Any path that lets readiness, illness, injury, a deload, or a fixture pattern SELECT the
  mode. Four such triggers have now been removed across two rulings, and each one cut a
  strength session with no reduction recorded anywhere — a mode change is silent by nature,
  so the week simply arrived smaller under a name that read like a coaching decision.
- A per-week mode picker anywhere other than the bye ask.
- A default of recovery, for anyone, for any reason.

### State today

`in_season_bye_recovery` is implemented, gated and reachable only through `byeMode`. Nothing
in generation sets it, deliberately, so every bye is a build bye until this ships.

`CoachingInputs.byeMode` therefore has no producer, and that is **approved as built** (Sam,
2026-07-29): *"a mode with no end-to-end path is untestable, and the seam is exactly where
the ask will plug in — one channel, already gated."* It is not dead wiring. Whoever builds
the ask writes to this field; nobody deletes it for being unused. Its shape
is covered by `readinessDoseSweepTests` block [5] at the contract and by
`section18PhasePlannerTests` scenarios 12-14, both of which now answer the ask the way the UI
will. See `docs/READINESS_CENSUS_SWEEP_2026-07-29.md` §3.0 for how the gap was found.

## 2. Subphase is never a button — it derives from two anchor dates

Onboarding asks **two anchor dates per off/pre-season**:

- season end, and
- pre-season start *or* first game.

Subphase then derives from **position within the athlete's own window**. Not from a fixed
week count, and never from a picker.

The reason is stated plainly: **calendars vary too much for fixed week counts.** A "week 3 of
pre-season" threshold is only meaningful relative to a window whose length differs by club,
by grade and by year.

**Do not build:** a subphase picker, a subphase override control, or any rule keyed on a
hardcoded week number.

> **Note for the engine-thresholds unit.** `section18EffectiveWeekEvaluator` currently gates
> on `phaseWeek <= 4`, `>= 4` and `> 4`, and `offseasonSubphase` / `preseasonSubphase` resolve
> from `phaseWeekNumber`. Those are hardcoded week thresholds of exactly the kind this ruling
> excludes. They are cited to the Bible today (`offseason_first_four_weeks_no_deload`), so the
> citation stands — but the *input* is due to change from a week count to a position within
> two anchor dates. Whoever builds the anchor-date onboarding owns re-deriving them; whoever
> rules Batch 3 should not treat `phaseWeek` as settled.

## 3. Mid-phase team breaks are neither a pause nor a phase change

A month off team training at Christmas is **not** a paused program and **not** a phase change.
It is a period during which:

- **team days = 0** for the date range,
- **individual training continues** unchanged,
- the **contract tops up** per the Bible's team-day-dependent rules — which already say what a
  week looks like when team training is absent.

The whole behaviour is already implied by making team days zero. Nothing new decides anything.

**The UX is a date-ranged team-days edit, not a mode.**

**Do not build:** a "break mode", a "pause training" state, a phase transition, or any week
kind for this. Each of those would be a new representation of a fact the schedule already
carries, and the contract already reads.

---

## Why these three are recorded together

All three replace a **control** with a **derivation from a fact the athlete already gives us**:
a fixture gap, two anchor dates, a team-days date range. That is the same direction as the
readiness ruling in `BATCH0_RULING_APPLIED_2026-07-28.md` — structure comes from phase and
schedule facts, and the app derives rather than asking someone to declare.

A picker for any of these would be a second representation of a fact already in the schedule,
and the two would drift the first time an athlete changed one and not the other.

**§1a is the exception that proves the test.** The question to ask is not "control or
derivation?" but **"is there a fact that answers this?"** For phase, subphase, byes and team
breaks there is one, so a control would duplicate it and the two would drift. For
build-vs-recovery there is not — the same calendar supports both answers — so deriving it
would mean inventing a fact, which is how capacity came to be setting structure in the first
place. Ask when no fact answers; derive when one does; never do both for the same question.
