# Programming follow-up — conditioning clarity and remaining decisions

Owner: programming-remedy. Verified baseline: `8dbcbc00`; report-only checkpoint
`738090ba`. Neither baseline evidence nor the original examples are overwritten.
Installation remains held; no phone reset, wipe or install is authorised here.

## Decision audit

REGISTRY-GREP: R-014, R-079, R-080, R-089, R-116, R-237–R-241, R-260–R-264.
Also checked Bible sections 7, 13, 14 and 20, the original P01–P22 handoff,
and `OPTIONAL_PLACEMENT_RULINGS_2026-07-30.md`.

Sam answered all five decisions in this task. These answers supersede the
earlier proposals below and the older unresolved-decision list at `8dbcbc00`.
Programming-remedy owns implementation and verification, not new content decisions.

1. P02/P06/P16: unilateral priority with missing rack/barbell is already
   directed. R-089 also settles uncovered-first coverage rather than erasing
   required squat/hinge coverage. The earlier replace-versus-lead question was
   too broad and is withdrawn. Remaining choice: delete Leg Press/conventional
   Deadlift versus keep manual/fallback access, and automatic preference.
   SIGNED: keep both for manual choice and suitable fallbacks. New automatic
   selection prefers legal alternatives; existing accepted selections restore.
2. P15: R-079 explicitly permits preseason flying sprints with club acceleration
   work; that permission is not a new question. Implement it within the existing
   nights, conditioning and safety limits. No new automatic in-season microdose
   is proposed where club work already supplies the need.
3. P17: the Bible lists Box/Broad jumps and example doses but its explicit
   automatic pool excludes them, and limits in-season lower work to vertical
   and lateral jumps. Recommend adding Box/Broad/Jump Squat as rotating
   alternatives in the existing single power slot for developing+ off/preseason,
   with existing doses and equipment/injury limits; keep the in-season pool.
   WITHDRAWN PROPOSAL: Sam rejected the extra age/phase preference above.
   SIGNED: Box/Broad/Jump Squat join the ordinary selectable pool, with no
   invented preference for Vertical Jump. Existing equipment/injury safeguards
   and previously signed Depth/Bounds/Kneeling constraints remain; no extra dose.
4. P18: no-default/spare-day filling is already forbidden. The need-computation
   definition explicitly requires sign-off. Recommend a recent game/hard club
   session plus mild reported soreness as the trigger for at most one safe,
   optional off-leg flush, not illness, injury or an empty day alone. This trigger
   WITHDRAWN PROPOSAL: Sam instead specified an OPTIONAL G+2 off-leg flush unless
   conditioning or team training is already there. Mild reported soreness after
   the recent game/hard club work makes it CORE on G+2. Existing unavailability,
   actual machine access, fixture and safety constraints remain. No spare-day
   filling outside G+2. Recovery work does not earn fitness-conditioning credit.
5. P22: Mobility + the five distinct existing additions is already repaired.
   Recommend merging another Mobility without duplicate exercises, with Recovery
   a separate removable part under the existing limit. WITHDRAWN merge proposal.
   SIGNED: another Mobility or Recovery is a separate added session, composed
   AFTER reading every exercise already programmed on that day. No duplicate
   exercises in the added session, including Mobility added to Strength and
   Mobility/Recovery added to each other. The current daily session limit stays.

P15 clarification: R-079 permits preseason top-end work with club acceleration;
it does not mandate extra app sprinting when club work already meets the floor.
Sam accepted keeping the existing club-floor policy; no new automatic in-season
microdose is authored.

## Work in progress and first failures

- Shared copy reviewed for 55 templates / 110 ordinary-minimum variants. The
  authored catalogue hash remains `27982face1a656ce4f2f93fc3c68ebb77b2c191d7df3f487b33d820e61921c89`.
  Work, recovery and numeric dose are compared against saved pre-edit output.
  Erg Flush Blocks keeps three blocks; machine order now belongs to the actual
  equipment selection, not a hard-coded promise of three machines.
- Bodyweight Circuit has four unnamed movements in its authored prescription.
  Sam has been asked for the missing list; no movements/doses were invented.
- First selection guard: 33 passing / 21 failing assertions, including absent
  automatic Box/Broad/Jump Squat and Leg Press priority. Existing ten-entry power
  suite now checks the approved expansion, retaining every prior safety check.
- Real Add journeys: duplicate exclusion, row identity, Undo and restart passed;
  the added separate-part assertion initially failed for both genders because
  two Mobility sessions shared one displayed component. Existing row workout
  identities now distinguish those sessions; no new store or alternate writer.
- First full-year run stopped at week 39's knee update. The new flush demand
  had leaked `recovery_flush` into the stored energy-system field, which accepts
  `aerobic_base`. Corrected in the existing connector, not by weakening the
  evidence map. A second diagnostic reached both 52-week athletes; it is not
  final candidate acceptance. The same review caught the assembly dropping the
  flush role on combined days; the enumerated conditioning contribution now
  carries that role beside its conditioning block.
- Final candidate checks and reports are still pending. Diagnostic output:
  `outputs/programming-clarity-2026-08-28/`.
- Wider Add witnesses reached 14 actual journeys (male/female × seven base/Add
  combinations), including manual-Mobility repetition and Recovery+Recovery.
  Two first failures showed a repeated Jefferson Curl from the separately derived
  strength warm-up. The existing context seam now reads the same warm-up,
  performed movement IDs and ledger/exclusion projection as the screen. Six
  further assertions exposed duplicate Mobility/Recovery grouping after a manual
  Mobility swap; row-owned kind now takes precedence over the container fallback.
  The resulting 104 assertions pass, including separate completion, session limit,
  exact Undo and restart. No native acceptance is implied.
- G+2's fixture move/back witness initially lost its flush because the existing
  minimal fixture specialist correctly removed stale offers but never reconsidered
  the fresh compiler target's offer. It now does that before acceptance, preserving
  lifting and suppressing conditioning/team collisions. The 11-assertion isolated
  fixture journey passes; complete compiler rerun is pending.
- P16's first real no-rack/no-barbell checks failed in four distinct athlete/kit
  worlds (8 assertions passed, 4 failed). A repeated fallback Leg Press occupied
  both lower days. The existing slot composer now keeps one necessary bilateral
  fallback and the other day's existing single-leg work, without more sets or
  relabelling. Accepted current seats and pins remain protected. All 12 focused
  assertions, including restarts, now pass; annual acceptance remains pending.
- The diagnostic session-checklist chain reached 201/201 checklist assertions
  and 74/74 mobility dose assertions, then failed three source checks in
  `quickExerciseActionsTests`. The test, screen and control source are byte-equal
  to baseline `8dbcbc00`; these are pre-existing diagnostic failures. No test was
  removed or weakened and the full diagnostic chain is not reported green.

## Approach

Compare (a) individual card text patches and (b) the existing shared structured
conditioning formatter and typed mode owner. Use (b): review the actual emitted
copy from all 55 templates and both ordinary/reduced-dose variants, then make
wording-only corrections there. No new writer, scheduler or alternate planner.
Keep authored doses/recovery unchanged and compare identical-input final years
against the verified baseline. New behavioural claims require named guards and
mutations; required-field checks alone do not certify readable instructions.

## NOT COVERED

- Work and verification are in progress; this is not a completion report.
- Missing Bodyweight Circuit movement list; physical acceptance and the 2 km
  skip-tap issue, which remains unresolved and was not proven fixed.
