# STOP — 0e IS BUILT, THE FLOW SET WAS NOT A SET, AND THE CENSUS FOUND A DEFECT

**LOOP CHECK:** *a flow asserts a world that no longer exists* — **sighting 2**
for this exact file (`lower-body-deletion.yaml` was re-aimed on 2026-08-10 for
three separate staleness faults; it was stale again today).
**Disposition: ITERATE, because the compression already exists and it worked.**
`docs/GOLDEN_FLOW_RUN_RECEIPT.md` carried that flow as `NOT RUN` — the instrument
said out loud that nobody could know, which is exactly what it was built for on
2026-08-10. Nothing new to compress; the receipt now carries today's runs.

**HEAD:** `ce09b522` on `main`. Branch verified immediately before the commit.

---

## 1. THE CENSUS THE ORDER DEMANDED FIRST

**Sam's plan, quoted in the order:** *"You do not need a brand-new temporary
Maestro flow for every bug. Keep a handful of canonical athlete flows."*

`.maestro/` holds **29** flow files: 12 golden, 3 action-trace-v2, 12 common
building blocks, 2 keyboard. Against the five canonical actions the order named:

| # | Canonical action | Before this pass | Evidence |
| --- | --- | --- | --- |
| 1 | **Move a session** | **NOTHING** | `golden/fixture-move.yaml` and `action-trace-v2/fixture-mutation-reload.yaml` both move a **game**. The `session-move-*` selectors had no caller in `.maestro/`. |
| 2 | **Delete a session** | **HALF** | `golden/lower-body-deletion.yaml` taps the real delete door at ONE part-scope (`strength`). No whole-day scope, no relaunch. |
| 3 | **Preview and approve a repaired week** | **NO DOOR TO TAP** | `SUPPORTED_ATHLETE_ACTIONS.md` 5.4 — *"DECIDED 2026-07-22, NOT BUILT"*. `PlanChangeSheet` applies a change and shows a `result` step; there is no proposal to approve. |
| 4 | **Relaunch and prove persistence** | **EXISTS** | `golden/reload-standard-week.yaml` + `common/checkpoint-and-reload.yaml`, reused by the three trace-v2 flows. |
| 5 | **Clear / reverse an adjustment** | **NOTHING** | `golden/day-readiness-profile-type.yaml` opens both readiness doors, asserts the options and taps **Cancel**. `action-trace-v2/restoration-reload.yaml` restores a **fixture**, and reaches it by tapping the words `"Restore fixture"` — the copy coupling `stableTestId.ts` exists to prevent. The `readiness-clear-action-*` and `adjustment-restore-*` selectors had no caller at all. |

**THE EXPLORER CAMPAIGN DOES NOT CLOSE 1 OR 2, AND THIS IS THE FINDING THAT
DECIDED THE UNIT.** `explorer-all-nine.yaml` runs `smoke-whole-session-deletion`,
`smoke-fixture-move` and friends — but a scenario dispatches a **typed action**
(`type: 'session.delete'`) through `ExplorerActionIngressControl`, a 2x2px,
0.01-opacity, dev-only `Pressable`. Its `controlTestId` is a **claim** that a
particular real control corresponds to that action. That proves the action
executes and the receipt renders. **It cannot prove the athlete's button works**,
and "the harness enters below the door" is a sighting this repo already has a
name for.

**WHICH ARE ONE-OFFS TO RETIRE — ANSWERED, AND THE ANSWER IS "NOT YET".** The
five UI-merge flows (`day-card-dropdowns`, `day-readiness-profile-type`,
`day-week-profile`, `profile-setup-equipment`, `coach-my-status`) look like
eye-pass one-offs, but **four of them are named as guards in
`src/rules/lawRegistry.ts`**. Retiring one means moving a registry row's guard,
which is a ruling-shaped act, not tidying — and this suite has a cell demanding
that a removal names where the behaviour went. **Recommended, not done, and the
seat should rule:** fold `day-readiness-profile-type`'s menu assertions into the
new adjust-and-clear flow, and re-point its two registry rows. `fixture-move` and
`restoration-reload` stay: a game is not a session.

## 2. WHAT WAS BUILT — TWO FLOWS, ONE EXTENSION, ALL DRIVEN ON GLASS

**Nothing here was authored blind.** Every selector was read off the live view
hierarchy first — the move sheet, the destination list, the readiness sheets —
which is why both new flows were green on their first run.

- **`golden/session-move.yaml`** — today's whole session onto **Sunday 19 Jul**,
  the only destination the picker offers as empty ("Currently a rest day"); the
  other four are swaps, and a swap changes two days at once. Monday redraws as
  `rest`, Sunday as `scheduled`, **and both survive a checkpoint and relaunch**
  (pass criterion 5). Asserting only the source would pass while the session fell
  on the floor — the conservation defect this repo keeps re-finding.
- **`golden/readiness-adjust-and-clear.yaml`** — **severe** illness, chosen on
  purpose: a mild report is INERT by ruling (3.2, *"week unchanged unless the
  soften offer is accepted"*), so a flow built on it could pass with the whole
  adjustment layer dead. It asserts the fact, the adjustment **and the
  programming effect** — `readiness-active-*` alone would only prove the app
  recorded something — then clears it with *"Clear adjustment — I'm good now"*
  and proves the reversal survives a relaunch.
- **`golden/lower-body-deletion.yaml`** — extended with the `whole_day` scope and
  a relaunch, so "delete a session" is finally the whole action.

## 3. THE DEFECT THE CENSUS FOUND — AND IT IS AN ATHLETE ONE

On the `lower-body-deletion` seed, today's card is titled **"Strength"** and
draws **Mobility / Warm-up + Lower Body Strength**. Delete the strength part and
the card retitles itself **"Conditioning"** and draws a conditioning part —
**one exercise that was there the whole time.**

**The athlete has training today that the day card does not show them**, and it
only becomes visible when something else is removed. Both sides are photographed.

**NOT DIAGNOSED HERE, DELIBERATELY.** A projection defect is its own unit, the
compound-day naming rule already has rulings attached to it, and the generator is
under a stand-down. What this pass owed was to find it, prove it and hand it over
— which is what a canonical flow set is for, and it paid on day one.

## 4. WHAT HOLDS IT

**`test:repo-law-guards` 37 → 38 cells. Registry 99/67 → 101/69, UNENFORCED
unmoved at 32.**

- **`LAW-canonical-athlete-flows`** — every named flow still on disk, and **at
  most ONE** canonical action may be fileless. The fileless one is named
  (#3, no door), so the set cannot quietly drift back into a flow per bug.
- **`LAW-memory-not-a-law-store`** — **PARTIAL and the row says so.** The memory
  store is machine-local and outside the repo; no cell can read what is in it.
  What the cell holds is that the ban and its destination are still written where
  every session reads them.

**THE MUTATION RUN CAUGHT TWO VACUOUS CELLS OF MINE**, both the same family and
neither findable by reading:

1. The first assertion matched a **heading** (`/AUTO MEMORY/i`), so replacing the
   entire law with *"Auto memory is handy."* left it green.
2. The second read the **whole section** for `lawRegistry.ts` — which the
   source-of-truth line four paragraphs above already names — so deleting the
   destination from the memory rule left it green too.

Both are the vacuous-cell class this suite exists to catch, caught by mutating
rather than by reading. Four mutations now kill across the two new cells
(hidden flow file; deleted ban; deleted destination; deleted paragraph), and a
line-wrap bug in between (`product\nlaw`) reddened the paragraph it was written
to protect until the regex learned `\s+`.

## 5. NORTH STAR

**Neutral — instruments, not state.** The adjacency worth naming: flow 5 asserts
that clearing an adjustment **derives the original week back** rather than
restoring a stored copy, which is the north star's own claim made checkable on
glass for the first time.

## 6. NOT COVERED

- **THE RE-AIMED DELETION FLOW HAS NOT RE-RUN, AND THE REASON IS THE SIMULATOR IS
  SHARED.** Three `maestro test` processes from a concurrent agent appeared on
  this device mid-pass (`standard-program-week` ×2, `one-set-feedback`) and were
  still running at the end of it. **Two Maestro sessions interleave taps into one
  app, so the honest outcome is "unknown", not "red"** — my run was stopped
  rather than reported. The re-run is OWED and the receipt row says so.
  `AGENTS.md` warns the git index is shared; **the device is shared the same way
  and nothing said so before now.**
- **`test:compile` IS RED ON A FILE THAT IS NOT MINE** — untracked
  `src/__tests__/fixtureSettleAfterSetupTests.ts`, exactly 1 error, from the
  concurrent agent's work in this checkout. My own changed files add no new
  errors. Same shape the inbox already records for `anchorRepro.ts`.
- **NO ONE-OFF WAS RETIRED.** Four of the five candidates are named as guards in
  the registry; retiring one is a ruling, and it is recommended above rather than
  taken.
- **CANONICAL ACTION #3 HAS NO FLOW BECAUSE IT HAS NO DOOR.** If 5.4 is built,
  the set's declared gap closes; until then a flow for it would be a fixture for a
  screen that does not exist.
- **THE COACH AND ONBOARDING PATHS ARE NOT IN THE FIVE** and were not surveyed
  here — the order named five athlete actions and this census answers those.
- **NOTHING WAS CHECKED ON SAM'S PHONE.** Stand-down C. Nothing here needs it.
