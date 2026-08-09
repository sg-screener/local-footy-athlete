# UNDO SURFACE RULING — 2026-08-09 evening (supersedes the mock's questions)

Sam, on seeing docs/UNDO_MOCK_2026-08-09.html: **"the coach should be
its own tab and the athlete just talks to it when it wants to change
something without tapping all the buttons? we've spoken about this
before."**

He is right and it was already recorded: docs/LFA_PRODUCT_ARCHITECTURE.md
names the coach conversation as the athlete's change interface, and
R5.7's cut froze exactly that tab. The mock built a second
change-interface beside the recorded one.

## The ruling (seat, under Sam's direction; his veto was offered and
## not taken)

1. **The standing bar and the confirm sheet are DEAD.** They are not
   deferred; they are wrong-shaped. Change-talk — including "undo
   that", older unwinding, coach-made changes — belongs to the coach
   tab and gets designed ONCE, mock-first, in the coach rebuild
   kickoff.
2. **The only screen-level undo affordance is the transient toast**
   immediately after an athlete makes a change by hand: it names the
   change and offers Undo, one step, through `undoLastDecision`. This
   satisfies Sam's one-step ruling
   (docs/UNDO_SHAPE_RULING_2026-08-09.md) in the standard shape every
   app uses. It appeared as the mock's state B and survived Sam's
   ruling; A/C/D/E did not.
3. **The mock's four questions are VOID.** ① and ③ die with the bar,
   ② dies with the sheet (a toast undo is immediate; the honest
   shortfall case becomes plain words in the toast's result or the
   coach's mouth — coach kickoff decides which). ④ stands reduced:
   toast wording ships PROPOSED to a copy batch as all new strings do.
4. **Undo of a COACH-authored decision** (the build boundary's open
   question): PARKED to the coach kickoff — it is a coach-behaviour
   question and LR-6's boundary puts it there.

## Not superseded

Sam's one-step undo ruling stands. The undo machinery
(`undoLastDecision`, replay filter, boot honouring) is
surface-independent and untouched by this ruling.
