/** Historical weekly fixtures enter the current accepted-block owner.
 * No copy of the retired per-session progression algorithm lives here.
 */
import { athleteAnswers, ARCHETYPES } from '../compilerYear/catalog';
import { compileCanonicalProgramProgression } from '../../rules/canonicalWeeklyProgressionCompiler';
import { resolveWeek, type ScheduleState } from '../../utils/sessionResolver';
export function authorWeekStrengthProgression(monday: string, state: ScheduleState) {
  if (!state.currentProgram || !state.currentMicrocycle) return resolveWeek(monday, state);
  const program = compileCanonicalProgramProgression({
    program: {...state.currentProgram, microcycles: [state.currentMicrocycle]},
    state, profile: state.athleteContext?.onboardingData ?? {...athleteAnswers(ARCHETYPES[2]), seasonPhase: state.seasonPhase!}, blockStartISO: monday,
    asOfISO: monday, blockNumber: 2, previousRequiredStrengthSessions: 1,
  });
  return resolveWeek(monday, {...state, currentProgram: program, currentMicrocycle: program.microcycles[0]});
}
