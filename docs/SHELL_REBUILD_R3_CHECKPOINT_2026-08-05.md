# SHELL REBUILD — R1.8 + R3 checkpoint, 2026-08-05

Branch `feat/stage-b-stage2`, continuing from R2's extraction (`aa5a70cc`,
Sam's install-over pass PASSED). Two units, each red-cells-first, each
committed on a full `npm run test:bible` EXIT 0 and a passing typecheck
ratchet. **Totals-or-red applies to this document: what is not listed as done
is not done.**

**THE NEXT GATE IS SAM'S DEVICE PASS ON THE DOORS. Nothing continues past
this checkpoint until he has run it.**

---

## Unit 1 — R1.8, the `?? 'restoration'` sweep (`f8147fb0`)

The carried item from the fixture-identity unit, paid. Sam's accept-and-reduce
ruling (2026-07-29) gave publication two kinds with opposite verdicts on a week
that cannot meet its contract; the CALL SITES were free to say nothing, and a
writer that said nothing inherited the strict one.

**What the default was doing.** On a world reached by acting — onboard,
generate, then mark next week as rest, which is the athlete stating a fact the
app does not refuse, so the marks commit and the shortfall is disclosed — six
athlete-visible doors read `restoration` and threw:

| door | what the athlete saw |
|---|---|
| season phase change | "The profile and program were rolled back because the accepted result could not be verified." |
| readiness answer | refused |
| removing your own override | refused — while PLACING one already declared `forward_decision` |
| the named erasure (onboarding complete, program create, profile reset) | refused |
| selecting another week | **could not open the week they had just made short** |
| republishing derived week overlays | refused |

**The season-phase one is evening-1's season-change failure with its layer
named — and it was TWO layers**, not one: `commitProfileProgramTransaction`
publishing unstated, and `factFreeBase` generating unstated one layer earlier.
R1.3 had already paid this class once at the three `weekRebuild` publications;
this is the sweep across the rest.

**What landed.** `AcceptedStateTransactionProposal.operation` is REQUIRED; the
override door's `operation` is REQUIRED; both `?? 'restoration'` expressions
are deleted. An unnamed operation is ALSO refused at runtime, because three
product writers reach the owner through `require(...)` where tsc cannot see
them and would otherwise have inherited the OTHER verdict — swapping one silent
default for its opposite is not a fix. 31 writers classified from what their
callers actually do, plus the 11 product generation call sites
(`weekAcceptance`).

**Restoration is still restoration, and now says so:** the reversible-adjustment
undo (all three proposals), the boot's replay generation, the rolling repair's
target generation (whose `catch` CONSUMES the throw as its signal), and
onboarding's first generation — declared strict under the 2026-07-25 honest
generation ruling, so a first week that cannot meet its contract still fails
loudly rather than installing something reduced.

**The gate.** `publicationOperationOwnershipTests` (`test:operation-ownership`,
chained, totals-or-red, 12 cells): the six doors on the acted shortfall world,
a CONTROL cell proving the same world without rest marks is whole, the
required-field law, the product generation sweep, the no-silent-permissive
guard, and the undo's strictness.

---

## Unit 2 — R3, the fact and season doors (`56eab2d4`)

Plan §2 class 2: "episodes and source facts move from
`acceptedMaterialContext` mirrors into their own input slices." R1.3 persisted
them. **Nothing read them back.**

**Measured:** declare a severe illness, force-quit, relaunch — facts=1 after
the door, facts=1 after rehydrate, **facts=0 after `rebuildDerivedWorld`**.
`materialContext` returns the accepted context when `revision > 0` and
otherwise composes a cold-start context from the armoured input stores; it
named three of them (calendar, readiness, coach-updates) and forgot the two
living in the program store's own input slice. R1.3's boot re-derives at
`revision: 0`, so **every** launch took that branch.

**It looked fine, and that is the worse half.** `coachUpdatesStore`'s
`activeConstraints` mirror separately persisted the constraint the fact had
derived, so the week still responded after a relaunch — carried by a store
plan §1 deletes in R5. A green standing on a surface the next slice removes:
the athlete's illness would have stopped shaping their week one release later,
silently, with no gate going red. The cells therefore **delete the mirror from
disk before the relaunch** and make the fact carry itself.

**The fix is one place** — the cold-start branch carries `temporarySourceFacts`
and `injuryEpisodes`, and `normalizeAcceptedMaterialContext` recomposes
constraints, injury compatibility and readiness FROM those facts. The fact is
the input; the constraint is derived output. That is the north-star direction,
not a new mirror.

**The gate.** `factDoorInputOwnershipTests` (`test:fact-door-inputs`, chained,
totals-or-red, 8 cells). Reported honestly:

- **Genuine reds paid by this commit:** illness (1, 2), injury (3), busy week
  (6) — each verified failing before the fix and passing after.
- **Green controls, and named as controls:** readiness (its own armoured input
  store), the season phase change (a profile answer + the anchor clock), the
  equipment answer, and "boot appends nothing with facts present".

### The two findings, declared not patched

Both are ratcheted declared reds; a declared red that stops redding owes its
entry's deletion in the greening commit.

**Finding 1 (cell 3) — the injured week changes across a relaunch.** Declaring
a 6/10 hamstring derives `Lower Squat + Continuous Aerobic` before the relaunch
and `Upper Push + Upper Pull` after it. The fact survives and the week
responds; HOW differs — an incremental REPLAN over the published week, versus a
full RESOLVE from inputs. This is the class Sam already ruled at the
fixture-identity unit ("the published week is a materialised REPLAN, derivation
is a RESOLVE, and no rebase input makes them equal") and it closes the same
way: **at R5's switchover, not by weakening the assertion here.**

**Finding 2 (cell 6) — a busy week changes nothing.** "I can only train twice
this week" lands as an input, survives the relaunch, derives a live `schedule`
constraint capping the week at 2 — and collapses no session. The door answers
"The schedule restriction is active. No visible session needed changing." on a
week showing three future sessions.

Cause, located: `maxSessionsThisWeek` has **exactly one consumer** in the repo
(the session-cap block in `validateMicrocycleAgainstActiveConstraints`), and
its only callers sit inside `canonicaliseHydratedState` — the HYDRATION path.
R1.3 replaced hydration with derivation, so the cap now runs on **no launch**,
and the fact door never called it. A live authored rule stranded in bypassed
machinery. It needs an owner on the derive path (§18 / resolver), which is a
unit, not a slice-boundary patch.

---

## What R3 did NOT do, deliberately

- **The fact doors still write through the heavy accepted-state transaction.**
  R3's job was making the facts INPUTS the boot reads. Retiring
  `temporarySourceFactTransaction` / `injuryEpisodeTransaction` bodies is R5's
  deletion, and doing it before Sam's pass would delete the machinery under the
  pass rather than after it.
- **Facts are NOT appended to the decision ledger, and that is the plan's own
  schema.** §2 puts life-facts in class 2 (their own input slices) and the
  ledger in class 3 (athlete EDITS). "Append + re-derive" is read as
  append-the-fact-to-its-slice. **If Sam meant fact decisions on the ledger
  too, say so and it becomes the next unit** — the union already has the
  extension note for it.
- The two findings above.

## Sam's device pass — the merge gate for these two units

Install over the top. Short list; anything off = what you tapped, what you saw.

1. **Change season mode** (Profile → season phase, e.g. Pre-season → In-season).
   Expected: it lands, the week re-derives, **no "couldn't be verified"**.
   This is evening-1's finding; it is the single most important tap here.
2. **Log sick** (week readiness sheet → illness, severe). Expected: it lands
   and the week visibly responds. **Then force-quit and relaunch** — expected:
   still sick, same week.
3. **Log an injury** (guided injury flow). Expected: it lands and the week
   responds. **Then relaunch** — expected: the injury is still there. *Known
   and declared: the week may come back with different sessions than it showed
   before the relaunch — finding 1. Note what you see; do not treat it as new.*
4. **Answer readiness**, then relaunch. Expected: the answer is still there.
5. **Delete a session, then undo it** on a week you have marked rest days in.
   Expected: both land; neither refuses.
6. *If you try a busy week: it will land and change nothing — finding 2, known.*

## Standing gates for whoever continues

Full `npm run test:bible` EXIT 0 before every commit; run it bare in the
background and read the true exit line. `git branch --show-current` before
every commit — the tree is shared. Commit BEFORE mutation-testing. A declared
red that stops redding owes its entry's deletion in the greening commit.
