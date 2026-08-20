# STATUS — seat `restore`

**Mission (Sam, 2026-08-20):** fix the Restore-after-same-day-Injury-swap
integration conflict on `finish/integration-candidate` at `f583935b`, run only
the relevant sequence and restart/durability checks, and prepare a clean
candidate for merging. Do not merge to main.

**Worktree:** the existing integration worktree at `f583935b`. Its two
build-generated iOS files (`ios/LocalFootyAthlete.xcodeproj/project.pbxproj`,
`ios/Podfile.lock`) were not altered, staged or committed.

**Control:** a worktree detached at the same `f583935b`, sharing the same
`node_modules`, so every before/after pair below saw the same tree.

---

## ⚠ THE RECORDED MECHANISM WAS WRONG, AND THE INSTRUMENT SAYS SO

`docs/STATUS_FINISH_INTEGRATION.md` recorded the defect as:

> *"That answer is written as a day override, built from a week regenerated
> after the restart — and Settings' session-3 change removes an excluded row at
> AUTHORING time, so that regenerated week no longer contains `Bench Press` at
> all. The override is baked without it."*

The bisect in that report is correct and its conclusion about WHERE is not. I
instrumented the sequence walk and printed, at every step, three things the
report inferred rather than measured: the **stored program**'s row count, the
**day override**'s contents, and the day read with **no exclusion filter at
all** (a writer's read).

| step | authored day carries `Bench Press` | day override | stored rows |
| --- | --- | --- | --- |
| after REMOVE | YES — hidden by the read filter | none yet | 4 |
| after SWAP | YES — **the override kept it** | 5 rows incl. `Bench Press` | 4 |
| after ADD | YES | 6 rows incl. `Bench Press` | 4 |
| **after RESTART** | **NO** | **5 rows, no `Bench Press`** | **3** |
| after the INJURY swap | NO | 5 rows, no `Bench Press` | 3 |

**The row is destroyed by the RESTART, before any injury exists.** The
2026-08-19 writer-side seam (`coachActions.resolveDateWorkout` stating
`athleteExclusions: []`) is **not** ineffective — the override at step 2 proves
it is doing its job exactly as designed.

The decisive control is already in the durability suite and nobody read it that
way: **sequence [2] is remove → restart → restore, with no swap and no injury on
the day at all, and it failed identically.** A defect that reproduces with the
injury removed is not an injury defect.

**WHAT ACTUALLY HAPPENS.** Boot regenerates on every launch, and since
2026-08-20 `generateProgram` applies `applyExclusionsToAuthoredWeek` to the week
it authors — Sam's ruling, working exactly as ordered: *"A settings change must
not re-add an excluded lift to the stored accepted program and rely on
projection to hide it. Stored truth and visible truth must agree."* So the
removal reaches STORAGE. What did not follow that ruling is Restore.

---

## THE DEFECT, STATED AS OWNERSHIP

A removal writes **two facts**:

1. the canonical exclusion in athlete preferences, and
2. the `remove_exercise` action on the decision ledger, which **keeps replaying**
   — every boot rebuilds the world from that ledger.

Reversing it therefore has three parts, and **they were spread across three
doors at three different levels of completeness**:

| door | clears the exclusion | annuls the ledger removal | settles the world |
| --- | --- | --- | --- |
| `undoLastDecision` | yes | yes (its own reversal) | yes, awaited |
| Status' Restore (`activeProgramModifiers`) | yes | yes | **no — it ASKS a caller** |
| `restoreExcludedExercise`, the canonical owner | yes | **no** | **no** |

Sam's contract is *"changing or restoring must use the same canonical
transaction owner"*. Three doors doing three different amounts of work for one
act is that contract broken, and it is the two-representations shape this repo
keeps paying for.

And the owner's own `rebuildRequired` was **stale**:
`Boolean(previous) && previous!.scope !== 'today_only'`. That line was true while
a removal was only ever a read-time filter — restoring un-hid a row the stored
week still held, so nothing needed rebuilding. Once the removal reached storage
it became false for every scope, and a Restore reporting "no rebuild needed"
reports success over an unchanged session.

### ⚠ AND THE REBUILD THAT `rebuildRequired: true` BUYS IS THE WRONG INSTRUMENT

This is the finding that decided the fix's shape, and it is athlete-facing.
Walked headlessly through the **real** Status control (`getActiveProgramModifiers`
→ `clearActiveProgramModifier`, which returned `rebuildRequired: true`) followed
by the rebuild `useProgramRebuild` actually runs
(`generateProgramForProfileFromStore({ recordSelections: 'author' })` +
`commitRebuiltProgram`):

```
stored rows for the restored lift:  3  ->  0
visible on the day:                 absent, before and after
```

**The athlete taps "Restore exercise", confirms the rebuild, and the exercise is
gone from their whole program.** An author-path rebuild re-DECIDES the emptied
slot; `settleDerivedWorldAfterDecision` is generation under
`recordSelections: 'replay'` plus the ledger replay, so the composer RESTORES
what the block recorded (`blockSelectionHistoryStore`) and the athlete's later
swaps and adds are re-applied on top of a day that has the row back.

---

## THE TWO DESIGNS COMPARED, AS ORDERED

**(1) Incremental — preserve the hidden original row through the injury/rebuild
writes.** REJECTED. It is a return to a stored week that carries a row the
projection hides, which is precisely what Sam ruled against on 2026-08-20. It
also cannot work: nothing was wrong with the writes. The override at step 2 of
the table above already carried the hidden row.

**(2) Single-owner — Restore derives/replays the exact recorded removal target.**
CHOSEN. It stores nothing new, adds no second representation of the session, and
the recovery mechanism it uses already exists and was already documented: the
Settings lane's own guard records the walk `STORED 4 -> 4 -> 0 (relaunch) -> 0
(restore) -> 4 (the rebuild restore asks for) -> 4 (next relaunch)` and names
`blockSelectionHistoryStore` as what gives the lift back. The fix is to make the
canonical owner perform that act instead of describing it.

---

## THE CHANGE

**`src/utils/exerciseExclusionOwner.ts`** — the owner.
- `restoreExcludedExercise` now reverses BOTH writes: it clears the decision and
  annuls the outstanding ledger removal. It tries the canonical identity first
  and then the name as given, because the ledger stores the action verbatim and
  canonicalisation may have rewritten it (`"rdl"` → `"RDLs"`).
- `rebuildRequired` is `Boolean(previous)` — every scope, including
  `today_only`, with the reason written at the line.
- NEW `restoreExcludedExerciseDurably` — the DOOR. The reversal, then
  `settleDerivedWorldAfterDecision()`, returning `rebuildRequired: false`
  because the world is already settled. The same plain/durable split
  `executeProgramControlActionDurably` has on the forward side.

**`src/utils/activeProgramModifiers.ts`** — drops its `annulOutstandingRemovalFor`
call. Behaviour identical; only the authorship of the second reversal moved,
and now every door gets it.

**`src/screens/coach/useCoachNoteActions.ts`** — My Status' "Restore exercise"
routes through the durable door, the same shape the injury arm beside it already
has, so the athlete's control no longer reaches the author-path rebuild that
took the lift to 0 stored rows.

**Harness** — `athleteJourney.putExerciseBack` and the restore call sites in
`sessionChangeSequenceTests`, `sessionChangeDurabilityTests` and
`exerciseRemovalOwnerTests` take the DOOR rather than the inner function.
**No `ok(...)` expectation was edited, renamed, weakened or deleted in any
suite.** The claims are the ones that were failing; what changed is that the
harness drives the act the athlete's control performs instead of one step inside
it.

---

## RESULTS — CONTROL vs BRANCH, SAME node_modules, SAME `f583935b`

| suite | control | branch |
| --- | --- | --- |
| `test:session-change-sequence` | 21 passed / 1 failed | **22 / 0** |
| `test:session-change-durability` | 40 / 7 | **42 / 5** |
| `test:exercise-removal-owner` | 34 / 1 | **35 / 0** |
| `test:exercise-restore-owner` (NEW) | — | **22 / 0** |
| `test:session-change-hub` | 65 / 0 | 65 / 0 |
| `test:injury-recomposition` | 41 / 0 | 41 / 0 |
| `test:undo-reversal` | 24 / 0 | 24 / 0 |
| `test:settings-persistence` | 187 / 0 | 187 / 0 |
| `test:block-selection-authority` | 5 / 0 | 5 / 0 |
| `test:coach-note-action-source` | 4 / 0 | 4 / 0 |
| `test:exercise-add-candidates` | 21 / 0 | 21 / 0 |
| `test:exercise-swap-choices` | 30 / 1 | 30 / 1 — same failure text |
| `test:exercise-exclusions` | 53 / 1 | 53 / 1 — same failure text |

**GAINED 3, LOST 0.**

**THE DURABILITY SUITE'S FIVE REMAINING REDS ARE THE PRE-EXISTING ONES, NAME FOR
NAME, AND NOTHING WAS DONE TO THEM** — not renamed, not weakened, not skipped:

- *CONTROL — all three changes are visible before the restart*
- *CONTROL — the injury really does forbid the athlete's choice (else this case proves nothing)*
- *the illegal choice is NOT shown*
- *the athlete is TOLD why — the standing-in row names their exercise and the injury*
- *the reason survives the restart too*

The two that disappeared are the two the mission named:
*RESTORE returns the EXACT original session — the row is back in its place at
its load* and *RESTORE brings the removed row back*.

`test:exercise-removal-owner`'s red — *"and after a restart, Restore still
returns every day"* — was pre-existing on the control and is **the same defect on
a different scope** (`this_block`). The same owner change closed it, which is the
best evidence available that the fix is systemic rather than shaped to two
suites.

---

## THE CHAIN

`test:session-change-sequence`, `test:session-change-durability` and
`test:session-change-hub` were all OUTSIDE `test:bible`, which is why a full
sweep reported `GAINED 0` over a candidate carrying an athlete-facing
regression. *A check outside the chain is a check nobody runs.*

**ENTERED THE CHAIN** (405 links, up from 402), each armed with
`armTotalsOrRed`/`totalsPrinted` first:

- `test:exercise-restore-owner` — the new guard, 22/0
- `test:exercise-removal-owner` — 35/0
- `test:session-change-sequence` — 22/0

**DELIBERATELY NOT IN THE CHAIN, AND WHY:**

- `test:session-change-durability` — 42/5. Adding it would either break the chain
  or require weakening five failures that belong to another subject. Its two
  RESTORE scenarios are reproduced in the new guard instead, so the property is
  in the chain while the five stay red where they are.
- `test:session-change-hub` — 65/0 measured on both trees. Green and eligible,
  but it is a hub-routing suite, not a sequence/restart guard, and it prints its
  totals in a shape that needs its own arming work. **Named here so it is a
  decision, not an oversight.**

**Chain-definition guard re-run:** `test:totals-or-red-law` is deeply red at base
(124 unarmed chain suites). The suites it NAMES are **identical on both trees —
126 names, zero added, zero removed** — so the three new links entered armed and
clearing. `test:law-registry`: 143 rows → 144, 122 guarded → 123, **UNENFORCED
stays 21** (the ratchet only falls), and its two pre-existing failures (LR-18
with no row; 21 unenforced) are unchanged.

---

## MUTATION — THREE OF THREE KILLED

Subject: `src/utils/exerciseExclusionOwner.ts`. Tree restored from my own
scratchpad backup after each and verified byte-identical (same sha256, 12430
bytes, before the first mutation and after the last).

| # | mutation | new guard |
| --- | --- | --- |
| M1 | the outstanding ledger removal is not annulled | **5 red** |
| M2 | `rebuildRequired` exempts `today_only` again | **6 red** |
| M3 | the durable door does not settle | **5 red** |

M1's most telling cell is *"and the decision itself is gone, not merely
out-voted"*, which comes back `["Bench Press"]` — the ledger replay writes the
exclusion straight back. That is the half-reversal the owner used to ship.

---

## THE NEW GUARD PICKS ITS INJURY BY MEASUREMENT

`TARGET` is an UPPER day, so the area decides whether case [2] can say anything
at all. Swept over six areas at severity 6:

| area | what the injury did |
| --- | --- |
| knee | **nothing** — *"Nothing on this session needed changing"* |
| shoulder, chest | swapped four rows, **and forbids the restored press too** |
| elbow, wrist | swapped four rows |
| **lower back** | swapped four rows, horizontal pressing stays legal |

A knee makes every cell pass by not applying. A shoulder makes the restore FAIL
**correctly** — the restored `Bench Press` is itself unsafe under it, so the
injury substitutes it, which is *"do not show the illegal choice"* working, not
a restore defect. Lower back is the only shape in which *"Restore returns the
exact row AND the injury swap is unchanged"* is a question with an answer, and
the non-vacuity control fails rather than passing quietly if that ever changes.

---

# NOT COVERED

- **NOTHING WAS SEEN ON GLASS.** The mission scoped the simulator out and said
  the required simulator checks were already done. Every claim here is headless
  — including the My Status "Restore exercise" re-route in
  `useCoachNoteActions`, which is athlete-facing code that has not been tapped.
  **It is the one change in this commit whose door I have not watched a human
  path reach.**
- **`test:compile` is red on both trees** against the documented stale baseline;
  what was checked is that the branch adds no new diagnostics.
- **The five durability reds and the two swap/exclusion reds were not
  investigated** — out of scope by instruction, and identical on the control.
- **`test:bible` was not run end to end.** The mission scoped the run to the two
  named suites plus the smallest chain-definition guard; the three chain links
  were each run alone and the chain-definition guards were diffed against the
  control.
- **The author-path rebuild's 3 → 0 result is recorded, not fixed.**
  `useProgramRebuild` is shared with the equipment and profile rebuilds. This
  commit routes the exclusion restore away from it; whether re-authoring should
  drop a lift from every week for any other door is **OPEN-UNKNOWN** and belongs
  to whoever owns that hook.
- **`getAthletePrefs`'s `today_only` projection reaching the composer week-wide
  via `prefs.excluded`** was read but not measured; `exclusionsForSelectionAuthority`
  withdraws the derived names on the replay path, which is the path that mattered
  here. Not investigated further.

## LOG

- 2026-08-20 — read `AGENTS.md`, `docs/CODEX_HANDOFF_2026-08-11.md` and the final
  blocker section of `docs/STATUS_FINISH_INTEGRATION.md`. Seat name `restore`
  chosen after `ls docs/STATUS_*.md`; no collision.
- 2026-08-20 — baseline reproduced (21/1 and 40/7), walk instrumented, recorded
  mechanism refuted, root cause traced to boot regeneration + a stale
  `rebuildRequired`. Hypothesis tested in a probe before any product edit.
- 2026-08-20 — owner fixed, durable door added, Status control re-routed, guard
  born, three suites entered the chain, three mutants killed, control worktree
  compared suite by suite.

Agent: restore
