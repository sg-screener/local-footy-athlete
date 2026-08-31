# STATUS — magnetic Manage Week drag (`weekdragux`, 2026-09-01)

## Owner request

Manage Week felt glitchy: cards floated without locking to a destination,
releasing between boxes did nothing, and Monday Lower could not be moved to
Wednesday even though Wednesday had room.

## Cause

There were two separate failures.

1. The board selected a destination only at release and required the pointer to
   be inside the exact small box. Row gaps and the date side of the row were
   dead zones, with no live feedback.
2. Monday was the past unlogged item named by the visible missed-session prompt.
   It remained disabled unless the athlete first tapped `No, move it`. When a
   past item did reach Wednesday's occupied half, it attempted a swap that would
   send future work back into the past, even though Wednesday's other slot was
   empty.

## Options compared

1. Keep exact-box hit testing and add a highlight after the pointer enters a
   box. This leaves dead zones and retains the impossible occupied-half move.
2. Resolve one continuous target from the measured day geometry, keep legality
   in the existing board/producer owners, and magnetically present the chosen
   slot. Treat dragging the one named missed item as the explicit move answer.

Option 2 landed. It removes the whole dead-zone class without moving any
programming or persistence decision into the screen.

## What changed

- The nearest measured day owns the gaps around it; outside the board cancels.
- Future-to-future drags can still select an occupied box and swap.
- A past unlogged source prefers the destination's empty slot across the whole
  row, because a future session cannot be swapped back into history.
- The exact past item named by the current missed prompt can be dragged
  directly. Every other past item remains locked.
- The destination gets a lime or blocked-red state and a haptic tick when it
  changes. The lifted card becomes opaque and magnetically settles into the
  target slot while the existing transaction finishes.

## Verification

- `test:missed-session-prompt`: 35/35.
- `test:week-board`: every new drag/target cell passes; one unrelated inherited
  session-plan adapter cell remains red (89/90 overall).
- Mutation: disabling empty-slot preference kills the exact Monday-to-Wednesday
  regression cell; restoring it returns that cell green.
- Product and devtools typecheck: zero errors. The compile gate remains red on
  five unrelated test-harness errors in four existing files.
- The release command remains red before its product witnesses because the
  inherited `exercise-removal-restart` seed cannot find its expected Back
  Squat. This change does not touch that seed or program generation.
- iPhone 17 Pro simulator: a real press-hold-drag showed the card lift opaque,
  magnetically lock to Wednesday with a lime outline, remain held, swap the two
  occupied sessions through the existing move owner, and expose Save changes.

## What catches the next defect of this class

The target resolver is pure and independently tests gaps, outside-board
cancellation, past-to-open placement and future occupied-slot swapping. The
screen binding also requires target updates during the gesture, not only at
release. A future layout change continues to feed measured frames rather than
duplicated style constants.

## NOT COVERED

- Physical-iPhone Release acceptance.
- VoiceOver announcements and Reduce Motion.
- Rapid flings across several rows.
- Physical glass coverage in this pass did not repeat fixture and team-training
  drags. Their existing board legality and canonical transaction cells remain
  green, and those routes were not changed.
