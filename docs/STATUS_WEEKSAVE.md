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

---

# STATUS — Season phase rebuild and Off-season entry (`weeksave`, 2026-08-26)

## Owner request

Every in-app season-phase change should show a deliberate ten-second build
state with `Takes up to 20 seconds`, then an explicit ready screen rather than
silently closing. Entering Off-season must ask with the white title `Select the
date of your last game`, use the Going Away calendar rather than typed date
fields, use that answer so a late change begins at the correct Off-season week,
and never ask for team-training days.

## Options compared

1. Change only My Status, where the finish-date question already existed, and
   add separate timer/success markup to each phase editor.
2. Complete the same phase-change contract in both live editors, retain their
   established transaction owners, and share the timing constant plus the
   existing build presentation and one completion component.

Option 2 landed. It removes the duplicate presentation decision without
rewriting either transaction architecture. Both editors now use the same signed
title, shared calendar owner and validator, and Profile's existing one setup
decider carries the date while retiring team and game anchors.

## Test-first and liveness receipt

My Status began with three named reds: no ten-second minimum, the old one-minute
copy and no explicit completion state. Profile then began with four named reds:
no finish-date step, no team-day retirement, no date in its patch and no shared
phase-change build/completion treatment.

After the change, `test:profile-reset-ui` is 187/187. Its executed Profile
decision proves a 2026-08-10 finish date survives in the patch and that two
stored team days plus the game anchor are cleared.

Mutation checks:

- Changing the shared minimum from 10,000 ms to zero made the duration cell red.
- Changing Profile's team-anchor retirement from Off-season to In-season made
  both the source-routing and executed decision cells red.

Both subjects were restored and the complete guard returned green.

## Verification

- TypeScript: green.
- `test:profile-reset-ui`: 187/187, plus the chained LFA wordmark 15/15.
- `test:onboarding-presentation`: 107/107; the same title and calendar owner
  are used during first setup without typed Day / Month / Year fields.
- `test:offseason-subphase-policy`: 35/35.
- `test:season-finish-date`: 12/12, including a mid-Off-season signup deriving
  Phase Week 4 and real generation consuming the exact date.
- `test:signed-copy-extraction`: 7/7.
- iPhone 17 Pro simulator, iOS 26.3: the deterministic My Status flow passed
  end to end. It entered Off-season from In-season, displayed the exact white
  `Select the date of your last game` title and shared calendar, proved Team
  training absent before and after it, showed the 20-second copy, reached the
  ready screen, stayed for Done and returned to My Status with Off-season
  displayed. The earlier Profile route also completed through finish date,
  build, ready and Done. Both screenshots were visually inspected.
- `test:phase-shift-atomicity`, the later half of `test:phase-clock`, and
  `test:phase-skew-repair` still stop in their old generated fixtures because
  those fixtures do not supply the now-required gender/profile fields.
- Registry baselines remain inherited red: rulings 6/2, laws 11/3, and copy
  binding 8/1 on three stale proposed strings. This unit added no new registry
  red.

## NOT COVERED

- Physical-iPhone Release acceptance.
- Exact frame timing if the app is backgrounded during the ten-second hold.
- VoiceOver announcement order and locale-specific calendar presentation.
- Editing only the finish date while already inside Off-season.

---

# STATUS — Profile setup action typography (`weeksave`, 2026-08-26)

## Owner request

`Something changed? Tell the coach` must use the same font size as the Program
Setup answer beside Equipment, for example `Commercial gym`.

## Decision and receipt

The setup answer was 14pt and the shared setup-edit action was 15pt. A one-off
doorway override would have broken the one-action-family ruling, so the shared
action owner now uses 14pt for the doorway and the three edit rows inside its
destination.

The new equality cell first made `test:profile-reset-ui` 187/1 and named the
15pt-versus-14pt mismatch. After changing the shared owner it returned green.

## NOT COVERED

- Physical-iPhone Release acceptance.
- Dynamic Type and non-phone widths.

---

# STATUS — My Status direct Program route (`weeksave`, 2026-08-26)

## Owner request

Day must open My Status without an intermediate popup. My Status must leave the
Coach tab, stay on Day and be added to Week.

## Decision and receipt

Keeping Coach as a hidden owner would still make a Program action switch tabs.
Instead, My Status is now a real Program-stack page. Its existing modifier
controls, season-phase flow and accepted transactions moved together without a
second implementation. Day and Week use the same permanent header doorway and
all Program status notices call the same direct route. Coach is chat-only.

Test first produced five named Program failures plus missing-destination stops
in the Coach and My Status suites. After the ownership move:

- `test:program-tab-read-only-modifiers`: 10/10.
- `test:coach-tab-slice3`: 147/147.
- `test:my-status-modifiers`: 10/10.
- Progress ownership source pass: 14/14.
- Coach read-only slices 1 and 2: 75/75 and 72/72.
- Coach Snapshot source ownership: 35/35; coach-note action source: 4/4.
- TypeScript: green.
- iPhone 17 Pro simulator: Day opened My Status directly with no popup, Week
  opened the same page, and Coach showed its conversation with no My Status
  doorway.

The full Coach Snapshot command retains three unrelated accumulated-walk
failures after the new season-finish onboarding requirement. The ruling and law
registry commands retain their previously recorded enforcement debt (two and
three failed cells respectively); this change introduced no new registry row in
an unenforced state.

## NOT COVERED

- Physical-iPhone Release acceptance.
- VoiceOver traversal and deep-link restoration into My Status.
- Non-phone widths.

---

# STATUS — directional onboarding pages (`weeksave`, 2026-08-26)

## Owner request

Onboarding page changes must slide forward and backward rather than fade.

## Decision and receipt

The onboarding native stack already owns every page transition and knows whether
navigation is advancing or going Back. Its shared transition now pushes pages
horizontally instead of cross-fading; individual screens carry no duplicate
direction or animation state.

The two new presentation cells first failed against the fade. After changing
the shared navigator the complete onboarding presentation suite passes 109/109
and TypeScript is green. An iPhone 17 Pro simulator recording shows Name enter
from the right when advancing and Welcome return from the left when going Back.

## NOT COVERED

- Physical-iPhone acceptance.
- Reduce Motion, Android and interactive swipe-back inspection.

---

# STATUS — live gym-wheel focus (`weeksave`, 2026-08-26)

## Owner request

The lime gym-days highlight must follow the number moving into focus rather than
waiting until the wheel is released.

## Decision and receipt

The wheel previously styled lime from the committed answer, while size and
opacity already followed the scroll. A separate nearest-centre visual index now
tracks the drag. It changes only presentation; the existing tap/release handler
still owns the answer and native snapping still owns the motion.

The two new cells first failed against the release-only highlight. After the
change, onboarding presentation passes 111/111, the separate feedback-scale
suite passes 45/45 and TypeScript is green. A slow iPhone 17 Pro simulator drag
shows 5 turn lime while travelling toward centre, before release, then settle on
lime 5.

## NOT COVERED

- Physical-iPhone acceptance.
- Rapid multi-value flings, VoiceOver announcements and Android.

---

# STATUS — Equipment Back path (`weeksave`, 2026-08-26)

## Owner request

After choosing Commercial gym and continuing, Back must return through the
Commercial gym location-choice page rather than skip to the previous onboarding
step.

## Decision and receipt

Equipment contains two local pages. It was deciding what Back meant from the
live saved answer, so Continue changed the screen from "fresh onboarding" to
"existing edit" while the athlete was still inside the same visit. The screen
now remembers how it was entered; saving cannot rewrite that navigation path.

The new named Equipment cell was red against the live answer read and is green
after the entry snapshot. The targeted suite now passes that cell while retaining
two unrelated existing failures. TypeScript and the 111-cell onboarding
presentation suite are green. On an iPhone 17 Pro simulator, the fresh path ran
Commercial gym → checklist → Gym Experience → Back → checklist → Back → Where
do you train, with Commercial gym still selected.

## NOT COVERED

- Physical-iPhone Release acceptance.
- Android hardware Back.
- Existing-answer Profile equipment editing on glass.
