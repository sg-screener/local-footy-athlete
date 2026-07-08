# LFA Programming Bible — Conditioning Finisher Rules (official, FINAL)

Ruled by Sam 2026-07-09 (v2 — supersedes the earlier same-day ruling and
Claude's draft F1–F13 in `FINISHER_VARIETY_INVESTIGATION_2026-07-09.md`).
The full Bible ("LFA Programming Rules v1") is not checked into the repo;
this section is recorded here so implementation work (Codex slices A–F)
references the authoritative text.

Placement in the Bible: under the Conditioning rules chapter, as its own
subsection "Conditioning Finishers", directly after the standalone
conditioning session rules and before the injury/readiness modifiers.

Status: Bible/context only — NOT yet implemented. Do not treat current
engine behaviour as compliant.

---

## 1. Finisher principle

A conditioning finisher is a small add-on, not a hidden second session.
A finisher should make the week better, not just make the session longer.

Not every strength session needs a finisher. Skipping a finisher is
allowed when the week is already covered or when the safe option would
just be filler.

Simple rule: **a finisher should add value, not padding.**

## 2. Row / SkiErg duration rule

LFA should not prescribe more than 10 minutes straight on the rower or
SkiErg as a default steady finisher.

Reason: long continuous row/ski finishers are boring and unpleasant.
They should not be the default.

Allowed:

- 8-10 min easy row/ski flush
- row/ski work longer than 10 min total only if broken into intervals

Examples:

- 8-10 min easy row = okay
- 8-10 min easy ski = okay
- 3 x 8 min row/ski with 2 min easy/rest = okay
- 2 x 10 min row/ski with 2 min easy/rest = okay
- 20 min straight row/ski = not okay as a default

## 3. Bike rule

Bike is different. 20+ minutes steady bike is okay when appropriate.
Bike is the preferred option for longer continuous easy aerobic finishers.

So:

- bike can be 15-25+ min continuous zone 2
- row/ski should cap continuous blocks at 10 min
- row/ski can still be used for longer total work if intervalised

## 4. Steady aerobic finisher repetition

Do not repeat the same boring steady erg finisher across the week.

Default rule: **no more than 2 steady aerobic erg-style finishers per
week unless there is a clear reason.**

Even then, vary the prescription:

- one steady easy aerobic flush
- one interval-style aerobic or tempo block

## 5. Lower body finisher rules

Lower/hinge days may use:

- short easy off-feet flush
- bike steady aerobic
- row/ski only if ≤10 min continuous or intervalised
- mobility
- breathing
- light trunk/prehab
- controlled loaded carries
- no finisher

Avoid after heavy lower:

- hard conditioning
- sprint/COD
- repetitive long row/ski finishers
- any finisher that turns the session into a second hard workout

## 6. Loaded carry clarification

Loaded carries are allowed after heavy lower if total session volume is
controlled. The issue is not "carries after lower are banned" — the issue
is total session load.

Allowed:

- short controlled carries
- low/moderate volume
- good technique
- not a brutal conditioning circuit

Not default:

- huge carry volume after hard lower
- loaded carries that make the session excessive
- hard trunk/carry circuits after an already demanding lower session

## 7. Upper body finisher rules

Upper body days are usually the best place for useful conditioning.

Upper days can use:

- true tempo
- moderate conditioning
- aerobic intervals
- carries
- trunk circuits
- aerobic finishers

But even upper days should not automatically get a finisher if the week
is already covered.

## 8. Game / team training weeks

Team training and games already count as conditioning/sprint exposure.
Do not add finishers just to chase volume in congested weeks.

No hard finishers near games or team training unless explicitly safe.
G-1 should stay light.

## 9. Decision ladder

When a requested finisher is not suitable, use this ladder:

1. Add useful finisher if it clearly improves the week.
2. Downgrade if the original request is too hard.
3. Shorten if the dose is too large.
4. Convert to easy aerobic / trunk / mobility / prehab if useful.
5. Skip if the week does not need it or the safe version is just filler.

## 10. Finisher vs conditioning component (Sam, 2026-07-09 addendum)

Important distinction:

A **finisher** is not the same as a **conditioning component**.

- A finisher is a small add-on.
- A conditioning component is proper planned conditioning work that may
  sit on the same day as strength.

For low-availability athletes, especially 4-day off-season athletes,
conditioning often needs to be paired with strength days. The app should
not remove useful conditioning just because it is attached to a strength
session.

The problem is not "conditioning after strength". The problem is
low-value filler finishers repeated across the week.

Simple rule: **use as much useful conditioning as the athlete can recover
from, but do not pad sessions with repetitive junk.**

Implementation note: skip/shorten/convert logic (Sections 1, 9) applies
to FINISHERS. It must never strip a planned conditioning component
(standalone COND or the conditioning half of a real S+C day) from a week
— those are first-class sessions, not padding.
