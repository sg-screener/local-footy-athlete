/**
 * THE DERIVE OWNER — R1.2 of the shell rebuild
 * (`docs/SHELL_REBUILD_PLAN_2026-08-05.md`, approved 2026-08-05).
 *
 *   visibleWeek = derive(Bible, profile, facts, decisions, results, today)
 *
 * One owner for the schedule-state assembly and the week derivation. Inputs
 * are EXPLICIT: `gatherDeriveInputs()` is the only sanctioned store read, and
 * `assembleScheduleState`/`deriveVisibleWeek` answer to their arguments alone
 * — `derivedWeekOwnershipTests` fails the build if an ambient read creeps
 * back in, or if the accepted-precedence switch grows a third home.
 *
 * History this closes: `buildScheduleStateImperative` (coachWeekDiff) and
 * `useScheduleState` (useSchedule) were KEEP-IN-SYNC twins of the same
 * assembly, and the debug panel carried a third copy. The imperative adapter
 * now delegates here; the reactive hook remains a DECLARED rival until R5
 * deletes it at switchover (LR-13).
 *
 * The `decisions` input is carried from R1.1 and consumed from R1.4 on, when
 * the day doors append ledger entries and the in-memory surfaces this
 * assembly reads become replay products instead of stored outputs.
 */

import {
  resolveWeekWithConditioning,
  type ScheduleState,
  type ResolvedDay,
} from './sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from './sessionBuilder';
import { resolveEquipmentAvailability } from './equipmentAvailability';
import { useProgramStore } from '../store/programStore';
import { useCalendarStore } from '../store/calendarStore';
import { useProfileStore } from '../store/profileStore';
import { useReadinessStore } from '../store/readinessStore';
import { todayISOLocal as getTodayISOLocal } from './appDate';
import { profileCapacityBandOrNull } from './readiness';
import { buildReadinessActiveConstraints } from './readinessConstraints';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { decisionLedgerEntries } from '../store/decisionLedgerStore';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import type { OnboardingData } from '../types/domain';

const DAY_NAME_TO_NUMBER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Everything derivation may read, gathered once. Field groups follow the
 * inputs schema (§2 of the plan): profile answers, life-facts, decisions,
 * results — plus, until R5 deletes them, the stored-output surfaces the
 * resolver still consults (program, overlays, overrides, accepted context).
 */
export interface DeriveWeekInputs {
  readonly todayISO: string;
  /** Profile answers. */
  readonly onboardingData: OnboardingData;
  /** Life-facts. */
  readonly markedDays: Record<string, string>;
  readonly readinessSignalsByDate: Record<string, unknown>;
  readonly coachActiveConstraints: unknown[];
  readonly coachActiveInjury: unknown;
  /** The decision ledger (consumed from R1.4). */
  readonly decisions: readonly DecisionLedgerEntry[];
  /** Stored program surfaces — outputs today, replay products from R1.4. */
  readonly currentProgram: ReturnType<typeof useProgramStore.getState>['currentProgram'];
  readonly currentMicrocycle: ReturnType<typeof useProgramStore.getState>['currentMicrocycle'];
  readonly dateOverrides: Record<string, unknown>;
  readonly weekScopedOverlays: Record<string, unknown>;
  readonly userRemovalConstraints: unknown[];
  readonly blockState: unknown;
  readonly acceptedMaterialContext: unknown;
  /** Results. */
  readonly sessionFeedback: Record<string, unknown>;
  readonly weightOverrides: Record<string, unknown>;
}

/** The one sanctioned ambient read: collect every derivation input, once. */
export function gatherDeriveInputs(todayISO?: string): DeriveWeekInputs {
  const programState = useProgramStore.getState();
  const calendarState = useCalendarStore.getState();
  const profileState = useProfileStore.getState();
  // Lazily required to avoid the store↔utils circular import (the same dodge
  // the imperative adapter used — one home for it now).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useCoachUpdatesStore } = require('../store/coachUpdatesStore');
  const coachUpdatesState = useCoachUpdatesStore.getState();
  return {
    todayISO: todayISO ?? getTodayISOLocal(),
    onboardingData: profileState.onboardingData,
    markedDays: { ...(calendarState.markedDays ?? {}) },
    readinessSignalsByDate: { ...(useReadinessStore.getState().signalsByDate ?? {}) },
    coachActiveConstraints: [...(coachUpdatesState.activeConstraints ?? [])],
    coachActiveInjury: coachUpdatesState.activeInjury ?? null,
    decisions: decisionLedgerEntries(),
    currentProgram: programState.currentProgram,
    currentMicrocycle: programState.currentMicrocycle,
    dateOverrides: { ...(programState.dateOverrides ?? {}) },
    weekScopedOverlays: { ...(programState.weekScopedOverlays ?? {}) },
    userRemovalConstraints: [...(programState.userRemovalConstraints ?? [])],
    blockState: programState.blockState ?? null,
    acceptedMaterialContext: programState.acceptedMaterialContext,
    sessionFeedback: { ...(programState.sessionFeedback ?? {}) },
    weightOverrides: { ...(programState.weightOverrides ?? {}) },
  };
}

/**
 * THE ONE ASSEMBLY. The accepted-precedence rule is stated here and in the
 * declared rival (`useScheduleState`) only: when the accepted context carries
 * a revision, it owns marked days, injury, constraints and readiness — the
 * athlete's accepted world outranks the live mirrors that fed it.
 */
export function assembleScheduleState(
  inputs: DeriveWeekInputs,
): ScheduleState & { activeConstraints: any[] } {
  const { todayISO, onboardingData } = inputs;

  const athleteContext = onboardingData
    ? {
        injuries: onboardingData.injuries || [],
        equipmentTags: resolveEquipmentAvailability(
          onboardingData,
          (inputs.coachActiveConstraints ?? []) as never,
          todayISO,
        ),
        trainingLocation: onboardingData.trainingLocation || 'Commercial gym',
        onboardingData,
      }
    : DEFAULT_ATHLETE_CONTEXT;

  const acceptedContext = normalizeAcceptedMaterialContext(
    inputs.acceptedMaterialContext as never,
  );
  const acceptedOwnsMaterialState = acceptedContext.revision > 0;
  const todayReadinessSignal = acceptedOwnsMaterialState
    ? acceptedContext.readinessSignalsByDate[todayISO]
    : (inputs.readinessSignalsByDate as never)[todayISO];
  // RENDER MUST NOT THROW (Sam, 2026-07-30): band or null, never a refusal.
  const readiness = profileCapacityBandOrNull(onboardingData);

  const preferredDays = onboardingData?.preferredTrainingDays;
  const availableDayNumbers =
    preferredDays && preferredDays.length > 0
      ? preferredDays
          .map((name: string) => DAY_NAME_TO_NUMBER[name])
          .filter((n: number | undefined): n is number => n !== undefined)
      : undefined;

  const activeInjury = acceptedOwnsMaterialState
    ? acceptedContext.activeInjury
    : (inputs.coachActiveInjury as never) ?? null;
  const activeConstraints = acceptedOwnsMaterialState
    ? acceptedContext.activeConstraints
    : (inputs.coachActiveConstraints as never[]) ?? [];
  const readinessActiveConstraints = acceptedOwnsMaterialState
    ? []
    : buildReadinessActiveConstraints(todayReadinessSignal as never);

  return {
    currentProgram: inputs.currentProgram,
    currentMicrocycle: inputs.currentMicrocycle,
    manualOverrides: (inputs.dateOverrides as never) || {},
    weekScopedOverlays: (inputs.weekScopedOverlays as never) || {},
    userRemovalConstraints: (inputs.userRemovalConstraints as never) || [],
    markedDays: acceptedOwnsMaterialState
      ? acceptedContext.markedDays
      : (inputs.markedDays as never) || {},
    athleteContext,
    seasonPhase: onboardingData?.seasonPhase || null,
    usualGameDay: onboardingData?.usualGameDay,
    gameDay: onboardingData?.gameDay,
    readiness,
    blockState: (inputs.blockState as never) || null,
    sessionFeedback: (inputs.sessionFeedback as never) || {},
    weightOverrides: (inputs.weightOverrides as never) || {},
    availableDayNumbers,
    activeInjury,
    injuryProjectionOwner: acceptedContext.injuryEpisodes.length > 0
      ? 'accepted_episode'
      : undefined,
    activeConstraints: [
      ...activeConstraints,
      ...readinessActiveConstraints,
    ],
  };
}

/** The derive owner: the proven resolver over the one assembly. */
export function deriveVisibleWeek(
  weekStart: string,
  inputs: DeriveWeekInputs,
): ResolvedDay[] {
  return resolveWeekWithConditioning(weekStart, assembleScheduleState(inputs));
}
