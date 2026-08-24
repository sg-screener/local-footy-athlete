# Coach rebuild release checkpoint — 2026-08-24

Owner: `coachrelease`

## Outcome

The rebuilt read-only Coach vertical slice is installed in place on Sam's
connected iPhone. The existing app was not deleted, so this install did not
deliberately erase local athlete data.

The phone was locked when the terminal attempted to launch the installed app.
Installation is verified; physical-device acceptance is still waiting for Sam
to unlock the phone, open Local Footy Athlete, and check the named surfaces.

## Choice made

Two release options were compared:

1. Stop after automated tests and the iOS simulator.
2. Run the same simulator checks, make a clean signed Release build, and install
   that build in place on the connected iPhone.

Option 2 was selected because Process Law L10 makes the physical iPhone the
acceptance instrument. In-place installation was used because deleting the app
was unnecessary and would intentionally discard local data.

## Evidence

- `coach-chat` deployed ACTIVE as version 5.
- `coach-lab` deployed ACTIVE as version 27.
- The complete `test:coach-snapshot` chain passed after the final Coach changes.
- Real endpoint probes returned grounded, read-only answers with zero actions.
- `scripts/dev-e2e/run-progress-dashboard-ios.sh` passed the Progress dashboard,
  simple Coach shell, and completed Mobility / Warm-up tick surfaces.
- `scripts/dev-e2e/run-coach-terra-read-only-ios.sh` passed a real Terra response,
  truthful greeting, removal of the old program-change promise, and absence of
  a change card.
- Visual simulator receipts:
  - `artifacts/ui-walk/progress-dashboard.png`
  - `artifacts/ui-walk/coach-terra-read-only.png`
  - `artifacts/ui-walk/mobility-completion-tick.png`
- A clean Release build for physical iPhone completed with `BUILD SUCCEEDED`.
  The signed product is at
  `/private/tmp/lfa-release-coach-20260824/Build/Products/Release-iphoneos/LocalFootyAthlete.app`.
- Device app inventory confirms `com.localfootyathlete.app`, version `1.0.0`,
  build `1`, is installed on Sam's connected iPhone.
- The terminal launch attempt was refused because the device was locked; it did
  not report an app crash.

## What catches the next defect of these classes

- Coach truth and refusal behaviour are held by the full Coach snapshot chain,
  real endpoint probes, and mutation checks that were observed red before being
  restored.
- Progress, Coach-shell, and completion-tick regressions are held by the two
  named simulator journeys rather than isolated source assertions.
- The final athlete-facing arbiter remains the in-place signed Release on Sam's
  physical iPhone.

## NOT COVERED

- Sam has not yet unlocked and opened this exact installed build.
- No Coach question has yet been asked on this exact physical-device install.
- Sam has not yet visually accepted the Progress dashboard or Mobility /
  Warm-up completion tick on this exact physical-device install.

This checkpoint is therefore: gates green and Release installed, awaiting Sam
device acceptance. It is not recorded as athlete-facing done.
