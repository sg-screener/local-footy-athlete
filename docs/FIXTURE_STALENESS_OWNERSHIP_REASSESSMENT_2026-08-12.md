# THE CHANGED GAME DAY IS NOT VISIBLE UNTIL THE APP IS REOPENED

**Reassessment before code, as `CLAUDE.md` requires.** The AI/semantic layer
understood the athlete correctly — the setup door produced the right patch, the
transaction committed, the answer reached disk — and a LATER layer failed to
reflect that intent. That is the second trigger of the Coach Architecture
Escalation Rule verbatim, so this document exists before any fix is written.

Raised 2026-08-12 while verifying the generation-anchor fix (`f2152d2b`) on the
simulator.

---

## THE SYMPTOM, MEASURED

Athlete changes **usual game day Saturday → Wednesday** in Profile → *Something
changed? Tell the coach* → *Edit program details*, and commits with **Update
program**.

Driving the real decision (`decideProfileSetupChange`) into the real transaction
(`commitProfileProgramTransaction`, `kind: 'profile_setup'`):

```
1. onboarded (Saturday)      : 0 date(s) on (none)
2. after commit (today)      : 4 date(s) on Saturday   [commit ok=true]
3. after settle-by-rederive  : 4 date(s) on Wednesday
4. after a relaunch          : 4 date(s) on Wednesday
```

**Nothing is lost.** `profile-store` holds `gameDay: "Wednesday"` and
`usualGameDay: "Wednesday"` on disk immediately, and the week is correct after a
relaunch. The defect is that **line 2 is what the athlete sees**: they state a
change, the app agrees it saved, and the fixtures stay on the old day until the
process is killed and reopened.

A SECOND OBSERVATION, recorded and NOT fixed here: line 1 shows a freshly
onboarded in-season world carrying **no game marks at all** until some later
transaction runs. That is a different question (does onboarding mark the
recurring fixture?) and is not in this document's scope. Naming it rather than
folding it in.

---

## 1. WHAT IS THE CURRENT SOURCE OF TRUTH?

For the RECURRING fixture: **the profile answer**, read through
`storedGameAnchor(profile)` (`rules/gameAnchor.ts:102`) — `usualGameDay` first,
then `gameDay`. It is an ANSWER, not a decision; nothing in the decision ledger
records it (`quiescentBoot.deriveBootFixtureMarks`, and the
`FIXTURE_BOOT_ORDER_RULING_2026-08-06` that put it there).

For an EXPLICIT one-off fixture (a game added, cancelled or moved): **the
decision ledger**, replayed at boot.

`calendarStore.markedDays` is **neither**. It is a PROJECTION of both — and boot
proves it, because `deriveBootFixtureMarks` **drops every `game`/`noGame` mark it
finds on disk** and rebuilds them from the profile answer plus the ledger replay.

## 2. HOW MANY REPRESENTATIONS OF THE ANSWER EXIST?

Three, and only one is authored:

| # | Representation | Authored? | Survives a relaunch? |
|---|---|---|---|
| 1 | `profile.usualGameDay` / `gameDay` | YES — the athlete's answer | yes, persisted |
| 2 | `calendarStore.markedDays` `game` entries | no — projection | **persisted, then discarded and recomputed at boot** |
| 3 | `acceptedMaterialContext.markedDays` | no — mirror of (2) inside the transaction | no |

Representation (2) is already stored-but-not-trusted: written to
`calendar-storage`, then thrown away on the next launch. That is a north-star
violation already present (`docs/NORTH_STAR.md`: *store only decisions, derive
everything else*) — this defect is that violation becoming visible.

## 3. WHERE CAN THE INTENT BE REINTERPRETED?

At exactly one place, and it is explicit:

```ts
// store/profileProgramTransaction.ts:359-364
const leavingInSeason = currentProfile.seasonPhase === 'In-season'
  && nextProfile.seasonPhase !== 'In-season';
const nextMarkedDays = leavingInSeason
  ? /* drop game + noGame */
  : before.markedDays;          // ← stays In-season: the OLD marks ride forward
```

The branch is correct about the case it was written for (leaving In-season must
retire fixture marks). It is silent about the case that matters here: **staying
In-season while CHANGING the day**. The old marks are carried forward as if
nothing about fixtures had changed, and the athlete's new answer is not consulted.

## 4. WHICH LAYER SHOULD OWN THE DECISION?

The one that already owns it at boot: **the derivation**
(`deriveBootFixtureMarks` inside `rebuildDerivedWorld`). The marks are its
output. No transaction should be hand-carrying a projection of an answer it just
changed — that is the "second representation pre-empting its owner" the
fixture-boot-order ruling already decided once, in boot ORDER; this is the same
defect in a WRITER.

## 5. WHAT SIMPLER ARCHITECTURE REMOVES REPRESENTATIONS?

### Option A — SETTLE BY RE-DERIVING (recommended)

The profile door does what the injury door and the undo door already do:

```ts
// store/injuryEpisodeTransaction.ts:622   store/undoLastDecision.ts:116
await settleDerivedWorldAfterDecision();
```

`settleDerivedWorldAfterDecision` **is** `rebuildDerivedWorld` under the replay
latch (`quiescentBoot.ts:281`). This is R5.1 THE SWITCHOVER, whose own docstring
states the purpose: *"the week an athlete sees after a tap is therefore the week
they see after a relaunch, because it is built by the same body."*

- Removes representation (2) as an independently-carried value at this door.
- Makes tap-week ≡ relaunch-week **by construction**, not by a matching rule.
- **No new mechanism.** It closes a door's non-use of an owner that exists —
  the same ownership shape as the anchor bug fixed in `f2152d2b`, where one of
  two producers simply did not call the one owner.
- MEASURED to work (line 3 above) and idempotent (line 4 unchanged).

Costs and risks, stated:
- One extra generation per setup change. The transaction already generates once
  (`profileProgramTransaction.ts:203`), so this is a second pass on a rare,
  explicitly-confirmed athlete action, not a per-render cost.
- The re-derivation regenerates from the ANCHOR and rebases on today, while the
  transaction generated on `input.todayISO`. Boot is the authority on that
  disagreement, so the settle result is the correct one — but the two must be
  proven equal for the no-op case or every setup save would silently reshuffle a
  week. **That is the cell to write first.**
- `leavingInSeason` above becomes dead once the derivation owns the marks; it
  should be DELETED in the same change, not left as a second author.

### Option B — RE-DERIVE THE MARKS INLINE IN THE TRANSACTION

Compute `nextMarkedDays` from the NEW profile using the same pure pair boot uses
(`storedGameAnchor` + `computeGameDatesForBlock`) instead of carrying
`before.markedDays`.

- Smaller and more targeted; no second generation.
- But it creates a SECOND site that derives fixture marks. Unless
  `deriveBootFixtureMarks` is extracted and shared, this is precisely the extra
  representation the escalation rule says to stop adding. Even shared, two
  callers must stay in step forever.
- Fixes this door only. The next door that changes an answer feeding fixtures
  has the same hole.

### Option C — DELETE THE STORED PROJECTION (the north-star endpoint)

Stop persisting `game`/`noGame` marks at all. The recurring fixture becomes a
read-time derivation of the profile answer; the ledger keeps the explicit
one-offs. Representation (2) ceases to exist rather than being kept in sync.

- Strictly the most correct: it makes the divergence UNREPRESENTABLE.
- **289 references to `markedDays` across 42 files.** This is an R5-sized
  deletion, not a fix for a reported defect, and it wants its own sequence
  alongside the existing R5 plan.
- Recommended as the DESTINATION, not as this change.

## 6. WHICH LEGACY PATHS SHOULD BE RETIRED RATHER THAN PATCHED?

- `nextMarkedDays` / `leavingInSeason` in `profileProgramTransaction.ts:359-364`
  — deleted under Option A, because the derivation then owns both the change
  case and the leaving case.
- Under Option C, `calendar-storage`'s `game`/`noGame` persistence and the
  `markedDays` mirror inside `acceptedMaterialContext`.

## 7. WHAT TESTS PROVE THE NEW OWNERSHIP BOUNDARY?

Written BEFORE the fix, failing first:

1. **The defect cell.** In-season, game day Saturday → Wednesday, committed
   through the real decision + transaction: the visible fixture dates fall on
   Wednesday **without a relaunch**. Fails today at line 2.
2. **Tap ≡ relaunch.** The same world after the change and after
   `rebuildDerivedWorld` produce the identical fixture set — the R5.1 property
   stated as an assertion. (Line 3 vs line 4 above.)
3. **The no-op guard.** A setup save that changes nothing that feeds fixtures
   (e.g. name only) leaves the visible week byte-identical. This is the cell
   that catches the Option A risk named in §5.
4. **Leaving In-season still retires marks.** The behaviour
   `leavingInSeason` was written for, now asserted against the derivation that
   replaces it — so deleting the branch cannot silently regress it.
5. **An explicit one-off survives.** A game added or cancelled by decision is
   still present after a game-day change, since the ledger replay owns it —
   proving the derivation did not flatten the athlete's explicit fixtures.

Mutation requirement: reverting the door's settle call must red cell 1 and
cell 2 and nothing else.

---

## RECOMMENDATION

**Option A**, with `leavingInSeason` deleted in the same change and cell 3
written first as the guard on its one real risk. Option C is the destination and
should be scheduled as an R5 item, not smuggled in here.

Awaiting Sam's ruling before code.
