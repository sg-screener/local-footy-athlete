# Stage B — Stage 1: what happened while you were out of credits

**For the Fable session that started stage 1 on 2026-08-04 and stopped mid-build.**
Written by the Cowork review seat, 2026-08-04 late. This is orientation, not
authority — the authoritative documents are named below and should be read
before acting.

---

## The short version

**Stage 1 is COMPLETE and GREEN.** Branch `feat/stage-b-stage1-l16-slice` at
`8dc35a2`, seven commits past where you left it. `main` is untouched at
`936bbf7`. Tree clean. **Unmerged by design** — L10 (Sam's device pass) is still
open for the whole unit.

`test:bible` ran **end to end, exit 0, zero FAIL lines, last link reached.** That
was the debt stages 0 and 1 both owed. It is paid.

---

## How it got done (the credit situation)

You ran out of Fable credits partway through Task A. Rather than lose the
context, Sam switched model in place — `/model opus` in the same terminal
session — which preserved everything you had in context. That session wrote the
checkpoint first, then did a deliberately narrow scope of work. A second Opus
session picked it up from the checkpoint and finished stage 1.

**The rule that came out of it, worth keeping:** switch model in place when the
context holds things not yet written down; start fresh when it has been. The
checkpoint doc exists so no session needs perfect knowledge.

---

## Read these, in this order

1. `docs/STAGE_B_STAGE1_BOUNDARY_REPORT_2026-08-04.md` — the real report
2. `docs/STAGE_B_STAGE1_CHECKPOINT_2026-08-04.md` — §9 first, then whole
3. `docs/PRECEDENCE_OWNERSHIP_REASSESSMENT_2026-08-04.md` — Task C's map, now
   partly superseded by measurement (see below)
4. `docs/LIGHTER_DAY_DERIVATION_UNIT_SHEET_2026-08-04.md`
5. `docs/MAS_RANGE_VS_BINARY_DECISION_SHEET_2026-08-04.md` — awaiting Sam
6. `git log --oneline main..feat/stage-b-stage1-l16-slice`

---

## The commits

```
8dc35a2  docs: the boundary report
c78d1d0  feat: Task D — L16 slice closes, L14 prefs injection, relaunch finds LR-27
b7a968e  feat: Task B — lighter-day trim derives from its fact; surface now coach-only
c3639fe  feat: Task C — one precedence ordering, one owner
3dc8d7f  docs: three corrections (task labels, stale Task C reservation, §9f provenance)
e232ce2  docs: scratch worktree removed
1c29a64  docs+census: LR-25 and LR-26 filed, two unit sheets, handover
5658038  test: declare the L-P3 combination red, build the matrix
0221d4d  wip: Task A — typed re-add restoration, legacy athlete deferral deleted, LR-3 4→2
5b1cb4d  docs: the stage 1 plan and the written golden predictions
```

---

## What each task actually found

### Task A (yours, finished as you left it)

Typed re-add restoration built; the athlete legacy deferral and both
`applyCoachRevisionDateOverrides` call sites deleted; LR-3 4→2, survivors
coach-owned under LR-6.

**The ruling's premise was stale and the diagnosis got sharper.** Occupied-day
stack adds had already migrated in an earlier unit, and `no_template_for_category`
was a no-op double refusal. The one real athlete residual was the active-removal
re-add. This was independently corroborated by `STORE_ARMOUR_RECIPE_2026-08-03.md`
lesson 16, which had already measured that no walked athlete tap door writes
`dateOverrides`.

### Task C — the important one, and it got SMALLER

The map said six copies with opposite orderings. **Measurement said otherwise.**

Running the existing agreement oracle first (`derivedRepairOwnershipTests`
`splitDays()` `:159`) showed it was **green only because its combination cell
authors the override on `aDayWithASession()` but marks rest on a hardcoded
different date — the two surfaces never collide on one day.** A probe that
collided them split immediately.

The real shape: **the two stacks were never ordering the inputs oppositely —
they run the same code.** The §18 gateway calls the live resolver with both
override surfaces blanked, so Priority 1 never fires and the mark wins.
Flattening demoted the override.

Consequences:

- The gateway blanking is **not** a defect to retire — the map's "genuine
  unknown" dissolved.
- Task C's scope **shrank**. Six copies now delegate to `src/rules/dayPrecedence.ts`.
- The accepted stack didn't move, which is why its suites stayed green untouched.
- The plan's predicted red never materialised: `coachScreenUAEFlowTests` [6]
  exercises a **resolver mock**, so it never pinned the ordering it is named for.

### Task B — lighter-day

Landed on a `readiness_reduction` overlay; `'lighter_day'` deleted from the
closed writer union (`programStore.ts:2581`). **`dateOverrides` is now coach-only
by construction.**

Its walker cell found a harness defect: the fresh-install reset cleared a mirror
before its source, so the mirror re-published inside the very `setState` meant to
clear it — the profile-mirror defect one store over. Fixed, and it now throws if
it ever fails to hold.

### Task D — L16 slice

The relaunch-identical cell found **LR-27 on its first run**, which is the whole
argument for L16. `derivedSessionProvenance` nests a full workout snapshot
recursively: chain depth 3→4, projected day payload **66,947 → 139,331 bytes
across ONE relaunch**, and it is written to disk. It roughly doubles per launch.

Filed and pinned, **not fixed** — it is LR-26's twin and Sam ruled the principle
there but not for this record.

---

## The class this session named (L12)

**A gate passing on coordinates its own fixture never builds.** Four sightings
now:

1. A declared red's "DEEP ONLY" note described the *walker's* reach, not the
   defect's — 56 observations where it recorded one.
2. The combination matrix axes agree on a coordinate the deep walker reds on —
   necessary but not sufficient.
3. The agreement oracle green because its fixture never collides the two
   surfaces on one day.
4. `coachScreenUAEFlowTests` [6] pinning an ordering it only ever asserts against
   a mock.

Three proposals in the report; the cheapest is a **non-vacuity assertion on the
fixture rather than on the outcome.** Not implemented.

---

## Gates at the boundary

```
test:bible                             EXIT 0 END-TO-END, 0 FAIL, last link reached
test:action-walker                     20/20
test:action-walker:deep                20/20, no pre-shrink violation
test:day-precedence-ownership          6/6   (NEW, chained)
test:derived-repair-ownership          4/4
test:readiness-ownership               22/22
test:program-override-ownership        7/7
test:athlete-door-matrix               431/431
test:session-list-combinations         5/5
test:section18-gateway                 91/91
test:legacy-census                     331/331
test:compile                           PASS — no file regressed
test:stage-b-generation-differential   3/3 byte-identical, no --write
```

---

## Carried honestly — the blind spot is unchanged

`team_night × [conditioning,strength]` **agrees in all 6 matrix observations
while the deep walker reds on it.** The declared red's coordinates do not
characterise the defect; row-level composition probably does, and the third axis
is unbuilt.

**Stage 1 is built over an unnamed defect.** No regex was widened. Depth reached
is stated per tier; the L16 cell is shallow on purpose and says so.

Also still true: the classifier owners (declared reds #1 and #3) are **unpaid**,
and the containment of the L-P3 combination was chosen by the **review seat, not
ruled by Sam.**

---

## SAM'S DECISIONS — awaiting him, do not guess these

**The three that block or shape further work:**

1. **Which ordering wins was decided from Sam's own device note, not from a
   ruling.** Task C converged the live path onto the accepted answer because
   `programStore.ts:1187-1196` calls the accepted answer "correct" (the screen
   prescribed Lower Squat on a day marked rest while the accepted week correctly
   held nothing). **The whole app now depends on that inference.** If the reading
   is wrong, the flip is contained in one module and two adapters — but that
   containment will not survive further building.

2. **The injury-filter behaviour delta from Task B.** A stored override was
   skipped by the injury filter (`source === 'manual'`); an overlay is not. **A
   lighter day is now re-filterable by a later injury.** Surfaced rather than
   decided inside a conversion. Athlete-visible.

3. **LR-27 — schedule or file?** It is on disk and doubles per launch. Does it
   get LR-26's ruling (delete the snapshot, keep the reference, re-derive at
   read), or does the displaced-session chain have a consumer the ledger snapshot
   does not?

**Also open, carried:**

4. **%MAS range-vs-binary** — the load-bearing question first: *was the ≤30s →
   110% rule authored as programming law, or is it code that accreted?* Nothing
   breaks until MAS becomes a number.
5. **LR-25** — does the producer's legacy-tail deletion stay, revert, or land as
   its own unit? The code is currently IN `0221d4d`; reverting is mechanical.
6. **LR-26** — ruled (delete the snapshot, re-derive at read), unimplemented,
   unscheduled.
7. **The declared L-P3 combination and the classifier owners** — narrowed, not
   closed.
8. **The legacy v1 `exposureContract`** materialising into stored overlays on
   hydrate. L15 says a writer of a retired shape is a red-gate defect. Is it one,
   or is the overlay's v1 field still load-bearing?
9. **The hydration-repair in-place branch** (`programStore.ts:1216-1219`) —
   inherited open from stage 0.
10. **The two-facts tie-break** in `activeReadinessFactIdForDate`.

---

## Where this leaves you

- Stage 1 is done and green; **stage 2 is the next engine work**, but nothing
  should build on the precedence ordering until Sam ratifies decision 1.
- The branch is unmerged and **L10 stands open for the whole unit** — Sam's
  device pass has not happened.
- Census is at 27 units (LR-1..LR-27), at its ceiling. The next finding raises it
  and the ratchet will demand justification.
- **Environment law still applies:** the working tree is shared. Verify the
  branch before every commit.

---

## Cost note

Fable at $10/M in and $50/M out, with context resent on every tool call and
subagents billing separately, put ~$50 through in about an hour. Levers that
worked: no parallel subagent fan-out, shorter sessions with a handover doc
instead of one long-running context, and reading the checkpoint rather than
re-deriving from source.
