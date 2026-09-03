import type { SeasonPhase, Workout } from '../types/domain';
import { POOL_REGISTRY, type PoolExercise } from '../data/exercisePools';
import { EXERCISE_MUSCLE_METADATA, type MuscleGroup } from '../data/muscleExperienceMetadata';
import {
  FLOW_CATEGORY_MUSCLE_MAPPING,
  SESSION_FLOW_MENUS,
  resolveLowerDayMenu,
  type FlowCategoryMapping,
  type FlowDayType,
  type FlowSlotCategory,
  type SessionFlowMenu,
} from '../data/sessionFlowMenus';
import { classifyPoolSlot } from '../data/exercisePoolsStrength';
import { canonicalExerciseName } from './exerciseCanonicalisation';
import { exerciseProgrammingAllows } from './exerciseFilter';
import { getSessionComponentRows } from './sessionComponents';
import { getTeamTrainingWorkoutState } from './teamTraining';
import {
  dateHash,
  filterPoolEntriesForAthlete,
  type AthleteContext,
} from './sessionBuilder';
import {
  publishAutomaticProgrammingSelectionTraces,
  rankSelectedFirst,
  type AutomaticProgrammingSelectionTrace,
} from '../rules/programmingSelectionTrace';
import { getMondayForDate } from './sessionResolver';
import { exerciseVariationConflictsWithSession } from '../rules/exerciseVariationFamily';

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
  /**
   * ⚠ **WARM-UP SLOTS THE ATHLETE HAS ALREADY DONE — REQUIRED, NOT OPTIONAL.**
   *
   * `utils/sessionExecutionChecklist`'s `performedMobilityMovementIds` reads
   * them off the saved session record. It is required because the defect this
   * closes was a surface FORGETTING to ask about the warm-up (R-213): an
   * optional field is a field a new screen omits and never notices. A day with
   * nothing ticked passes `[]` and derives exactly as it always did.
   */
  performedMovementIds: readonly string[];
}

function movementHighTarget(min: number | undefined, max: number | undefined): string {
  const low = Number(min ?? 0);
  const high = Number(max ?? low);
  return `${high}`;
}

/**
 * The flow movement's authored dose, shared by the session and its front review.
 * A second formatter would let the card promise a different warm-up from the
 * one the athlete sees after Start Session.
 */
export function mobilityFlowMovementDose(movement: PoolExercise): string {
  const sets = movement.sets > 1 ? `${movement.sets} × ` : '';
  const side = movement.perSide ? ' / side' : '';
  const unit = movement.prescriptionType === 'duration' ? 's' : '';
  return `${sets}${movementHighTarget(movement.repsMin, movement.repsMax)}${unit}${side}`;
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

/**
 * The same registry, keyed the way a SAVED TICK names a movement. A warm-up row
 * is stored as its pool id, so retention (R-213) looks the movement back up by
 * the id it was recorded under rather than by a name that may have been
 * reworded since.
 */
const POOL_ENTRY_BY_ID: ReadonlyMap<string, PoolExercise> = (() => {
  const map = new Map<string, PoolExercise>();
  for (const pool of Object.values(POOL_REGISTRY)) {
    for (const entry of pool) map.set(entry.id, entry);
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
 * The candidates for one authored slot: its pools (plus any explicitly ruled
 * cross-pool exercises) intersected with its muscle groups, then this athlete's
 * equipment and injuries.
 *
 * Walks `EXERCISE_MUSCLE_METADATA` in sheet order, so the rotation is over Sam's
 * own ordering rather than over an order this file invented.
 */
export function flowSlotCandidates(
  category: FlowSlotCategory,
  athlete: AthleteContext,
): PoolExercise[] {
  const mapping = FLOW_CATEGORY_MUSCLE_MAPPING[category];
  const wanted = new Set<MuscleGroup>(mapping.muscleGroups);
  const eligible = new Set(
    filterPoolEntriesForAthlete([...POOL_ENTRY_BY_NAME.values()], athlete).map((e) => e.id),
  );
  const out: PoolExercise[] = [];
  for (const entry of EXERCISE_MUSCLE_METADATA) {
    if (!flowCategoryIncludesExercise(mapping, entry)) continue;
    if (![...entry.primary, ...entry.secondary].some((group) => wanted.has(group))) continue;
    const poolEntry = POOL_ENTRY_BY_NAME.get(canonicalExerciseName(entry.exercise));
    if (!poolEntry || !eligible.has(poolEntry.id)) continue;
    if (!exerciseProgrammingAllows(poolEntry.name, {
      experienceLevel: athlete.onboardingData?.experienceLevel,
      daysToGame: athlete.daysToGame, route: 'warmup',
    })) continue;
    out.push(poolEntry);
  }
  return out;
}

function flowCategoryIncludesExercise(
  mapping: FlowCategoryMapping,
  entry: (typeof EXERCISE_MUSCLE_METADATA)[number],
): boolean {
  return mapping.pools.includes(entry.pool)
    || (mapping.alsoEligibleExercises ?? [])
      .some((name) => canonicalExerciseName(name) === canonicalExerciseName(entry.exercise));
}

/** Exact identity and typed variation identity both count as already on the day. */
function exerciseConflictsWithDay(
  candidate: string,
  existingCanonicalNames: ReadonlySet<string>,
): boolean {
  const canonicalCandidate = canonicalExerciseName(candidate);
  return existingCanonicalNames.has(canonicalCandidate)
    || exerciseVariationConflictsWithSession({
      candidate,
      existingExerciseNames: [...existingCanonicalNames],
    });
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
  sessionExerciseNames: ReadonlySet<string>,
): MobilityPrehabFlowMovement[] {
  const movements: MobilityPrehabFlowMovement[] = [];
  const taken = new Set<string>();
  const namesThisDay = new Set(sessionExerciseNames);
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
      // Mobility / Warm-up prepares the prescribed work; it is not a second
      // place to prescribe the same exercise. Filter at the selector so the
      // slot can take its next legal authored candidate instead of deleting a
      // duplicate after composition and needlessly shrinking the menu.
      if (exerciseConflictsWithDay(candidate.name, namesThisDay)) continue;
      taken.add(candidate.id);
      namesThisDay.add(canonicalExerciseName(candidate.name));
      movements.push({ exercise: candidate, category: slot.category });
      filled += 1;
    }
  }
  return movements;
}

/**
 * The authored D17 category a movement really belongs to, found by asking the
 * mapping rather than by inventing one. Used only for a RETAINED movement,
 * whose own slot may not exist in the menu the session now takes.
 *
 * `DEFAULT_ATHLETE_CONTEXT`-style filtering is deliberately NOT applied here:
 * the question is which category authored this exercise, not whether the
 * athlete could be given it today — they have already done it.
 */
function authoredCategoryOf(exercise: PoolExercise): FlowSlotCategory | null {
  const entry = EXERCISE_MUSCLE_METADATA.find(
    (row) => canonicalExerciseName(row.exercise) === canonicalExerciseName(exercise.name),
  );
  if (!entry) return null;
  for (const category of Object.keys(FLOW_CATEGORY_MUSCLE_MAPPING) as FlowSlotCategory[]) {
    const mapping = FLOW_CATEGORY_MUSCLE_MAPPING[category];
    if (!flowCategoryIncludesExercise(mapping, entry)) continue;
    if (![...entry.primary, ...entry.secondary].some((g) => mapping.muscleGroups.includes(g))) {
      continue;
    }
    return category;
  }
  return null;
}

/**
 * ⚠ **WORK THE ATHLETE HAS ALREADY DONE OUTRANKS A MENU RE-PICKED UNDERNEATH
 * THEM — SAM, 2026-08-25 (R-213).**
 *
 * *"If a warm up is already ticked off then it should stay, but otherwise
 * swapping it for something else is okay if they change a main lift because the
 * warm up is supposed to prepare them for the work ahead."*
 *
 * Both halves are here. A performed movement the fresh fill dropped is put
 * back; everything the athlete had NOT done is whatever the fill just chose for
 * the new work. So a main lift change still re-primes the session — it just
 * cannot rewrite history while doing it.
 *
 * ⚠ **THIS IS THE ONE PLACE THE AUTHORED MENU SHAPE MAY BE BROKEN, AND IT IS
 * BOUNDED TWO WAYS.** A retained movement can come from a category this menu
 * does not contain (a lower day's hip drill kept on a day that became upper), so
 * `mobilityPrehabFlowTests` §1 asserts the shape only for a flow with nothing
 * performed. **The COUNT is not broken at all:** retention re-places work inside
 * the count the menu produced and never pads past it, which is the half of
 * "counts are law" that would actually mislead the athlete.
 */
function retainPerformed(
  filled: MobilityPrehabFlowMovement[],
  performedMovementIds: readonly string[],
  athlete: AthleteContext,
  sessionExerciseNames: ReadonlySet<string>,
): MobilityPrehabFlowMovement[] {
  if (performedMovementIds.length === 0) return filled;

  const present = new Set(filled.map((movement) => movement.exercise.id));
  const restored: MobilityPrehabFlowMovement[] = [];
  const seen = new Set<string>();
  const namesThisDay = new Set(sessionExerciseNames);
  for (const id of performedMovementIds) {
    if (present.has(id) || seen.has(id)) continue;
    seen.add(id);
    const exercise = POOL_ENTRY_BY_ID.get(id);
    // An id no pool knows is a record of something this build cannot draw. It
    // is skipped rather than turned into a movement with invented content.
    if (!exercise) continue;
    // R-213 retains completed warm-up history through a changed main lift, but
    // it must not manufacture two visible prescriptions for one exercise. The
    // load-bearing session row wins this one collision; every non-conflicting
    // completed warm-up movement retains the established behavior below.
    if (exerciseConflictsWithDay(exercise.name, namesThisDay)) continue;
    const category = authoredCategoryOf(exercise);
    if (!category) continue;
    restored.push({ exercise, category });
    namesThisDay.add(canonicalExerciseName(exercise.name));
  }
  if (restored.length === 0) return filled;

  // Performed work leads, then as much of the fresh fill as the count allows.
  const capacity = Math.max(filled.length, restored.length);
  const merged = [...restored];
  for (const movement of filled) {
    if (exerciseConflictsWithDay(movement.exercise.name, namesThisDay)) continue;
    merged.push(movement);
    namesThisDay.add(canonicalExerciseName(movement.exercise.name));
  }
  return merged.slice(0, capacity);
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

  const sessionRows = getSessionComponentRows(workout);
  const sessionExerciseNames = new Set(
    [
      ...sessionRows.powerRows,
      ...sessionRows.speedRows,
      ...sessionRows.strengthRows,
      ...sessionRows.supportRows,
      ...sessionRows.conditioningRows,
      ...sessionRows.mobilityRows,
      ...sessionRows.recoveryRows,
      ...sessionRows.teamTrainingRows,
    ].map((row) => canonicalExerciseName(
      String(row?.exercise?.name ?? row?.name ?? '').trim(),
    )).filter(Boolean),
  );

  const movements = retainPerformed(
    fillMenu(menu, context.athlete, dateHash(context.date), sessionExerciseNames),
    context.performedMovementIds,
    context.athlete,
    sessionExerciseNames,
  );
  // An empty draw is no flow rather than an empty one.
  if (movements.length === 0) return null;

  const seenNames = new Set<string>();
  const traces: AutomaticProgrammingSelectionTrace[] = movements.map((movement, seatIndex) => {
    const candidates = flowSlotCandidates(movement.category, context.athlete).map((candidate) => {
      const alreadyOnDay = exerciseConflictsWithDay(candidate.name,
        new Set([...sessionExerciseNames, ...seenNames]));
      return {
        name: candidate.name,
        eligible: !alreadyOnDay,
        rejectedBy: alreadyOnDay ? ['already_on_day' as const] : [],
        rank: null,
        score: {
          phasePriority: 0,
          athletePreference: false,
          recentUsage: 0,
          annualUsage: 0,
          weeksOrBlocksSinceUse: null,
          weeklyUsage: alreadyOnDay ? 1 : 0,
        },
      };
    });
    seenNames.add(canonicalExerciseName(movement.exercise.name));
    return {
      schemaVersion: 1,
      decisionId: `mobility-flow:${context.date}:${movement.category}:${seatIndex}`,
      kind: 'mobility_exercise',
      owner: 'mobilityPrehabFlow',
      need: {
        dateISO: context.date,
        weekStartISO: getMondayForDate(context.date),
        dayOfWeek: new Date(`${context.date}T12:00:00`).getDay(),
        phase: context.seasonPhase ?? 'unknown',
        movementOrQuality: movement.category,
        role: 'warmup_mobility',
        seatIndex,
        equipment: [...context.athlete.equipmentTags],
        experience: context.athlete.onboardingData?.experienceLevel ?? null,
        injuries: context.athlete.injuries.map((injury) => injury.bodyArea),
        daysToGame: context.athlete.daysToGame ?? null,
      },
      candidates: rankSelectedFirst(candidates, movement.exercise.name),
      selected: movement.exercise.name,
      selectionReason: 'authored_day_type_slot_rotation',
    };
  });
  publishAutomaticProgrammingSelectionTraces(traces);

  return { dayType, movements, movementCount: movements.length };
}
