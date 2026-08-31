/** Full generation boundary: accepted inputs -> final program, with no store writes.
 * Selection/assembly, exclusions and progression share this ordering on live
 * generation, fixture target compilation and restart. */
import type { TrainingProgram, OnboardingData } from '../types/domain';
import type { CoachingPlan } from '../utils/coachingEngine';
import { compileCanonicalProgramWeeks, type CanonicalProgramWeeksInput } from './canonicalWeeklyRowCompiler';
import { compileCanonicalProgramProgression } from './canonicalWeeklyProgressionCompiler';
import { applyExclusionsToAuthoredWeek } from './exerciseExclusions';
import { publishAutomaticProgrammingSelectionTraces } from './programmingSelectionTrace';

export interface CanonicalProgramCompilerInput {
  readonly metadata: Omit<TrainingProgram, 'microcycles'>;
  readonly weeks: CanonicalProgramWeeksInput;
  readonly exclusions: Parameters<typeof applyExclusionsToAuthoredWeek>[0]['exclusions'];
  readonly progression: Omit<Parameters<typeof compileCanonicalProgramProgression>[0], 'program'>;
}

export function compileCanonicalProgram(input: CanonicalProgramCompilerInput) {
  const compiled = compileCanonicalProgramWeeks(input.weeks);
  publishAutomaticProgrammingSelectionTraces(compiled.selectionTraces);
  /**
   * ── REMOVE MEANS REMOVE, IN STORAGE AND NOT ONLY ON THE SCREEN ────────────
   *
   * **Sam, 2026-08-20:** *"A settings change must not re-add an excluded lift to
   * the stored accepted program and rely on projection to hide it. Stored truth
   * and visible truth must agree."*
   *
   * **THE AUTHORITY THAT REINTRODUCED IT WAS THIS FUNCTION'S OWN OUTPUT, ON THE
   * REPLAY PATH.** Measured: an athlete excludes a lift `until_changed`, the
   * rollover publishes a week WITHOUT it (stored 0 rows) — and the very next
   * relaunch publishes one WITH it (stored 4 rows), because
   * `exclusionsForSelectionAuthority` withholds the decision from a replay's
   * SELECTION so the recorded lift is restored rather than a new one chosen.
   * The row then reached disk and only `sessionResolver`'s read-time filter kept
   * it off the athlete's week. Two truths, one hidden behind the other.
   *
   * **THIS IS NOT A SECOND FILTER. IT IS THE SAME OWNER, MOVED EARLIER.**
   * `applyExclusionsToAuthoredWeek` is `rules/exerciseExclusions`' single
   * definition and it was already the thing doing this work — at read time, on
   * every render, over a week that had the row in it. Applying it once, here,
   * where the week is authored, is what makes stored == visible BY
   * CONSTRUCTION. The read-time application is now idempotent over a program
   * built by this function: it finds nothing left to remove.
   *
   * **AND IT MUST BE AFTER SELECTION, NEVER INSTEAD OF IT.** Feeding the
   * exclusion to the selection authority on a replay is the defect the 2026-08-19
   * ruling closed: the composer re-decided the emptied slot and an athlete who
   * removed `RDLs` got `Deadlift@77.5` back for closing the app. Selection still
   * restores what the block recorded; the removal happens to the built week, so
   * the slot is left EMPTY and nothing replaces it — which is the ruling, applied
   * to storage instead of to the projection.
   */
  const microcycles = compiled.microcycles.map((microcycle) => {
    const kept = applyExclusionsToAuthoredWeek({
      workouts: microcycle.workouts,
      weekStart: String(microcycle.startDate).slice(0, 10),
      exclusions: input.exclusions,
    });
    // A week nothing was removed from comes out IDENTICAL — the owner returns
    // the same array when it removes nothing, so an author path (where the
    // composer already avoided the exercise) is byte-unchanged rather than
    // rebuilt into an equal-looking copy.
    return kept === microcycle.workouts ? microcycle : { ...microcycle, workouts: kept };
  });


  const plan = compiled.plans[0];
  const program = compileCanonicalProgramProgression({
    ...input.progression,
    program: { ...input.metadata, microcycles,
      name: plan ? buildProgramName(input.weeks.profile, plan) : input.metadata.name },
  });
  return { ...compiled, microcycles: program.microcycles, program };
}

function buildProgramName(data: OnboardingData, plan: CoachingPlan): string {
  const phase = data.seasonPhase || 'Training';
  const core = plan.coreSessions;
  const total = plan.coreSessions + plan.optionalSessions + plan.recoverySessions;
  return `${phase} Program — ${core} Core + ${total - core} Support`;
}
