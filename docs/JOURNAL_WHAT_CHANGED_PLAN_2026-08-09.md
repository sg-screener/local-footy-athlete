# WHAT CHANGED / WHAT WAS PROTECTED — measured, not inferred

Addendum Group 1 item 2, and **the last unbuilt item in the Journal unit**.

Written after a lesson: I called week status "blocked" from a gate's refusal
rather than from a measurement, and it turned out to be buildable the whole time.
So this item gets measured before it gets a verdict.

## 1. THE LEDGER'S VOCABULARY, READ FROM THE TYPE

`AthleteDecision` (`src/types/decisionLedger.ts:32`) is a closed union:

| Kind | Athlete-facing? |
| --- | --- |
| `plan_change` (carrying a `PlanChange`) | **YES** |
| `fixture_add` / `fixture_remove` / `fixture_move` | **YES** |
| `reversal` | **YES** — "undo is a decision too" (LR-29) |
| `migrated_day_placement` | **NO** — one-time envelope migration bookkeeping; no writer creates it |

And `PlanChange` (`src/utils/planChangeTypes.ts:109`) carries: `remove_session`,
`swap_template`, `add_template`, `swap_category`, `add_category`,
`move_session`, `shutdown_week`, `clear_days`, `move_team_night`.

**Every one of those is something the athlete DID.** That half of the item is
free — it is a read over an input the app already persists.

## 2. THE GAP IS REAL AND IT IS EXACTLY WHAT LR-29 MEASURED

**Nothing in that union expresses "the app changed your week because you were
ill / injured / your readiness dropped / the phase shifted."** The LR-29
dependency list measured this before the Journal unit began: *"the ledger has no
vocabulary for illness/injury/readiness/phase."*

So a "what changed this week" list built from the ledger is **complete about the
athlete's own decisions and silent about the app's**. That silence is the
dangerous part: a list that looks complete implies the app changed nothing.

**RULING (mine, veto open): build the athlete's half, and say the other half is
missing.** This is rider 1 applied one level up — the same law that makes the
Journal say "no reason recorded" rather than inventing a why. A list with an
honest boundary is worth more than no list; a list without one is worse than no
list.

## 3. WHAT "PROTECTED" MEANS, AND WHY IT IS ALREADY HALF-BUILT

The addendum pairs "what changed" with "what was protected". The app's existing
answer to that is `section18ShortfallDisclosure` — Sam's SIGNED sentence, shown
at the moment of a decision: *"Resting Tuesday means you'll miss a strength
session this week."*

**That sentence is a disclosure at the DOOR, not a weekly record.** The ledger
does not store what the app protected, and re-deriving it for a past week would
mean re-running the decision against a week that has since changed — a
reconstruction, not a record.

**So "what was protected" is NOT built, and the reason is a measurement rather
than a preference:** the fact does not exist. Recording it would be new stored
state — a decision the north star would allow, since it is a fact about what
happened — but it is an engine-side change to the decision doors, not a Journal
change, and it belongs to whoever next opens those doors.

## 4. WHAT THIS SLICE ADDS

- `rules/journalChanges.ts` — pure derivation over ledger entries, filtered to
  this week, translated into athlete words.
- One Journal section, with the honest boundary line stated rather than implied.
- **Zero new stored state.** North star: TOWARD.

## 5. NOT COVERED

- **"What was protected"** — the fact is not recorded (above). Named as owed,
  with the reason.
- The ledger's missing vocabulary for illness/injury/readiness/phase — LR-29's,
  not this unit's.
- No device evidence.
