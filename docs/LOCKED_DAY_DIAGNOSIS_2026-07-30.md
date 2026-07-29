# The locked G-1 day — read from Sam's device, not reconstructed

**Status: DIAGNOSED FROM BYTES, NOT FIXED.** Two defects, both from one
sequence on Sam's phone (2026-07-29/30). The fix waits for the action log to
ship and for Sam to re-run the sequence, so the *order* of what happened is
read rather than inferred. Reconstruction has been wrong four times on this
exact flow.

The export these numbers came from (`device-export-3.json`) was read and
deleted in the same commit that recorded this file. Nothing personal was in it;
the numbers below are the whole of what it said.

---

## 1. What Sam did, in his words

On a G-1 day holding the canonical **rest stub**:

1. The ask appeared. (Correct — this is the funnel working.)
2. He picked **Accessories only**, and the day was given **Full Body Strength**
   — the landing session at full size, not its accessories version.
3. He deleted that session.
4. From then on the day is **dead**: every add and every swap refuses with
   *"I couldn't safely make that change, so the plan is untouched."*

## 2. What the device says

```
markedDays                       { "2026-08-01": "game", "2026-07-31": "rest" }
userRemovalConstraintCount       1
dateOverrideDates                []
weekScopedOverlayWeeks           ["2026-07-27"]
acceptedRevision                 14        lastTransaction  temporary_source_fact:hydrate
onboardingAnswerCount            23        snapshotAnswerCount 23    mirrorRefusals 0
```

`2026-08-01` is the Saturday fixture. **`2026-07-31` is the G-1 Friday, and it
now carries an explicit `rest` CALENDAR MARK** — the same class of mark as a
game. Nothing the athlete did was a calendar edit.

(The profile numbers are incidental but worth noting: 23 answers, 23 in the
snapshot, zero mirror refusals. The mirror-narrowing law is holding on the real
device.)

## 3. Defect A — a deletion door writes a schedule fact

`stageAthleteSessionDeletionTransaction` (`store/acceptedStateTransaction.ts`,
the `wholeDayRest` branch):

```ts
const markedDays = { ...prior.markedDays };
if (wholeDayRest) markedDays[date] = 'rest';
```

Deleting the only session on a day writes `markedDays[date] = 'rest'`, and that
mark is read by the resolver at the TOP of `_resolveDateRaw` — before templates,
before proximity, before anything the athlete could add later. Hence "dead
day": the mark outranks every door, and no door the athlete can reach removes
it.

**Sam's framing, and the law to fix against: a deletion door has no business
deciding a schedule fact.** "There is no session here today" and "this day is a
rest day" are different claims. The first is what the athlete said; the second
is a standing instruction to the planner that survives them changing their mind.
One is the absence of content, the other is content of its own.

Open questions for the fix (do NOT answer them by reading the code alone —
Sam's re-run answers them):

- Was the mark written by the delete, or by the reversible-adjustment ledger
  reacting to it? `reversibleAdjustmentTransaction.ts:468` and
  `acceptedStateTransaction.ts:2944` both DELETE a rest mark; something writes
  one and nothing on the athlete's path removes it.
- Which day did Sam actually delete — the G-1 Friday itself, or the source day?
- Does the surviving removal constraint (count 1) also gate the day, or is the
  mark doing all of the work? Two candidate locks, and the log will say which
  fires first.

## 4. Defect B — route (b) placed the landing session at full size

Sam picked **Accessories only** and got **Full Body Strength**. That is the
untransformed landing template, so on his build the route's transformation did
not reach what was published.

This is the class the landing unit added a single owner for
(`utils/g1RouteMaterialisation`, one wrapper for every materialise call), and
three separate paths that dropped the route were fixed in `d0437ce`. **Sam's
build predates that commit**, so the first thing his re-run establishes is
whether B still reproduces at all. If it does, the log names the door and the
boundary, and the fix has one place to look rather than three.

Note the interaction that made this worse than a wrong session: an empty G-1
holding a rest stub is exactly the case where route (a) reads *"Leave Friday
free"*, and where — under Sam's ruling below — the Gunshow should have been on
the menu in the first place.

## 5. Sam's rulings for the fix that follows (2026-07-30)

Recorded now, built after the log lands and the sequence is read.

**(1) The warning must read as a warning.** The current sheet renders the ask
as a neutral picker — the same option rows as "which conditioning session?".
The athlete is being told they are about to cost themselves a game, and it
looks like a preference. It needs the caution register. Athlete-facing design:
the treatment is proposed for Sam's sign-off, not chosen unilaterally.

**(2) On an empty or rest-stub G-1, the Gunshow joins the option list.** An
athlete adding work the day before a game should be offered the session that day
was built for — today the menu offers three ways to place *their* choice and
never offers the day's own. And the back affordance is labelled for what it
does: **"Go back — leave Friday free."**

The route copy pattern extends accordingly (a fourth option on empty days, plus
the labelled back row), and **Sam signs the new strings** before they ship —
the copy-equality gate in `g1LandingAskFlowTests` 18 fails until the design
document carries them, which is the mechanism that enforces it.
