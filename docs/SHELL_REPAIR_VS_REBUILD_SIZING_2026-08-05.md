# Shell repair vs shell rebuild — the sizing comparison, 2026-08-05 (evening)

**For Sam's decision tonight. No code rides with this document.** The four
evening failures are reproduced as declared reds in
`test:device-pass-2026-08-05-evening` (`e1aa150`), chained into the bible.
Those cells are the specification EITHER path must turn green, so they are
path-neutral: this document only argues about which path gets them green —
and keeps them green — sooner.

Evidence base: `device-export-2026-08-05-evening.txt` (the tape),
`docs/LEGACY_RECKONING_CENSUS_2026-07-30.md` + `src/data/legacyReckoningCensus.ts`
(current statuses), `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`, tonight's
instrumented probes (storage work per tap, measured through the real doors),
and `docs/NORTH_STAR.md`.

---

## §1 What tonight actually established

The four findings are ONE mechanism plus one instrumentation failure, all
measured, none guessed:

1. **Boot is not quiescent.** One relaunch with zero new athlete decisions ran
   THREE full durable accepted-state transactions (revision 25 → 29 on the
   tape; 2 → 5 replayed in Node). Each cost **~31.5 s wall-clock on his
   phone** (requested 04:03:07.049 → completed 04:03:38.712; requested
   04:03:38.766 → completed 04:04:10.379). The accepted-mutation lock was held
   for **~63 s of one launch**. Cause: the L15 hydration migration re-mints
   the `busy_week` fact on every transaction and never completes its lift —
   known convergence debt, now priced.

2. **Any tap made against the world the athlete can actually see refuses
   `conflicted`.** The screen captures `expectedAcceptedRevision` at render
   (`useHomeScreen.ts:1055`); boot mints past it; the transaction refuses
   ("The accepted program changed before the fixture mutation could run") and
   the screen alerts **"Couldn't update your week"** — for a decision nothing
   conflicted with. Reproduced deterministically for game-add and for the
   game-day sheet's Remove. This is the game-add and game-day-sheet failure.

3. **The tap's work bill is unbounded relative to the decision.** One
   whole-day delete — a decision about one day of one store — wrote **every
   persisted store** (9-19 setItem calls, 531 KB–1.2 MB written, ~650 KB read,
   against a 239-485 KB program envelope; a game add/remove serializes the
   full envelope TWICE). Node prices that pipeline at 60-125 ms; his phone
   prices the identical pipeline at ~31.5 s. **The 30-second delete is this
   bill at device I/O and Hermes rates — a ~300-500× environment multiplier
   the Node harness structurally cannot see.**

4. **The evidence self-destructs.** Boot door-writes are themselves
   "decision events"; each device launch emits ~115 of them into the
   200-entry ring, so his two evening launches evicted every trace of his
   failing taps — the export arrived carrying only the boot. Fifth sighting
   of the instrumentation-alive failure. Season change specifically remains
   UNLOCATED because of this: the transaction layer lands at every
   coordinate acting can build (fresh, worn, binned-removals, hydration
   ingress), so its failing layer is above the transaction — and the one
   instrument that could name it lost the tap.

**The load-bearing observation for tonight's decision:** this morning the
bible was EXIT 0 end-to-end (138 links), the device suite was 17/17 with zero
undeclared reds, the day's batch closed all seven morning findings — and the
phone failed again the same evening, on doors whose Node cells PASS. The
harness verifies logic; the shell's failure mode is work × time × concurrency
on a phone. That class is invisible to every gate we own, and it is the third
consecutive device pass to return findings in the same shell layer (L10,
L11-day, L11-evening) after an all-green bible.

## §2 What "the shell" is, and what "the engine" is

Measured from source tonight:

| Layer | Content | Lines | Status under the law |
|---|---|---|---|
| **Engine** | `src/rules/` (27.5k), `src/data/` (17.1k), `generateProgram.ts` (2.1k) | **~47k** | Bible-gated, 138 links, EXIT 0; Stage A/B authored + equality-bound; this is the part the phone has never contradicted |
| **Shell: stores + transactions** | 29 files in `src/store/` (19.2k) — `acceptedStateTransaction` 3.4k, `programStore` 2.9k, `coachMutationTransaction` 1.0k, `temporarySourceFactTransaction` 1.2k, six accepted-mirror stores, quarantine, hydration | **~19k** (~11k of it is the transaction/mirror machinery) | 10 of 12 persisted stores pre-law by construction; 11 of 12 now armoured (recipe); ALL FOUR tonight's findings live here |
| **Shell: coach pipeline** | `coachingEngine` 8.4k, `coachTurnController` 6.3k, `coachProgramEdit` 5.8k, `coachCommandExecutor` 4.8k, `coachCommandRouter` 3.4k, + | **~29k** | Pre-law core; LR-6 ("eight representations") is a standing XL STOP on all of it |
| **Shell: screens/UI** | `src/screens/` 22.7k, `src/components/` 8.7k, hooks | **~32k** | Buttons/UI unit unified the doors 2026-07-31; screens mostly READ projections and CALL doors — they are rewire-able, and 109 product files are already unreachable from App.tsx |
| **Other utils** | projection/resolver/planChange/programControl etc. (utils minus coach ≈ 75k incl. tests-adjacent helpers) | — | Mixed; the projection + resolver + door vocabulary is proven by the walker/bible and survives either path |

The engine is not in question. Both options keep it byte-for-byte. The
decision is about the ~19k-line store/transaction shell (and how much of the
coach pipeline beta needs).

## §3 Option A — door-by-door shell repair to beta

**What it is.** Keep the accepted-state transaction / mirror / hydration
machinery; pay the units that turn tonight's cells green; continue the census
queue (25 scheduled units, 1 in-flight, LR-6 stop) as they gate beta.

Units to kill tonight's reds:

| Unit | Kills | Size | Notes |
|---|---|---|---|
| A1. Complete the L15 hydration lift — boot stops transacting | evening-0, and evening-2/3 follow (no minting → no stale revision) | **M-L** | `temporarySourceFactTransaction.ts:229-244` re-migration + `composeTemporarySourceFactCompatibility` re-emission; known shape, but it is a change INSIDE the machinery all four wipes lived in |
| A2. Persistence write-set rescope — a transaction persists the stores its decision changed | evening-4 (the 30-s tap) | **L** | Touches `coachMutationTransaction` (951 lines), the 6-store mirror write burst, the full-envelope serialize+readback protocol, and `acceptedStateTransaction` (3.4k). The mirrors exist BECAUSE outputs are stored; rescoping the writes without unstoring the outputs is treatment, not cure |
| A3. Ring retention — athlete taps never evicted by system events | evening-1 | **S** | Real fix, small; also shrinks with A1 (quieter boots) |

**What repair keeps paying (the honest part).** A1+A2+A3 turn tonight's cells
green, but the CLASS stays representable: outputs remain stored (485 KB
envelope, still growing per LR-26/LR-28's snapshot debt), the revision remains
the concurrency token for a store of outputs, and the device-only 300-500×
cost multiplier remains invisible to every gate. The last three device passes
each returned new findings in exactly this layer after an all-green bible.
Under repair, the completion condition is **empirical** — "the last device
pass found nothing" — and tonight is direct evidence that condition does not
converge on a schedule we control: the harness cannot price the phone, so
each repair round costs one of Sam's device evenings to falsify.

**Repair's genuine assets:** the armour recipe is proven and paid (11/12
stores, wipe class contained — note the armour WORKED tonight: the
`snapshot_would_widen_gap` refusal on the tape is the mirror correctly
refusing a narrowing write at boot); the fix units are known shapes; nothing
is thrown away; Stage B stage 2 merges as planned.

**Repair to Renee:** 3 units (S+M/L+L) + one confirming device pass —
optimistically 3-5 working days IF the next pass is clean. The record says
plan for 2-4 more find-fix-verify cycles at one device evening each, with the
census tail (LR-3/4/5 tier-1, LR-26/27-class envelope growth) still queued
behind beta.

## §4 Option B — shell rebuild on the proven engine

**What it is.** Not a greenfield app. It is jumping directly to the north
star's stated end state instead of converging store-by-store:

```
persisted state = inputs only:
  profile answers + life-facts + decision ledger + training results
visibleWeek     = derive(Bible, profile, facts, decisions, results, today)
```

The engine (47k lines), the door vocabulary (programControlActions /
planChange producers), the screens (readers of a projection + callers of
doors), and the entire bible/walker harness survive. What is REPLACED is the
~11k-line accepted-state transaction + mirror + hydration machinery — the
layer all four of tonight's findings, both wipe sagas, the phase-skew family,
and the week-identity defect lived in.

Why tonight's four classes die **by construction**, not by fix:

- **evening-0:** boot reads inputs and derives. There is no transaction to
  run, no revision to mint, no fact to re-mint — hydration migration ceases
  to exist as a category.
- **evening-2/3:** an athlete decision APPENDS to the ledger. Appends do not
  conflict with derivation; there is no output-store revision for a
  background process to move under the tap. (Real conflicts — two decisions
  about the same slot — remain, and remain decidable at the decision level,
  where "the same facts were re-transacted" can never masquerade as one.)
- **evening-4:** persisting a delete = appending one typed decision —
  hundreds of bytes, one store, one write. The 485 KB envelope of stored
  outputs is not persisted because it is not stored. The 300-500× device
  multiplier now multiplies ~1 KB, not ~1.2 MB × 19 writes.
- **evening-1:** the decision ledger IS the record of what the athlete did.
  The action log stops being the only witness; boots emit no decision-flood
  because boots make no decisions.

Plus the classes already paid for at great expense stop being representable:
stored-output staleness (both wipes), mirror/live divergence, two owners of
one fact, the five publication shapes. Roughly 15 of the 27 open census units
(the stored-output family: LR-3, 4, 7, 8, 13, 26, 27-class growth, 28, 29,
30…) are units Option B deletes rather than performs.

**Units, sized:**

| Unit | Size | Notes |
|---|---|---|
| B1. The input schema + decision ledger store (armour recipe applied once) | **M** | The shapes EXIST: markedDays, readiness signals, injury episodes, temporary source facts, userRemovalConstraints, the reversible-adjustment ledger minus its stored snapshots — Stage B already made `dateOverrides` coach-only and unified resolver precedence |
| B2. `derive()` assembled from the existing projection/resolver | **M** | `buildScheduleStateImperative` + `resolveWeekWithConditioning` + `visibleProgramReadModel` already compute this; the unit is ONE owner and the deletion of its rivals (pays LR-13) |
| B3. Boot = read inputs, derive, render | **S** | No transactions; quiescence is structural |
| B4. Doors rewired to append decisions | **M** | The door vocabulary and screens survive; the buttons/UI unit already forced one-projection + unified doors |
| B5. One-time migration: old envelope → inputs | **M** | Read the persisted envelope once, extract inputs (they are all present in it), discard outputs. The export conformance fixtures are the test bed |
| B6. Coach for beta | **M scoped / XL full** | The honest unknown. The 29k-line coach pipeline targets the old mutation stack and is under the LR-6 STOP anyway. Scope beta coach to typed/template edits through the SAME decision doors (the direction the LR-6 reassessment already points); the free-text pipeline ports after beta |
| B7. Device pass + bible re-link | **S-M** | The evening suite's five cells are the acceptance gates; the walker vocabulary drives the new doors |

**Rebuild's honest risks:** B5 migration is where rebuilds die — it must be
gated like the switchover was (differential harness, both worlds derived and
compared); B6 is a genuine scope cut Sam must sign; and a new shell will have
new bugs — but they land under gates that already exist, and the completion
condition is **structural** (all persisted state is an input — a property a
gate can check) rather than empirical ("the last pass found nothing").

**Rebuild to Renee:** 7 units, mostly S/M, one M/XL scope decision (coach).
More calendar days than Option A's optimistic case (~1.5-2.5 weeks of units
at the current cadence) — but the terminal state is the north star, the
census shrinks by ~15 units instead of zero, and the find-fix-verify loop
that has now consumed three device passes ends because the classes it keeps
finding stop existing.

## §5 Which reaches Renee-on-TestFlight sooner

- **If the next device pass after A1-A3 would be clean:** Option A, by roughly
  a week.
- **The record's answer on whether it would be clean:** three consecutive
  passes returned shell findings after an all-green harness; the harness
  cannot price device work×time; and A2 rescopes writes of outputs that
  remain stored, so the envelope keeps growing (LR-26/27/28 class) and the
  next size-driven failure is queued, not killed.
- Option B is slower to its FIRST TestFlight build and faster to a build that
  survives Renee using it for a week — because Renee's phone is precisely the
  environment where stored-output weight and boot transactions bill at 500×.

## §6 Recommendation

**Option B — the shell rebuild on the proven engine — with the coach scope cut
(B6 "M scoped") signed explicitly for beta.** Three reasons, all from
tonight's evidence rather than preference:

1. Tonight's four findings are one architecture expressing itself, not four
   bugs. Repair prices the expression; rebuild deletes the grammar. The
   north-star doc predicted every one of tonight's classes by name.
2. The repair path's completion condition is empirical and has now failed to
   converge three device passes in a row while the entire gate estate was
   green. The rebuild's completion condition is structural and gateable
   (persisted-state-is-inputs is a sweep we already know how to write).
3. The expensive parts of a rebuild are already paid: the engine is signed
   and equality-bound, the door vocabulary and screens survive, the armour
   recipe applies to the new ledger store in one application, and Stage B
   already moved resolver precedence, `dateOverrides` ownership, and the
   switchover harness in exactly this direction. Option B is Stage B's
   destination, taken directly.

If Sam rules A instead: A1 before A2 (quiescence kills the conflicted class
for free), the evening suite's five entries are the payment ledger, and the
A2 unit should be explicitly barred from adding a fourth representation of
the write set — it rescopes, it does not wrap.

**Convergence statement (both options):** the evening suite stores nothing
and derives every assertion from acting; Option B moves the app to the north
star outright; Option A holds position and pays interest. Either way, the
next device pass runs with athlete-action diagnostics ON and the ring
retention fix (A3/B-structural) in place, or the pass cannot name what it
finds — that one is path-independent and cheap.
