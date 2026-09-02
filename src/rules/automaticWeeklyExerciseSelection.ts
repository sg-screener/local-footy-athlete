/**
 * One automatic exercise-selection state for a complete athlete week.
 *
 * It judges canonical delivered identities and the catalogue's real movement
 * classification before composition authors a row. Composer labels are not an
 * escape hatch: an anchor squat remains a squat even if a caller asks to use it
 * as support. Athlete-authored work never enters this state.
 */
import { POOL_REGISTRY } from '../data/exercisePools';
import {
  STRENGTH_POOLS,
  findPoolEntry,
  type PoolSlotKey,
} from '../data/exercisePoolsStrength';
import {
  strengthExerciseClassification,
  upperAccessoryAffinity,
} from '../data/exerciseTags';
import type { MovementPlane } from '../data/exerciseMovementPlaneMetadata';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import type { ComposedExerciseIdentity } from './composedRowLegality';
import {
  slotsForExerciseName,
  type SessionSlot,
  type SlotDayKind,
} from './sessionSlotCoverage';
import type { WeeklyMainStrengthSlot } from './weeklyStrengthBudget';
import type { WorkoutExercise } from '../types/domain';
import {
  exerciseSuppliesGymTransverseOrMultiplanar,
  exerciseSuppliesLowerBodyFrontal,
  preferredMovementPlaneCohort,
  type MovementPlaneTieBreakContext,
} from './movementPlaneProgramming';

export type AutomaticExerciseRoute = 'strength' | 'power' | 'mobility' | 'prehab';
export type AutomaticFallbackTier =
  | 'same_category'
  | 'accessory'
  | 'prehab'
  | 'core_or_robustness';

export const MAX_AUTOMATIC_COMPOUNDS_PER_STRENGTH_SESSION = 4;

const CLASSIFIED_STRENGTH_POOL_SLOTS: readonly PoolSlotKey[] = [
  'squat', 'hinge',
  'horizontal_push', 'vertical_push',
  'horizontal_pull', 'vertical_pull',
  'isolation_upper', 'isolation_lower',
];

const CLASSIFIED_SUPPORT_POOL_CATEGORIES: readonly (keyof typeof POOL_REGISTRY)[] = [
  'biceps', 'groin_adductors', 'calves',
];

/** Pool scope asks which identities require the field; exercise tags own its value. */
export function requiredStrengthClassificationIdentities(): readonly string[] {
  return [...new Set([
    ...CLASSIFIED_STRENGTH_POOL_SLOTS.flatMap((slot) => [
      ...STRENGTH_POOLS[slot].anchor.entries,
      ...STRENGTH_POOLS[slot].accessory.entries,
    ].map((entry) => canonicalExerciseName(entry.name))),
    ...CLASSIFIED_SUPPORT_POOL_CATEGORIES.flatMap((category) =>
      POOL_REGISTRY[category].map((entry) => canonicalExerciseName(entry.name))),
  ])];
}

export function missingRequiredStrengthClassifications(): readonly string[] {
  return requiredStrengthClassificationIdentities()
    .filter((identity) => strengthExerciseClassification(identity) === undefined);
}

/**
 * Direction-matched upper support comes only from isolation metadata. Pool
 * groups target the area; no exercise-name classification or fallback list is
 * maintained here.
 */
export function automaticIsolationSupportCandidatesForSlot(
  slot: SessionSlot,
): readonly string[] {
  const upper = [
    ...STRENGTH_POOLS.isolation_upper.anchor.entries,
    ...STRENGTH_POOLS.isolation_upper.accessory.entries,
  ].filter((entry) => strengthExerciseClassification(entry.name) === 'isolation');
  if (slot === 'push_accessory_1' || slot === 'push_accessory_2') {
    return upper.filter((entry) => {
      const affinity = upperAccessoryAffinity(entry.name);
      return affinity === 'push' || affinity === 'both';
    })
      .map((entry) => canonicalExerciseName(entry.name));
  }
  if (slot === 'pull_accessory_1' || slot === 'pull_accessory_2') {
    return upper.filter((entry) => {
      const affinity = upperAccessoryAffinity(entry.name);
      return affinity === 'pull' || affinity === 'both';
    })
      .map((entry) => canonicalExerciseName(entry.name));
  }
  return [];
}

function poolIdentitySet(categories: readonly (keyof typeof POOL_REGISTRY)[]): ReadonlySet<string> {
  return new Set(categories.flatMap((category) => POOL_REGISTRY[category]
    .map((entry) => canonicalExerciseName(entry.name))));
}

const GENUINE_MOBILITY_IDENTITIES = poolIdentitySet(['mobility']);
const GENUINE_PREHAB_IDENTITIES = poolIdentitySet([
  'lower_prehab', 'shoulder_health', 'hamstring_light',
]);

/** Pool authorship, not a composed badge, decides the only repeat exemption. */
export function automaticExerciseRouteForIdentity(identity: string): AutomaticExerciseRoute {
  const canonical = canonicalExerciseName(identity);
  if (GENUINE_MOBILITY_IDENTITIES.has(canonical)) return 'mobility';
  if (GENUINE_PREHAB_IDENTITIES.has(canonical)) return 'prehab';
  return 'strength';
}

/** Typed authorship shared by generation, audit and rebuild paths. */
export function workoutExerciseWasAutomaticallySelected(row: WorkoutExercise): boolean {
  return row.automaticSelection === true
    || row.section18Evidence?.provenance === 'composer_declaration';
}

const MAIN_FAMILIES: ReadonlySet<SessionSlot> = new Set([
  'squat', 'hinge',
  'horizontal_push', 'vertical_push',
  'horizontal_pull', 'vertical_pull',
]);

function realMainMovementFamily(identity: string): WeeklyMainStrengthSlot | null {
  return slotsForExerciseName(canonicalExerciseName(identity))
    .find((slot): slot is WeeklyMainStrengthSlot => MAIN_FAMILIES.has(slot)) ?? null;
}

/** Real slots from the authored exercise catalogue, never from a composed row. */
export function realMovementSlotsForAutomaticExercise(identity: string): readonly SessionSlot[] {
  return slotsForExerciseName(canonicalExerciseName(identity));
}

/**
 * A main family is earned by real catalogue classification. An authored anchor
 * cannot hide behind an accessory label. A constrained accessory can spend a
 * main seat only when the weekly owner explicitly asks it to replace that main.
 */
export function automaticMainFamilyForExercise(
  identity: string,
  context: { readonly route: AutomaticExerciseRoute; readonly requestedAsMain: boolean },
): WeeklyMainStrengthSlot | null {
  if (context.route !== 'strength') return null;
  const family = realMainMovementFamily(identity);
  if (!family) return null;
  const authored = findPoolEntry(canonicalExerciseName(identity));
  return authored?.role === 'anchor' || context.requestedAsMain ? family : null;
}

export interface AutomaticWeeklySelectionCandidate {
  readonly identity: string;
  readonly requestedSlot: SessionSlot;
  readonly dayKind: SlotDayKind | null;
  readonly route: AutomaticExerciseRoute;
  readonly requestedAsMain: boolean;
}

export interface AutomaticFallbackRequest {
  readonly sameCategory: readonly string[];
  readonly accessories: readonly string[];
  readonly prehab: readonly string[];
  readonly coreOrRobustness?: readonly string[];
  readonly requestedSlot: SessionSlot;
  readonly dayKind: SlotDayKind | null;
  readonly requestedAsMain: boolean;
}

export interface AutomaticFallbackChoice extends AutomaticWeeklySelectionCandidate {
  readonly tier: AutomaticFallbackTier;
}

function violatesDedicatedDayOwnership(candidate: AutomaticWeeklySelectionCandidate): boolean {
  if (candidate.route !== 'strength') return false;
  const real = new Set(realMovementSlotsForAutomaticExercise(candidate.identity));
  if (candidate.dayKind === 'lower_hinge' && real.has('single_leg_knee')) return true;
  if (candidate.dayKind === 'lower_squat' && real.has('single_leg_hip')) return true;
  return false;
}

export interface AutomaticWeeklyExerciseSelector {
  beginSession(): void;
  canUse(candidate: AutomaticWeeklySelectionCandidate): boolean;
  accept(candidate: AutomaticWeeklySelectionCandidate): void;
  chooseFallback(request: AutomaticFallbackRequest): AutomaticFallbackChoice | null;
  movementPlaneContextFor(
    requestedSlot: SessionSlot,
    referenceIdentity?: string,
  ): MovementPlaneTieBreakContext;
  checkpoint(): AutomaticWeeklySelectionCheckpoint;
  restore(checkpoint: AutomaticWeeklySelectionCheckpoint): void;
  usedIdentities(): readonly string[];
  spentMainFamilies(): readonly WeeklyMainStrengthSlot[];
  sessionCompoundCount(): number;
}

export interface AutomaticWeeklySelectionCheckpoint {
  readonly usedIdentities: readonly string[];
  readonly spentMainFamilies: readonly WeeklyMainStrengthSlot[];
  readonly sessionCompoundIdentities?: readonly string[];
  readonly coveredCompoundSlots?: readonly SessionSlot[];
  readonly planeDeliveredIdentities?: readonly string[];
}

const COMPOUND_DIRECTION_SLOTS: ReadonlySet<SessionSlot> = new Set([
  'squat', 'hinge', 'single_leg_knee', 'single_leg_hip',
  'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
]);

export function createAutomaticWeeklyExerciseSelector(
  initialDelivered: readonly string[] = [],
): AutomaticWeeklyExerciseSelector {
  const used = new Set<string>();
  const spent = new Set<WeeklyMainStrengthSlot>();
  const sessionCompounds = new Set<string>();
  const coveredCompoundSlots = new Set<SessionSlot>();
  const planeDelivered = new Set<string>();

  for (const raw of initialDelivered) {
    const identity = canonicalExerciseName(raw);
    const route = automaticExerciseRouteForIdentity(identity);
    if (route !== 'mobility') planeDelivered.add(identity);
    if (route !== 'strength') continue;
    used.add(identity);
    const family = automaticMainFamilyForExercise(identity, {
      route, requestedAsMain: false,
    });
    if (family) spent.add(family);
  }

  const canUse = (candidate: AutomaticWeeklySelectionCandidate): boolean => {
    if (candidate.route === 'mobility' || candidate.route === 'prehab') {
      return !candidate.requestedAsMain;
    }
    const identity = canonicalExerciseName(candidate.identity);
    if (used.has(identity) || violatesDedicatedDayOwnership(candidate)) return false;
    if (candidate.route === 'power') return !candidate.requestedAsMain;
    const strengthClassification = strengthExerciseClassification(identity);
    if (strengthClassification === 'compound') {
      if (!COMPOUND_DIRECTION_SLOTS.has(candidate.requestedSlot)
        || coveredCompoundSlots.has(candidate.requestedSlot)
        || sessionCompounds.size >= MAX_AUTOMATIC_COMPOUNDS_PER_STRENGTH_SESSION) return false;
    } else if (candidate.requestedAsMain) {
      // Isolation and unlabelled support may never inherit a missing main seat.
      return false;
    }
    const family = automaticMainFamilyForExercise(identity, candidate);
    if (!family) return !candidate.requestedAsMain;
    // A real anchor is never smuggled into a support request. When a constrained
    // accessory is asked to replace a main, its real family must match the seat.
    if (!candidate.requestedAsMain || candidate.requestedSlot !== family) return false;
    return !spent.has(family);
  };

  const accept = (candidate: AutomaticWeeklySelectionCandidate): void => {
    if (!canUse(candidate)) {
      throw new Error(`Illegal automatic weekly exercise selection: ${candidate.identity}`);
    }
    const identity = canonicalExerciseName(candidate.identity);
    if (candidate.route !== 'mobility') planeDelivered.add(identity);
    if (candidate.route === 'mobility' || candidate.route === 'prehab') return;
    used.add(identity);
    if (candidate.route === 'power') return;
    if (strengthExerciseClassification(identity) === 'compound') {
      sessionCompounds.add(identity);
      coveredCompoundSlots.add(candidate.requestedSlot);
    }
    const family = automaticMainFamilyForExercise(identity, candidate);
    if (family) spent.add(family);
  };

  const movementPlaneContextFor = (
    requestedSlot: SessionSlot,
    referenceIdentity?: string,
  ): MovementPlaneTieBreakContext => {
    const lowerSlots: ReadonlySet<SessionSlot> = new Set([
      'squat', 'hinge', 'single_leg_knee', 'single_leg_hip',
      'lower_accessory', 'football_robustness',
    ]);
    const lowerFrontalPresent = [...planeDelivered].some((identity) =>
      exerciseSuppliesLowerBodyFrontal(
        identity,
        automaticExerciseRouteForIdentity(identity) === 'prehab' ? 'prehab' : 'strength',
      ));
    const gymTransverseOrMultiplanarPresent = [...planeDelivered].some((identity) =>
      exerciseSuppliesGymTransverseOrMultiplanar(
        identity,
        automaticExerciseRouteForIdentity(identity) === 'prehab' ? 'prehab' : 'strength',
      ));
    const missingUsefulPlanes: MovementPlane[] = [];
    if (lowerSlots.has(requestedSlot) && !lowerFrontalPresent) missingUsefulPlanes.push('frontal');
    if (!gymTransverseOrMultiplanarPresent) missingUsefulPlanes.push('transverse');
    return {
      ...(referenceIdentity ? { referenceIdentity } : {}),
      missingUsefulPlanes,
    };
  };

  const chooseFallback = (request: AutomaticFallbackRequest): AutomaticFallbackChoice | null => {
    const choose = (
      identities: readonly string[],
      tier: AutomaticFallbackTier,
      route: AutomaticExerciseRoute,
      requestedAsMain: boolean,
    ): AutomaticFallbackChoice | null => {
      for (const identity of preferredMovementPlaneCohort(
        identities,
        movementPlaneContextFor(request.requestedSlot),
      )) {
        const semanticSupportSlot = tier === 'core_or_robustness'
          ? (realMovementSlotsForAutomaticExercise(identity).find((slot) =>
              slot === 'football_robustness' || slot === 'core') ?? 'core')
          : null;
        const candidate: AutomaticFallbackChoice = {
          identity,
          tier,
          requestedSlot: route === 'prehab'
            ? (request.requestedSlot.includes('push') || request.requestedSlot.includes('pull')
              ? 'shoulder_prehab' : 'football_robustness')
            : semanticSupportSlot ?? request.requestedSlot,
          dayKind: request.dayKind,
          route,
          requestedAsMain,
        };
        if (canUse(candidate)) return candidate;
      }
      return null;
    };
    return choose(request.sameCategory, 'same_category', 'strength', request.requestedAsMain)
      ?? choose(request.accessories, 'accessory', 'strength', request.requestedAsMain)
      ?? choose(request.prehab, 'prehab', 'prehab', false)
      ?? choose(request.coreOrRobustness ?? [], 'core_or_robustness', 'strength', false);
  };

  return {
    beginSession() {
      sessionCompounds.clear();
      coveredCompoundSlots.clear();
    },
    canUse,
    accept,
    chooseFallback,
    movementPlaneContextFor,
    checkpoint: () => ({
      usedIdentities: [...used],
      spentMainFamilies: [...spent],
      sessionCompoundIdentities: [...sessionCompounds],
      coveredCompoundSlots: [...coveredCompoundSlots],
      planeDeliveredIdentities: [...planeDelivered],
    }),
    restore(checkpoint) {
      used.clear(); checkpoint.usedIdentities.forEach((identity) => used.add(identity));
      spent.clear(); checkpoint.spentMainFamilies.forEach((family) => spent.add(family));
      sessionCompounds.clear();
      checkpoint.sessionCompoundIdentities?.forEach((identity) => sessionCompounds.add(identity));
      coveredCompoundSlots.clear();
      checkpoint.coveredCompoundSlots?.forEach((slot) => coveredCompoundSlots.add(slot));
      planeDelivered.clear();
      checkpoint.planeDeliveredIdentities?.forEach((identity) => planeDelivered.add(identity));
    },
    usedIdentities: () => [...used],
    spentMainFamilies: () => [...spent],
    sessionCompoundCount: () => sessionCompounds.size,
  };
}

export interface FinalAutomaticSelectionExercise {
  readonly identity: string;
  readonly authorship: 'automatic' | 'athlete';
  readonly route: AutomaticExerciseRoute;
  readonly requestedAsMain: boolean;
  readonly requestedSlot?: SessionSlot;
}

export interface FinalAutomaticSessionAudit {
  readonly compoundCount: number;
  readonly compoundIdentities: readonly string[];
  readonly overLimitIdentities: readonly string[];
}

/** Final delivered-session guard. Power and athlete-added rows do not count. */
export function auditFinalAutomaticSession(
  exercises: readonly FinalAutomaticSelectionExercise[],
): FinalAutomaticSessionAudit {
  const compoundIdentities = exercises
    .filter((row) => row.authorship === 'automatic')
    .map((row) => canonicalExerciseName(row.identity))
    .filter((identity) => strengthExerciseClassification(identity) === 'compound');
  return {
    compoundCount: compoundIdentities.length,
    compoundIdentities,
    overLimitIdentities: compoundIdentities.slice(MAX_AUTOMATIC_COMPOUNDS_PER_STRENGTH_SESSION),
  };
}

export interface FinalAutomaticSelectionDay {
  readonly dayKind: SlotDayKind | null;
  readonly exercises: readonly FinalAutomaticSelectionExercise[];
}

export interface FinalAutomaticWeekSelectionAudit {
  readonly repeatedExact: readonly { readonly identity: string; readonly count: number }[];
  readonly repeatedMainFamilies: readonly {
    readonly family: WeeklyMainStrengthSlot;
    readonly identities: readonly string[];
  }[];
  readonly dedicatedDayOwnership: readonly {
    readonly dayKind: 'lower_squat' | 'lower_hinge';
    readonly identity: string;
    readonly forbiddenSlot: 'single_leg_hip' | 'single_leg_knee';
  }[];
}

/** Final delivered-name audit. Row roles and composed slots are deliberately ignored. */
export function auditFinalAutomaticWeek(
  days: readonly FinalAutomaticSelectionDay[],
): FinalAutomaticWeekSelectionAudit {
  const identities = new Map<string, number>();
  const families = new Map<WeeklyMainStrengthSlot, string[]>();
  const dedicatedDayOwnership: FinalAutomaticWeekSelectionAudit['dedicatedDayOwnership'][number][] = [];

  for (const day of days) {
    for (const row of day.exercises) {
      if (row.authorship !== 'automatic') continue;
      const identity = canonicalExerciseName(row.identity);
      const route = automaticExerciseRouteForIdentity(identity);
      if (route === 'strength' || route === 'power') {
        identities.set(identity, (identities.get(identity) ?? 0) + 1);
      }
      // The audit counts real authored anchors regardless of whatever role the
      // composer printed. Constrained accessory-as-main is enforced live by the
      // selector because only that selection request knows it spent the seat.
      const family = automaticMainFamilyForExercise(identity, {
        route, requestedAsMain: false,
      });
      if (family) {
        const list = families.get(family) ?? [];
        list.push(identity);
        families.set(family, list);
      }
      const real = new Set(realMovementSlotsForAutomaticExercise(identity));
      if (day.dayKind === 'lower_hinge' && real.has('single_leg_knee')) {
        dedicatedDayOwnership.push({ dayKind: 'lower_hinge', identity,
          forbiddenSlot: 'single_leg_knee' });
      }
      if (day.dayKind === 'lower_squat' && real.has('single_leg_hip')) {
        dedicatedDayOwnership.push({ dayKind: 'lower_squat', identity,
          forbiddenSlot: 'single_leg_hip' });
      }
    }
  }

  return {
    repeatedExact: [...identities.entries()]
      .filter(([, count]) => count > 1)
      .map(([identity, count]) => ({ identity, count })),
    repeatedMainFamilies: [...families.entries()]
      .filter(([, members]) => members.length > 1)
      .map(([family, members]) => ({ family, identities: members })),
    dedicatedDayOwnership,
  };
}

/** Prehab fallback benches, read from the existing authored pools. */
export function automaticPrehabFallbacksForSlot(slot: SessionSlot): readonly string[] {
  if (slot.includes('push') || slot.includes('pull') || slot === 'shoulders') {
    return POOL_REGISTRY.shoulder_health.map((entry) => entry.name);
  }
  if (slot === 'hinge' || slot === 'single_leg_hip') {
    return [
      ...POOL_REGISTRY.hamstring_light.map((entry) => entry.name),
      ...POOL_REGISTRY.lower_prehab.map((entry) => entry.name),
    ];
  }
  if (slot === 'squat' || slot === 'single_leg_knee' || slot === 'lower_accessory') {
    return POOL_REGISTRY.lower_prehab.map((entry) => entry.name);
  }
  if (slot === 'football_robustness') {
    return [
      ...POOL_REGISTRY.lower_prehab.map((entry) => entry.name),
      ...POOL_REGISTRY.hamstring_light.map((entry) => entry.name),
    ];
  }
  // Core/robustness is the next rung and has its own typed candidate list.
  return [];
}

export function asComposedIdentity(identity: string): ComposedExerciseIdentity {
  return canonicalExerciseName(identity) as ComposedExerciseIdentity;
}
