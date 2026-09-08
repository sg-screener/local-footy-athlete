/**
 * coachRevisionTemplateContext — the ONE seam through which dynamic
 * registry templates (engine-generated strength / accessory sessions)
 * reach app state.
 *
 * Why this exists: static templates (flush rides, recovery flow) are pure
 * functions of (templateId, date). Engine-generated strength sessions
 * also need the athlete context (injuries, equipment, onboarding) and
 * accepted phase, equipment, exclusions and selection history for the same
 * canonical strength composer as weekly programming. The registry signature stays
 * (templateId, date) everywhere — policy, producer, and writer all call
 * it — so the context arrives via this module-level provider instead of
 * threading new parameters through every call site.
 *
 * Determinism contract: within one app session the provider returns the
 * same context for the requested date, so the advertised snapshot (producer),
 * the validation signature (policy), and the written workout (writer)
 * are all derived from identical inputs. Tests may inject a fixture
 * provider; the default reads the live stores lazily and falls back to
 * safe defaults when stores are unavailable (pure node test runs).
 */

import type { AthleteContext } from './sessionBuilder';
import { DEFAULT_ATHLETE_CONTEXT } from './sessionBuilder';
import type { ComposerInputs } from '../rules/composeWeek';
import { canonicalWeeklyAvailabilityStateFrom } from '../rules/canonicalWeeklyAvailabilityState';
import { canonicalWeeklyInjuryStateFrom } from '../rules/canonicalWeeklyInjuryState';
import { buildGenerationConstraintContext } from './generationConstraints';
import { resolveSeasonPhaseClock, phaseClockMondayISO } from '../rules/seasonPhaseClock';
import { composedIdentityFor } from '../rules/composedRowLegality';
import type { Workout } from '../types/domain';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import { selectMobilityPrehabFlow } from './mobilityPrehabFlow';
import { applyMobilityFlowExerciseDecisions, applyRecoveryAddonExerciseDecisions } from './derivedExerciseDecisions';
import { performedMobilityMovementIds } from './sessionExecutionChecklist';
import { recordedLoadsFromFeedback } from '../rules/blockBoundaryProgression';

export interface CoachRevisionTemplateContext {
  athlete: AthleteContext;
  /** ISO dates of known games (marked + virtual), for proximity filters. */
  gameDates: string[];
  inSeason: boolean;
  strengthComposition?: Omit<ComposerInputs, 'plannedDays'>;
  dayExerciseReadState?: {
    performedMovementIds: readonly string[];
    entries: readonly DecisionLedgerEntry[];
    excludedExerciseNames: readonly string[];
  };
}

export type CoachRevisionTemplateContextProvider =
  (dateISO?: string) => CoachRevisionTemplateContext;

const FALLBACK_CONTEXT: CoachRevisionTemplateContext = {
  athlete: DEFAULT_ATHLETE_CONTEXT,
  gameDates: [],
  inSeason: true,
};

/** Default provider: read the live stores lazily (same pattern as
 *  useSchedule) so the module works in the app without bootstrap wiring,
 *  and degrades to the fallback in store-less test environments. */
function liveStoreProvider(dateISO?: string): CoachRevisionTemplateContext {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useProfileStore } = require('../store/profileStore') as typeof import('../store/profileStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useCalendarStore } = require('../store/calendarStore') as typeof import('../store/calendarStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useCoachUpdatesStore } = require('../store/coachUpdatesStore') as typeof import('../store/coachUpdatesStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolveEquipmentAvailability } = require('./equipmentAvailability');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { todayISOLocal } = require('./appDate');

    const onboardingData = useProfileStore.getState().onboardingData;
    const markedDays = useCalendarStore.getState().markedDays ?? {};
    const activeConstraints =
      useCoachUpdatesStore.getState().activeConstraints ?? [];
    const todayISO = dateISO ?? todayISOLocal();

    const athlete: AthleteContext = onboardingData
      ? { activeConstraints,
          injuries: onboardingData.injuries || [],
          equipmentTags: resolveEquipmentAvailability(
            onboardingData,
            activeConstraints,
            todayISO,
          ),
          onboardingData,
        }
      : { ...DEFAULT_ATHLETE_CONTEXT };

    const { getEffectiveGameDates } = require('./sessionResolver') as typeof import('./sessionResolver');
    const { buildScheduleStateImperative } = require('./coachWeekDiff') as typeof import('./coachWeekDiff');
    const { buildFilterContext } = require('./exerciseFilter') as typeof import('./exerciseFilter');
    const gameDates = [...getEffectiveGameDates(buildScheduleStateImperative(), todayISO)].sort();
    athlete.daysToGame = buildFilterContext(todayISO, gameDates, [], false).daysToGame;

    const inSeason =
      (onboardingData?.seasonPhase ?? 'In-season') === 'In-season';

    if (!onboardingData) return { athlete, gameDates, inSeason };
    const { useProgramStore, getBlockPositionForGeneration } = require('../store/programStore') as typeof import('../store/programStore');
    const { getAthletePrefs } = require('../store/athletePreferencesStore') as typeof import('../store/athletePreferencesStore');
    const { blockSelectionHistory } = require('../store/blockSelectionHistoryStore') as typeof import('../store/blockSelectionHistoryStore');
    const program = useProgramStore.getState().currentProgram;
    const weekStartISO = phaseClockMondayISO(todayISO);
    const phase = resolveSeasonPhaseClock({ selectedPhase: onboardingData.seasonPhase,
      targetWeekStartISO: weekStartISO, persistedClock: program?.seasonPhaseClock,
      legacyProgram: program, seasonFinishedOn: onboardingData.seasonFinishedOn });
    const availability = canonicalWeeklyAvailabilityStateFrom({ profile: onboardingData,
      weekStartISO, activeConstraints });
    const injury = canonicalWeeklyInjuryStateFrom({ profile: onboardingData,
      generationConstraints: buildGenerationConstraintContext({ activeConstraints, todayISO }) });
    const prefs = getAthletePrefs(todayISO);
    const position = getBlockPositionForGeneration(todayISO);
    const strengthComposition: Omit<ComposerInputs, 'plannedDays'> = {
      profile: onboardingData, todayISO: weekStartISO,
      phaseClock: { weekNumber: phase.phaseWeekNumber }, seasonPhase: phase.clock.selectedPhase,
      offseasonSubphase: phase.offseasonSubphase,
      kit: availability.composition.permanentKit,
      temporaryKitByDayOfWeek: availability.composition.temporaryKitByDayOfWeek,
      injuries: { prohibitedPatterns: injury.prohibitedPatterns, excludedIdentities: prefs.excluded ?? [] },
      blockNumber: position.blockNumber, blockStartISO: position.blockStart,
      pinnedIdentities: (prefs.pinned ?? []).map(composedIdentityFor),
      progressedIdentities: [], selectionHistory: blockSelectionHistory(),
      // R-358: a door-authored row reads the athlete's own record before any estimate.
      recordedLoads: recordedLoadsFromFeedback(useProgramStore.getState().sessionFeedback ?? {}),
    };
    const { useDecisionLedgerStore } = require('../store/decisionLedgerStore') as typeof import('../store/decisionLedgerStore');
    return { athlete, gameDates, inSeason, strengthComposition, dayExerciseReadState: {
      performedMovementIds: performedMobilityMovementIds(useProgramStore.getState().sessionFeedback[todayISO] ?? null),
      entries: useDecisionLedgerStore.getState().entries,
      excludedExerciseNames: prefs.excluded ?? [],
    } };
  } catch {
    return FALLBACK_CONTEXT;
  }
}

let provider: CoachRevisionTemplateContextProvider = liveStoreProvider;

export function getCoachRevisionTemplateContext(dateISO?: string): CoachRevisionTemplateContext {
  try {
    return provider(dateISO);
  } catch {
    return FALLBACK_CONTEXT;
  }
}

/** Read the same visible exercises as the day/session, including derived work. */
export function coachRevisionExistingExerciseNames(workout: Workout | null, date: string): string[] {
  if (!workout) return [];
  const ctx = getCoachRevisionTemplateContext(date);
  const read = ctx.dayExerciseReadState ?? { performedMovementIds: [], entries: [], excludedExerciseNames: [] };
  const visible = applyRecoveryAddonExerciseDecisions({ athlete:ctx.athlete,workout, date, entries: read.entries,
    excludedExerciseNames: read.excludedExerciseNames });
  const flow = applyMobilityFlowExerciseDecisions({ athlete:ctx.athlete,date, entries: read.entries,
    excludedExerciseNames: read.excludedExerciseNames,
    flow: selectMobilityPrehabFlow({ workout: visible, date, athlete: ctx.athlete,
      seasonPhase: ctx.strengthComposition?.seasonPhase ?? ctx.athlete.onboardingData?.seasonPhase,
      isGameWeek: ctx.gameDates.some(game => phaseClockMondayISO(game) === phaseClockMondayISO(date)),
      performedMovementIds: read.performedMovementIds }),
  });
  return [...visible.exercises.map(row => row.exercise.name),
    ...visible.recoveryAddons?.flatMap(addon => addon.exercises.map(row => row.name)) ?? [],
    ...flow?.movements.map(movement => movement.exercise.name) ?? []];
}

/** Test / bootstrap injection point. Pass null to restore the default. */
export function setCoachRevisionTemplateContextProvider(
  next: CoachRevisionTemplateContextProvider | null,
): void {
  provider = next ?? liveStoreProvider;
}
