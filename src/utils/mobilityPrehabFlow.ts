import type { SeasonPhase, Workout } from '../types/domain';
import { POOL_REGISTRY, type PoolExercise } from '../data/exercisePools';
import { EXERCISE_MUSCLE_METADATA, type MuscleGroup } from '../data/muscleExperienceMetadata';
import {
  FLOW_CATEGORY_MUSCLE_MAPPING,
  SESSION_FLOW_MENUS,
  resolveLowerDayMenu,
  type FlowDayType,
  type FlowSlotCategory,
  type SessionFlowMenu,
} from '../data/sessionFlowMenus';
import { classifyPoolSlot } from '../data/exercisePoolsStrength';
import { canonicalExerciseName } from './exerciseCanonicalisation';
import { getSessionComponentRows } from './sessionComponents';
import { getTeamTrainingWorkoutState } from './teamTraining';
import {
  dateHash,
  filterPoolEntriesForAthlete,
  type AthleteContext,
} from './sessionBuilder';

/**
 * D13/D17 — the Mobility & Prehab flow that sits collapsed at the top of a session.
 *
 * Spec: `docs/SESSION_TEMPLATE_SPEC_2026-07-25.md` §4 (the mechanism) and
 * `docs/PROGRAMMING_DESIGN_SESSION_2026-07-23.md` §D17 (the content). Bible `:229`.
 *
 * ## It composes from D17, and finding that out reversed this file's rewrite
 *
 * This module used to pick one of ten `MOBILITY_FLOW_TEMPLATES` entries by the
 * session's dominant movement pattern, then attach two hand-mapped "primers". Sam
 * does not recognise those bundles
 * (`docs/OPTIONAL_PLACEMENT_LAW_SUPERSESSION_2026-07-30.md`) and the provenance
 * trace agrees: the exercise NAMES were his, the groupings arrived in a single
 * unauthored commit.
 *
 * The retirement was first written to compose from `MOBILITY_POOL` across the four
 * signed mobility regions. **That was wrong, and for the same reason the bundles
 * were wrong.** `data/sessionFlowMenus.ts` is D17 — Sam AUTHORED it on 2026-07-27,
 * for THIS surface, and its own header says "NOT WIRED YET: nothing composes a flow
 * from this." Composing from a different signed source while the one he wrote for
 * the job sat unconsumed would have been the same class of defect one layer over:
 * deriving from something other than what he authored.
 *
 * So the flow is now D17's, exactly:
 *
 *   MENU BY DAY TYPE      upper / lower_hinge / lower_squat / lower_general /
 *                         full_body, with his precedence — hinge > squat > general.
 *   COUNTS ARE LAW        every menu lands on four items; the app chooses WHICH,
 *                         never how many.
 *   CATEGORIES RESOLVE    each slot draws from the pools and muscle groups D17
 *                         maps it to, through the authored muscle metadata.
 *   DOSES ARE CURATED      `FLOW_DOSING.curatedDoseWins` is true and every
 *                         candidate is a curated pool entry, so each movement
 *                         carries the dose Sam authored on it.
 *
 * WHAT THE BUNDLES TOOK WITH THEM. `TEMPLATE_FOR_SHAPE` (a mapping this file's own
 * comment called "a v1 placeholder, on purpose") and the `phaseSuitability` filter
 * both existed to choose AMONG bundles; with a menu per day type there is nothing
 * to choose. The primers went too — they were agent-picked prehab, and D17 has
 * authored prehab slots in the menus. What SURVIVES is the shape DETECTION, which
 * was never the placeholder: D17 needs to know the day type.
 *
 * ## The flow is never load-bearing
 *
 * §6 item 6 and `FLOW_IS_NEVER_LOAD_BEARING`: the product assumes athletes will
 * sometimes skip the flow entirely, so any prehab that matters must live in the
 * session as an ordinary badged row. Nothing here feeds `SessionComponentKind`,
 * conditioning credit, the Finish action, or the feedback panel — and
 * `mobilityPrehabFlowTests` §5 fails if a future change wires it in.
 */

export interface MobilityPrehabFlowMovement {
  readonly exercise: PoolExercise;
  /** Which D17 slot it filled. Travels so a movement can name its authored slot. */
  readonly category: FlowSlotCategory;
}

export interface MobilityPrehabFlow {
  /** Which of Sam's menus this session took. */
  readonly dayType: FlowDayType;
  readonly movements: readonly MobilityPrehabFlowMovement[];
  readonly movementCount: number;
}

export interface MobilityPrehabFlowContext {
  workout: Partial<Workout> | null | undefined;
  seasonPhase: SeasonPhase | null | undefined;
  isGameWeek: boolean;
  /** Equipment and injuries — the flow filters exactly as every pool draw does. */
  athlete: AthleteContext;
  /** ISO date of the session; rotates which entry fills each slot. */
  date: string;
}

const CONDITIONING_ONLY_TYPES: ReadonlySet<string> = new Set([
  'Conditioning',
  'Flush-Out',
  'Sprint-Intervals',
  'Hill-Sprints',
  'MAS-Training',
  'Quality-Sprints',
  'MetCon',
  'Flog-Friday',
  'Long-Run',
  '6x1km',
  'Tempo-Run',
]);

const UPPER_SLOTS = new Set([
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
]);

/**
 * Every curated pool entry, by canonical name.
 *
 * D17 defines a slot's candidates by MUSCLE-SHEET pool ("Shoulder health"), not by
 * registry category — `FLOW_CATEGORY_MUSCLE_MAPPING.pools` says so in its own type
 * comment. So the draw walks the authored sheet and resolves each name here, and
 * the app needs no mapping between the two authored vocabularies at all.
 *
 * The first draft DID write that mapping, drawing from `POOL_REGISTRY` by category
 * and checking muscle groups. `mobilityPrehabFlowTests` §1 killed it on its first
 * run: `Band Pull-Apart` is in `SHOULDER_HEALTH_POOL` but the muscle sheet files it
 * under a different pool, so a shoulder_prehab slot drew a movement D17 does not
 * put there. Reading the field Sam authored removes the divergence rather than
 * reconciling it.
 */
const POOL_ENTRY_BY_NAME: ReadonlyMap<string, PoolExercise> = (() => {
  const map = new Map<string, PoolExercise>();
  for (const pool of Object.values(POOL_REGISTRY)) {
    for (const entry of pool) map.set(canonicalExerciseName(entry.name), entry);
  }
  return map;
})();

function isRecoveryWorkout(workout: any): boolean {
  return workout?.workoutType === 'Recovery' || workout?.sessionTier === 'recovery';
}

/**
 * Which of Sam's menus this session takes.
 *
 * Returns null when nothing classifies — a session with no recognisable strength
 * pattern has no gym work to prime, and offering a flow at the top of nothing is
 * the uninvited placement his law forbids.
 */
export function flowDayTypeFor(workout: Partial<Workout>): FlowDayType | null {
  const rows = getSessionComponentRows(workout);
  const candidates = [...rows.strengthRows, ...rows.supportRows];

  let squat = 0;
  let hinge = 0;
  let upper = 0;
  for (const row of candidates) {
    const name = canonicalExerciseName(
      String(row?.exercise?.name ?? row?.name ?? '').trim(),
    );
    if (!name) continue;
    const slot = classifyPoolSlot(name)?.slot;
    if (!slot) continue;
    if (slot === 'squat') squat += 1;
    else if (slot === 'hinge') hinge += 1;
    else if (UPPER_SLOTS.has(slot)) upper += 1;
  }

  const lower = squat + hinge;
  if (lower === 0 && upper === 0) return null;
  if (lower > 0 && upper > 0) return 'full_body';
  if (upper > 0) return 'upper';
  // Sam's precedence, through his own resolver rather than re-derived here.
  return resolveLowerDayMenu({ isHinge: hinge > 0, isSquat: squat > 0 }).dayType;
}

/**
 * The candidates for one authored slot: D17's pools ∩ D17's muscle groups, then
 * this athlete's equipment and injuries.
 *
 * Walks `EXERCISE_MUSCLE_METADATA` in sheet order, so the rotation is over Sam's
 * own ordering rather than over an order this file invented.
 */
export function flowSlotCandidates(
  category: FlowSlotCategory,
  athlete: AthleteContext,
): PoolExercise[] {
  const mapping = FLOW_CATEGORY_MUSCLE_MAPPING[category];
  const pools = new Set<string>(mapping.pools);
  const wanted = new Set<MuscleGroup>(mapping.muscleGroups);
  const eligible = new Set(
    filterPoolEntriesForAthlete([...POOL_ENTRY_BY_NAME.values()], athlete).map((e) => e.id),
  );
  const out: PoolExercise[] = [];
  for (const entry of EXERCISE_MUSCLE_METADATA) {
    if (!pools.has(entry.pool)) continue;
    if (![...entry.primary, ...entry.secondary].some((group) => wanted.has(group))) continue;
    const poolEntry = POOL_ENTRY_BY_NAME.get(canonicalExerciseName(entry.exercise));
    if (!poolEntry || !eligible.has(poolEntry.id)) continue;
    out.push(poolEntry);
  }
  return out;
}

/**
 * Fill Sam's menu.
 *
 * THE COUNTS ARE LAW, so nothing here adjusts one. What the app decides is WHICH
 * entry fills each slot, rotated by date so the same session on the same day is
 * identical and a later week differs. A slot whose candidates are exhausted by
 * equipment or injury filtering SHRINKS — it never pads from another category,
 * because a category is what Sam authored and a count borrowed across categories
 * is a menu he did not write.
 */
function fillMenu(
  menu: SessionFlowMenu,
  athlete: AthleteContext,
  seed: number,
): MobilityPrehabFlowMovement[] {
  const movements: MobilityPrehabFlowMovement[] = [];
  const taken = new Set<string>();
  let slotIndex = 0;
  for (const slot of menu.slots) {
    const candidates = flowSlotCandidates(slot.category, athlete);
    const slotSeed = seed + slotIndex * 7919; // prime offset, as every pool draw uses
    slotIndex += 1;
    if (candidates.length === 0) continue;
    let filled = 0;
    for (let step = 0; step < candidates.length && filled < slot.count; step += 1) {
      const candidate = candidates[(slotSeed + step) % candidates.length];
      if (taken.has(candidate.id)) continue;
      taken.add(candidate.id);
      movements.push({ exercise: candidate, category: slot.category });
      filled += 1;
    }
  }
  return movements;
}

export function selectMobilityPrehabFlow(
  context: MobilityPrehabFlowContext,
): MobilityPrehabFlow | null {
  const { workout } = context;
  if (!workout) return null;

  // Three ruled exclusions. A whole recovery day makes the flow redundant (§6
  // item 3, `DAY_KINDS_WITHOUT_FLOW`); conditioning-only days get no flow in v1
  // (§6 item 8); a team-only day has no gym session to prime for.
  if (isRecoveryWorkout(workout)) return null;
  if (CONDITIONING_ONLY_TYPES.has(String(workout.workoutType ?? ''))) return null;
  if (getTeamTrainingWorkoutState(workout).isTeamTrainingOnly) return null;

  const dayType = flowDayTypeFor(workout);
  if (!dayType) return null;
  const menu = SESSION_FLOW_MENUS.find((entry) => entry.dayType === dayType);
  if (!menu) return null;

  const movements = fillMenu(menu, context.athlete, dateHash(context.date));
  // An empty draw is no flow rather than an empty one.
  if (movements.length === 0) return null;

  return { dayType, movements, movementCount: movements.length };
}
