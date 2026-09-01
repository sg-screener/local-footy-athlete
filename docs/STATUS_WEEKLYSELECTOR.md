# STATUS — systemic automatic weekly exercise selector

Owner: `weeklyselector`. Started 2026-09-01 from exact checkpoint
`2b0ccd207cd19587aeb7af94f391059af1090b59` on branch
`codex/failure-only-state-export`.

## Boundary

- Only automatic weekly exercise identity, real main-family classification,
  fallback order and dedicated lower-day ownership are in scope.
- Athlete additions remain outside the automatic budget.
- Existing equipment, injury, block history, phase, conditioning and program
  editing systems are inputs, not redesign targets.
- Existing unrelated `docs/NOW.md` and untracked shared work are preserved.

## Options compared before coding

1. Add a final cleanup pass after sessions are composed.
2. Give the existing whole-week composer one selection state that sees every
   delivered automatic identity and the exercise catalogue's real movement
   classification before a row is authored.

Option 2 is the selected design. A cleanup pass would author an illegal row,
record its block selection and trace, then try to hide it. Selection-time
ownership prevents the illegal decision and keeps save/restart deterministic.

## Starting measurement

The real 50-profile generator matrix reached 200 athlete-weeks. The diagnostic
counted final composer-declared exercise identities and their catalogue-owned
movement classifications, not composer role labels:

- 12 repeated exact-exercise findings, all repeated `Nordic Lower`.
- 52 repeated anchor-family findings.
- 44 dedicated `Lower Hinge` day findings containing single-leg knee work,
  with `Walking Lunges` the first observed example.

Denominators: 200 athlete-weeks across male/female, all three phases, 2-6 gym
days and club/no-club worlds where applicable. These are pre-fix findings.

## Cause and change

The composer already carried `usedThisWeek`, but it treated uniqueness as a
preference and deliberately fell back to the used list when fresh choices ran
out. Its weekly main-seat decision was made from the requested slot and printed
role before an exercise was chosen. That let a real anchor variation be
relabeled as support, and the dedicated lower slot tables put both unilateral
categories on both lower days.

`automaticWeeklyExerciseSelection.ts` is now the one week-level selection
state. It canonicalises the final identity, reads real catalogue movement and
pool authorship, enforces exact identity and real main-family limits, separates
dedicated unilateral ownership, and owns the four-step fallback. The composer
asks it before authorship. Genuine Mobility/Prehab pool identities stay exempt
and a prehab fallback is authored in a prehab/robustness slot without spending
the missing strength seat. Empty mainless cards roll their provisional choices
back, so an invisible row cannot block later work or enter restart history.
Mid-week remainder composition seeds that same state with already delivered
automatic rows before choosing the governed remainder. The canonical injury
replacement and session-addition ladders consult the same state; athlete-owned
rows are deliberately excluded from that seed.

## Focused verification before the annual run

- `test:automatic-weekly-selection`: 13/13. This includes every requested
  named example, 50 generated profile worlds / 200 athlete-weeks, a restricted
  bodyweight generation, mid-week delivered-history seeding, athlete-added
  duplicate work and exact save/restart.
- Chained `test:full-body-balance`: 10/10 balance + 5/5 variety + 5/5 weekly
  budget + 13/13 R-318.
- `test:slot-coverage`: 84/84.
- `test:generated-week`: 36/36.
- `test:compile`: zero new product, devtool or test errors.

Mutation liveness, restored after each run:

- Remove exact-identity memory: focused guard 11/12; repeated Single-Leg RDL
  selected itself instead of the accessory fallback.
- Ignore spent real families: 9/12; Back/High Box, two squat variations and two
  hinge variations all went red.
- Disable Lower Hinge unilateral ownership: 10/12; direct Bulgarian and the real
  bodyweight Cossack Squat delivery both went red.
- Drop the mid-week delivered seed: 12/13; the Back Squat/High Box remainder
  example went red.
- Restoration returned 13/13 and zero type-check regressions.

## Separate inherited reds — not changed

- `test:law-registry`: the new law's shape, named guard and chain-membership
  cells pass; the suite remains red only on the existing 21 distinct
  `UNENFORCED` registry rows.
- Direct `composerSliceB1Tests.ts`: 49/54. Its five inherited expectations still
  describe the old five-row/full-upper and earlier bodyweight gap shapes made
  stale by the already-committed 11-item upper-session work. They are outside
  this selector boundary.
- `test:repo-law-guards` still reports shared pre-existing document/inbox and
  Maestro reachability debt; no reported item names an R-318 path.

## Annual acceptance

The first exact-checkpoint run at `6fad92b0342d055ed7fd00a0f31e439bfcd8958e`
completed 104 athlete-weeks and 104/104 successful restart reconstructions, then
found six distinct repeated exact identities / 12 delivered occurrences and two
repeated real squat-family findings / four delivered occurrences. Dedicated-day
ownership findings were zero. The dated cases proved that injury and mid-week
illness/recovery remainder compilation had not been seeded from the accepted
part of the week.

After both paths joined the systemic selector, a second complete working-tree
diagnostic completed the same 104 athlete-weeks and 104/104 restarts with:

- repeated exact exercise findings: 0 distinct, 0 delivered occurrences;
- repeated real main-family findings: 0 distinct, 0 delivered occurrences;
- dedicated-day ownership findings: 0 occurrences.

The reusable audit now labels this result separately as `selectionVerdict`.
Its inherited cross-year skeleton-variety checks remain red: six repeated
Lower Hinge skeleton findings and two recurring-purpose variety findings. Those
thresholds judge annual rotation, not the requested within-week selection rule,
and were not removed or repaired.

The established `programming-final-year-acceptance.cjs` did not reach its 24
checks on the first exact artifact: it crashed on an unrelated exported `Team
training` row with no `catalogueIdentity`. No selector finding came from that
instrument. Final exact-commit regeneration is still pending.

## NOT COVERED

- The final amended-commit male/female 52-week artifact is not yet recorded in
  this status checkpoint section; the complete working-tree diagnostic is.
- No simulator, native onboarding tap path, Release build or physical iPhone
  acceptance was run.
- The focused generated matrix does not enumerate every injury, illness,
  fatigue, temporary-equipment, fixture and availability combination.
- Unrelated inherited suite debt listed above was measured and not repaired.
