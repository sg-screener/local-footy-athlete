/** Current compiler input witness for legacy diagnostic rule observers.
 * Never repairs a supplied workout or reintroduces the retired post-write validator.
 * Real transaction/restart coverage lives in compilerYear/sourceFacts.
 */
import type { ActiveConstraint } from '../../store/coachUpdatesStore';
import { canonicalProgramInputFromProfile } from '../../services/api/generateProgram';
import { compileCanonicalProgram } from '../../rules/canonicalProgramCompiler';
import { establishSeasonPhaseClock } from '../../rules/seasonPhaseClock';
import { ARCHETYPES, athleteAnswers } from '../compilerYear/catalog';

export function compileConstraintWeekForTests(constraints: readonly ActiveConstraint[], date: string) {
  const profile = athleteAnswers(ARCHETYPES.find(athlete => athlete.id === 'male-3-experienced-gym')!);
  const input = canonicalProgramInputFromProfile(profile, {
    todayISO: date, blockStartISO: date, blockNumber: 1, microcycleLimit: 1,
    seasonPhaseClock: establishSeasonPhaseClock({ selectedPhase: 'Pre-season', targetWeekStartISO: date }).clock,
    activeConstraints: constraints, temporarySourceFacts: [], readinessSignal: null,
    selectionHistory: [], athletePrefs: { pinned: [], exclusions: [], excluded: [] }, recordSelections: false,
  });
  const output = compileCanonicalProgram(input);
  return { workouts: output.program.microcycles[0].workouts,
    activeConstraintIds: (input.weeks.activeConstraints ?? []).map(constraint => constraint.id).sort() };
}
