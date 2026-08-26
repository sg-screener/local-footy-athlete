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

---

# STATUS — Session demos default muted (`weeksave`, 2026-08-26)

## Owner request

YouTube Shorts opened from exercise rows in the live session should default to
muted.

## Options compared

1. Append a `mute=1` query parameter to the embed URL.
2. Enable YouTube's documented iframe JavaScript API and call the documented
   `mute()` player method when the player reports ready.

Option 2 landed because YouTube documents the player method but does not list a
mute URL parameter among its supported embed parameters. Playback still waits
for the athlete's tap, and YouTube's normal sound control remains available.

## Test-first receipt

The new video-modal section began at 8 pass / 3 fail: no API enablement, no
stable iframe player id/API loader, and no on-ready mute callback. After the
supported player hookup it reached 11/0. Changing `mute()` to `unMute()` made
the exact behavior cell fail at 10/1; restoring it returned 11/0.

## Verification

- `test:video-modal-fill`: 11/11.
- TypeScript reported no diagnostic in the three changed video files.
- iPhone 17 Pro simulator: Couch Stretch's Short opened and played inline in
  the existing modal, with no external fallback or layout regression.

## NOT COVERED

- Automated audio-level measurement from the simulator.
- Physical-iPhone Release acceptance.
- External YouTube playback, which remains YouTube-owned.
- VoiceOver traversal inside the YouTube player.
