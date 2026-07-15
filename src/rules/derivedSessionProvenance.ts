import type {
  DerivedSessionCredit,
  DerivedSessionDependency,
  DerivedSessionHistoryEntry,
  DerivedSessionOrigin,
  DerivedSessionProvenance,
  DerivedSessionScope,
  Workout,
} from '../types/domain';
import { hasMeaningfulWorkoutContent } from '../utils/workoutContent';
import type { WeeklyExposureContractV2 } from './weeklyExposureContractV2';

export interface DerivedSessionExpiry {
  planEntryId: string | null;
  workoutId: string;
  origin: DerivedSessionOrigin;
  scope: DerivedSessionScope;
  reason: 'trigger_changed' | 'fixture_returned' | 'typed_invalidation';
}

export interface DerivedSessionExpiryCandidate {
  workouts: Workout[];
  expiries: DerivedSessionExpiry[];
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** The lifecycle signature contains policy intent, not achieved/evaluator output. */
export function section18ContractLifecycleSignature(
  contract: WeeklyExposureContractV2,
  weekStart: string,
): string {
  return stable({
    protocolVersion: contract.protocolVersion,
    weekStart: weekStart.slice(0, 10),
    identity: {
      phase: contract.identity.seasonPhase,
      mode: contract.identity.mode,
      kind: contract.identity.weekKind,
      anchorState: contract.identity.anchorState,
    },
    anchors: contract.anchors.map((anchor) => ({
      id: anchor.id,
      kind: anchor.kind,
      day: anchor.dayOfWeek,
      participation: anchor.participation,
    })),
    selected: {
      strength: contract.mainStrength.exposure.plannerSelectedTarget,
      conditioning: contract.conditioning.core.plannerSelectedTarget,
      sprint: contract.sprintHighSpeed.exposure.plannerSelectedTarget,
      patterns: contract.strengthPatterns.requiredSafePatterns,
      rest: contract.restStress.requiredFullRestMinimum,
      hardMaximum: contract.restStress.permittedHardDayMaximum ??
        contract.restStress.normalProgrammedHardDayMaximum,
    },
    safety: {
      prohibitedPatterns: contract.safety.prohibitedPatterns,
      prohibitedSprint: contract.safety.prohibitedSprintHighSpeed,
      prohibitedPower: contract.safety.prohibitedPower,
    },
  });
}

export function createDerivedSessionProvenance(args: {
  origin: DerivedSessionOrigin;
  scope: DerivedSessionScope;
  triggerSignature: string;
  credit: DerivedSessionCredit;
  originatingDate: string;
  originatingFixtureDate?: string | null;
  sourcePlanEntryId?: string | null;
  history?: DerivedSessionHistoryEntry[];
  validWhile?: DerivedSessionProvenance['validWhile'];
  invalidWhen?: DerivedSessionProvenance['invalidWhen'];
  dependency?: DerivedSessionDependency;
}): DerivedSessionProvenance {
  return {
    protocolVersion: args.dependency ? 2 : 1,
    authorship: 'system',
    origin: args.origin,
    scope: args.scope,
    triggerSignature: args.triggerSignature,
    targetMetric: args.credit.metric,
    credit: { ...args.credit },
    originatingFixtureDate: args.originatingFixtureDate ?? null,
    originatingDate: args.originatingDate.slice(0, 10),
    validWhile: args.validWhile ?? [{ kind: 'contract_signature_matches', signature: args.triggerSignature }],
    invalidWhen: args.invalidWhen ?? (args.origin === 'fixture_replacement'
      ? [{ kind: 'fixture_present', fixtureDate: args.originatingFixtureDate ?? null }]
      : []),
    history: args.history ?? [{
      action: 'created',
      date: args.originatingDate.slice(0, 10),
    }],
    sourcePlanEntryId: args.sourcePlanEntryId ?? null,
    dependency: args.dependency,
  };
}

export function appendDerivedSessionHistory(
  provenance: readonly DerivedSessionProvenance[] | undefined,
  entry: DerivedSessionHistoryEntry,
): DerivedSessionProvenance[] | undefined {
  return provenance?.map((record) => ({
    ...record,
    history: [...record.history, { ...entry }],
  }));
}

/** Stamp newly generated planner content while its originating contract is known. */
export function stampPlannerDerivedSessionProvenance(args: {
  workouts: readonly Workout[];
  contract: WeeklyExposureContractV2;
  weekStart: string;
}): Workout[] {
  const triggerSignature = section18ContractLifecycleSignature(args.contract, args.weekStart);
  return args.workouts.map((workout) => {
    if (workout.derivedSessionProvenance?.length) return workout;
    const records: DerivedSessionProvenance[] = [];
    const sourcePlanEntryId = workout.planEntryId ?? null;
    const hasStrength = workout.exercises.some((row) =>
      row.section18Evidence?.role === 'main_strength') ||
      !!workout.strengthIntent?.effectivePatterns.length;
    const role = workout.section18Evidence?.conditioningRole ?? workout.section18ConditioningRole;
    const hasConditioning = role === 'required_core' || role === 'planner_selected_core' ||
      role === 'core' || role === 'optional_flush' || role === 'optional_recovery_aerobic';
    const strengthOrigin: DerivedSessionOrigin = contractSafetyOwns(args.contract, 'main_strength')
      ? 'safety_substitution'
      : 'contract_shortfall_repair';
    const conditioningOrigin: DerivedSessionOrigin =
      args.contract.equipment.substitutionStatus === 'substituted'
        ? 'equipment_substitution'
        : contractSafetyOwns(args.contract, 'conditioning')
          ? 'safety_substitution'
          : 'contract_shortfall_repair';
    if (hasStrength && workout.workoutType !== 'Team Training') {
      records.push(createDerivedSessionProvenance({
        origin: workout.sessionTier === 'optional'
          ? 'optional_planner_addition'
          : strengthOrigin,
        scope: hasConditioning ? 'strength_component' : 'session',
        triggerSignature,
        credit: { metric: 'main_strength', amount: 1 },
        originatingDate: args.weekStart,
        sourcePlanEntryId,
        // Strength remains valid across fixture changes when its typed content
        // still passes the new contract; whole-week evaluation owns removal.
        validWhile: [],
      }));
    }
    if (hasConditioning && workout.workoutType !== 'Team Training' && workout.workoutType !== 'Game') {
      const core = role === 'required_core' || role === 'planner_selected_core' || role === 'core';
      records.push(createDerivedSessionProvenance({
        origin: core ? conditioningOrigin : 'optional_planner_addition',
        scope: hasStrength ? 'conditioning_component' : 'session',
        triggerSignature,
        credit: {
          metric: core ? 'conditioning_core' : 'optional_non_core',
          amount: 1,
          conditioningRole: role,
        },
        originatingDate: args.weekStart,
        sourcePlanEntryId,
        // Ordinary contract-satisfying core work remains preservable across
        // readiness/fixture signatures. Typed safety/equipment substitutes
        // retain their narrower lifecycle and are reconsidered when it moves.
        validWhile: core && conditioningOrigin === 'contract_shortfall_repair'
          ? []
          : undefined,
      }));
    }
    if (workout.speedBlock) {
      records.push(createDerivedSessionProvenance({
        origin: 'optional_planner_addition',
        scope: 'speed_component',
        triggerSignature,
        credit: { metric: 'sprint_high_speed', amount: 1 },
        originatingDate: args.weekStart,
        sourcePlanEntryId,
        validWhile: [],
      }));
    }
    if (workout.powerBlock) {
      records.push(createDerivedSessionProvenance({
        origin: 'optional_planner_addition',
        scope: 'power_component',
        triggerSignature,
        credit: { metric: 'optional_non_core', amount: 1 },
        originatingDate: args.weekStart,
        sourcePlanEntryId,
        validWhile: [],
      }));
    }
    if (workout.sessionTier === 'optional' && records.length === 0) {
      records.push(createDerivedSessionProvenance({
        origin: 'optional_planner_addition',
        scope: 'session',
        triggerSignature,
        credit: { metric: 'optional_non_core', amount: 1 },
        originatingDate: args.weekStart,
        sourcePlanEntryId,
        validWhile: [],
      }));
    }
    if (
      records.length === 0 &&
      workout.workoutType !== 'Rest' &&
      workout.workoutType !== 'Game' &&
      workout.workoutType !== 'Team Training'
    ) {
      records.push(createDerivedSessionProvenance({
        origin: workout.workoutType === 'Recovery'
          ? 'rest_distribution_repair'
          : 'optional_planner_addition',
        scope: 'session',
        triggerSignature,
        credit: {
          metric: workout.workoutType === 'Recovery'
            ? 'safe_session_content'
            : 'optional_non_core',
          amount: 1,
        },
        originatingDate: args.weekStart,
        sourcePlanEntryId,
      }));
    }
    return records.length > 0 ? { ...workout, derivedSessionProvenance: records } : workout;
  });
}

function contractSafetyOwns(
  contract: WeeklyExposureContractV2,
  domain: 'main_strength' | 'conditioning',
): boolean {
  return contract.safety.reasons.length > 0 && (
    contract.safety.affectedDomains.includes(domain) ||
    (domain === 'main_strength' && contract.safety.affectedDomains.includes('session_dose'))
  );
}

/** Bind accepted generated provenance to the final post-safety contract. */
export function rebindDerivedSessionProvenance(args: {
  workouts: readonly Workout[];
  contract: WeeklyExposureContractV2;
  weekStart: string;
}): Workout[] {
  const signature = section18ContractLifecycleSignature(args.contract, args.weekStart);
  return args.workouts.map((workout) => workout.derivedSessionProvenance?.length
    ? {
        ...workout,
        derivedSessionProvenance: workout.derivedSessionProvenance.map((record) => ({
          ...record,
          triggerSignature: signature,
          validWhile: record.validWhile.map((condition) =>
            condition.kind === 'contract_signature_matches'
              ? { ...condition, signature }
              : condition),
        })),
      }
    : workout);
}

function withoutConditioningComponent(workout: Workout, recordIndex: number): Workout | null {
  const linkedRows = new Set(
    (workout.conditioningBlock?.options ?? []).flatMap((option) => option.exerciseIds),
  );
  const provenance = (workout.derivedSessionProvenance ?? [])
    .filter((_record, index) => index !== recordIndex);
  const stripped: Workout = {
    ...workout,
    exercises: (workout.exercises ?? []).filter((row) =>
      !linkedRows.has(row.id) && row.section18Evidence?.role !== 'conditioning'),
    conditioningBlock: undefined,
    conditioningCategory: undefined,
    conditioningFlavour: undefined,
    conditioningFeasibility: undefined,
    hasCombinedConditioning: false,
    attachedConditioningKind: undefined,
    coachAddedConditioningLabel: undefined,
    section18ConditioningRole: undefined,
    section18Evidence: undefined,
    derivedSessionProvenance: provenance.length > 0 ? provenance : undefined,
  };
  return hasMeaningfulWorkoutContent(stripped) ? stripped : null;
}

function withoutDerivedScope(
  workout: Workout,
  record: DerivedSessionProvenance,
  recordIndex: number,
): Workout | null {
  if (record.scope === 'session') {
    const restoration = record.dependency?.restoration.workout;
    return restoration ? JSON.parse(JSON.stringify(restoration)) as Workout : null;
  }
  if (record.scope === 'conditioning_component') {
    return withoutConditioningComponent(workout, recordIndex);
  }
  const provenance = (workout.derivedSessionProvenance ?? [])
    .filter((_value, index) => index !== recordIndex);
  const base = {
    ...workout,
    derivedSessionProvenance: provenance.length > 0 ? provenance : undefined,
  };
  if (record.scope === 'power_component') return { ...base, powerBlock: undefined };
  if (record.scope === 'speed_component') return { ...base, speedBlock: undefined };
  if (record.scope === 'recovery_component') return { ...base, recoveryAddons: [] };
  if (record.scope === 'strength_component') {
    const stripped = {
      ...base,
      exercises: base.exercises.filter((row) => row.section18Evidence?.role !== 'main_strength'),
      strengthIntent: undefined,
      strengthPatternContributions: undefined,
    };
    return hasMeaningfulWorkoutContent(stripped) ? stripped : null;
  }
  return base;
}

function fixturePresent(contract: WeeklyExposureContractV2): boolean {
  return contract.anchors.some((anchor) =>
    (anchor.kind === 'game' || anchor.kind === 'practice_match') &&
    anchor.participation === 'normal_unrestricted');
}

function fixtureDatePresent(contract: WeeklyExposureContractV2, fixtureDate: string | null): boolean {
  if (!fixtureDate) return fixturePresent(contract);
  const fixtureDay = new Date(`${fixtureDate.slice(0, 10)}T12:00:00`).getDay();
  return contract.anchors.some((anchor) =>
    (anchor.kind === 'game' || anchor.kind === 'practice_match') &&
    anchor.dayOfWeek === fixtureDay);
}

function exactFixtureDatePresent(args: {
  contract: WeeklyExposureContractV2;
  fixtureDate: string | null;
  activeFixtureDates?: ReadonlySet<string>;
}): boolean {
  if (args.fixtureDate && args.activeFixtureDates) {
    return args.activeFixtureDates.has(args.fixtureDate.slice(0, 10));
  }
  return fixtureDatePresent(args.contract, args.fixtureDate);
}

function expiryReason(args: {
  record: DerivedSessionProvenance;
  currentSignature: string;
  contract: WeeklyExposureContractV2;
  activeFixtureDates?: ReadonlySet<string>;
}): DerivedSessionExpiry['reason'] | null {
  if (args.record.invalidWhen.some((condition) =>
    condition.kind === 'fixture_present' && fixturePresent(args.contract))) {
    return 'fixture_returned';
  }
  if (args.record.invalidWhen.some((condition) =>
    condition.kind === 'fixture_absent' && !exactFixtureDatePresent({
      contract: args.contract,
      fixtureDate: condition.fixtureDate,
      activeFixtureDates: args.activeFixtureDates,
    }))) {
    return 'typed_invalidation';
  }
  if (args.record.validWhile.some((condition) =>
    condition.kind === 'contract_signature_matches' && condition.signature !== args.currentSignature)) {
    return 'trigger_changed';
  }
  if (args.record.invalidWhen.some((condition) =>
    condition.kind === 'contract_signature_matches' && condition.signature === args.currentSignature)) {
    return 'typed_invalidation';
  }
  return null;
}

/**
 * Generates deterministic expiry candidates. The whole-week owner evaluates
 * them before accepting removal, so provenance enables disposal but never
 * bypasses the complete contract.
 */
export function buildDerivedSessionExpiryCandidates(args: {
  workouts: readonly Workout[];
  contract: WeeklyExposureContractV2;
  weekStart: string;
  activeFixtureDates?: ReadonlySet<string>;
}): DerivedSessionExpiryCandidate[] {
  const currentSignature = section18ContractLifecycleSignature(args.contract, args.weekStart);
  const removals: Array<{
    workoutIndex: number;
    recordIndex: number;
    record: DerivedSessionProvenance;
    reason: DerivedSessionExpiry['reason'];
  }> = [];
  args.workouts.forEach((workout, workoutIndex) => {
    (workout.derivedSessionProvenance ?? []).forEach((record, recordIndex) => {
      if (record.authorship !== 'system') return;
      const reason = expiryReason({
        record,
        currentSignature,
        contract: args.contract,
        activeFixtureDates: args.activeFixtureDates,
      });
      if (reason) removals.push({ workoutIndex, recordIndex, record, reason });
    });
  });
  const candidateFor = (selected: typeof removals): DerivedSessionExpiryCandidate => {
    const selectedByWorkout = new Map<number, typeof removals>();
    for (const removal of selected) {
      selectedByWorkout.set(removal.workoutIndex, [
        ...(selectedByWorkout.get(removal.workoutIndex) ?? []),
        removal,
      ]);
    }
    const workouts = args.workouts.flatMap((workout, workoutIndex) => {
      let next: Workout | null = workout;
      const forWorkout = (selectedByWorkout.get(workoutIndex) ?? [])
        .sort((left, right) => right.recordIndex - left.recordIndex);
      for (const removal of forWorkout) {
        if (!next) break;
        next = withoutDerivedScope(next, removal.record, removal.recordIndex);
      }
      return next ? [next] : [];
    });
    return {
      workouts,
      expiries: selected.map((removal) => ({
        planEntryId: args.workouts[removal.workoutIndex].planEntryId ?? null,
        workoutId: args.workouts[removal.workoutIndex].id,
        origin: removal.record.origin,
        scope: removal.record.scope,
        reason: removal.reason,
      })),
    };
  };
  if (removals.length === 0) return [];
  return [candidateFor(removals), ...removals.map((removal) => candidateFor([removal]))];
}
