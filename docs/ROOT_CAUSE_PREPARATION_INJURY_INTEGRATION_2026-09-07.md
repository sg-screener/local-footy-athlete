# Preparation integration: injury release blockers

Owner: scopebridge. Sam approved this correction on 2026-09-07.

The preparation change exposed four failing assertions across three injury
shapes. Earlier-build counterparts passed: review 80/0, preview 194/0.
Before correction, current results were 77/3 and 193/1.

## Verified causes and correction

1. **A promised replacement disappeared.** The ladder selected B-Stance RDL
   for RDLs, but `canonicalWeeklyInjuryCompiler.compileCanonicalInjuryWeek`
   rejected its main hinge pattern. The review listed a withdrawal while the
   paused summary omitted it. `compileCanonicalInjuryStage` now passes the
   existing weekly pattern restrictions into `planInjuryRecomposition` before
   choosing replacements. No new coaching restriction was introduced.
2. **A fully paused session kept an older summary.**
   `injurySessionAdjustment.applyInjurySessionAdjustment` returned the previous
   workout when nothing remained and nothing could be added. It now retains
   the rows with the current summary. The existing view still marks them
   unavailable. A real knee-then-lower-back case proves this after reopening.
3. **Edits ran before their rows existed.**
   `quiescentBoot.compileExerciseDecisionGroup` replayed edits before injury
   composition. Weighted Dead Bug was absent, so its set edit disappeared.
   A retained-row edit also wrote a whole healthy-day override, reclaiming
   unrelated conditioning. Injury-era and unresolved row edits now continue
   through `sourceFactCompilation` after injury composition, using the existing
   edit compiler, exact identities and dated safety checks. Earlier edits retain
   their ordering; persistence format is unchanged.

## Verification

Separate symptom patches were compared with correcting these shared boundaries;
Sam approved the latter. Original failures remain tested. Expanded journeys cover
second edits, Undo, conditioning conservation, improvement, Clear, earlier edits,
reopening and preserved history. Deliberate breakages verify detection. The
former forced-withdrawal fixture now checks every actual removal's explanation,
including paused rows, as the approved correction requires.

All 36 release units passed. Signed Release installed over the existing app on Sam’s iPhone; no reset.

NOT COVERED: native interaction, Sam's acceptance, live Coach deployment,
historical PDF regeneration.
