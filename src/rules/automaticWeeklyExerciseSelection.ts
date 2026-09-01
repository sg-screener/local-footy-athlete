/**
 * One automatic exercise-selection state for a complete athlete week.
 *
 * It judges canonical delivered identities and the catalogue's real movement
 * classification before composition authors a row. Composer labels are not an
 * escape hatch: an anchor squat remains a squat even if a caller asks to use it
 * as support. Athlete-authored work never enters this state.
 */
import { POOL_REGISTRY } from '../data/exercisePools';
import { findPoolEntry } from '../data/exercisePoolsStrength';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import type { ComposedExerciseIdentity } from './composedRowLegality';
import {
  slotsForExerciseName,
  type SessionSlot,
  type SlotDayKind,
} from './sessionSlotCoverage';
import type { WeeklyMainStrengthSlot } from './weeklyStrengthBudget';

export type AutomaticExerciseRoute = 'strength' | 'mobility' | 'prehab';
export type AutomaticFallbackTier = 'same_category' | 'accessory' | 'prehab';

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
  canUse(candidate: AutomaticWeeklySelectionCandidate): boolean;
  accept(candidate: AutomaticWeeklySelectionCandidate): void;
  chooseFallback(request: AutomaticFallbackRequest): AutomaticFallbackChoice | null;
  checkpoint(): AutomaticWeeklySelectionCheckpoint;
  restore(checkpoint: AutomaticWeeklySelectionCheckpoint): void;
  usedIdentities(): readonly string[];
  spentMainFamilies(): readonly WeeklyMainStrengthSlot[];
}

export interface AutomaticWeeklySelectionCheckpoint {
  readonly usedIdentities: readonly string[];
  readonly spentMainFamilies: readonly WeeklyMainStrengthSlot[];
}

export function createAutomaticWeeklyExerciseSelector(
  initialDelivered: readonly string[] = [],
): AutomaticWeeklyExerciseSelector {
  const used = new Set<string>();
  const spent = new Set<WeeklyMainStrengthSlot>();

  for (const raw of initialDelivered) {
    const identity = canonicalExerciseName(raw);
    const route = automaticExerciseRouteForIdentity(identity);
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
    if (candidate.route === 'mobility' || candidate.route === 'prehab') return;
    const identity = canonicalExerciseName(candidate.identity);
    used.add(identity);
    const family = automaticMainFamilyForExercise(identity, candidate);
    if (family) spent.add(family);
  };

  const chooseFallback = (request: AutomaticFallbackRequest): AutomaticFallbackChoice | null => {
    const choose = (
      identities: readonly string[],
      tier: AutomaticFallbackTier,
      route: AutomaticExerciseRoute,
      requestedAsMain: boolean,
    ): AutomaticFallbackChoice | null => {
      for (const identity of identities) {
        const candidate: AutomaticFallbackChoice = {
          identity,
          tier,
          requestedSlot: route === 'prehab'
            ? (request.requestedSlot.includes('push') || request.requestedSlot.includes('pull')
              ? 'shoulder_prehab' : 'football_robustness')
            : request.requestedSlot,
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
      ?? choose(request.prehab, 'prehab', 'prehab', false);
  };

  return {
    canUse,
    accept,
    chooseFallback,
    checkpoint: () => ({ usedIdentities: [...used], spentMainFamilies: [...spent] }),
    restore(checkpoint) {
      used.clear(); checkpoint.usedIdentities.forEach((identity) => used.add(identity));
      spent.clear(); checkpoint.spentMainFamilies.forEach((family) => spent.add(family));
    },
    usedIdentities: () => [...used],
    spentMainFamilies: () => [...spent],
  };
}

export interface FinalAutomaticSelectionExercise {
  readonly identity: string;
  readonly authorship: 'automatic' | 'athlete';
  readonly route: AutomaticExerciseRoute;
  readonly requestedAsMain: boolean;
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
      if (route === 'strength') {
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
  return POOL_REGISTRY.trunk_anti_rotation.map((entry) => entry.name);
}

export function asComposedIdentity(identity: string): ComposedExerciseIdentity {
  return canonicalExerciseName(identity) as ComposedExerciseIdentity;
}
