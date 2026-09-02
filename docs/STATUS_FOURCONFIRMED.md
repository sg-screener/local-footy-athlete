# Four confirmed annual-program fixes

Owner: `fourconfirmed`

Starting checkpoint: `deed34fa2a2f8462a9925b19a74361dc2dbf2715`

Scope is limited to Sam's four confirmed findings: remaining automatic Gunshow
repeats, missing meaningful lower-body frontal work, the missing Speed warm-up
inside combined Change of Direction sessions, and conditioning nested inside
Mobility; plus Sam's pre-audit R-334 repair for useful ordinary strength
sessions and typed Push/Pull accessory ownership. Work is isolated in
`/private/tmp/lfa-four-confirmed-fixes`.

## Options compared before implementation

1. Patch the named weeks/exercises and repair the annual PDF/audit output.
2. Fix the four existing canonical owners: weekly automatic selection history,
   weekly plane completion, shared session composition/projection, and typed
   nested conditioning presentation.

Option 2 is the only systemic option and preserves the existing architecture.
It will be used. No annual output will be manually repaired.

For R-334, the two compared options were (a) add a post-generation filler pass,
or (b) stop canonical composition from deleting legal support below the useful
floor, keep using its existing fallback selector, and stamp the final contract.
Option (b) landed because it does not create a second session programmer.

## Baseline

The exact-checkpoint focused gates were green but did not reach the accumulated
annual states: automatic weekly selection 17/17, movement planes 13/13,
standalone flush presentation 4/4, fortnightly COD 19/19, final composition
6/6. The saved exact-checkpoint annual output measured these distinct defects:

- 3 automatic Gunshow duplicate rows (one each in male Weeks 29, 41 and 42).
- 8 athlete-weeks without useful lower-body frontal work (both athletes in
  Weeks 22, 23, 35 and 42).
- 6 combined COD sessions (both athletes in Weeks 5, 7 and 13) with the three
  drills present but the Speed warm-up absent.
- 2 Week-40 Mobility days (one per athlete) where Nasal-Paced Easy was counted
  as a second Mobility row and its conditioning prescription was not visible.

The units above are final generated athlete rows/athlete-weeks, not source call
sites. No compiler refusal or manual session repair was involved.

## Focused final evidence

- `test:automatic-weekly-selection`: 17/17.
- `test:session-components`: 39/39.
- `test:weekly-plan-display`: 64/64.
- `test:programming-final-composition`: 6/6.
- `test:movement-planes`: 13/13.
- `test:upper-split-composition`: 29/29 after retiring the stale cross-direction
  upper expectations.
- `test:minimum-useful-strength-session`: 7/7 across 30 final generated worlds
  (two sexes, every phase and 2–6 available days), all four ordinary shapes,
  scheduled deload, weekly exact/main-family uniqueness, four-compound ceiling,
  persistence shape and workbook/code equality.
- Real accumulated 42-week male/female journeys: 24/24 focused checks, 42/42
  weeks and 42/42 matching cold restarts per athlete. The 12 November Lower
  Hinge is now RDLs, Hamstring Curl, Single-Leg Calf Raise and Slant Board
  Step-Down, with a typed 4/4 `met` receipt. No session was manually repaired.

Mutation receipts for R-334: changing the minimum from four to three killed the
exact minimum cell (6 pass / 1 fail); changing Lateral Raise affinity from Push
to Pull killed workbook/code equality (6 pass / 1 fail). Both were restored and
the final gate returned 7/7. The existing COD and presentation guards already
carry their mutation receipts in the rulings they guard; the sandbox refused a
temporary production mutation that would deliberately remove the COD warm-up,
so no unsafe mutation was left in this checkout.

## Inherited red, not repaired

- `test:standalone-conditioning-ownership` retains its exact-checkpoint Week 3
  and Week 4 C3 fixture failures (59 pass / 2 fail); the focused standalone
  flush presentation cells are green.
- `test:law-registry` retains the exact-checkpoint 21 historical `UNENFORCED`
  rows; the new R-334 row is well formed, names a real chained guard and adds no
  new unguarded law.

## NOT COVERED

- Unrelated test debt or architecture cleanup.
- Full `test:bible`, catalogue reversal, simulator or either physical phone.
