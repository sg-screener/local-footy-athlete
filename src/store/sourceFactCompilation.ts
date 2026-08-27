/** Capture inputs and publish the pure source-fact compiler's result. */
import { useProgramStore, getBlockPositionForGeneration, statedProgressionInputs, type ProgramState } from './programStore';
import { useProfileStore } from './profileStore';
import { acceptedProfileForContext, normalizeAcceptedMaterialContext } from './acceptedStateColdStart';
import { commitAcceptedStateTransaction } from './acceptedStateTransaction';
import { canonicalProgramInputFromProfile } from '../services/api/generateProgram';
import { compileCanonicalSourceFactWeeks, sourceFactRequiresCompilation, type CanonicalWeeklySourceFactInput } from '../rules/canonicalWeeklySourceFactCompiler';
import { composeTemporarySourceFactCompatibility, type TemporarySourceFact } from '../rules/temporarySourceFact';
import { getAthletePrefs } from './athletePreferencesStore';
import { readBlockHistory } from '../rules/blockBoundaryProgression';
import { storedWorldSurfaces } from '../utils/liveEvaluationSurfaces';

function captureSourceFactCompilerInput(state: ProgramState, facts: readonly TemporarySourceFact[]): CanonicalWeeklySourceFactInput {
  const anchor = state.currentProgram?.generationAnchorISO;
  if (!anchor) throw new Error('source_fact_compilation_requires_generation_anchor');
  const context = normalizeAcceptedMaterialContext(state.acceptedMaterialContext);
  const profile = acceptedProfileForContext(context, useProfileStore.getState().onboardingData);
  const programsByWeek = Object.fromEntries(state.currentProgram!.microcycles.map(week => {
    const weekStart = week.startDate.slice(0, 10);
    const position = getBlockPositionForGeneration(weekStart);
    const input = canonicalProgramInputFromProfile(profile, {
      recordSelections: 'replay', todayISO: weekStart,
      blockNumber: position.blockNumber, blockStartISO: position.blockStart,
      previousProgram: state.currentProgram, seasonPhaseClock: state.currentProgram?.seasonPhaseClock,
      progressionHistory: statedProgressionInputs(state),
      temporarySourceFacts: [], activeConstraints: [], readinessSignal: null,
      microcycleLimit: 1,
    });
    // A one-week projection is not acceptance of another progression block.
    // Reopening in week 3 must not spend week 2's logs on an already-authored
    // prescription. Keep the accepted block's earned-load cutoff.
    return [weekStart, { ...input, metadata: { ...input.metadata, generationAnchorISO: anchor },
      progression: { ...input.progression, asOfISO: anchor } }];
  }));
  return {
    surfaces: { ...storedWorldSurfaces(state),
      athleteExclusions: getAthletePrefs().exclusions ?? [], temporarySourceFacts: facts },
    profile, markedDays: context.markedDays, facts, programsByWeek,
    recordedLoads: readBlockHistory({ feedbackByDate: state.sessionFeedback ?? {},
      blockStartISO: '0000-01-01', blockEndISO: '9999-12-31', requiredStrengthSessions: 0 }).lastRecordedLoadByExercise,
  };
}

/** No writes and no live-state rollback: execute the accepted continuation
 * with proposed facts. An active fact's output is never used as its own base.
 */
export function previewAcceptedSourceFacts(facts: readonly TemporarySourceFact[]) {
  const state = useProgramStore.getState();
  if (!state.sourceFactCompilerInput &&
      state.acceptedMaterialContext.temporarySourceFacts.some(sourceFactRequiresCompilation)) {
    throw new Error('source_fact_preview_requires_compiled_base');
  }
  const input = state.sourceFactCompilerInput ?? captureSourceFactCompilerInput(state, []);
  return { input, compiled: compileCanonicalSourceFactWeeks({ ...input, facts }) };
}

export function compileAcceptedSourceFacts(facts: readonly TemporarySourceFact[]): string[] {
  const state = useProgramStore.getState();
  if (!state.currentProgram) return [];
  const input = captureSourceFactCompilerInput(state, facts);
  const compiled = compileCanonicalSourceFactWeeks(input);
  const compatibility = composeTemporarySourceFactCompatibility({ temporarySourceFacts: facts });
  commitAcceptedStateTransaction({
    reason: 'canonical_source_fact_compilation', operation: 'forward_decision',
    program: { weekScopedOverlays: compiled.weekScopedOverlays, dateOverrides: { ...compiled.dateOverrides } },
    sourceFactCompilerInput: input,
    temporarySourceFacts: [...facts], injuryEpisodes: compatibility.injuryEpisodes,
    activeConstraints: compatibility.activeConstraints,
    readinessSignalsByDate: compatibility.readinessSignalsByDate,
    profile: input.profile, preserveExactAcceptedWorkouts: true, skipConstraintProjection: true,
    validateWeekStarts: compiled.affectedWeekStarts,
  });
  return compiled.affectedWeekStarts;
}
