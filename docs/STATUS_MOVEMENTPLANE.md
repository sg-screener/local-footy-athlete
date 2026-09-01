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
- Final focused tape: 9/9, including exact classification membership, metadata
  invariants, workbook equality both ways, exact unanswered-question coverage,
  selector state, same-plane substitution, accepted-history priority and all
  three audit rules.
- Adjacent owners: muscle/workbook equality 97/97; automatic weekly selector
  13/13 including 50 generated worlds and restart; programming audit projection
  7/7; power pool 104/104.
- Law registry structure, guard name, chain membership and R-327 resolution all
  pass. Its overall command remains red only on the inherited 21 UNENFORCED
  rows.

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
