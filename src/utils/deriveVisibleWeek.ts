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
 * and reactive hook now both gather inputs for this same assembler.
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
import { ownSeasonPhase } from '../rules/seasonPhaseOwner';
import { buildReadinessActiveConstraints } from './readinessConstraints';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { decisionLedgerEntries } from '../store/decisionLedgerStore';
import { liveAthleteExclusions } from './liveEvaluationSurfaces';
import { useCoachPreferencesStore } from '../store/coachPreferencesStore';
import type { ModalityPreference } from '../rules/modalityPreferenceLookup';
import type { ExerciseExclusion } from '../rules/exerciseExclusions';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import type { OnboardingData, OverrideContext } from '../types/domain';

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
  readonly modalityPreferences?: Record<string, ModalityPreference>;
  readonly overrideContexts?: Record<string, OverrideContext>;
  readonly athleteExclusions?: readonly ExerciseExclusion[];
  /** Profile answers. */
  readonly onboardingData: OnboardingData;
  /** Life-facts. */
  readonly markedDays: Record<string, string>;
  readonly readinessSignalsByDate: Record<string, unknown>;
  readonly coachActiveConstraints: unknown[];
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
    modalityPreferences: { ...useCoachPreferencesStore.getState().modalityPreferences },
    overrideContexts: { ...programState.overrideContexts },
    athleteExclusions: liveAthleteExclusions(),
    onboardingData: profileState.onboardingData,
    markedDays: { ...(calendarState.markedDays ?? {}) },
    readinessSignalsByDate: { ...(useReadinessStore.getState().signalsByDate ?? {}) },
    coachActiveConstraints: [...(coachUpdatesState.activeConstraints ?? [])],
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
        activeConstraints: (normalizeAcceptedMaterialContext(inputs.acceptedMaterialContext as never).activeConstraints ?? inputs.coachActiveConstraints ?? []) as never,
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
  const capacity = profileCapacityBandOrNull(onboardingData);

  const preferredDays = onboardingData?.preferredTrainingDays;
  const availableDayNumbers =
    preferredDays && preferredDays.length > 0
      ? preferredDays
          .map((name: string) => DAY_NAME_TO_NUMBER[name])
          .filter((n: number | undefined): n is number => n !== undefined)
      : undefined;

  const activeConstraints = acceptedOwnsMaterialState
    ? acceptedContext.activeConstraints
    : (inputs.coachActiveConstraints as never[]) ?? [];
  const readinessActiveConstraints = acceptedOwnsMaterialState
    ? []
    : buildReadinessActiveConstraints(todayReadinessSignal as never);

  return {
    todayISO,
    modalityPreferences: inputs.modalityPreferences ?? {},
    overrideContexts: inputs.overrideContexts ?? {},
    currentProgram: inputs.currentProgram,
    currentMicrocycle: inputs.currentMicrocycle,
    manualOverrides: (inputs.dateOverrides as never) || {},
    weekScopedOverlays: (inputs.weekScopedOverlays as never) || {},
    userRemovalConstraints: (inputs.userRemovalConstraints as never) || [],
    // THE ATHLETE'S EXCLUSIONS, ON THE VIEW STATE ONLY.
    //
    // This assembler and `hooks/useSchedule.useScheduleState` are the two doors
    // that mean "what the athlete sees"; every other `ScheduleState` in the app
    // is built by a canonicaliser composing the week to be STORED, and those
    // must not carry exclusions or a reversible decision gets written into the
    // program. See `utils/sessionResolver.resolveDate`.
    //
    // Gathered with the other accepted inputs, never read ambiently while
    // compiling a candidate or reconstructing a captured world.
    athleteExclusions: inputs.athleteExclusions ?? [],
    // The RECORD, same source, same breath — see the declared rival
    // (`hooks/useSchedule.ts`) and
    // `docs/REMOVAL_RECORD_SPLIT_RULING_2026-08-06.md`.
    removalDecisions: (inputs.userRemovalConstraints as never) || [],
    // THE ATHLETE'S SOURCE FACTS — leg (v)'s read side, install site 2 of 3.
    // Same source, same breath as the marks below: the accepted context is
    // already gathered, so the week's identity can be DERIVED here rather than
    // looked up on a stored declaration.
    temporarySourceFacts: acceptedContext.temporarySourceFacts,
    markedDays: acceptedOwnsMaterialState
      ? acceptedContext.markedDays
      : (inputs.markedDays as never) || {},
    athleteContext,
    // THE CLOCK OWNS SEASON PHASE (phase-ownership collapse, `46fe2df`), and
    // this assembly used to read the profile selection directly — the exact
    // defect that ruling closed. The declared rival already resolved it through
    // the owner and recorded why: "a failed phase-shift rebuild left the visible
    // week built from one and labelled by the other."
    //
    // R5.2 found it while measuring what the rival knows that the owner does
    // not, and it is the reason the rival could not simply be deleted. It
    // matters more here than it did there: since R5.1 this is the BOOT
    // authority (`quiescentBoot` -> `buildScheduleStateImperative` -> here), so
    // a skewed world derived every relaunch under the profile's answer.
    seasonPhase: ownSeasonPhase({
      program: inputs.currentProgram as never,
      profile: onboardingData as never,
    }).phase,
    usualGameDay: onboardingData?.usualGameDay,
    gameDay: onboardingData?.gameDay,
    capacity,
    blockState: (inputs.blockState as never) || null,
    sessionFeedback: (inputs.sessionFeedback as never) || {},
    weightOverrides: (inputs.weightOverrides as never) || {},
    availableDayNumbers,
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

/**
 * R-229 S4: THE LIVE WEEK HAS ONE DOOR. Every production read of "the week
 * the athlete sees, from the live stores" enters here — boot equivalence is
 * then definitional at the entry, not a property four call sites have to
 * keep re-earning. Candidate/what-if reads still use `deriveVisibleWeek`
 * with their own inputs; a caller hand-assembling the live pair
 * (`resolveWeekWithConditioning(x, buildScheduleStateImperative())`) is the
 * scattered shape this door retires, and the equivalence suite greps for it.
 */
export function deriveVisibleWeekLive(
  weekStart: string,
  todayISO?: string,
): ResolvedDay[] {
  return deriveVisibleWeek(weekStart, gatherDeriveInputs(todayISO));
}
