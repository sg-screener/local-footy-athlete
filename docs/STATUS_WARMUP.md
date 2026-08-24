# STATUS — seat `warmup`

## 2026-08-25 — the warm-up is a second, unstored session list

**Sam's report:** *"i think the mobility warm up is constantly missed
somehow ... it's like it's seen as something else vs the strength work"*.

**One cause under every symptom.** The warm-up is DERIVED beside the workout
(`selectMobilityPrehabFlow`), not stored in it, so each surface must remember to
ask for it separately. The ones that forgot are the ones he noticed.

### Measured, headless, through the screen's own owners

| probe | result |
| --- | --- |
| header count vs the plan | `metaCount` = **8**; the execution plan holds **12** (8 strength + 4 warm-up) |
| swap one main lift | **2 of 4** warm-up movements re-derived |
| reload after that swap | **2 of 4 ticks lost**; Mobility section `full` -> unknown; 3 items orphaned |
| the athlete's OWN warm-up swap | **lost** — its decision is keyed to a slot id that no longer exists |
| equipment reduced | flow shrinks 4 -> 3 (documented shrink-never-pad; 1 orphan) |

### Built

- **R-213** retention: `performedMovementIds` is a **required** field on
  `MobilityPrehabFlowContext`. Required, because the defect class is a surface
  FORGETTING the warm-up and an optional field is one a new screen omits without
  noticing. Both call sites (session screen, week card) answer it.
- **R-214** header: date line + count deleted, `Start session` in its place,
  `SessionDateLine.tsx` deleted, `DATE_LINE_HEIGHT` moved to its one consumer.

### Receipts

- `test:mobility-flow` **74 passed, 0 failed** (was 59/0; §7 is 16 new cells).
- `test:session-execution` **192 passed, 5 failed** — the 5 are the same 5 as at
  HEAD; the sixth HEAD red was the date-line cell this work replaced.
- `test:compile` output is **byte-identical to a control worktree at HEAD**
  (64 pre-existing reds, none in the touched files).
- `visible-surfaces`, `approved-icons`, `accessibility-contracts`,
  `day-first-timeline`, `ruling-registry` — all identical to the HEAD control.
- **Mutation-proven, 4 for 4.** Neutering retention, dropping the fresh-fill
  dedup, removing the count cap and ignoring the ticked flag each red exactly
  one cell. **The dedup mutation SURVIVED TWO CELLS FIRST** — with every
  movement ticked, restoring them all and trimming to the menu count gives the
  same four either way, so the cap hid the missing dedup. The cell that catches
  it ticks ONE movement: `[a] + [a,b,c,d]` capped at four is `a, a, b, c`.
- Seen on glass, iPhone 17 Pro, `standard-in-season-week`: the header reads
  `LFA` then `Start session` on the left with the options dots right, no
  calendar and no count; warm-up ticked 3/3 and the log form read
  `Mobility / Warm-up  Fully 3/3`.

### NOT COVERED

- **A tick that has not been saved yet.** Retention reads the durable record, so
  ticking a warm-up and changing a main lift *before* logging can still re-pick
  it. Raised to Sam rather than guessed at.
- A relaunch-persistence pass. The dev harness refuses a checkpoint reload once
  a session has been logged (seed fingerprint mismatch — harness, not product),
  and Sam stopped the simulator work before another route was tried.

### Seen in passing, NOT this seat's work

- `test:session-execution` has a red at HEAD: *"the day card reads Mobility
  completion from that saved checklist owner"*. `recordedExecutionSectionCompletion`
  has **no production caller** — `HomeScreenV2` never calls it — while
  `lawRegistry:1877` records that binding as BORN GUARDED. A red guard shipped.
