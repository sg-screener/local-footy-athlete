# THE WEEK BOARD — plan, Sam 2026-08-25 (R-218)

**Seat `warmup`. Written BEFORE any code. Sam asked for the plan and answered
four questions; his answers are law here and are quoted, not paraphrased.**

## What he asked for, verbatim

> *"you hit manage sessions — you get taken straight here [the day list] — the
> dates should not be selectable ... the day should be broken into its own thing
> but in 2 sections if there is already a session or two sessions on that day ...
> For days where nothing is planned, they can just be one box. Game day is also
> one box. For rest days — you should have a + icon on the box to add a session
> that day, and follow the same pathway the current 'add a session' button does.
> For any box that has a session in it, you should have a trash can symbol ... and
> the other thing is — these boxes should be able to be dragged and dropped. You
> can't move more than 3 sessions to a day, and you can't move a
> strength/conditioning/mobility etc session to where a team training box [is],
> but you can drag a strength to a strength, or a strength to a free day, same
> with conditioning, gunshows, recoverys."*

## His four answers, asked before planning

| question | **his answer** |
| --- | --- |
| how many boxes can a day hold | **Two, and that's the cap** |
| drop a strength onto another strength | **They swap places** |
| does an empty box beside a session get a `+` | **Yes, `+` on every empty box** |
| can the team-training box itself be dragged | **Yes — this week only, no question asked** |

## THE ONE ARCHITECTURAL FACT THIS PLAN TURNS ON

**The boxes ARE the move scopes, and the drop rules ALREADY EXIST.**

A day is one workout carrying PARTS (`VisiblePartKind`: strength, conditioning,
recovery, team_training, game, speed, support). `move_session` already takes a
`scope` — `whole_day | strength | conditioning | recovery | team` — and
`planChangeProducer`'s `destinationsFor(scope)` already computes which days that
scope may travel to, already refuses an occupied G-1, and already says
*"every other day is a game, team training, or already full."*

**So the board renders that owner; it does not invent a second rule set.** Every
rule Sam listed is either already there or belongs in that owner. **A drop
legality computed in the UI would be a second authority nothing can tell apart
from the first when they disagree** — the exact shape this repo keeps paying for
(`week-identity-two-owners`, `a-legality-probe-is-not-a-change-probe`).

## Acceptance criteria

1. **Manage sessions goes straight to the board.** The nested Add / Move /
   Remove step (R-206) is deleted; the board does all three. The dates are not
   selectable and the whole-row tap-to-pick mode is gone.
2. **A day shows its parts as boxes.** One part -> that box plus one empty box.
   Team training is always its own box. A rest day or an unplanned day is ONE
   box. **Game day is ONE box and is not draggable and not a drop target.**
3. **Every empty box carries a `+`** and enters the existing add pathway for
   that date. Every box holding a session carries a **trash can** entering the
   existing remove pathway for that part.
4. **Drag and drop moves a session.** Legal drops come from the existing
   producer. A drop onto an occupied box **swaps** the two. A drop onto a day
   already holding two is refused. **Nothing may be dropped onto a team-training
   box.** A team-training box MAY itself be dragged, as `this_week_only`.
5. **Nothing is written except through `executeProgramControlActionDurably`** —
   the one program-change door, 26 typed actions. The board raises
   `move_session` (with the box's scope), `move_team_night` (route
   `this_week_only`), `bin_session` and the existing add flow. **No new
   mutation path, no new stored state.**

## Non-goals

- No new session types, no new generation, no change to what a session CONTAINS.
- **No change to the load engine or any §18 counter.** Moving work between days
  is what the existing move action already means.
- The **permanent** team-night route is untouched and still reachable from its
  own flow; the board just never asks the question (his answer 4).
- No multi-week drag. The board is one visible week, as today.

## HIS THREE CORRECTIONS TO THE FIRST DRAFT — these OVERRIDE it

**1. THE EMPTY BOX IS NOT A PROPERTY OF REST DAYS. IT IS A PROPERTY OF ROOM.**
*"if you add a session to rest day or drag a session there, then it would now be
that session + an empty box next to it like any other day"*.

This collapsed the rule rather than complicating it. **Boxes = the day's parts,
plus ONE empty box whenever the day holds fewer than two and is not a game
day.** A rest or unplanned day has zero parts, so its "one box" IS the empty box
— the same rule, not an exception to it. The first draft had rest days as a
special case; they are not one.

**2. A DAY MAY NEVER HOLD THREE, AND SPEED IS CONDITIONING.** *"no a day should
not be allowed to hold 3 sessions, speed is conditioning and should be treated
as such — so there should only ever be S+C, S+TT, S solo, C solo, TT solo, or
any of the other added sessions like mobility, recovery, gunshow etc can be
paired with C"*.

So the board folds `speed` into the Conditioning box. Two consequences:

- **The cap of two is a DISPLAY rule as well as a drop rule**, which is the
  opposite of what the first draft assumed. That draft was written before this
  answer and its resolution is SUPERSEDED.
- ⚠ **`speed` IS A SEPARATELY PRODUCED PART TODAY** (`projectVisibleWeek`
  emits it, `sessionComponents` types it), so `strength + speed + team_training`
  is expressible. Folding speed into conditioning makes that
  `strength + conditioning + team_training` — still three. **If a real week
  produces one, that is a DEFECT to show Sam with a screenshot, not something
  the board quietly truncates.** Checked in slice 2 against real generated
  weeks; a finding, not a blocker.

**3. THE OLD PATHWAY IS DELETED LAST, NOT FIRST.** *"maybe it's worth saving the
old pathway deletion until the end so it's easier to connect what happens when
you add a session, or remove a session etc"*.

He is right and it is not merely convenience: the board's `+` and bin CALL those
handlers. Deleting the menu rows first would have meant rewiring against a flow
that no longer had a working surface to compare against. **The handlers stay
live throughout; only the menu ROWS go, in the final slice.**

## Slices, each shippable and checked against the criteria above

**1. The board replaces the nested step.** Manage sessions -> board. Dates
inert. **The old Add / Move / Remove rows and every handler behind them STAY
LIVE** (his correction 3) — this slice changes where Manage sessions LANDS, and
nothing else. *Proof: a cell that Manage sessions opens the board; the existing
picker-mode cells still green, untouched.*

**2. Boxes, from the projection.** Boxes = parts + one empty box while the day
holds fewer than two and is not a game day. `speed` folds into Conditioning.
*Proof: cells over a week fixture covering every shape — strength alone,
strength + team training, rest, game — AND a census over real generated weeks
for any day that still yields three parts, reported to Sam if found.*

**3. `+` and trash.** Both enter the EXISTING pathways with the box's own date
and scope. *Proof: cells binding each glyph to the established handler, plus a
mutation showing a wrong scope reds.*

**4. Drag and drop.** Legality read from the producer; swap on occupied; refuse
on full, on team-training targets and on game day. *Proof: cells per rule, and
an adversarial pass that a drop the producer refuses cannot be committed by the
UI.*

**5. Team night drags as `this_week_only`.** *Proof: a cell that the board never
raises the permanent route, and that the route field is still populated.*

**6. LAST — retire the old rows.** Only now do the nested Add / Move / Remove
rows, their picker modes and their three signed strings go, with R-206's guards
INVERTED rather than deleted. *Proof: the picker modes gone, the strings
deregistered, and every board cell from slices 1-5 still green.*

## What could bite, named now

- **Drag on a scrolling list.** The week scrolls; a long-press-to-lift gesture
  must not fight the scroll. Expect a gesture-handler pass and a real device
  check before this is called WORKING.
- **`test:athlete-session-move`, `test:move-scoping`, `test:displacement-sweep`
  and `test:athlete-move-occupied-content-loss` all own move behaviour.** They
  are the safety net for slice 4 and must be run at every slice, not at the end.
- **R-206's guards** pin the nested step's exact words. They are INVERTED, never
  deleted (`gate-must-watch-the-deleted-surface`).
