# STATUS — Manage Week finish (`weeksave`, 2026-08-26)

## Owner request

After an add, move or removal in Manage Week, show one `Save changes` button.
The underlying transaction is already durable; the button gives the athlete a
clear finish, briefly confirms, then returns to the ordinary Week view. Sam's
follow-up simplified the presentation: no disabled save control before a
change; the button appears only after one.

## Options compared

1. Set a dirty boolean in every current add/move/remove success callback.
2. Capture the board projection when editing opens and compare it with the
   current visible projection.

Option 2 landed. It automatically covers training and games plus future board
doors, and a refusal or no-op does not claim there is something to save. Both
fingerprints are transient screen state and are never persisted.

## Test-first receipt

The new Week-board section first stopped on the missing fingerprint export.
After the helper existed it reached the UI checks at 79 pass / 2 fail. After the
button and finish path were mounted it reached 81 pass / 0 fail.

The button is absent before a change, appears afterwards, briefly reads
`Changes saved` with a tick for 1 second, then closes Manage Week. Once changed,
the old Cancel exit is absent and the Day/Week toggle cannot silently close the
editing visit. Existing transaction owners are untouched.

Mutation proof: replacing the fingerprint with one constant changed the focused
suite from 81/0 to 80/1 and killed the visible-change cell while its unchanged
control stayed green. Restoring the implementation returned it to 81/0.

## Verification

- `test:week-board`: 81/81.
- `test:signed-copy-extraction`: 7/7; both new strings are registered.
- `test:compile`: inherited workspace baseline is red; it reports no new
  diagnostic in any file changed by this unit.
- The Week-board suite now runs through the in-chain day-first command.
- iPhone 17 Pro simulator: Save is absent on entry, appears after removing a
  session, stays visibly docked above the tab bar, and returns to ordinary Week
  view after the tap.

## NOT COVERED

- Physical-iPhone Release acceptance.
- VoiceOver speech/order.
- Leaving the app via a bottom tab while Manage Week is open.
