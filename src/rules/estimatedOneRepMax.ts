export interface OneRepMaxBasis {
  readonly externalLoadKg: number;
  readonly reps: number;
  readonly bodyWeightKg?: number;
}

export const RIR_ESTIMATE_METHOD = 'nuzzo_last_set_rir_v1' as const;
export type TrackedLiftId = 'pull_up' | 'bench_press' | 'rdl' | 'back_squat'
  | 'lat_pulldown' | 'overhead_press' | 'trap_bar_deadlift' | 'bulgarian_split_squat';
export type TrackedLiftSlot = 'pull_up' | 'bench_press' | 'rdl' | 'back_squat';
export type TrackedLiftChoices = Partial<Record<TrackedLiftSlot, TrackedLiftId>>;
export type TrackedLiftProgrammingPattern = 'push' | 'pull' | 'squat' | 'hinge';
export type TrackedLiftProgrammingSeat =
  | 'horizontal_push' | 'vertical_push' | 'horizontal_pull' | 'vertical_pull'
  | 'squat' | 'hinge'
  // R-353: the tracked single-leg squat lives in the single-leg knee seat.
  | 'single_leg_knee';
export const TRACKED_LIFT_PAIRS: Readonly<Record<TrackedLiftSlot, readonly TrackedLiftId[]>> = {
  pull_up: ['pull_up', 'lat_pulldown'],
  bench_press: ['bench_press', 'overhead_press'],
  rdl: ['rdl', 'trap_bar_deadlift'],
  back_squat: ['back_squat', 'bulgarian_split_squat'],
};
export const TRACKED_LIFTS: Readonly<Record<TrackedLiftId, { label: string; names: readonly string[] }>> = {
  pull_up: { label: 'Pull-Up', names: ['Pull-Ups', 'Pull-Up', 'Weighted Pull-Up', 'Weighted Pull-Ups'] },
  bench_press: { label: 'Bench Press', names: ['Bench Press'] },
  rdl: { label: 'RDL', names: ['RDL', 'RDLs', 'Romanian Deadlift', 'Romanian Deadlifts'] },
  back_squat: { label: 'Back Squat', names: ['Back Squat', 'Back Squats'] },
  lat_pulldown: { label: 'Lat Pulldown', names: ['Lat Pulldown'] },
  overhead_press: { label: 'OHP', names: ['Overhead Press', 'OHP'] },
  trap_bar_deadlift: { label: 'Trap-Bar Deadlift', names: ['Trap Bar Deadlift', 'Trap-Bar Deadlift'] },
  bulgarian_split_squat: { label: 'Bulgarian Split Squat', names: ['Bulgarian Split Squat', 'Bulgarian Split Squats'] },
};

export function trackedLiftId(name: string): TrackedLiftId | null {
  const normalized = name.trim().toLowerCase();
  return (Object.keys(TRACKED_LIFTS) as TrackedLiftId[]).find((id) =>
    TRACKED_LIFTS[id].names.some((alias) => alias.toLowerCase() === normalized)) ?? null;
}

export function selectedTrackedLifts(choices: TrackedLiftChoices = {}): TrackedLiftId[] {
  return (Object.keys(TRACKED_LIFT_PAIRS) as TrackedLiftSlot[]).map((slot) => {
    const chosen = choices?.[slot];
    return chosen && TRACKED_LIFT_PAIRS[slot].includes(chosen) ? chosen : slot;
  });
}

const TRACKED_LIFT_SLOT_FOR_PATTERN: Readonly<Record<
  TrackedLiftProgrammingPattern, TrackedLiftSlot
>> = {
  push: 'bench_press', pull: 'pull_up', squat: 'back_squat', hinge: 'rdl',
};

const TRACKED_LIFT_PROGRAMMING_SEAT: Readonly<Record<
  TrackedLiftId, TrackedLiftProgrammingSeat
>> = {
  bench_press: 'horizontal_push', overhead_press: 'vertical_push',
  pull_up: 'vertical_pull', lat_pulldown: 'vertical_pull',
  // R-353 (Sam, 2026-09-02, "yep fix that"): a Bulgarian split squat has no
  // weekly main family, so the squat main seat refused it every week and the
  // athlete's tracked lift never landed. It is the tracked lift of the
  // single-leg knee seat; the squat seat keeps a bilateral squat.
  back_squat: 'squat', bulgarian_split_squat: 'single_leg_knee',
  rdl: 'hinge', trap_bar_deadlift: 'hinge',
};

/**
 * One validated owner of the lift that anchors each programming pattern. The
 * Progress selector stores a partial answer; absent or invalid values retain
 * the four published defaults instead of creating an unprogrammable state.
 */
export function selectedTrackedLiftForPattern(
  choices: TrackedLiftChoices | null | undefined,
  pattern: TrackedLiftProgrammingPattern,
): TrackedLiftId {
  const slot = TRACKED_LIFT_SLOT_FOR_PATTERN[pattern];
  const selected = choices?.[slot];
  return selected && TRACKED_LIFT_PAIRS[slot].includes(selected) ? selected : slot;
}

/** The movement plane the selected anchor actually occupies. */
export function selectedTrackedLiftProgrammingSeat(
  choices: TrackedLiftChoices | null | undefined,
  pattern: TrackedLiftProgrammingPattern,
): TrackedLiftProgrammingSeat {
  return TRACKED_LIFT_PROGRAMMING_SEAT[selectedTrackedLiftForPattern(choices, pattern)];
}

/** When an athlete chooses the alternative, its default leaves automatic work. */
export function displacedTrackedLiftDefaults(
  choices: TrackedLiftChoices | null | undefined,
): TrackedLiftId[] {
  return (Object.keys(TRACKED_LIFT_PAIRS) as TrackedLiftSlot[]).flatMap((slot) => {
    const selected = choices?.[slot];
    return selected && selected !== slot && TRACKED_LIFT_PAIRS[slot].includes(selected)
      ? [slot] : [];
  });
}

/** Raw athlete observation, written by session feedback, read only by Progress.
 * Guard: estimatedOneRepMaxTests (including the accepted save/reopen journey).
 */
export interface LastSetEstimateInput {
  method: typeof RIR_ESTIMATE_METHOD;
  liftId: TrackedLiftId;
  exerciseId: string;
  workoutExerciseId: string;
  setId: string;
  setNumber: number | null;
  source: 'logged_set' | 'athlete_confirmed_last_set';
  actualWeightKg: number | null;
  actualReps: number | null;
  rir: 0 | 1 | 2 | 3 | 4 | '5+' | null;
  skipped: boolean;
  bodyWeightKg?: number | null;
  side?: 'non_dominant';
  /** Legacy ingress only. New feedback does not ask for or partition by setup. */
  setup?: string;
}

// Nuzzo et al., doi:10.1007/s40279-023-01937-7, Figures 2 and 3.
// Coordinates visually verified against the published tables. 1 @ 100% is the
// definitional endpoint. Interpolation/RIR/<=15 are Sam's application policy,
// not validation of a last-set inverse estimator (research used fresh first sets).
export const GENERAL_REPS_PERCENT = [
  [1, 100], [3.28, 95], [4.94, 90], [7.15, 85], [9.75, 80],
  [12.37, 75], [14.80, 70], [17.11, 65], [19.53, 60],
] as const;
export const BENCH_REPS_PERCENT = [
  [1, 100], [2.59, 95], [4.11, 90], [6.23, 85], [8.82, 80],
  [11.51, 75], [14.08, 70], [16.59, 65], [19.34, 60],
] as const;

export function estimateLastSetOneRepMaxKg(input: LastSetEstimateInput): number | null {
  if (input.method !== RIR_ESTIMATE_METHOD || input.skipped || input.rir === null
    || typeof input.rir !== 'number' || !Number.isInteger(input.rir)
    || input.rir < 0 || input.rir > 4 || !TRACKED_LIFTS[input.liftId]
    || !input.exerciseId || !input.workoutExerciseId || !input.setId) return null;
  if (!Number.isInteger(input.actualReps) || Number(input.actualReps) < 1) return null;
  if (typeof input.actualWeightKg !== 'number' || !Number.isFinite(input.actualWeightKg)
    || input.actualWeightKg < 0) return null;
  if (input.liftId === 'bulgarian_split_squat' && input.side !== 'non_dominant') return null;
  const bodyWeight = input.liftId === 'pull_up' ? input.bodyWeightKg : 0;
  if (typeof bodyWeight !== 'number' || !Number.isFinite(bodyWeight)
    || (input.liftId === 'pull_up' && bodyWeight <= 0)) return null;
  const load = input.actualWeightKg + bodyWeight;
  const effectiveReps = Number(input.actualReps) + input.rir;
  if (load <= 0 || effectiveReps > 15) return null;
  const curve = input.liftId === 'bench_press' ? BENCH_REPS_PERCENT : GENERAL_REPS_PERCENT;
  for (let i = 1; i < curve.length; i += 1) {
    const [loReps, loPercent] = curve[i - 1];
    const [hiReps, hiPercent] = curve[i];
    if (effectiveReps > hiReps) continue;
    const percent = loPercent + (hiPercent - loPercent) * (effectiveReps - loReps) / (hiReps - loReps);
    return load * 100 / percent - bodyWeight;
  }
  return null;
}

/**
 * Brzycki estimated 1RM. Low-rep sets only: beyond ten reps the estimate
 * becomes too sensitive to endurance and proximity to failure to plot as a
 * believable strength value.
 */
export function estimateOneRepMaxKg(loadKg: number, reps: number): number | null {
  if (!Number.isFinite(loadKg) || loadKg <= 0) return null;
  if (!Number.isInteger(reps) || reps < 1 || reps > 10) return null;
  return loadKg * 36 / (37 - reps);
}

/**
 * External-load equivalent. Barbell lifts have no bodyWeightKg and therefore
 * return the ordinary estimate. A weighted Pull-Up estimates the total system
 * load first, then removes bodyweight so the athlete sees the familiar added
 * load rather than a misleading 90kg Pull-Up.
 */
export function estimateExternalOneRepMaxKg(basis: OneRepMaxBasis): number | null {
  const bodyWeightKg = basis.bodyWeightKg ?? 0;
  if (!Number.isFinite(bodyWeightKg) || bodyWeightKg < 0) return null;
  if (!Number.isFinite(basis.externalLoadKg) || basis.externalLoadKg < 0) return null;
  const totalEstimate = estimateOneRepMaxKg(
    bodyWeightKg + basis.externalLoadKg,
    basis.reps,
  );
  return totalEstimate === null ? null : Math.max(0, totalEstimate - bodyWeightKg);
}

export function bestOneRepMaxBasis(sets: readonly OneRepMaxBasis[]): OneRepMaxBasis | null {
  let best: OneRepMaxBasis | null = null;
  let bestEstimate = -Infinity;
  for (const set of sets) {
    const estimate = estimateExternalOneRepMaxKg(set);
    if (estimate === null || estimate <= bestEstimate) continue;
    best = set;
    bestEstimate = estimate;
  }
  return best;
}

export function isPullUpExerciseName(exerciseName: string): boolean {
  const normalized = exerciseName
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
  return normalized === 'pull up'
    || normalized === 'pull ups'
    || normalized === 'weighted pull up'
    || normalized === 'weighted pull ups';
}
