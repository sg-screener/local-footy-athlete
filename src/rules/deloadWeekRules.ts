import type {
  SeasonPhase,
  WeekKind,
  WorkoutExercise,
} from '../types/domain';
import { CONDITIONING_META, EXERCISE_TAGS } from '../data/exerciseTags';
import { classifyPoolSlot } from '../data/exercisePoolsStrength';
import { resolveExerciseName } from '../utils/loadEstimation';
import { resolveSeasonPhaseWeekKind } from './seasonPhaseClock';

export type DeloadConditioningCategory =
  | 'aerobic_base'
  | 'tempo'
  | 'sprint'
  | 'vo2'
  | 'glycolytic';

/**
 * THE DELOAD LAW — Sam's authored transformation (2026-07-27, Bible §14).
 *
 * "Same week, same days — the structure doesn't change, the work shrinks."
 *
 * This is the WHAT. It is deliberately separate from the WHEN, because three
 * doors deload — a scheduled deload week, a low-readiness call (rolling 7
 * days), and an active moderate-or-severe illness — and Sam's law says no door
 * invents its own reductions. A door decides IF; this decides WHAT, once.
 *
 * Two entries supersede shipped behaviour:
 *   conditioningWorkMultiplier — conditioning used to be untouched by a deload
 *     apart from a category downgrade. Halving the work is new law.
 *   keepPower — power used to be REMOVED outright on deload weeks. Sam keeps a
 *     small sharp dose: a deload is not a reason to lose sharpness.
 */
export const DELOAD_LAW = {
  /** Main lifts: "half the sets". */
  mainLiftSetMultiplier: 0.5,
  /** Never halve a lift out of existence. */
  minSetsPerExercise: 1,
  /** "Every set easy — RPE 5-6 ... nowhere near failure." */
  rpeMin: 5,
  rpeMax: 6,
  /** "Accessories: cut to 2-3, or half, whichever is less." */
  accessoryMaxKept: 3,
  accessoryKeepMultiplier: 0.5,
  /** "Conditioning: half the total work." */
  conditioningWorkMultiplier: 0.5,
  /** "One quality exposure max, the rest easy aerobic." */
  maxQualityConditioningExposures: 1,
  /** "Power/speed: keep a small sharp dose." Not removed. */
  keepPower: true,
  /** Few reps, full recovery — the dose stays sharp while it shrinks. */
  powerSetMultiplier: 0.5,
  minPowerSets: 1,
  /**
   * "Weight stays the same or drops slightly if you're beat up." The default is
   * HOLD. The drop is CONDITIONAL, so it is not an unconditional multiplier —
   * which is what the code did before this law.
   */
  beatUpLoadMultiplier: 0.9,
} as const;

/**
 * Which door opened this deload. The TRANSFORMATION is the same for all three —
 * "no door invents its own reductions" — but only the scheduled door is
 * phase-gated (see `resolveDoorDeloadPolicy`).
 */
export type DeloadDoor = 'scheduled' | 'readiness' | 'illness';

export interface DeloadWeekPolicy {
  weekKind: 'deload';
  /**
   * In-season is reachable through the readiness and illness doors only; the
   * scheduled door never mints it (D16).
   */
  seasonPhase: SeasonPhase;
  intensityMultiplier: number;
  /**
   * True when the athlete is beat up, which is the ONLY case Sam's law drops
   * the weight. Absent/false means hold the weight.
   */
  athleteIsBeatUp?: boolean;
}

export function resolveWeekKind(
  seasonPhase: SeasonPhase | null | undefined,
  phaseWeekNumber: number,
): WeekKind {
  return resolveSeasonPhaseWeekKind(seasonPhase, phaseWeekNumber);
}

export function resolveWeekIntensityMultiplier(
  seasonPhase: SeasonPhase | null | undefined,
  weekKind: WeekKind,
): number {
  if (weekKind !== 'deload') return 1.0;
  if (seasonPhase === 'Off-season') return 0.85;
  if (seasonPhase === 'Pre-season') return 0.9;
  return 1.0;
}

/**
 * The SCHEDULED door: a deload week the block plan laid down in advance.
 *
 * Phase-gated by D16 — "no scheduled in-season deloads; games and byes
 * self-regulate; backing off happens through readiness/bye recovery only." The
 * gate belongs to THIS door alone. Gating the readiness and illness doors the
 * same way would leave in-season with no way to deload at all, which is the
 * opposite of what D16 says.
 */
export function resolveDeloadWeekPolicy(
  seasonPhase: SeasonPhase | null | undefined,
  weekKind: WeekKind | null | undefined,
): DeloadWeekPolicy | null {
  if (weekKind !== 'deload') return null;
  if (seasonPhase !== 'Off-season' && seasonPhase !== 'Pre-season') return null;
  return {
    weekKind: 'deload',
    seasonPhase,
    intensityMultiplier: resolveWeekIntensityMultiplier(seasonPhase, weekKind),
  };
}

/**
 * The READINESS and ILLNESS doors: an athlete-driven deload, in ANY phase.
 *
 * These are the doors D16 names as the in-season way to back off, so they carry
 * no phase gate. What they open is the SAME transformation the scheduled door
 * opens — `DELOAD_LAW`, untouched — because "no door invents its own
 * reductions." The only thing that varies by phase is the intensity multiplier,
 * and in-season it resolves to 1.0: the weight is HELD, which is Sam's default
 * ("Weight stays the same, or drops slightly if the athlete is beat up"). The
 * halved sets and RPE 5-6 are the whole change.
 */
export function resolveDoorDeloadPolicy(args: {
  door: Exclude<DeloadDoor, 'scheduled'>;
  seasonPhase: SeasonPhase | null | undefined;
  athleteIsBeatUp?: boolean;
}): DeloadWeekPolicy | null {
  const seasonPhase = args.seasonPhase ?? 'In-season';
  return {
    weekKind: 'deload',
    seasonPhase,
    intensityMultiplier: resolveWeekIntensityMultiplier(seasonPhase, 'deload'),
    athleteIsBeatUp: args.athleteIsBeatUp,
  };
}

export function isHardDeloadConditioningCategory(
  category: DeloadConditioningCategory | null | undefined,
): boolean {
  return category === 'sprint' || category === 'vo2' || category === 'glycolytic';
}

export function deloadConditioningCategory(
  category: DeloadConditioningCategory | null | undefined,
): DeloadConditioningCategory | null {
  if (category === 'vo2') return 'tempo';
  if (category === 'sprint' || category === 'glycolytic') return 'aerobic_base';
  return category ?? null;
}

export function deloadConditioningFlavour(
  category: DeloadConditioningCategory | null | undefined,
): 'aerobic' | 'tempo' | 'high-intensity' | undefined {
  const deloaded = deloadConditioningCategory(category);
  if (deloaded === 'aerobic_base') return 'aerobic';
  if (deloaded === 'tempo') return 'tempo';
  return undefined;
}

export function isConditioningExerciseRow(exercise: WorkoutExercise): boolean {
  const name = exercise.exercise?.name ?? '';
  const tags = EXERCISE_TAGS[name];
  if (tags?.movement === 'conditioning') return true;
  // Registry consult, not regex widening (LR-9 forbids widening): the 55
  // authored template names answer from CONDITIONING_META — the same
  // registry-first shape as the EXERCISE_TAGS line above.
  if (CONDITIONING_META[name]) return true;
  return /\b(conditioning|sprint|tempo|aerobic|interval|run|bike|row|ski|swim|vo2|mas|cool-?down|warm-?up)\b/i
    .test(`${name} ${exercise.notes ?? ''}`);
}

export function isMainStrengthRow(exercise: WorkoutExercise): boolean {
  if (isConditioningExerciseRow(exercise)) return false;
  // The pool registry is keyed by CANONICAL names, and the generator writes
  // display names — "Romanian Deadlift" for the pool's "RDLs". Asking the
  // registry with the raw name returned null for those rows, so this test
  // called a session's anchor lift an accessory and the trim below deleted it.
  //
  // The §18 evidence classifier already resolves the alias before asking, so
  // the two readers of the same row disagreed. One key, asked the same way, is
  // the fix; adding the missing names to the pool would leave the next alias
  // to find the same hole.
  return classifyPoolSlot(resolveExerciseName(exercise.exercise?.name ?? ''))?.role === 'anchor';
}

export function isAccessoryStrengthRow(exercise: WorkoutExercise): boolean {
  if (isConditioningExerciseRow(exercise)) return false;
  return !isMainStrengthRow(exercise);
}

function roundLoad(weightKg: number): number {
  return Math.round(weightKg * 2) / 2;
}

function appendDeloadNote(notes: string | undefined): string {
  const note =
    `Deload: keep RPE ${DELOAD_LAW.rpeMin}-${DELOAD_LAW.rpeMax}; `
    + 'every rep fast and clean, nowhere near failure.';
  if (!notes) return note;
  if (/Deload week:/i.test(notes)) return notes;
  return `${notes} ${note}`;
}

/**
 * Apply the deload law to a session's STRENGTH rows.
 *
 * Main lifts halve their sets; accessories are cut to 2-3 or half, whichever is
 * less; weight is HELD unless the athlete is beat up. Conditioning rows pass
 * through untouched here — `applyConditioningDeloadToExercises` owns those,
 * because Sam's conditioning rule is about total WORK rather than sets.
 */
export function applyStrengthDeloadToExercises(
  exercises: WorkoutExercise[],
  policy: DeloadWeekPolicy,
): WorkoutExercise[] {
  const accessoryIndexes = exercises
    .map((exercise, index) => ({ exercise, index }))
    .filter(({ exercise }) => !isConditioningExerciseRow(exercise)
      && isAccessoryStrengthRow(exercise))
    .map(({ index }) => index);

  // "cut to 2-3, or half, whichever is LESS" — the cap and the half compete,
  // and the smaller number wins. With 8 accessories the cap (3) wins; with 4
  // the half (2) wins.
  const keepCount = Math.min(
    DELOAD_LAW.accessoryMaxKept,
    Math.floor(accessoryIndexes.length * DELOAD_LAW.accessoryKeepMultiplier),
  );
  const removeIndexes = new Set(accessoryIndexes.slice(keepCount));

  return exercises
    .filter((_, index) => !removeIndexes.has(index))
    .map((exercise, index) => {
      if (isConditioningExerciseRow(exercise)) {
        return { ...exercise, exerciseOrder: index + 1 };
      }

      const nextSets = Math.max(
        DELOAD_LAW.minSetsPerExercise,
        Math.round(exercise.prescribedSets * DELOAD_LAW.mainLiftSetMultiplier),
      );

      // Weight is HELD by default. Sam's law drops it only when the athlete is
      // beat up, and then only slightly — so this is a conditional, not the
      // unconditional phase multiplier the code used to apply.
      const nextWeight = policy.athleteIsBeatUp
        && exercise.prescribedWeightKg
        && exercise.prescribedWeightKg > 0
        ? roundLoad(exercise.prescribedWeightKg * DELOAD_LAW.beatUpLoadMultiplier)
        : exercise.prescribedWeightKg;

      return {
        ...exercise,
        exerciseOrder: index + 1,
        prescribedSets: nextSets,
        prescribedWeightKg: nextWeight,
        notes: appendDeloadNote(exercise.notes),
      };
    });
}

/** A conditioning row that trains a hard quality rather than easy aerobic work. */
function isQualityConditioningRow(exercise: WorkoutExercise): boolean {
  const name = exercise.exercise?.name ?? '';
  return /\b(vo2|mas|sprint|interval|repeat|hard|tempo|shuttle|fartlek|emom|tabata)\b/i
    .test(`${name} ${exercise.notes ?? ''}`);
}

/**
 * Apply the deload law to a session's CONDITIONING rows.
 *
 * NEW LAW (Sam, 2026-07-27): "Conditioning: half the total work. One quality
 * exposure max, the rest easy aerobic." Before this, a deload left conditioning
 * volume untouched and only downgraded the category.
 *
 * Rows are kept rather than deleted — the structure does not change, the work
 * shrinks — so a demoted quality row becomes easy aerobic work of half the
 * duration rather than disappearing from the athlete's week.
 */
export function applyConditioningDeloadToExercises(
  exercises: WorkoutExercise[],
  _policy: DeloadWeekPolicy,
): WorkoutExercise[] {
  let qualityKept = 0;

  return exercises.map((exercise, index) => {
    if (!isConditioningExerciseRow(exercise)) {
      return { ...exercise, exerciseOrder: index + 1 };
    }

    const isQuality = isQualityConditioningRow(exercise);
    const keepAsQuality = isQuality
      && qualityKept < DELOAD_LAW.maxQualityConditioningExposures;
    if (keepAsQuality) qualityKept += 1;

    const durationCarrier = exercise as WorkoutExercise & {
      prescribedDurationMinutes?: number;
      deloadQualityExposure?: boolean;
    };
    const minutes = durationCarrier.prescribedDurationMinutes;
    const halved = typeof minutes === 'number' && minutes > 0
      ? Math.round(minutes * DELOAD_LAW.conditioningWorkMultiplier)
      : minutes;

    return {
      ...exercise,
      exerciseOrder: index + 1,
      ...(typeof halved === 'number' ? { prescribedDurationMinutes: halved } : {}),
      deloadQualityExposure: keepAsQuality,
      notes: appendConditioningDeloadNote(exercise.notes, keepAsQuality),
    } as WorkoutExercise;
  });
}

function appendConditioningDeloadNote(
  notes: string | undefined,
  keptAsQuality: boolean,
): string {
  const note = keptAsQuality
    ? 'Deload: this is the week\'s one quality exposure — keep it sharp but short.'
    : 'Deload: easy aerobic only. Half the usual work.';
  if (!notes) return note;
  if (/^Deload:/m.test(notes) || /Deload:/.test(notes)) return notes;
  return `${notes} ${note}`;
}

/** A power dose under the deload law: kept, but smaller and still sharp. */
export interface PowerDose {
  readonly sets: number;
  readonly repsMin: number;
  readonly repsMax: number;
}

/**
 * Shrink a power dose for a deload week.
 *
 * Sam's law: "Power/speed: keep a small sharp dose — few reps, full recovery,
 * stop the moment speed drops." Power used to be REMOVED entirely on deload
 * weeks; returning null here would reinstate exactly that.
 */
export function deloadPowerDose(full: PowerDose): PowerDose | null {
  if (!DELOAD_LAW.keepPower) return null;
  return {
    sets: Math.max(
      DELOAD_LAW.minPowerSets,
      Math.round(full.sets * DELOAD_LAW.powerSetMultiplier),
    ),
    // Reps are already low on power work and the point is SHARPNESS, so the
    // rep range is preserved rather than cut — it is the volume that drops.
    repsMin: full.repsMin,
    repsMax: full.repsMax,
  };
}
