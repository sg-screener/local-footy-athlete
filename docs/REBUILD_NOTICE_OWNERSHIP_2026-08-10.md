# WHO OWNS TELLING THE ATHLETE A REBUILD IS HAPPENING?

**LOOP CHECK: one thing carrying two meanings — sighting 7 — COMPRESS, and the
compression is this document.** `LAW-one-name-two-meanings` got its row an hour
ago and has now changed the answer four times: the replay latch, the witness
validation point, the knot's own pricing, and here. **The unit is framed as the
ownership question, not as "untangle the day screen"** — which is the seat's
order 2 and also what the measurement below forces.

---

## THE FREE WIN IS REAL — MEASURED, NOT HOPED

The seat's order 4 was to check this **before** scoping. Done:

| Path | Rebuild state it drives |
| --- | --- |
| `handleProgramControlResult` (every modifier action) | `setRebuildMsgIdx`, `rebuildMsgOpacity`, `runRebuild` |
| `executePhaseShift` (ruling 6's control) | `setRebuildMsgIdx`, `rebuildMsgOpacity`, `setIsRebuilding`, `clearRebuildError` |

**THE SAME FOUR PIECES OF STATE.** `useHomeScreen.ts:1328` and `:886` set the
identical values two hundred lines apart.

**SO ONE OWNERSHIP MOVE CLOSES BOTH.** Ruling 4's remaining strands and ruling 6
are one unit, and **that is the whole of the merge's remaining work** — which is
exactly what the seat asked to be confirmed before scoping, and it holds.

---

## THE TWO ROUTES, PRICED

### (a) ONE OWNER EVERY SCREEN READS — `useRebuildNotice()`

A hook owning `isRebuilding`, the message index, the fade value and the error,
with `runRebuild` as its one writer. `useHomeScreen` calls it and keeps rendering
the notice exactly as it does; the coach status screen calls it and renders the
same notice; nothing else changes.

- **COST:** one new hook; `useHomeScreen` loses four `useState`s and gains one
  call; **the day screen's rendering is untouched** — the notice component reads
  the same values by the same names.
- **RISK:** the rebuild state becomes shared, so two screens mounted at once
  observe one truth. **That is the intent** — a rebuild IS one event — but it
  must be a module-scoped store rather than per-hook state, or each caller gets
  its own copy and the bug looks like "the coach screen never shows it".
- **WHAT IT REMOVES:** the second meaning inside `useHomeScreen` — "the day
  screen's state" AND "the app's rebuild owner".

### (b) EACH SCREEN CARRIES ITS OWN NOTICE

- **COST:** lower today. No shared store, no boot-adjacent thinking.
- **RISK, AND IT IS THE DECIDING ONE: a second writer of one idea.** Two screens
  would each decide when a rebuild starts and ends, from the same underlying
  event, and **this repo has been bitten by exactly that class today** — the
  replay latch and the witness point are both one thing meaning two, and the copy
  gate, the day name and the count are the same shape earlier. A rebuild is ONE
  event in the athlete's world; two owners of it can disagree, and the first
  disagreement is "the coach screen says it finished while the day screen is
  still spinning".

## THE RECOMMENDATION, WITH THE REASON RATHER THAN THE PREFERENCE

**(a), AND NOT BECAUSE IT IS TIDIER.** (b) creates a second writer of a fact that
has one true value, which is the defect class this project has spent the whole
day paying for in five separate places. **The elegance rule asks which removes
classes of bugs: (a) removes "two surfaces disagree about whether a rebuild is
running" entirely, and (b) creates it.**

**THE ONE THING THAT WOULD CHANGE THE ANSWER:** if a rebuild triggered from the
coach page should NOT show on the day screen — i.e. if it is genuinely two
events. **It is not: `runRebuild` rebuilds the athlete's one program.**

---

## WHAT THE UNIT LOOKS LIKE, FROM ITS FIRST LINE

1. `useRebuildNotice()` over a module-scoped store — one owner, everyone reads.
2. `useHomeScreen` calls it; **its rendering does not change**, which is the
   assertion that proves the move was a move.
3. `handleProgramControlResult` and `executePhaseShift` become its callers.
4. **Then, and only then,** the modifier actions and the phase control mount on
   the status screen — and `LIVE_ACTION_KINDS` empties itself.
5. **Then the removals ship**: ruling 4's section and ruling 6's card leave the
   day screen, in the same commit as their replacement, per
   `LAW-removal-ships-with-its-replacement`.

**THE GUARD THAT MATTERS:** a tape proving a rebuild started from the coach page
shows its notice on BOTH surfaces and lands on the SAME decision the day screen
writes — the ownership boundary, not the pixel.

## NOT COVERED

- **NOTHING IS BUILT.** This is the shaped unit the seat asked for, and the
  measurement behind it, and no more.
- **THE STORE SHAPE IS NOT DESIGNED.** Whether it is a Zustand store beside the
  others or a smaller module is not decided.
- **`runRebuild` ITSELF IS NOT MEASURED.** It is the one writer and this document
  assumes it can move without changing; **that assumption is unverified** and is
  the first thing the next pass should check, because if `runRebuild` closes over
  day-screen state the price changes.
