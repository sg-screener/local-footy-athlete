# STATUS — combined Change of Direction session

Owner: `codcombine`. Started 2026-09-02 from exact checkpoint
`040ba498377c4daf20ffd8f76646d5c3a448fe61` on branch
`codex/failure-only-state-export`.

## Boundary

- Replace the four separate COD/deceleration templates with one automatic
  `Change of Direction` session.
- Render one shared Speed warm-up followed by three ordered sections:
  Low-Intensity Deceleration Drills, 45-Degree Cut Reps and Up-Back Shuttle.
- Remove Deceleration and Landing Work from current programming.
- Allow this exact COD session on a lower-body day as an explicit on-feet
  exception to the normal lower-plus-conditioning off-feet preference.
- Preserve the existing cadence, season, fixture, readiness, injury, day-count,
  conditioning-count, save/restart and Undo owners.

## Options compared

1. Patch the failed Week 5 selection by pretending one COD row is off-feet.
   Rejected: COD is running work, so this would make the label and delivered
   modality disagree.
2. Give the existing conditioning template one typed ordered-section shape and
   exempt the `cod_decel` category at the existing lower-day pairing decision.
   Chosen: one selectable identity, one honest running modality and one existing
   session/conditioning credit.

## Red-first receipt

The focused fortnightly COD tape began with five named failures and then stopped
on the missing lower-day exception owner. It proved the current catalogue still
held four identities, selected Low-Intensity Deceleration Drills alone, rendered
one main row and had no legal way to keep COD on-feet beside lower strength.

The guard was then mutation-tested: changing the lower-day COD exception back
to off-feet made the focused tape fail, and restoring the rule returned it to
19/19.

## Implemented result

- The current catalogue now has 52 selectable conditioning templates and one
  COD identity: `Change of Direction`.
- The retired standalone COD identities cannot be selected automatically.
- The visible session is the ordinary Speed warm-up followed by exactly three
  work rows in the ruled order, with the ruled work, recovery, amount, effort
  and cue on each row.
- It remains running-only, earns one conditioning exposure, and is allowed to
  share a lower-body day without being forced onto a machine.
- The same typed sections feed generation, projection, signed copy, save and
  restart reconstruction; no display-only repair was added.
- Both current source-of-truth workbooks and the Programming Bible were updated
  with the same identity and section copy.

## Verification

Green current-boundary checks:

- TypeScript: 0 errors.
- Conditioning catalogue/equality: 170/170 plus modality 5/5.
- Combined COD journey: 19/19.
- Final composition: 6/6.
- Generated-week assembly: 30/30.
- Conditioning modality routes: 2,726/2,726; persistence 6/6; Erg Flush 2/2.
- Signed copy: 7/7.
- Muscle/experience: 97/97; conditioning-muscle equality: 31/31.

Existing red checks were reproduced unchanged at the starting checkpoint:

- `test:programming-selection-release` reaches the same seven inherited
  upper-split failures.
- `test:weekly-scheduler` reaches the same travel-zero-equipment mutation
  mismatch (9/10).
- `test:conditioning-identity` remains 63/73 because of the same ten obsolete
  expectations.
- The law registry remains 21 inherited `UNENFORCED` laws; this change added
  one new guarded law and no new debt.

## NOT COVERED

- No full-year male/female replay or PDF generation; that is the next isolated
  audit job.
- No simulator, clean Release build or physical-phone acceptance.
- No remote/backend behaviour or every possible athlete/profile combination.
