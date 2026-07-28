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
