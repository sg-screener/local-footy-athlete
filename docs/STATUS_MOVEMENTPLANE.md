# STATUS — typed exercise movement planes

Owner: `movementplane`. Started 2026-09-02 from exact checkpoint
`cd013f07c5cf56a997d76f2aa16e904849729bc4` on branch
`codex/failure-only-state-export`.

## Boundary

- Add Sam's exact primary and secondary movement-plane classifications to the
  canonical exercise catalogue and Exercise Master workbook.
- Extend the existing automatic selection path with plane preservation and
  equal-candidate tie-breaking only after legality, equipment, experience,
  season/session policy and weekly limits.
- Add typed weekly and annual hole checks for lower-body frontal work, athletic
  transverse/multiplanar exposure and the softer 7–14 day trunk rotation check.
- Keep athlete-facing screens and labels unchanged.
- Preserve the existing uncommitted `docs/NOW.md` and every unrelated shared
  worktree path.

## Options compared before coding

1. Add plane fields directly to every large exercise-tag object and maintain a
   second workbook parser beside it.
2. Add one small typed plane catalogue keyed by canonical exercise identity,
   hold it equal to two new Exercise Master columns, and have both the existing
   selector and audit read that owner.

Option 2 is the target. It gives planes one owner, keeps unclassified exercises
visibly unanswered rather than guessed, and avoids a second selection or write
path.

## Starting state

- The shared working tree already contains an unrelated modified `docs/NOW.md`
  and unrelated untracked files. None are in this boundary.
- The existing whole-week selector owns automatic identity/family limits and
  the block selector owns accepted-history restoration and stable rotation.
- The workbook currently has eight columns and no movement-plane fields.

## Change

- One typed catalogue now carries the 122 exact exercise classifications Sam
  supplied. It rejects duplicate primary/secondary answers and the two
  no-secondary primary values by construction.
- Exercise Master now has `Primary Plane` and `Secondary Plane(s)` columns. The
  92 unlisted identities remain blank and are recorded, one-for-one, in
  `docs/MOVEMENT_PLANE_QUESTIONS_2026-09-02.md`.
- The existing block selector restores an accepted current-block identity
  first. Only the remaining legal equal cohort is narrowed for same-primary
  substitution or a missing useful plane, before existing stable history picks
  inside that cohort.
- The existing weekly selector exposes a lower-frontal tie-break until a
  meaningful lower strength/prehab contribution fills it. Its existing
  checkpoint/restore also rolls that temporary plane state back with discarded
  sessions.
- Rotational medicine-ball credit is an explicit field on the existing power
  pool. COD credit reads the authored conditioning quality, and Team Training
  reads its typed role. No conditioning display name or description is parsed.
- The existing annual selector audit now reports required lower-frontal and
  athletic transverse/multiplanar holes plus the softer 7–14 day trunk check.
  It does not silently add work to repair a reported hole.

## Focused verification

- Red first: `test:movement-planes` could not load either required module.
- Final focused tape: 10/10, including exact classification membership, metadata
  invariants, workbook equality both ways, exact unanswered-question coverage,
  selector state, same-plane substitution, accepted-history priority and all
  three audit rules.
- Adjacent owners: muscle/workbook equality 97/97; automatic weekly selector
  13/13 including 50 generated worlds and restart; programming audit projection
  7/7; power pool 104/104.
- Law registry structure, guard name, chain membership and R-327 resolution all
  pass. Its overall command remains red only on the inherited 21 UNENFORCED
  rows.
- Liveness mutation: changing Bench Press primary plane from transverse to
  sagittal made the original focused tape 6/9. The exact classification, workbook
  equality and same-plane substitution cells all died for the intended reason.
  Restoring the catalogue returned 9/9 with a byte-clean source diff.

## Annual finding — existing saved year, not silently repaired

The existing `3e6ac18b` male/female artifact contains 104 athlete-weeks and
104/104 successful restart records. The new instrument reports 75 distinct
athlete-week findings: 46 required athletic transverse/multiplanar holes, 13
required lower-frontal holes, 12 soft trunk-due findings and 4 soft unknown-
history findings. Its source revision differs from this working checkpoint, so
it is diagnostic evidence, not an exact-source acceptance run. No exercise was
invented and no extra session was added to make the count green.

## Inherited reds kept separate

- The chained full-body command reaches this task's 9/9 plane tape, but remains
  red on the pre-existing compound-classification count: its test expects 84
  governed identities while the unchanged current catalogue has 86.
- The compile gate reports seven errors in the unrelated new
  `sessionWorkOwnershipJourneyTests.ts`; no task path imports or edits that file.
- The ruling registry still reports its pre-existing R-070 dead path, nine old
  unenforced rulings and sixteen old uncited parked questions. Adding `BUILT`
  to R-327's own row prevents the new ruling from expanding that question set.

## Sam's 2026-09-02 clarification

- Gym programming must contain at least one meaningful transverse or
  multiplanar strength/prehab/power/trunk exercise every week. A secondary
  transverse plane counts. Team Training never counts toward this gym rule.
- Team Training does count as the athlete's change-of-direction exposure.
- With no Team Training, the app uses one small COD dose every second week only
  in late off-season and the accepted Christmas shutdown.
- The previous saved-year finding count above predates this clarification and
  is retained as historical diagnostic evidence, not a current acceptance
  result.

## Banded 90/90 External Rotation

- Added to the existing Shoulder health pool, upper-body Movement Prep and
  manual Add/Swap routes for everyone.
- Reused the existing band answer, band load control and Banded External
  Rotation dose: 2 × 15–20 per arm with 20 seconds rest.
- Added exact cues, video, transverse plane, supplied ratings/restrictions and
  the Exercise Master row. No new equipment, unit, role or selector.
- Red-first focused tape: 0/6. Final: 6/6. Workbook/muscle equality: 97/97.

## Fortnightly COD implementation

- The scheduler exchanges an existing easy/moderate conditioning component for
  `Low-Intensity Deceleration Drills` (2–4 controlled reps, about 3–5 minutes).
  It does not add a training day or increase the conditioning count.
- Late off-season phase weeks 5, 7, 9… are due. Christmas shutdown weeks 1, 3,
  5… are due, counted from the first Monday on/after the accepted closure begins.
- Weeks with Team Training, a game, low readiness, a deload or a running safety
  restriction receive no automatic COD from this rule. Travel is not mistaken
  for Christmas.
- Red-first focused tape: 7/14. Final: 14/14. The existing weekly scheduler tape
  remains 128/128.
- Liveness mutation: changing the late-off-season cadence from every 2 weeks to
  every 3 weeks killed the phase-week-7 cell (13/14); restoration returned 14/14.

## Current inherited reds

- `test:weekly-scheduler` reaches and passes both scheduler tapes, then remains
  red in the older `generatedTravelZeroEquipmentTests` mutation: the broken week
  is correctly refused, but that test expects a different refusal clause.
- `test:compile` reports zero product and dev-tool errors and zero errors in this
  task's new tests; it remains red on seven errors in unrelated
  `sessionWorkOwnershipJourneyTests.ts`.
- `test:authored-cues` reaches all new cue/video checks, then remains red on the
  unchanged Tib Raises and Copenhagen Plank (Half) load-profile expectations.

## NOT COVERED (clarification and new exercise)

- No simulator, Release build or physical-phone acceptance run.
- No fresh exact-checkpoint annual programme was generated after the clarified
  weekly gym and fortnightly COD rules.
- External playback of the supplied YouTube video was not checked.

## NOT COVERED (starting state)

- No code, workbook or test changes had been made when this checkpoint note was
  opened.
- No annual artifact, simulator, Release build or physical phone run.

## NOT COVERED (final)

- No fresh exact-checkpoint 52-week programme was generated; the saved annual
  artifact was audited in place.
- The 59 required findings in that saved year were not repaired by adding or
  moving programme content.
- Unlisted plane questions remain unanswered by design.
- No simulator, athlete-facing UI, Release build or physical phone run.
