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

## 2026-09-02 — saved-year audit diagnosis only

Boundary: read the already-generated `3e6ac18b` male/female year; do not change
programming, regenerate a year or make PDFs. The only implementation change is
inside the audit instrument that incorrectly demanded exercise identity from a
typed Team Training anchor.

### Lower-hinge variety findings

The six excessive-skeleton findings are three aggregate signatures repeated for
each gender. Male and female outputs are identical:

- `RDLs > Nordic Lower`, session `lower_hinge`, 11 athlete-weeks per gender:
  3, 4, 12, 13, 24, 25, 35, 38, 47, 49, 50.
- `RDLs > Hamstring Curl`, session `lower_hinge`, 15 athlete-weeks per gender:
  5, 6, 7, 16, 17, 18, 27, 28, 29, 37, 39, 40, 41, 51, 52.
- `RDLs > SL 45° Back Extension`, session `lower_hinge`, 13 athlete-weeks per
  gender: 8, 9, 10, 20, 21, 31, 32, 33, 34, 43, 44, 45, 46.

The fourth lower-hinge signature is `RDLs > Seated Calf Raise` in week 14 for
each gender. That makes the two recurring-purpose findings: male `lower_hinge`,
40 sessions / 4 distinct skeletons; female `lower_hinge`, 40 sessions / 4
distinct skeletons.

Verdict: all eight are obsolete audit expectations, not measured programming
breaches. The `>5` annual-occurrence ceiling and `>=6` distinct-skeleton floor
exist only as literals in `weekly-strength-budget-year-audit.cjs`; neither is
authored in the Bible nor Rulings. They also ignore distribution: the saved
year changes support rows across blocks while retaining the tracked RDL anchor,
and its actual weekly selection audit is zero exact repeats, zero repeated main
families and zero dedicated-day ownership breaches. The obsolete thresholds
were diagnosed but not edited in this unit.

### Team Training identity failure

Cause: the exporter correctly writes club attendance as
`role: team_training`, `catalogueIdentity: null`. It is a visible schedule/load
anchor, not an exercise. The audit projection, conditioning census and year-row
duplicate summary iterated every visible row and called the strict exercise
identity resolver before checking the typed role. The final-year runner
therefore stopped on the first club row.

Fix: one audit-only predicate now says whether a visible row requires catalogue
identity. Every audit consumer excludes the typed `team_training` anchor from
exercise/template identity and duplicate checks. The row remains visible and
continues to count in the visible-workload summary. Missing identity still
throws for a real exercise. No display-name comparison and no program change
were added.

Focused receipts:

- Red first: both new anchor cells threw `missing catalogueIdentity: Club
  session` before the audit predicate changed.
- `test:programming-audit-projection`: 7/7.
- `test:year-row-summary`: 6/6.
- `npx tsc --noEmit`: exit 0.
- Existing `3e6ac18b` artifact through `programming-final-year-acceptance.cjs`:
  completes 24 checks instead of crashing; 16 pass and 8 unrelated checks are
  red (accepted schedule inputs, travel-equipment restoration, team weekday
  expectations and fixture counts, each for male and female). Those findings
  were not investigated or changed.

One broader `test:programming-selection-trace` diagnostic was started after the
two focused suites. It reached its existing generated-selection assertion and
failed at `strength:2026-10-07:push_accessory_1:0`; the audit-only change is not
read by generation. It was not investigated or used as evidence for this unit.

### NOT COVERED

- No new program generation, full-year generation or PDF output.
- No programming selector, composer, schedule, exercise or athlete-facing app
  code changed.
- The eight unrelated final-year findings were not diagnosed.
- The obsolete lower-hinge variety thresholds were not removed or rewritten.
- No simulator, restart, remote persistence or physical-phone run.

## 2026-09-02 — obsolete variety audit removal and eight-finding classification

Boundary: reuse the saved `3e6ac18b` year only. No generation, PDF or production
programming change.

The annual session-shape ceiling of five and recurring-purpose floor of six
were deleted from `weekly-strength-budget-year-audit.cjs`, including their
maps, verdict arm, receipt keys and top-skeleton list. A source scan over
`scripts` and `src/__tests__` finds none of the old constants or receipt terms.
There were no separate obsolete test cells: both expectations existed only as
executable literals in that script. No replacement threshold was added.

The saved-year selector audit still reads 104 athlete-weeks, 104/104 successful
restart receipts, zero exact-exercise breaches, zero main-family breaches and
zero dedicated-day ownership breaches. Its command exits 1 solely because the
saved program source is `3e6ac18b` and the current audit-tool checkpoint is
`0e038eeb`; the receipt states both revisions. This is expected when re-auditing
an explicitly preserved older year and is not a new program finding.

The exact `3e6ac18b` final-year receipt contains eight failing checks, four per
athlete. Male and female delivered programs are identical at these coordinates:

1. `accepted_programming_inputs`: Pre-season weeks 8-26 save Monday/Wednesday
   team training, while the audit still expects Tuesday/Thursday. This checks
   saved input metadata, so there is no single session/exercise row. AUDIT
   MISTAKE: the annual-driver correction and Sam's audit instruction explicitly
   require Monday/Wednesday in Pre-season and Tuesday/Thursday In-season.
2. `full_equipment_travel_restore`: the audit inspects week 19,
   2027-02-01..05, and demands dumbbells/bands/bench-only kit. Those dates carry
   Team Training; Lower Squat (Box Jumps, Back Squat, Bulgarian Split Squats);
   Team Training + Upper Pull (Rotational Medicine-Ball Slam, Pull-Ups, Seated
   Cable Row, Incline DB Bench); Mobility (Deep Squat Hold, Adductor Rockback,
   Jefferson Curl, Open Book Rotation, Toe Stretch, Pigeon Stretch); and Lower
   Hinge (RDLs, Steady Aerobic Intervals). AUDIT MISTAKE: no travel fact exists
   in week 19. The journey's travel is Pre-season phase week 7 / annual week 14,
   2026-12-28..2027-01-01, and those five days correctly expose only
   bodyweight/dumbbells/bands/bench with no conditioning modality; full kit is
   restored on 2027-01-02.
3. `team_training_anchors`: the audit calls the 36 Pre-season Monday/Wednesday
   club dates invalid and demands 39 Tuesday plus 39 Thursday dates. Affected
   weeks are 8-13 and 15-26; week 14 is the Christmas break. Monday is Team
   Training-only. Wednesday is Team Training + Upper Body Pull. AUDIT MISTAKE:
   the weekday expectation duplicates the stale input check above. In-season
   weeks 27-52 are correctly Tuesday/Thursday.
4. `fixture_journey`: the audit demands 21 games (17 Saturday, four Sunday).
   The saved year has 23: weeks 27-30, 32-36, 38-42 and 44-52; exact dates are
   2027-04-03, 04-10, 04-18, 04-24, 05-08, 05-15, 05-22, 05-30, 06-05,
   06-19, 06-26, 07-03, 07-11, 07-17, 07-31, 08-07, 08-14, 08-22, 08-28,
   09-04, 09-11, 09-18 and 09-25. These are Game Day anchors with no exercise
   rows. AUDIT MISTAKE: the fixed 21 belongs to the retired 24-week In-season
   assumption. The canonical year has 26 In-season weeks; three byes leave 23
   fixtures, and four scripted moves produce 19 Saturday plus four Sunday.

Classification totals across the exact eight check findings: zero real
programming problems, eight audit mistakes, zero needing a new coaching
decision. The Wednesday upper-pull exercise lists vary by stable block, but no
exercise is the subject of either weekday finding; the alleged breach is only
the date.

Focused checks: programming audit projection 7/7, year row summary 6/6, audit
script syntax green, obsolete-term scan empty. NOT COVERED: the eight stale
expectations were classified but not removed from final-year acceptance in this
unit; no broader suite, generation, PDF, simulator or phone run.
