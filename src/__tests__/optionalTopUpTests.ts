/**
 * THE NEED-BASED TOP-UP PASS — every signed threshold, asserted.
 *
 * `docs/NEED_COMPUTATION_SHEET_2026-07-30.md` was sent before anything was wired
 * and `docs/OPTIONAL_PLACEMENT_RULINGS_2026-07-30.md` records what Sam signed.
 * This suite is the sheet turned into cells, one per ruling, so a threshold
 * cannot drift from the document he read.
 *
 * NOT YET WIRED. The pass is a pure module and nothing calls it: wiring it is
 * indivisible from deleting the six placement rows it replaces (Sam's one-commit
 * condition), and that commit is not this one. These cells test the DECISION —
 * what the pass would place, given a week — which is the whole of the signed
 * sheet and the part a reviewer can check against the document.
 *
 * WHY A PURE MODULE AT ALL, rather than the decision living where it is applied:
 * the need computation is athlete-affecting logic that Sam signs, and logic he
 * signs has to be readable in one place and testable without a generator. The
 * seam it will run at — after `requireSection18AcceptedWeek` — is chosen so two
 * of his five conditions are STRUCTURAL: a session added after acceptance is
 * incapable of affecting compliance, because the contract was satisfied before
 * it existed and is never re-evaluated against it.
 *
 * DEPTH (L13): 0 — a pure function over a week's rows. It has no state to
 * accumulate. What accumulates is whether a LONG-LIVED week keeps satisfying the
 * needs after many edits, and that belongs to the wiring commit, not here.
 *
 * Run: npm run test:optional-topup
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import type { Workout } from '../types/domain';
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
  HAMSTRING_LIGHT_POOL,
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

console.log('\n-- The need-based top-up pass --');

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
    hamstring: HAMSTRING_LIGHT_POOL[0].name,
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
  const placements = computeOptionalTopUps(baseInput([strengthDay]));
  assert(placements.length === 0,
    'the top-up fired on a week that already covers three regions — it is a '
    + 'default, not a top-up');
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

run('N2. NEVER in-season or pre-season (`:104`)', () => {
  for (const seasonPhase of ['In-season', 'Pre-season'] as const) {
    const placements = computeOptionalTopUps(
      baseInput([workoutWith(1, ['Back Squat'])], { seasonPhase }),
    ).filter((placement) => placement.type === 'mobility');
    assert(placements.length === 0,
      `${seasonPhase} planned ${placements.length} mobility session(s). The Bible at `
      + ':104 says chasing mobility outside the off-season risks injury.');
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
    assert(placement.need === 'accessory_coverage' || placement.need === 'offseason_mobility',
      `a placement carries no need: ${JSON.stringify(placement)}`);
  }
});

console.log(`\nOptional top-up totals: ${passed} passed, ${failed} failed`);
console.log('  NOT WIRED — the pass is pure and nothing calls it yet. Wiring is');
console.log('  indivisible from deleting the six placement rows it replaces.');
console.log('  DEPTH (L13): 0 — a pure function over a week\'s rows.');
if (failed > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
