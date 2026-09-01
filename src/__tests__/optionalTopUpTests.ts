/**
 * THE NEED-BASED TOP-UP PASS — every signed threshold, asserted.
 *
 * `docs/NEED_COMPUTATION_SHEET_2026-07-30.md` was sent before anything was wired
 * and `docs/OPTIONAL_PLACEMENT_RULINGS_2026-07-30.md` records what Sam signed.
 * This suite is the sheet turned into cells, one per ruling, so a threshold
 * cannot drift from the document he read.
 *
 * WIRED as of the placement commit. §A below is the DECISION — what the pass
 * places, given a week, one cell per signed ruling so a threshold cannot drift
 * from the document Sam read. §B is the APPLICATION: that the decision becomes real
 * composed sessions, from the same builders the athlete's own doors use.
 *
 * WHY A PURE DECISION MODULE AT ALL, rather than the decision living where it is
 * applied: the need computation is athlete-affecting logic that Sam signs, and logic
 * he signs has to be readable in one place and testable without a generator. The
 * seam it runs at — after `requireSection18AcceptedWeek` — is chosen so two of his
 * five conditions are STRUCTURAL: a session added after acceptance is incapable of
 * affecting compliance, because the contract was satisfied before it existed and is
 * never re-evaluated against it.
 *
 * DEPTH (L13): 0 — a pure function over a week's rows, plus a pure application of
 * its output. Neither has state to accumulate. Depth over a long-lived week is the
 * generator's, and `athleteDoorMatrixTests` / `athleteActionWalkerTests` are where
 * it is reached.
 *
 * Run: npm run test:optional-topup
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { Workout } from '../types/domain';
import { applyOptionalTopUps } from '../utils/optionalTopUpPlacement';
import {
  buildWorkoutsFromCoach,
  type CoachGeneratedWorkoutInput,
} from '../data/defaultProgram';
import { BICEPS_POOL, DELTS_POOL, TRICEPS_POOL } from '../data/exercisePools';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import {
  MOBILITY_MAX_MOVEMENTS,
  MOBILITY_MIN_MOVEMENTS,
  MOBILITY_REGION_BY_ID,
} from '../rules/mobilitySessionComposition';
import {
  ACCESSORY_REGION_THRESHOLD,
  OFFSEASON_MOBILITY_TARGET,
  PREHAB_REGIONS,
  accessoryRegionsCovered,
  computeOptionalTopUps,
  mobilitySessionCount,
} from '../rules/optionalTopUp';
import {
  CALVES_POOL,
  GROIN_ADDUCTORS_POOL,
  HAMSTRING_PREHAB_SUBSET,
  LOWER_PREHAB_POOL,
  MOBILITY_POOL,
  SHOULDER_HEALTH_POOL,
  TRUNK_ANTI_ROTATION_POOL,
} from '../data/exercisePools';

let passed = 0; let failed = 0; const failures: string[] = [];
function assert(c: unknown, d: string): asserts c { if (!c) throw new Error(d); }
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (e) { failed += 1; failures.push(name); console.error(`  FAIL ${name}\n      ${e instanceof Error ? e.message : e}`); }
}

/**
 * A week, described by what its rows CONTAIN.
 *
 * Deliberately built from real pool names rather than invented ones: the pass
 * maps a row to a region by pool membership, so a fixture of made-up names would
 * map to nothing and every cell would pass vacuously.
 */
function workoutWith(dayOfWeek: number, exerciseNames: readonly string[]): Workout {
  return {
    id: `w-${dayOfWeek}`,
    microcycleId: 'topup-test',
    dayOfWeek,
    name: 'Session',
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Strength',
    exercises: exerciseNames.map((name, index) => ({
      id: `${dayOfWeek}-${index}`,
      exercise: { name },
    })),
  } as unknown as Workout;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const baseInput = (workouts: readonly Workout[], overrides: Record<string, unknown> = {}) => ({
  workouts,
  seasonPhase: 'In-season' as const,
  candidateDays: ALL_DAYS,
  gameDayOfWeek: null,
  ...overrides,
});

console.log('\n-- A. The need-based top-up pass: the DECISION --');

// ──────────────────────────────────────────────────────────────────────────
// V1 — accessory region coverage. Sam's ruling 1: in-session rows COUNT.
// ──────────────────────────────────────────────────────────────────────────

run('V1. every one of the six regions is recognised from its own pool', () => {
  // NON-VACUITY FIRST. Every cell below depends on a row mapping to a region;
  // if the pools and the map ever disagree, this is what says so.
  const oneEach: Record<string, string> = {
    groin_adductors: GROIN_ADDUCTORS_POOL[0].name,
    calves: CALVES_POOL[0].name,
    lower_prehab: LOWER_PREHAB_POOL[0].name,
    midline: TRUNK_ANTI_ROTATION_POOL[0].name,
    shoulder_health: SHOULDER_HEALTH_POOL[0].name,
    hamstring: HAMSTRING_PREHAB_SUBSET[0].name,
  };
  for (const region of PREHAB_REGIONS) {
    const covered = accessoryRegionsCovered([workoutWith(1, [oneEach[region]])]);
    assert(covered.has(region),
      `"${oneEach[region]}" is in the ${region} pool and the pass does not see it`);
    assert(covered.size === 1,
      `"${oneEach[region]}" mapped to ${covered.size} regions`);
  }
});

run('V1. IN-SESSION rows count — a strength day carrying prehab silences the need', () => {
  // SAM'S RULING 1, and the one that decides whether this pass is a top-up or a
  // default. A normal lower day carries prehab and midline after its accessories
  // (`:224`), and those rows are the week's accessory volume.
  const strengthDay = workoutWith(1, [
    'Back Squat',
    GROIN_ADDUCTORS_POOL[0].name,
    TRUNK_ANTI_ROTATION_POOL[0].name,
    CALVES_POOL[0].name,
  ]);
  const covered = accessoryRegionsCovered([strengthDay]);
  assert(covered.size === 3,
    `a strength day with three prehab rows covered ${covered.size} regions`);
  const placements = computeOptionalTopUps(baseInput([strengthDay]))
    .filter((placement) => placement.type === 'accessories');
  assert(placements.length === 0,
    'the Accessories top-up fired on a week that already covers three regions');
});

run('V1. non-prehab rows do not count toward coverage', () => {
  const covered = accessoryRegionsCovered([
    workoutWith(1, ['Back Squat', 'Bench Press', 'Romanian Deadlift']),
  ]);
  assert(covered.size === 0,
    `main lifts counted as accessory coverage: ${Array.from(covered).join(', ')}`);
});

// ──────────────────────────────────────────────────────────────────────────
// N1 — the signed threshold.
// ──────────────────────────────────────────────────────────────────────────

run('N1. fires BELOW three of six regions, and not at three', () => {
  assert(ACCESSORY_REGION_THRESHOLD === 3,
    `the threshold is ${ACCESSORY_REGION_THRESHOLD}; Sam signed 3 of 6`);
  const names = [
    GROIN_ADDUCTORS_POOL[0].name,
    CALVES_POOL[0].name,
    TRUNK_ANTI_ROTATION_POOL[0].name,
  ];
  for (let covered = 0; covered <= 3; covered += 1) {
    const week = [workoutWith(1, names.slice(0, covered))];
    const placements = computeOptionalTopUps(baseInput(week))
      .filter((placement) => placement.type === 'accessories');
    const expected = covered < 3 ? 1 : 0;
    assert(placements.length === expected,
      `${covered} region(s) covered produced ${placements.length} accessories `
      + `top-up(s); expected ${expected}`);
  }
});

run('N1. places AT MOST ONE — it fills the lack, it does not chase six', () => {
  const placements = computeOptionalTopUps(baseInput([workoutWith(1, ['Back Squat'])]))
    .filter((placement) => placement.type === 'accessories');
  assert(placements.length === 1,
    `a week covering zero regions produced ${placements.length} accessories sessions. `
    + '"At most what fills the lack" is one.');
});

// ──────────────────────────────────────────────────────────────────────────
// N2 — off-season mobility, Sam's ruling 4: toward TWO.
// ──────────────────────────────────────────────────────────────────────────

const mobilityDay = (day: number) =>
  workoutWith(day, [MOBILITY_POOL[0].name, MOBILITY_POOL[1].name]);

run('N2. off-season with no mobility tops up toward TWO', () => {
  assert(OFFSEASON_MOBILITY_TARGET === 2,
    `the mobility aim is ${OFFSEASON_MOBILITY_TARGET}; Sam signed 2`);
  const placements = computeOptionalTopUps(
    baseInput([workoutWith(1, ['Back Squat'])], { seasonPhase: 'Off-season' }),
  ).filter((placement) => placement.type === 'mobility');
  assert(placements.length === 2,
    `off-season with zero mobility produced ${placements.length} mobility top-ups; `
    + 'Sam ruled it aims for two — "just want to get the athlete feeling good again"');
});

run('N2. one existing mobility session leaves room for exactly one more', () => {
  const week = [workoutWith(1, ['Back Squat']), mobilityDay(2)];
  const placements = computeOptionalTopUps(baseInput(week, { seasonPhase: 'Off-season' }))
    .filter((placement) => placement.type === 'mobility');
  assert(mobilitySessionCount(week) === 1,
    `the week's mobility session was not recognised (counted ${mobilitySessionCount(week)})`);
  assert(placements.length === 1,
    `a week with one mobility session produced ${placements.length} top-ups`);
});

run('R-237. in-season and pre-season each offer one optional Mobility', () => {
  for (const seasonPhase of ['In-season', 'Pre-season'] as const) {
    const placements = computeOptionalTopUps(
      baseInput([workoutWith(1, ['Back Squat'])], { seasonPhase }),
    ).filter((placement) => placement.type === 'mobility');
    assert(placements.length === 1,
      `${seasonPhase} planned ${placements.length} mobility session(s); R-237 offers one`);
  }
});

run('N2. a strength day with ONE mobility movement is not a mobility session', () => {
  // Strict on purpose: counting a warm-up movement as a session would silence a
  // need the athlete really has.
  const week = [workoutWith(1, ['Back Squat', MOBILITY_POOL[0].name])];
  assert(mobilitySessionCount(week) === 0,
    'a strength day with one mobility movement counted as a mobility session');
});

// ──────────────────────────────────────────────────────────────────────────
// Caps — signed as drafted, with ruling 3's amendment.
// ──────────────────────────────────────────────────────────────────────────

run('CAP. a week may take BOTH an Accessories and a Mobility top-up (ruling 3)', () => {
  const placements = computeOptionalTopUps(
    baseInput([workoutWith(1, ['Back Squat'])], { seasonPhase: 'Off-season' }),
  );
  const types = new Set(placements.map((placement) => placement.type));
  assert(types.has('accessories') && types.has('mobility'),
    `a bare off-season week produced only ${Array.from(types).join(', ')}. Sam amended `
    + 'the cap: both, at most one per type — with mobility aiming for two.');
});

run('CAP. never on the game day, never on G-1', () => {
  // `:90` and `:132` for the game day; `:153` for G-1, which the authored Gunshow
  // owns. A top-up landing there would be the app double-booking its own rule.
  const placements = computeOptionalTopUps(
    baseInput([workoutWith(1, ['Back Squat'])], { gameDayOfWeek: 6, candidateDays: [5, 6] }),
  );
  assert(placements.length === 0,
    `a week whose only free days are the game and G-1 placed ${placements.length} `
    + 'session(s)');
});

run('CAP. G+1 permits recovery Mobility but never Accessories', () => {
  const covered = workoutWith(2, [
    GROIN_ADDUCTORS_POOL[0].name,
    CALVES_POOL[0].name,
    TRUNK_ANTI_ROTATION_POOL[0].name,
  ]);
  const placements = computeOptionalTopUps(baseInput([covered], {
    gameDayOfWeek: 0,
    candidateDays: [1],
    equipmentFreeCandidateDays: [1],
  }));
  assert(placements.length === 1
    && placements[0].type === 'mobility'
    && placements[0].dayOfWeek === 1,
  `G+1 produced ${JSON.stringify(placements)}; only recovery Mobility is legal`);
});

run('CAP. never on a day that already has a session', () => {
  const week = ALL_DAYS.map((day) => workoutWith(day, ['Back Squat']));
  const placements = computeOptionalTopUps(baseInput(week, { seasonPhase: 'Off-season' }));
  assert(placements.length === 0,
    `a full week placed ${placements.length} top-up(s) — every day is taken`);
});

run('CAP. two top-ups never land on the same day', () => {
  const placements = computeOptionalTopUps(
    baseInput([workoutWith(1, ['Back Squat'])], { seasonPhase: 'Off-season' }),
  );
  const days = placements.map((placement) => placement.dayOfWeek);
  assert(new Set(days).size === days.length,
    `two top-ups landed on the same day: ${days.join(', ')}`);
});

run('R-237. Mobility may use a non-gym spare day; Accessories remain gym-only', () => {
  const placements = computeOptionalTopUps(baseInput([workoutWith(1, ['Back Squat'])], {
    candidateDays: [4],
    equipmentFreeCandidateDays: [2, 4],
  }));
  const mobility = placements.find((placement) => placement.type === 'mobility');
  const accessories = placements.find((placement) => placement.type === 'accessories');
  assert(mobility?.dayOfWeek === 2,
    `Mobility did not use the non-gym spare day: ${JSON.stringify(placements)}`);
  assert(accessories?.dayOfWeek === 4,
    `Accessories escaped the gym-day set: ${JSON.stringify(placements)}`);
});

run('CAP. SHRINK, never pad — fewer free days means fewer sessions', () => {
  // Sam's gunshow ruling, applied here: the app never invents to fill a quota,
  // and that does not stop at gunshows. One free day means one session, not three
  // stacked on it.
  const placements = computeOptionalTopUps(
    baseInput([workoutWith(1, ['Back Squat'])], {
      seasonPhase: 'Off-season',
      candidateDays: [3],
    }),
  );
  assert(placements.length === 1,
    `one free day produced ${placements.length} top-ups`);
});

// ──────────────────────────────────────────────────────────────────────────
// Day preference — `:152` names Wednesday; G-3 is its fixture-relative form.
// ──────────────────────────────────────────────────────────────────────────

run('DAY. prefers G-3 when there is a game, Wednesday when there is not', () => {
  const bare = [workoutWith(1, ['Back Squat'])];
  const noGame = computeOptionalTopUps(baseInput(bare, { candidateDays: [2, 3, 4, 5] }));
  assert(noGame[0]?.dayOfWeek === 3,
    `no-game week placed on day ${noGame[0]?.dayOfWeek}; :152 names Wednesday`);
  // Saturday game (6) → G-3 is Wednesday (3) too, so use a Sunday game to
  // separate the two rules: game 0, G-3 = 4 (Thursday).
  const withGame = computeOptionalTopUps(
    baseInput(bare, { gameDayOfWeek: 0, candidateDays: [2, 3, 4, 5] }),
  );
  assert(withGame[0]?.dayOfWeek === 4,
    `Sunday-game week placed on day ${withGame[0]?.dayOfWeek}; G-3 is Thursday (4)`);
});

run('EVERY placement names the need that produced it', () => {
  // A placement that cannot say which rule made it is a default with extra steps.
  const placements = computeOptionalTopUps(
    baseInput([workoutWith(1, ['Back Squat'])], { seasonPhase: 'Off-season' }),
  );
  assert(placements.length > 0, 'nothing was placed, so this proves nothing');
  for (const placement of placements) {
    assert(placement.need === 'accessory_coverage'
      || placement.need === 'spare_day_mobility'
      || placement.need === 'offseason_mobility',
      `a placement carries no need: ${JSON.stringify(placement)}`);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// B. THE APPLICATION — the decision becomes real composed sessions.
//
// Sam's class ruling: REAL COMPOSED SESSIONS ONLY. "A sentence on a day is
// invented composition; that class is dead." These cells are what stops the pass
// from placing one.
// ──────────────────────────────────────────────────────────────────────────

console.log('\n-- B. The top-up, APPLIED --');

const PREHAB_POOL_NAMES = new Set([
  ...GROIN_ADDUCTORS_POOL, ...CALVES_POOL, ...LOWER_PREHAB_POOL,
  ...TRUNK_ANTI_ROTATION_POOL, ...SHOULDER_HEALTH_POOL, ...HAMSTRING_PREHAB_SUBSET,
].map((entry) => canonicalExerciseName(entry.name)));
const MOBILITY_POOL_NAMES = new Set(
  MOBILITY_POOL.map((entry) => canonicalExerciseName(entry.name)));

const applied = (workouts: readonly Workout[], overrides: Record<string, unknown> = {}) =>
  applyOptionalTopUps({
    workouts,
    seasonPhase: 'In-season',
    athlete: DEFAULT_ATHLETE_CONTEXT,
    microcycleId: 'mc-topup',
    weekStartISO: '2026-07-27',
    gameDayOfWeek: null,
    candidateDays: ALL_DAYS,
    ...overrides,
  });

const rowNames = (workout: Workout): string[] =>
  (workout.exercises ?? []).map((row) =>
    canonicalExerciseName((row as { exercise?: { name?: string } }).exercise?.name ?? ''));

run('APPLY. a lacking week gains a composed Accessories session, drawn from the six pools', () => {
  const week = [workoutWith(1, ['Back Squat'])];
  const result = applied(week);
  const placed = result.workouts.find((workout) => workout.composedOptionalKind === 'prehab');
  assert(placed, `no Accessories session in ${result.workouts.length} workouts`);
  const strangers = rowNames(placed).filter((name) => !PREHAB_POOL_NAMES.has(name));
  assert(rowNames(placed).length > 0, 'the placed session has no rows at all');
  assert(strangers.length === 0,
    `the placed Accessories session prescribes ${strangers.join(', ')}, which is in none `
    + "of Sam's six prehab pools. A sentence on a day is what this replaced.");
});

run('APPLY. the mobility top-up is the SIGNED composition — 5-8 across the regions', () => {
  const result = applied([workoutWith(1, ['Back Squat'])], { seasonPhase: 'Off-season' });
  const mobility = result.workouts.filter((workout) =>
    rowNames(workout).length > 0 &&
    rowNames(workout).every((name) => MOBILITY_POOL_NAMES.has(name)));
  assert(mobility.length === 2,
    `${mobility.length} composed mobility sessions; Sam ruled off-season aims for two`);
  for (const session of mobility) {
    const count = rowNames(session).length;
    assert(count >= MOBILITY_MIN_MOVEMENTS && count <= MOBILITY_MAX_MOVEMENTS,
      `a placed mobility session has ${count} movements, outside Sam's 5-8`);
    const regions = new Set((session.exercises ?? []).map((row) =>
      MOBILITY_REGION_BY_ID[String((row as { exerciseId?: string }).exerciseId ?? '')]));
    regions.delete(undefined as never);
    assert(regions.size === 4,
      `a placed mobility session covers ${regions.size} of the four signed regions`);
  }
});

run('APPLY. every placed session is VISIBLY OPTIONAL — one of the five conditions', () => {
  const result = applied([workoutWith(1, ['Back Squat'])], { seasonPhase: 'Off-season' });
  const placed = result.workouts.slice(1);
  assert(placed.length === 3, `expected three placements, got ${placed.length}`);
  for (const session of placed) {
    assert((session as { sessionTier?: string }).sessionTier === 'optional',
      `a placed session reads as ${(session as { sessionTier?: string }).sessionTier}. `
      + "Sam's law: rendered visibly optional, always.");
  }
});

run('APPLY. the accepted real sessions are never mutated', () => {
  // The seam is the argument, and this is the half of it a test can see: the
  // sessions the contract accepted come out byte-identical, so nothing the pass
  // does can change what was accepted.
  const week = [workoutWith(1, ['Back Squat']), workoutWith(2, ['Bench Press'])];
  const before = JSON.stringify(week);
  const result = applied(week, { seasonPhase: 'Off-season' });
  assert(JSON.stringify(week) === before, 'the input week was mutated in place');
  assert(JSON.stringify(result.workouts.slice(0, 2)) === before,
    'the accepted sessions came back changed');
});

run('APPLY. covered Accessories do not suppress the one Mobility offer', () => {
  const covered = [workoutWith(1, [
    'Back Squat',
    GROIN_ADDUCTORS_POOL[0].name,
    TRUNK_ANTI_ROTATION_POOL[0].name,
    CALVES_POOL[0].name,
  ])];
  const result = applied(covered);
  assert(result.placements.length === 1 && result.placements[0].type === 'mobility',
    `a covered week produced ${JSON.stringify(result.placements)}`);
});

run('APPLY. auto Mobility is bodyweight-only even when the athlete has full equipment', () => {
  const equipmentByName = new Map(MOBILITY_POOL.map((entry) => [
    canonicalExerciseName(entry.name), entry.equipment,
  ]));
  for (let week = 0; week < 28; week += 1) {
    const monday = new Date('2026-07-27T12:00:00');
    monday.setDate(monday.getDate() + week * 7);
    const weekStartISO = monday.toISOString().slice(0, 10);
    const result = applyOptionalTopUps({
      workouts: [workoutWith(1, ['Back Squat'])],
      seasonPhase: 'In-season',
      athlete: DEFAULT_ATHLETE_CONTEXT,
      microcycleId: `mc-topup-${week}`,
      weekStartISO,
      gameDayOfWeek: null,
      candidateDays: ALL_DAYS,
    });
    const mobility = result.workouts.find((workout) =>
      workout.composedOptionalKind === 'mobility');
    assert(mobility, `no Mobility session was composed for ${weekStartISO}`);
    const invalid = rowNames(mobility).filter((name) =>
      !(equipmentByName.get(name) ?? []).every((requirement) =>
        Array.isArray(requirement)
          ? requirement.every((tag) => tag === 'bodyweight')
          : requirement === 'bodyweight'));
    assert(invalid.length === 0,
      `${weekStartISO} auto Mobility included equipment-dependent rows: ${invalid.join(', ')}`);
  }
});

run('APPLY. an optional offer replaces an explicit Rest shell on its day', () => {
  const rest = {
    ...workoutWith(3, []),
    name: 'Rest',
    workoutType: 'Rest',
    sessionTier: 'recovery',
  } as Workout;
  const result = applied([workoutWith(1, ['Back Squat']), rest], {
    candidateDays: [3],
    equipmentFreeCandidateDays: [3],
  });
  assert(result.workouts.filter((workout) => workout.dayOfWeek === 3).length === 1,
    `day 3 has ${result.workouts.filter((workout) => workout.dayOfWeek === 3).length} rows`);
  assert(result.workouts.some((workout) =>
    workout.dayOfWeek === 3 && workout.composedOptionalKind === 'mobility'),
  'the Rest shell remained instead of the Mobility offer');
});

run('APPLY. every placement lands on the day the DECISION chose', () => {
  // The materialiser derives a date from the day; if it then re-derived the day
  // from that date it could disagree with the caps that vetted it.
  const result = applied([workoutWith(1, ['Back Squat'])], {
    seasonPhase: 'Off-season',
    candidateDays: [3, 4, 5],
  });
  const placedDays = result.workouts.slice(1).map((workout) => workout.dayOfWeek);
  const decidedDays = result.placements.map((placement) => placement.dayOfWeek);
  assert(JSON.stringify(placedDays) === JSON.stringify(decidedDays),
    `placed on ${placedDays.join(', ')} but decided ${decidedDays.join(', ')}`);
  assert(placedDays.every((day) => [3, 4, 5].includes(day)),
    `a session landed outside the candidate days: ${placedDays.join(', ')}`);
});

// ──────────────────────────────────────────────────────────────────────────
// C. THE ALLOCATOR'S OWN OPTIONAL PLACEMENTS — composed, not described.
//
// Sam's class ruling covers the placements that STAY as well as the ones the pass
// replaces: R1 (the authored G-1 Gunshow) and R8 (the adjacency repair's
// neutralised day). Both mark their allocation `composedOptionalKind`, and these
// cells prove the marker reaches the pools.
// ──────────────────────────────────────────────────────────────────────────

console.log('\n-- C. The allocator\'s composed optional placements --');

const SIGNED_GUNSHOW_POOLS = {
  biceps: new Set(BICEPS_POOL.map((entry) => canonicalExerciseName(entry.name))),
  triceps: new Set(TRICEPS_POOL.map((entry) => canonicalExerciseName(entry.name))),
  delts: new Set(DELTS_POOL.map((entry) => canonicalExerciseName(entry.name))),
};

const allocationProfile = {
  seasonPhase: 'In-season',
  position: 'inside_mid',
  motivation: 'Build strength and football fitness',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  trainingLocation: 'Commercial gym',
  equipment: ['Full Gym'],
  equipmentSelectionCompleteness: 'complete',
  experienceLevel: '2-5 years',
  squatStrength: '1.5x bodyweight',
  benchStrength: '1.25x bodyweight',
  conditioningLevel: 'Elite',
  sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
} as never;

const builtFrom = (
  allocation: Record<string, unknown>,
  coachWorkouts: CoachGeneratedWorkoutInput[] = [],
): Workout | undefined =>
  buildWorkoutsFromCoach(
    coachWorkouts,
    'mc-composed',
    [allocation as never],
    allocationProfile,
  )[0];

run('R1. the G-1 Gunshow is Sam\'s SIGNED 2 biceps + 2 triceps + 2 pump delts', () => {
  // The row Sam confirmed as authored, and the one the sheet flagged as having two
  // owners. They disagreed about COMPOSITION: the resolver built the signed pools
  // while the generator handed a focus string to a hardcoded five-row fallback
  // (Bicep Curls, Tricep Pushdowns, Face Pulls, Calf Raises, Pallof Press) — where
  // "Face Pull" is not even in the signed shoulder family.
  const built = builtFrom({
    tier: 'optional',
    focus: 'Optional arms/pump - biceps, triceps, lateral raises only',
    dayOfWeek: 'Friday',
    isHardExposure: false,
    composedOptionalKind: 'gunshow',
  });
  assert(built, 'the gunshow allocation built nothing');
  const names = (built.exercises ?? []).map((row) =>
    canonicalExerciseName((row as { exercise?: { name?: string } }).exercise?.name ?? ''));
  const count = (pool: Set<string>) => names.filter((name) => pool.has(name)).length;
  assert(count(SIGNED_GUNSHOW_POOLS.biceps) === 2
    && count(SIGNED_GUNSHOW_POOLS.triceps) === 2
    && count(SIGNED_GUNSHOW_POOLS.delts) === 2,
    `the composed gunshow is ${count(SIGNED_GUNSHOW_POOLS.biceps)} biceps / `
    + `${count(SIGNED_GUNSHOW_POOLS.triceps)} triceps / ${count(SIGNED_GUNSHOW_POOLS.delts)} delts. `
    + 'Sam signed 2 + 2 + 2, and "shoulder" means the PUMP delts pool.');
  assert(names.length === 6,
    `${names.length} rows — a cross-family top-up put a seventh movement in, or a row `
    + 'came from outside the three signed pools');
});

run('R8. a neutralised adjacency day composes Accessories from the six pools', () => {
  const built = builtFrom({
    tier: 'optional',
    focus: 'Low-fatigue support - trunk, calves, groin, shoulder prehab',
    dayOfWeek: 'Wednesday',
    isHardExposure: false,
    composedOptionalKind: 'prehab',
  });
  assert(built, 'the neutralised allocation built nothing');
  const names = (built.exercises ?? []).map((row) =>
    canonicalExerciseName((row as { exercise?: { name?: string } }).exercise?.name ?? ''));
  assert(names.length > 0, 'the composed accessories session has no rows');
  const strangers = names.filter((name) => !PREHAB_POOL_NAMES.has(name));
  assert(strangers.length === 0,
    `the neutralised day prescribes ${strangers.join(', ')}, which is in none of the six `
    + 'signed prehab pools');
});

run('COHERENCE. a day PROMOTED to required strength never composes prehab over it', () => {
  // THE REGRESSION CELL for the defect this commit found and fixed. A shortfall
  // repair may promote an optional accessory slot to required strength; the marker
  // used to survive that promotion, and the builder — which reads it first — then
  // composed prehab work on a day the contract was counting as a main-strength
  // exposure. The week came out one strength exposure short.
  //
  // Two things now prevent it, and this asserts the second: `assignRequiredStrength`
  // clears the marker, AND the builder refuses an incoherent marker.
  const promoted = builtFrom({
    tier: 'core',
    focus: 'Lower body strength - combined squat + hinge coverage',
    dayOfWeek: 'Wednesday',
    isHardExposure: true,
    strengthPattern: 'lower_combined',
    // Deliberately stale — this is what a mutator that forgot to clear it leaves.
    composedOptionalKind: 'prehab',
  }, [{
    dayOfWeek: 3,
    name: 'Lower Body Strength',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [{ name: 'Back Squat', sets: 3, repsMin: 5, repsMax: 5 }],
  }]);
  assert(promoted, 'the promoted allocation built nothing');
  const names = (promoted.exercises ?? []).map((row) =>
    canonicalExerciseName((row as { exercise?: { name?: string } }).exercise?.name ?? ''));
  const prehabOnly = names.length > 0 && names.every((name) => PREHAB_POOL_NAMES.has(name));
  assert(!prehabOnly,
    'a day carrying a required strength pattern composed prehab work instead: '
    + `${names.join(', ')}. A stale marker must not outrank the contract.`);
});

run('R7. rest-slot conditioning comes FROM the 55 signed templates', () => {
  // INVERTED 2026-08-05, exactly as the pinned form of this cell instructed:
  // "WHEN THIS CELL FAILS, that is the fix landing, not a regression: invert
  // it and assert the signed template." The Stage B switchover landed —
  // selection now serves an authored template name, and the synthesised
  // "5 x 8min zone 2 Rower" vocabulary is gone from the generator
  // (`docs/STAGE_B_STAGE2_SWITCHOVER_PREDICTION_2026-08-05.md`).
  const built = builtFrom({
    tier: 'optional',
    focus: 'Conditioning - aerobic base / zone 2 (steady state, conversational pace)',
    dayOfWeek: 'Thursday',
    isHardExposure: false,
    conditioningFlavour: 'aerobic',
    conditioningCategory: 'aerobic_base',
  });
  assert(built, 'the optional conditioning allocation built nothing');
  const rows = built.exercises ?? [];
  assert(rows.length > 0, 'the optional conditioning session has no rows');
  assert(built.sessionTier === 'optional',
    `a rest-slot conditioning session reads as ${built.sessionTier}`);
  // The structural Warm-up row is not the headline; the authored row is.
  const headline = rows
    .map((row) => String((row as { exercise?: { name?: string } }).exercise?.name ?? ''))
    .find((name) => name !== '' && !/^warm-up$/i.test(name)) ?? '';
  const signedNames = new Set(CONDITIONING_TEMPLATES.map(
    (template) => canonicalExerciseName(template.name)));
  assert(signedNames.has(canonicalExerciseName(headline)),
    `"${headline}" is not one of the 55 signed conditioning templates — a second `
    + 'dose vocabulary is back in the generator.');
});

console.log(`\nOptional top-up totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
console.log('  WIRED after requireSection18AcceptedWeek — a top-up is incapable of');
console.log('  affecting compliance because the contract was satisfied before it existed.');
console.log('  DEPTH (L13): 0 — a pure decision and a pure application of it.');
if (failed > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
