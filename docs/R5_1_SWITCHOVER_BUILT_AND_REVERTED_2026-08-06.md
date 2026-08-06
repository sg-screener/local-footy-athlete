# R5.1 — THE SWITCHOVER: BUILT, PROVEN, REVERTED

Sequenced by `docs/R5_DELETION_SEQUENCE_2026-08-06.md` §3. This records a
unit that WORKS, pays a declared cell, and was reverted because it turns a
bible suite red — and the red is the interesting part, not the unit.

Nothing in this document is a note about intended work. Every claim below is
either MEASURED (a printed suite result) or labelled HYPOTHESIS.

---

## §1 What was built

One owner, `settleDerivedWorldAfterDecision` in `store/quiescentBoot.ts`:
`rebuildDerivedWorld()` under the replay latch. A door that lands a decision
settles by RE-DERIVING instead of keeping the incremental replan it built on
the way, so the week after a tap is the week after a relaunch by
construction rather than by agreement.

Wired at ONE call site: `createOrUpdateInjuryEpisode` (the injury door body).

The exact diff is `git stash show -p stash@{0}` — stash message
`R5.1 switchover WIP`, taken on `9da7ff16`, three files:
`store/quiescentBoot.ts`, `store/injuryEpisodeTransaction.ts`,
`__tests__/factDoorInputOwnershipTests.ts`.

## §2 What it pays — MEASURED

`npm run test:fact-door-inputs`, cell 3 ("a declared injury lands, the week
responds, and both survive a relaunch"):

- before: `RED (declared: 3, paid by R5 …)`
- after: `PASS 3`, and the suite's own ratchet printed
  **`DECLARED RED NO LONGER REDS — delete the entry: 3`**

The declared entry was deleted in the same working tree, per the ratchet
direction. That deletion is in the stash.

**The placement finding, which is the reusable part.** The settle was FIRST
wired at the executor boundary (`executeProgramControlActionDurably`) and in
the durable fixture door. Measured: it paid **nothing** — cell 3 stayed red
and `fixture-identity-3` stayed red, because both cells drive the door
BODIES directly, not the async executors. Plan §1's wording is literally
right and the executor boundary is literally wrong: *"body becomes
append-fact + re-derive"*. Those two unmeasured call sites were reverted
rather than committed, because a full regenerate per tap that pays nothing
is a cost wearing a law's clothes.

## §3 What it breaks — MEASURED

Full `test:bible` with the unit in: **printed `TRUE_EXIT=1`.**

> The completion notification for that same run reported **exit code 0**.
> This is the second recorded instance. Trust only the printed exit line.

One suite, `npm run test:injury-authority`, 12 passed / **5 failed**, every
failure the same signature:

```
Section 18 final-week rejection (planner_selected_target_miss:main_strength:2)
```

failing I1, I2, I3 (upper_body 9/10 only), I5, I6. Lower-body and
back_midline at every severity, and upper_body at 2/5/7, all still pass.
`main_strength` clears the §18 floor and misses the phase planner's selected
core target of 2 (`section18EffectiveWeekEvaluator.ts:862`).

## §4 The diagnosis so far

**REFUTED — "the derive path rejects a severe upper-body injured week".**
This was the first hypothesis and it is wrong. Probe, on the CLEAN tree
(switchover stashed): `factDoorInputOwnershipTests` cell 3's constraint
changed to `shoulder / upper_body / severity 9`, then run. The relaunch
derived a week with **no §18 rejection at all** — the cell reds on its
ordinary "the injured week changed across the relaunch" message. The probe
edit was reverted; the tree is clean.

So the rejection is not a property of severity, region, or the derive path
on its own. It is a property of the world the failing suite is in.

**What is different about that world — MEASURED.** `injuryAuthorityOwnershipTests`
builds its world with `seedSpentWeekFriday()` + `markSpentDaysDone()`. The
fact-door world has no completed sessions; this one has four, recorded
through the real results door (`commitSessionOutcomeTransaction`).

**The structural fact that makes this matter — MEASURED.**
`types/decisionLedger.ts` has six decision kinds: `plan_change`,
`fixture_add`, `fixture_remove`, `fixture_move`, `reversal`,
`migrated_day_placement`. **A session outcome is not one of them.** Results
are persisted as inputs (`sessionFeedback`, `weightOverrides` in
`programStore`'s partialize) but a results decision's EFFECT on the week is
not replayed by `rebuildDerivedWorld`, because there is nothing to replay it
from.

**REFUTED — "re-derivation loses completed training".** That was the second
hypothesis. It is also wrong, and the measurement that killed it found the
real cause.

## §4b THE ROOT CAUSE — MEASURED. The generation anchor has two homes, and
## boot reads the empty one.

Probe: seed the spent-week world, record four sessions Done, then call
`rebuildDerivedWorld()` directly **with no injury anywhere in the picture**.
Printed:

```
BEFORE re-derive
  anchor : {"store":null,"program":"2026-07-20","weeks":["2026-07-20","2026-07-27","2026-08-03","2026-08-10"]}
  week   : Lower Body Strength | Team Training + Upper Pull | Team Training + Upper Push
  verdict: ADMISSIBLE
AFTER re-derive (no injury anywhere)
  anchor : {"store":"2026-08-06","program":"2026-08-06","weeks":["2026-08-03","2026-08-10","2026-08-17","2026-08-24"]}
  week   : (no week)
  verdict: THREW: Accepted effective week unavailable for 2026-07-20: Contract v2 is missing
  sessionFeedback keys: 3
```

The injury was never the subject. **Re-deriving moved the athlete's entire
program forward to today and deleted the week they were in.** The results
inputs survived (3 `sessionFeedback` keys) — the week they belong to did not.

The cause, read from source and confirmed by the printout:

- `rebuildDerivedWorld` (`quiescentBoot.ts:197`) reads
  `storeState.generationAnchorISO ?? todayISOLocal()`.
- **That store field has no writer anywhere in product.** `grep` over `src/`
  excluding tests: `generateProgram.ts:992` sets `generationAnchorISO` on the
  PROGRAM object; `programStore.ts:332` and `:2225` persist
  `state.generationAnchorISO ?? null`; `:2249` rehydrates it. Nothing ever
  assigns it. The persisted "anchor input" is therefore **always `null`**.
- So the fallback is not a fallback. It is the only branch that ever runs,
  and every re-derivation anchors to TODAY.

One input, two homes — `programStore.generationAnchorISO` and
`program.generationAnchorISO` — and the derive owner reads the one that is
always empty. This is the repo's own one-owner class, inside the rebuild's
own boot.

**Why every gate missed it.** A world created today has anchor == today, so
both homes agree and the bug is invisible. `quiescentBootTests` proves "the
visible week survives a relaunch by derivation" on worlds born in the same
process on the same day. The defect needs a world whose program was
generated on an EARLIER day — which is every real athlete after day one, and
no suite. This is `gate-passing-on-coordinates-it-never-builds`, fifth
sighting.

**Athlete-reachable, and R5.1 did not cause it.** `rebuildDerivedWorld` is
what BOOT runs. On the measurement above, an athlete whose program was
generated on 2026-07-20 and who relaunches on 2026-08-06 has their program
re-anchored to 2026-08-06. R5.1 only called the same body earlier in the
day, so a gate finally stood somewhere it could see.

**NOT MEASURED, and it decides the severity:** what Sam's phone actually
does. The season-phase clock IS a persisted input and IS passed to
generation, so block/phase may be held steady even as the anchor moves —
which would explain why the R1 and R2 device passes read as "everything
still there". Whether the re-anchoring is cosmetic or destructive on a real
worn world is the next measurement, and it is the one that decides whether
this is a blocker or a defect with a queue position.

## §5 Why it was reverted rather than declared

A new declared red is how a defect gets hidden behind a green gate. The
declared-red ledger exists for findings that are ROOT-CAUSED and RULED, and
this one is neither yet. `HEAD` is left green, the unit is one `git stash
pop` away, and the finding is written down where the next seat starts.

This is the same shape as finding 3 (`9d676e7c`): the ruled fix was built,
proven, and reverted once it exposed a defect underneath it.

## §6 State of R5 at this checkpoint

- `9da7ff16` — the R5 sequence doc. Committed, tree green.
- R5.1 — built and proven, REVERTED, in `stash@{0}`. Blocked on §4b.
- R5.2–R5.8 — not started. All of them sit behind the switchover.

**The next seat's order of work, and it is not R5.2.**

1. **Fix the anchor's ownership** (§4b). One home for the generation anchor,
   read by the derive owner. It is a small change with a large blast radius,
   and it is a prerequisite for the whole switchover: every batch after R5.1
   makes derivation more authoritative, and derivation is currently anchored
   to the wrong day.
2. **Build the gate that would have caught it** before fixing it — a world
   whose program was generated on an earlier day, relaunched. Every existing
   boot suite is same-day, which is why 138 links missed this.
3. Then `git stash pop` R5.1, and re-run `test:injury-authority`. If the
   anchor was the whole cause, those five cells go green with no further
   change to the switchover.
4. Then R5.2 onward, per `docs/R5_DELETION_SEQUENCE_2026-08-06.md` §3.

**Baseline evidence:** full `test:bible` on `91446fe3`, clean tree, printed
`TRUE_EXIT=0`, chain reached its last suite.

## §7 NOT-COVERED

- The §4 hypothesis is unmeasured. Everything downstream of it is open.
- `fixture-identity-3` is untouched and still declared-red. R5.1 as built
  does not pay it: that cell drives `executeFixtureMutationInMemory`, and
  the replan it measures lives inside the interpreter that ledger REPLAY
  itself runs — so re-deriving reproduces it. Paying that cell means the
  fixture path stops composing a week at all, which is R5.3/R5.6, not R5.1.
- `fact-door-inputs` cell 6 (the stranded session cap) is unchanged and
  still declared-red.
- No device pass. Nothing here has been on hardware.
