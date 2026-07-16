import type {
  DayOfWeek,
  OnboardingData,
  ProgramAvailabilityConstraint,
} from '../types/domain';
import {
  ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
  ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
  acceptedProfileForContext,
  normalizeAcceptedMaterialContext,
  normalizeAcceptedProgramSurfaces,
  type AcceptedCompositionBaseV1,
  type AcceptedProfileSnapshotV1,
} from './acceptedStateColdStart';
import { commitAcceptedStateTransaction } from './acceptedStateTransaction';
import { runCoachMutationTransaction } from './coachMutationTransaction';
import { useProgramStore } from './programStore';
import { useProfileStore } from './profileStore';
import { composeTemporarySourceFactCompatibility } from '../rules/temporarySourceFact';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  buildRebuiltProgramSurfaces,
  collectWeekRebuildContext,
  decideOverrideSweep,
} from '../utils/weekRebuild';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';
import {
  composeAcceptedProfileConstraints,
  isAcceptedProfileConstraint,
} from '../rules/acceptedProfileProjection';

export type ProfileProgramChange =
  | {
      kind: 'baseline_equipment';
      equipment: string[];
    }
  | {
      kind: 'preferred_training_weekdays';
      weekdays: DayOfWeek[];
    }
  | {
      kind: 'permanent_unavailable_weekdays';
      weekdays: DayOfWeek[];
    }
  | {
      kind: 'permanent_session_time_cap';
      maxSessionMinutes: number | null;
      weekdays?: DayOfWeek[];
    }
  | {
      kind: 'profile_setup';
      patch: Partial<OnboardingData>;
    };

export interface ProfileProgramTransactionInput {
  change: ProfileProgramChange;
  todayISO: string;
  sourceSurface: string;
  expectedAcceptedRevision?: number;
  testHooks?: {
    verifyCandidate?: () => boolean;
    verifyAfterPersistence?: () => boolean;
  };
}

export interface ProfileProgramTransactionResult {
  ok: boolean;
  changedProgram: boolean;
  message: string;
  reason?: string;
  acceptedRevision?: number;
}

const DAY_ORDER: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const PERMANENT_UNAVAILABLE_PREFIX = 'accepted-profile:permanent-unavailable:';
const PERMANENT_TIME_CAP_PREFIX = 'accepted-profile:permanent-time-cap:';

function orderedWeekdays(days: readonly DayOfWeek[]): DayOfWeek[] {
  const unique = new Set(days);
  return DAY_ORDER.filter((day) => unique.has(day));
}

function applyProfileChange(
  profile: OnboardingData,
  change: ProfileProgramChange,
  now: string,
): OnboardingData {
  if (change.kind === 'profile_setup') {
    if ((change.patch.availabilityConstraints ?? [])
      .some((constraint) => constraint.scope === 'temporary')) {
      throw new Error('temporary_profile_constraints_require_source_facts');
    }
    return {
      ...profile,
      ...change.patch,
    };
  }
  if (change.kind === 'baseline_equipment') {
    return {
      ...profile,
      equipment: [...change.equipment],
      equipmentSelectionCompleteness: 'complete',
    };
  }
  if (change.kind === 'preferred_training_weekdays') {
    const preferredTrainingDays = orderedWeekdays(change.weekdays);
    return {
      ...profile,
      preferredTrainingDays,
      trainingDaysPerWeek: preferredTrainingDays.length,
    };
  }
  if (change.kind === 'permanent_unavailable_weekdays') {
    const retained = (profile.availabilityConstraints ?? []).filter((constraint) =>
      !(constraint.scope === 'permanent' && constraint.kind === 'unavailable_day') &&
      !constraint.id.startsWith(PERMANENT_UNAVAILABLE_PREFIX));
    const owned = orderedWeekdays(change.weekdays).map((day): ProgramAvailabilityConstraint => ({
      id: `${PERMANENT_UNAVAILABLE_PREFIX}${day.toLowerCase()}`,
      kind: 'unavailable_day',
      scope: 'permanent',
      dayOfWeek: day,
      active: true,
      reason: 'Permanent athlete availability',
      createdAt: now,
      updatedAt: now,
    }));
    return {
      ...profile,
      availabilityConstraints: [...retained, ...owned],
    };
  }
  const targetedDays = change.weekdays?.length
    ? orderedWeekdays(change.weekdays)
    : DAY_ORDER;
  const targetedIds = new Set(targetedDays.map((day) =>
    `${PERMANENT_TIME_CAP_PREFIX}${day.toLowerCase()}`));
  const retained = (profile.availabilityConstraints ?? [])
    .filter((constraint) =>
      !targetedIds.has(constraint.id) &&
      !(constraint.scope === 'permanent' &&
        constraint.kind === 'time_limit' &&
        !!constraint.dayOfWeek &&
        targetedDays.includes(constraint.dayOfWeek)));
  if (change.maxSessionMinutes === null) {
    return { ...profile, availabilityConstraints: retained };
  }
  const minutes = Math.trunc(change.maxSessionMinutes);
  if (!Number.isFinite(minutes) || minutes < 10 || minutes > 240) {
    throw new Error('permanent_session_time_cap_invalid');
  }
  const owned = targetedDays.map((day): ProgramAvailabilityConstraint => ({
    id: `${PERMANENT_TIME_CAP_PREFIX}${day.toLowerCase()}`,
    kind: 'time_limit',
    scope: 'permanent',
    dayOfWeek: day,
    maxSessionMinutes: minutes,
    active: true,
    reason: 'Permanent athlete session time cap',
    createdAt: now,
    updatedAt: now,
  }));
  return {
    ...profile,
    availabilityConstraints: [...retained, ...owned],
  };
}

function factFreeBase(args: {
  profile: OnboardingData;
  todayISO: string;
  now: string;
  sourceRevision: number;
}): AcceptedCompositionBaseV1 {
  const state = useProgramStore.getState();
  let surfaces = normalizeAcceptedProgramSurfaces(state);
  if (state.currentProgram) {
    const program = generateProgramLocally(args.profile, {
      todayISO: args.todayISO,
      previousProgram: state.currentProgram,
      activeConstraints: [],
      readinessSignal: null,
    });
    const context = collectWeekRebuildContext({
      baseProfile: args.profile,
      program,
      todayISO: args.todayISO,
    });
    const sweep = decideOverrideSweep(context);
    surfaces = normalizeAcceptedProgramSurfaces({
      ...surfaces,
      ...buildRebuiltProgramSurfaces(program, sweep, {
        selectedDate: args.todayISO,
      }),
    });
  }
  return {
    protocolVersion: ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
    capturedAt: args.now,
    updatedAt: args.now,
    sourceRevision: args.sourceRevision,
    provenance: 'accepted_pre_injury',
    surfaces,
  };
}

export async function commitProfileProgramTransaction(
  input: ProfileProgramTransactionInput,
): Promise<ProfileProgramTransactionResult> {
  const now = new Date().toISOString();
  const before = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  if (input.expectedAcceptedRevision !== undefined &&
    input.expectedAcceptedRevision !== before.revision) {
    return {
      ok: false,
      changedProgram: false,
      message: 'The accepted profile changed before this update could be applied.',
      reason: 'accepted_revision_changed',
    };
  }
  const currentProfile = acceptedProfileForContext(
    before,
    useProfileStore.getState().onboardingData,
  );
  let nextProfile: OnboardingData;
  try {
    nextProfile = applyProfileChange(currentProfile, input.change, now);
  } catch (error) {
    return {
      ok: false,
      changedProgram: false,
      message: 'That profile change could not be applied safely.',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
  if (semanticFingerprint(nextProfile) === semanticFingerprint(currentProfile)) {
    return {
      ok: true,
      changedProgram: false,
      message: 'Those profile settings are already active.',
      acceptedRevision: before.revision,
    };
  }
  let base: AcceptedCompositionBaseV1;
  try {
    base = factFreeBase({
      profile: nextProfile,
      todayISO: input.todayISO,
      now,
      sourceRevision: before.revision + 1,
    });
  } catch (error) {
    return {
      ok: false,
      changedProgram: false,
      message: 'The profile change could not build a valid accepted base, so nothing changed.',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
  const compatibility = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: before.temporarySourceFacts,
    activeConstraints: [
      ...before.activeConstraints.filter((constraint) =>
        !isAcceptedProfileConstraint(constraint)),
      ...composeAcceptedProfileConstraints(nextProfile, now),
    ],
    readinessSignalsByDate: before.readinessSignalsByDate,
  });
  const acceptedProfileSnapshot: AcceptedProfileSnapshotV1 = {
    protocolVersion: ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
    capturedAt: before.acceptedProfileSnapshot?.capturedAt ?? now,
    updatedAt: now,
    sourceRevision: before.revision + 1,
    onboardingData: nextProfile,
  };
  const weeks = Array.from(new Set([
    ...(base.surfaces.currentProgram?.microcycles ?? [])
      .map((microcycle) => microcycle.startDate.slice(0, 10)),
    ...(base.surfaces.currentMicrocycle
      ? [base.surfaces.currentMicrocycle.startDate.slice(0, 10)]
      : []),
    ...Object.keys(base.surfaces.weekScopedOverlays),
  ])).sort();
  const factFingerprint = semanticFingerprint(before.temporarySourceFacts);
  const profileFingerprint = semanticFingerprint(nextProfile);
  let committedBaseFingerprint: string | null = null;
  const transaction = await runCoachMutationTransaction({
    todayISO: input.todayISO,
    allowAcceptedStateOnlyChange: true,
    mutate: () => {
      const result = commitAcceptedStateTransaction({
        reason: `profile_program:${input.change.kind}:${input.sourceSurface}`,
        program: base.surfaces,
        profile: nextProfile,
        activeConstraints: compatibility.activeConstraints,
        activeInjury: compatibility.activeInjury,
        injuryEpisodes: compatibility.injuryEpisodes,
        temporarySourceFacts: before.temporarySourceFacts,
        readinessSignalsByDate: compatibility.readinessSignalsByDate,
        acceptedCompositionBase: base,
        acceptedProfileSnapshot,
        validateWeekStarts: weeks,
        programAlreadyAccepted: true,
        skipConstraintProjection: true,
      });
      committedBaseFingerprint = semanticFingerprint(
        result.context.acceptedCompositionBase?.surfaces ?? null,
      );
      return result;
    },
    didApply: () => true,
    verifyCandidate: () => {
      if (input.testHooks?.verifyCandidate?.() === false) {
        return { ok: false, reason: 'profile_program_candidate_test_rejection' };
      }
      const accepted = normalizeAcceptedMaterialContext(
        useProgramStore.getState().acceptedMaterialContext,
      );
      if (semanticFingerprint(accepted.acceptedProfileSnapshot?.onboardingData ?? null) !==
        profileFingerprint) {
        return { ok: false, reason: 'accepted_profile_candidate_mismatch' };
      }
      if (semanticFingerprint(accepted.acceptedCompositionBase?.surfaces ?? null) !==
        committedBaseFingerprint) {
        return { ok: false, reason: 'accepted_composition_base_candidate_mismatch' };
      }
      if (semanticFingerprint(accepted.temporarySourceFacts) !== factFingerprint) {
        return { ok: false, reason: 'profile_program_changed_temporary_facts' };
      }
      return { ok: true };
    },
    verifyAfterPersistence: () => {
      if (input.testHooks?.verifyAfterPersistence?.() === false) {
        return { ok: false, reason: 'profile_program_readback_test_rejection' };
      }
      const accepted = normalizeAcceptedMaterialContext(
        useProgramStore.getState().acceptedMaterialContext,
      );
      if (semanticFingerprint(accepted.acceptedProfileSnapshot?.onboardingData ?? null) !==
        profileFingerprint ||
        semanticFingerprint(useProfileStore.getState().onboardingData) !== profileFingerprint) {
        return { ok: false, reason: 'accepted_profile_durable_readback_mismatch' };
      }
      if (semanticFingerprint(accepted.acceptedCompositionBase?.surfaces ?? null) !==
        committedBaseFingerprint ||
        semanticFingerprint(accepted.temporarySourceFacts) !== factFingerprint) {
        return { ok: false, reason: 'profile_program_durable_readback_mismatch' };
      }
      return { ok: true };
    },
  });
  if (!transaction.ok) {
    return {
      ok: false,
      changedProgram: false,
      message: 'The profile and program were rolled back because the accepted result could not be verified.',
      reason: transaction.reason,
    };
  }
  const accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  return {
    ok: true,
    changedProgram: transaction.diff.hasProgrammingChange,
    message: transaction.diff.hasProgrammingChange
      ? 'Profile updated. The accepted program was rebuilt and verified.'
      : 'Profile updated and durably verified.',
    acceptedRevision: accepted.revision,
  };
}
