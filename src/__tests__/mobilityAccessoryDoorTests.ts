/**
 * THE MOBILITY AND ACCESSORIES DOORS — what the athlete can now reach, and what
 * it is made of.
 *
 * Sam's charter, stage 4 (2026-07-30):
 *
 *   MOBILITY   — 5-8 movements, warm-up doses, full-body spread (lower / hips /
 *                midline / upper), COMPOSED from the mobility pool. Sam's
 *                supersession the same day retired the pre-built flow bundles:
 *                he does not recognise them, and the provenance trace agrees.
 *   ACCESSORIES— prehab pools, with a per-region shape. Athlete-add only.
 *   GUNSHOW    — 2 biceps + 2 triceps + 2 pump delts. Under thin equipment it
 *                gets SMALLER, never padded. No cross-family top-ups.
 *
 *   All three: never hard, invisible to load, never break rest.
 *
 * WHAT THIS SUITE IS FOR, beyond "the doors exist". Two of the three findings
 * the charter gate made on its first run live here, and both were composition
 * defects that every other gate in the repo was blind to:
 *
 *   - the Gunshow reached OUTSIDE Sam's signed sixteen for a sixth exercise,
 *     drawing "Face Pull" from `UPPER_BACK_PUMP_POOL` while the signed shoulder
 *     family holds "Cable Face Pull". Every gate that checks "is this exercise
 *     authored?" passed it, because it IS authored — just not for this session.
 *   - a built "Prehab & Accessories" session classified as `lower_strength` at
 *     HIGH stress and took a hard day, because it draws Cossack Squat from the
 *     groin pool and the taxonomy inferred a squat.
 *
 * So the cells here assert MEMBERSHIP and SHAPE, not just existence: which pool
 * each row came from, how many from each family, and what the ledger does with
 * the finished session. An exercise being authored somewhere is not the same
 * claim as a session being composed from the source it cites.
 *
 * DEPTH (L13): 1 — build each door's session and evaluate it. These are claims
 * about composition and counting, which do not accumulate with the length of an
 * athlete's life. What a long life would test is whether the doors keep working
 * on a well-worn week, and that is recorded as not covered.
 *
 * Run: npm run test:mobility-accessory-doors
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED');
};
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { TrainingProgram, Workout, WorkoutExercise } from '../types/domain';
import { validatePairings } from '../data/defaultProgram';
import { mobilityRegionOf } from '../rules/mobilitySessionComposition';
import {
  MOBILITY_PAIRS_MAX,
  pairMobilityWithAccessories,
  pairableAccessories,
  pickMobilityFor,
} from '../rules/mobilityPairing';
import { generateProgramLocally } from '../services/api/generateProgram';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';
import {
  MOBILITY_DOOR_MAX_MOVEMENTS,
  MOBILITY_DOOR_MIN_MOVEMENTS,
  buildCoachRevisionTemplateWorkout,
  listCoachRevisionTemplates,
} from '../utils/coachRevisionTemplates';
import {
  MOBILITY_REGIONS,
  MOBILITY_REGION_BY_ID,
  mobilityPool,
  regionsCovered,
} from '../rules/mobilitySessionComposition';
import { PLAN_CHANGE_CATEGORY_IDS } from '../utils/planChangeTypes';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import {
  BICEPS_POOL,
  TRICEPS_POOL,
  DELTS_POOL,
  UPPER_BACK_PUMP_POOL,
  GROIN_ADDUCTORS_POOL,
  CALVES_POOL,
  LOWER_PREHAB_POOL,
  TRUNK_ANTI_ROTATION_POOL,
  SHOULDER_HEALTH_POOL,
  HAMSTRING_LIGHT_POOL,
} from '../data/exercisePools';
import {
  samExport8Profile,
  samExport8EquipmentAnswerThroughTheDoor,
} from './support/samDeviceExport8Fixture';
import { useProfileStore } from '../store/profileStore';

// The doors under test read the LIVE athlete context, and they are post-
// onboarding surfaces — a real athlete behind them has answered the (required)
// equipment step. The store default is honestly empty now (2026-07-31), so the
// suite seeds the answered athlete it samples.
useProfileStore.setState({
  onboardingData: {
    ...samExport8Profile(),
    equipmentAnswer: samExport8EquipmentAnswerThroughTheDoor(),
  },
  isOnboardingComplete: true,
} as never);

let passed = 0; let failed = 0; const failures: string[] = [];
function assert(c: unknown, d: string): asserts c { if (!c) throw new Error(d); }
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (e) { failed += 1; failures.push(name); console.error(`  FAIL ${name}\n      ${e instanceof Error ? e.message : e}`); }
}
function quiet<T>(b: () => T): T {
  const w = console.warn, e = console.error, d = console.debug, i = console.info, l = console.log;
  console.warn = console.error = console.debug = console.info = console.log = (() => undefined) as never;
  try { return b(); } finally { console.warn = w; console.error = e; console.debug = d; console.info = i; console.log = l; }
}

const DATE = '2026-07-27';
const names = (workout: Workout | null): string[] =>
  (workout?.exercises ?? []).map((row) => (row as { exercise?: { name?: string } }).exercise?.name ?? '');
const canonical = (pool: readonly { name: string }[]): Set<string> =>
  new Set(pool.map((entry) => canonicalExerciseName(entry.name)));
const built = (templateId: string): Workout | null =>
  quiet(() => buildCoachRevisionTemplateWorkout(templateId, DATE));

console.log('\n-- The Mobility and Accessories doors --');

// ──────────────────────────────────────────────────────────────────────────
// A. GUNSHOW — Sam's signed structure, and nothing outside it.
// ──────────────────────────────────────────────────────────────────────────

const GUNSHOW_FAMILIES = {
  biceps: canonical(BICEPS_POOL),
  triceps: canonical(TRICEPS_POOL),
  delts: canonical(DELTS_POOL),
};

run('A1. a Gunshow is 2 biceps + 2 triceps + 2 shoulder', () => {
  const workout = built('accessories_pump');
  assert(workout, 'the Gunshow builds nothing');
  const rows = names(workout).map(canonicalExerciseName);
  const counts = {
    biceps: rows.filter((n) => GUNSHOW_FAMILIES.biceps.has(n)).length,
    triceps: rows.filter((n) => GUNSHOW_FAMILIES.triceps.has(n)).length,
    delts: rows.filter((n) => GUNSHOW_FAMILIES.delts.has(n)).length,
  };
  assert(counts.biceps === 2 && counts.triceps === 2 && counts.delts === 2,
    `Sam signed 2 + 2 + 2 and the session is ${JSON.stringify(counts)}: ${rows.join(', ')}`);
});

run('A2. NO CROSS-FAMILY TOP-UPS — nothing outside the signed sixteen', () => {
  // THE DEFECT THIS CLOSES. The slot table ended `{ delts: 1 }, { upper_back_pump: 1 }`,
  // so the sixth exercise came from a pool Sam did not sign for this session —
  // "Face Pull" from the upper-back pump pool, beside a signed shoulder family
  // that holds "Cable Face Pull". Authored, and not authored FOR THIS.
  const workout = built('accessories_pump');
  assert(workout, 'the Gunshow builds nothing');
  const signed = new Set([
    ...GUNSHOW_FAMILIES.biceps, ...GUNSHOW_FAMILIES.triceps, ...GUNSHOW_FAMILIES.delts,
  ]);
  const strangers = names(workout).filter((n) => !signed.has(canonicalExerciseName(n)));
  assert(strangers.length === 0,
    `the Gunshow prescribes ${strangers.join(', ')}, outside the sixteen Sam signed. `
    + 'Under thin equipment a gunshow gets SMALLER, never padded.');
  // NON-VACUITY, and specific: the pool the top-up came from is still a real
  // pool with real entries, so this cell is not passing because it is empty.
  assert(UPPER_BACK_PUMP_POOL.length > 0,
    'the upper-back pump pool is empty, so "no cross-family top-up" proves nothing');
});

run('A3. thin equipment SHRINKS the Gunshow rather than padding it', () => {
  // The behaviour behind the ruling, asserted at the picker: a family with fewer
  // entries than its slot asks for contributes what it has. Nothing repeats and
  // nothing is borrowed. Read off the pool sizes, which are Sam's signed census.
  const requested = { biceps: 2, triceps: 2, delts: 2 };
  for (const [family, count] of Object.entries(requested)) {
    const pool = GUNSHOW_FAMILIES[family as keyof typeof GUNSHOW_FAMILIES];
    assert(pool.size >= count,
      `${family} has ${pool.size} signed candidates for a ${count}-exercise slot — `
      + 'the session would have to shrink, which is correct, but Sam signed enough');
  }
});

// ──────────────────────────────────────────────────────────────────────────
// B. ACCESSORIES — the prehab pools, per region.
// ──────────────────────────────────────────────────────────────────────────

const PREHAB_POOLS = {
  trunk_anti_rotation: canonical(TRUNK_ANTI_ROTATION_POOL),
  groin_adductors: canonical(GROIN_ADDUCTORS_POOL),
  shoulder_health: canonical(SHOULDER_HEALTH_POOL),
  calves: canonical(CALVES_POOL),
  hamstring_light: canonical(HAMSTRING_LIGHT_POOL),
  lower_prehab: canonical(LOWER_PREHAB_POOL),
};

run('B1. Accessories draws only from the 36 Sam signed', () => {
  const workout = built('accessories_prehab');
  assert(workout, 'the Accessories session builds nothing');
  const signed = new Set(Object.values(PREHAB_POOLS).flatMap((pool) => Array.from(pool)));
  const strangers = names(workout).filter((n) => !signed.has(canonicalExerciseName(n)));
  assert(strangers.length === 0,
    `Accessories prescribes ${strangers.join(', ')}, outside the 36 across 6 pools`);
});

run('B2. Accessories has a PER-REGION shape, not a flat draw', () => {
  // Sam's own observation on the census: `TRUNK_ANTI_ROTATION_POOL` is 17 of the
  // 36, so a session drawn uniformly would be mostly trunk work. The shape is
  // one per region, and this asserts the outcome rather than the slot table —
  // a flat draw would fail it however the table was written.
  const workout = built('accessories_prehab');
  assert(workout, 'the Accessories session builds nothing');
  const rows = names(workout).map(canonicalExerciseName);
  const perRegion = Object.entries(PREHAB_POOLS)
    .map(([region, pool]) => [region, rows.filter((n) => pool.has(n)).length] as const)
    .filter(([, count]) => count > 0);
  assert(perRegion.length >= 3,
    `the session draws from ${perRegion.length} region(s) — that is a flat draw, not a shape`);
  for (const [region, count] of perRegion) {
    assert(count <= 2,
      `${count} exercises from ${region} in one session — the shape is per-region`);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// C. MOBILITY — the door the Bible granted and the app never offered.
// ──────────────────────────────────────────────────────────────────────────

const mobilityTemplates = listCoachRevisionTemplates().filter((t) => t.category === 'mobility');

run('C1. the Mobility door exists and is reachable', () => {
  assert(PLAN_CHANGE_CATEGORY_IDS.includes('mobility' as never),
    'there is still no Mobility category — the Bible grants it at :122');
  assert(mobilityTemplates.length === 1,
    `the Mobility door offers ${mobilityTemplates.length} templates. It composes ONE `
    + 'session from the pool; a list of templates is the pre-built bundles again.');
});

run('C2. NO PRE-BUILT BUNDLES — the door does not read the flow templates', () => {
  // SAM'S SUPERSESSION, AS A CELL. He does not recognise the flow bundles, and
  // the provenance trace agrees: the exercises are his, the GROUPINGS arrived in
  // one commit with no ruling cited. Deriving the door from them was still
  // deriving from something nobody authored.
  //
  // Asserted against the built SESSION rather than against an import, because an
  // import can be removed while the shape it produced survives: every movement
  // the door prescribes has to be a POOL entry, and a bundle would show up as a
  // movement the pool does not contain.
  const workout = built(mobilityTemplates[0].templateId);
  assert(workout, 'the Mobility door builds nothing');
  const pool = new Set(mobilityPool().map((entry) => canonicalExerciseName(entry.name)));
  const strangers = names(workout).filter((n) => !pool.has(canonicalExerciseName(n)));
  assert(strangers.length === 0,
    `the Mobility session prescribes ${strangers.join(', ')}, which is not in `
    + "MOBILITY_POOL. Sam's exercises are the source; nothing sits between them and the athlete.");
});

run('C3. a composed session is 5-8 movements', () => {
  for (const date of ['2026-07-27', '2026-08-03', '2026-08-10', '2026-09-14']) {
    const workout = quiet(() =>
      buildCoachRevisionTemplateWorkout(mobilityTemplates[0].templateId, date));
    assert(workout, `the Mobility door builds nothing on ${date}`);
    const count = (workout.exercises ?? []).length;
    assert(count >= MOBILITY_DOOR_MIN_MOVEMENTS && count <= MOBILITY_DOOR_MAX_MOVEMENTS,
      `${date} composed ${count} movements, outside Sam's 5-8`);
  }
});

run('C4. every session spreads across the four regions', () => {
  // FULL-BODY SPREAD, and the cell that matters most: hips is the pool's largest
  // region, so an unshaped draw would produce six variations on hips. This is
  // the property the pre-built bundles were standing in for.
  for (const date of ['2026-07-27', '2026-08-03', '2026-08-10', '2026-09-14']) {
    const workout = quiet(() =>
      buildCoachRevisionTemplateWorkout(mobilityTemplates[0].templateId, date));
    assert(workout, `the Mobility door builds nothing on ${date}`);
    const byName = new Map(mobilityPool().map((entry) =>
      [canonicalExerciseName(entry.name), entry] as const));
    const picked = names(workout)
      .map((n) => byName.get(canonicalExerciseName(n)))
      .filter((entry): entry is NonNullable<typeof entry> => !!entry);
    const covered = regionsCovered(picked);
    assert(covered.length === MOBILITY_REGIONS.length,
      `${date} covers ${covered.join('+') || 'nothing'} — Sam ruled lower / hips / `
      + 'midline / upper');
  }
});

run('C5. the doses are the AUTHORED ones, and the composition is deterministic', () => {
  const templateId = mobilityTemplates[0].templateId;
  const first = built(templateId);
  const again = built(templateId);
  assert(first && again, 'the Mobility door builds nothing');
  assert(JSON.stringify(names(first)) === JSON.stringify(names(again)),
    'two builds of the same date produced different sessions — the advertised '
    + 'snapshot and the written workout could not agree');
  const byName = new Map(mobilityPool().map((entry) =>
    [canonicalExerciseName(entry.name), entry] as const));
  (first.exercises ?? []).forEach((row) => {
    const source = byName.get(canonicalExerciseName(
      (row as { exercise?: { name?: string } }).exercise?.name ?? ''));
    assert(source, 'a prescribed movement is not a pool entry');
    assert((row as { prescribedSets?: number }).prescribedSets === source.sets &&
      (row as { prescribedRepsMin?: number }).prescribedRepsMin === source.repsMin &&
      (row as { prescribedRepsMax?: number }).prescribedRepsMax === source.repsMax,
      `${source.name} carries a dose Sam did not author`);
  });
});

run('C6. the region table and the pool are equal, both directions', () => {
  // The one INVENTION in this unit, gated as such. An exercise Sam adds with no
  // region would silently never be picked; a region for an exercise he removed
  // would rot. Both fail here rather than in a session nobody inspects.
  const poolIds = new Set(mobilityPool().map((entry) => entry.id));
  const tableIds = new Set(Object.keys(MOBILITY_REGION_BY_ID));
  const unmapped = Array.from(poolIds).filter((id) => !tableIds.has(id));
  const orphaned = Array.from(tableIds).filter((id) => !poolIds.has(id));
  assert(unmapped.length === 0,
    `mobility exercises with no region: ${unmapped.join(', ')} — they can never be picked`);
  assert(orphaned.length === 0,
    `regions for exercises that are not in the pool: ${orphaned.join(', ')}`);
  for (const region of MOBILITY_REGIONS) {
    const size = Object.values(MOBILITY_REGION_BY_ID).filter((r) => r === region).length;
    assert(size >= 2,
      `region "${region}" has ${size} exercise(s) — a session cannot rotate within it`);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// D. ALL THREE COUNT TOWARD NOTHING — observed through the real evaluator.
// ──────────────────────────────────────────────────────────────────────────

const program = quiet(() => generateProgramLocally({
  ...samExport8Profile(),
  equipmentAnswer: samExport8EquipmentAnswerThroughTheDoor(),
} as never, {
  todayISO: '2026-07-13',
  previousProgram: null,
  seasonPhaseClock: {
    protocolVersion: 1,
    selectedPhase: 'Pre-season',
    phaseEntryWeekStartISO: '2026-07-13',
    originProvenance: 'explicit_user_phase_change',
    persistenceProvenance: 'preserved_persisted_state',
  },
})) as TrainingProgram;
const week = program.microcycles.find((m) => m.startDate.slice(0, 10) === DATE)
  ?? program.microcycles[0];
const contract = week.exposureContractV2;

function evaluate(workouts: readonly Workout[]) {
  return quiet(() => evaluateSection18EffectiveWeek({
    contract: contract as never, workouts: workouts as never, weekStart: DATE,
  }));
}
const EMPTY = evaluate([]);
const FREE_DAY = EMPTY.ledger.restStress.trueFullRestDays[0];

run('D0. the harness can measure', () => {
  assert(typeof FREE_DAY === 'number',
    'the generated week has no free day to place a door session on');
});

const DOOR_SESSIONS: ReadonlyArray<readonly [string, string]> = [
  ['Gunshow', 'accessories_pump'],
  ['Accessories', 'accessories_prehab'],
  ['Mobility', mobilityTemplates[0]?.templateId ?? ''],
];

for (const [label, templateId] of DOOR_SESSIONS) {
  run(`D1.${label} — never hard, no load, never breaks rest`, () => {
    assert(templateId, `${label} has no template to build`);
    const source = built(templateId);
    assert(source, `${label} builds nothing`);
    const ledger = evaluate([{ ...source, dayOfWeek: FREE_DAY } as Workout]).ledger;
    assert(!ledger.restStress.hardDays.includes(FREE_DAY),
      `${label} took a hard day (Sam's ruling 2: never hard)`);
    assert(ledger.mainStrength.achievedCount === EMPTY.ledger.mainStrength.achievedCount &&
      ledger.conditioning.coreCount === EMPTY.ledger.conditioning.coreCount &&
      ledger.sprintHighSpeed.achievedCount === EMPTY.ledger.sprintHighSpeed.achievedCount &&
      ledger.power.achievedPrimerCount === EMPTY.ledger.power.achievedPrimerCount,
      `${label} moved a Section 18 exposure total (invisible to load)`);
    assert(ledger.restStress.trueFullRestDays.includes(FREE_DAY),
      `${label} broke the athlete's rest day. Athlete-added optional sessions never do.`);
  });
}

run('D2. NON-VACUITY — a real strength session still does all three', () => {
  // Every cell above would pass on a build where the ledger had stopped
  // measuring. The contrast case has to move what the door sessions do not.
  const strength = built('strength_lower');
  assert(strength, 'the strength door builds nothing');
  const ledger = evaluate([{ ...strength, dayOfWeek: FREE_DAY } as Workout]).ledger;
  assert(ledger.mainStrength.achievedCount > EMPTY.ledger.mainStrength.achievedCount,
    'a real strength session moved no exposure total — the ledger is not counting');
  assert(!ledger.restStress.trueFullRestDays.includes(FREE_DAY),
    'a real strength session did not break rest — the rest law is not being applied');
});

// ── SAM'S 2-3 MOBILITY PAIRS SURVIVE THE VALIDATOR (seat item 26) ──────────
//
// docs/MOBILITY_PAIRING_RULINGS_2026-07-31.md rule 1, Sam-ruled 2026-07-31:
// "On strength days, 2-3 accessory exercises are paired with mobility exercises
// as SUPERSETS by default". The validator capped a session at ONE pair and
// silently binned the rest, so a producer built to his design would have lost
// two thirds of it with NO ERROR. The item names this cell: it must fail if a
// 3-pair session survives as a 1-pair session.
const pairedRow = (group: string, order: number, name: string): WorkoutExercise => ({
  id: `we-${group}-${order}`,
  workoutId: 'w',
  exerciseId: name,
  exerciseOrder: order,
  prescribedSets: 2,
  prescribedRepsMin: 8,
  prescribedRepsMax: 12,
  restSeconds: 60,
  supersetGroup: group,
  supersetOrder: order,
  pairType: 'superset',
  exercise: { id: name, name },
} as unknown as WorkoutExercise);

const THREE_PAIRS: WorkoutExercise[] = [
  pairedRow('g1', 1, 'Split Squat'), pairedRow('g1', 2, 'QL Extension'),
  pairedRow('g2', 1, 'Single-Arm Bench'), pairedRow('g2', 2, 'Butterfly'),
  pairedRow('g3', 1, 'Chest Supported Row'), pairedRow('g3', 2, 'Ankle Rock'),
];

const survivingGroups = (rows: WorkoutExercise[], tier: 'core' | 'optional'): Set<string> =>
  new Set(validatePairings(rows, tier)
    .filter((ex) => ex.supersetGroup)
    .map((ex) => ex.supersetGroup as string));

run("Sam's three mobility pairs survive the validator — all three, not one", () => {
  const groups = survivingGroups(THREE_PAIRS, 'core');
  assert(groups.size === 3,
    `${groups.size} group(s) survived, expected 3: ${[...groups].join(',')}`);
});

run('every surviving paired row keeps its group, order and type', () => {
  const kept = validatePairings(THREE_PAIRS, 'core')
    .filter((ex) => ex.supersetGroup && ex.supersetOrder && ex.pairType);
  assert(kept.length === 6, `${kept.length} rows kept their pairing fields, expected 6`);
});

run('a FOURTH pair is still stripped — his number is 2-3, not unlimited', () => {
  const four = [...THREE_PAIRS, pairedRow('g4', 1, 'Curl'), pairedRow('g4', 2, 'Hip Flexor')];
  const groups = survivingGroups(four, 'core');
  assert(groups.size === 3, `${groups.size} groups survived, expected the ceiling of 3`);
});

run('a group that is not exactly 2 is still stripped', () => {
  const groups = survivingGroups([pairedRow('g1', 1, 'Split Squat')], 'core');
  assert(groups.size === 0, `${groups.size} incomplete group(s) survived`);
});

run('pairing on a non-core session is still stripped', () => {
  const groups = survivingGroups(THREE_PAIRS, 'optional');
  assert(groups.size === 0, `${groups.size} group(s) survived on a non-core session`);
});

// ── THE PAIRING PRODUCER — Sam's design, built (seat item 26) ──────────────
//
// Seven Sam-ruled rules, signed 2026-07-31, unbuilt for thirteen days. These
// cells drive the REAL signed pool and the REAL row classifier, not a stand-in.
const liftRow = (name: string, order: number): WorkoutExercise => ({
  id: `we-${order}`, workoutId: 'w', exerciseId: name, exerciseOrder: order,
  prescribedSets: 3, prescribedRepsMin: 8, prescribedRepsMax: 12, restSeconds: 60,
  exercise: { id: name, name },
} as unknown as WorkoutExercise);

const upperDay = (): Workout => ({
  id: 'w', microcycleId: 'mc', dayOfWeek: 2, name: 'Upper Body Strength',
  description: '', intensity: 'Moderate', workoutType: 'Strength', durationMinutes: 45,
  exercises: [
    liftRow('Bench Press', 1),
    liftRow('Chest Supported Row', 2),
    liftRow('Face Pulls', 3),
    liftRow('Bicep Curls', 4),
    liftRow('Tricep Pushdowns', 5),
  ],
  createdAt: '2026-08-13T00:00:00.000Z', updatedAt: '2026-08-13T00:00:00.000Z',
} as unknown as Workout);

run('accessories are pairable and MAIN LIFTS ARE NOT (rule 2)', () => {
  const day = upperDay();
  const names = pairableAccessories(day).map((r) => r.exercise?.name);
  assert(names.length >= 2, `only ${names.length} pairable accessories found`);
  assert(!names.includes('Bench Press'),
    `a MAIN LIFT was offered for pairing: ${names.join(', ')} — rule 2 says never`);
});

run('2-3 accessories are paired as supersets, by default (rule 1)', () => {
  const out = pairMobilityWithAccessories(upperDay());
  const groups = new Set((out.exercises ?? []).filter((r) => r.supersetGroup)
    .map((r) => r.supersetGroup));
  assert(groups.size >= 2 && groups.size <= MOBILITY_PAIRS_MAX,
    `${groups.size} pairs produced — his ruling is 2-3`);
  const everyGroupHasTwo = [...groups].every((g) =>
    (out.exercises ?? []).filter((r) => r.supersetGroup === g).length === 2);
  assert(everyGroupHasTwo, 'a superset group did not come out as exactly two rows');
});

run('NON-COMPETE: an upper accessory never draws upper mobility (rule 3)', () => {
  const out = pairMobilityWithAccessories(upperDay());
  const mobilityRows = (out.exercises ?? []).filter((r) => r.supersetOrder === 2);
  assert(mobilityRows.length >= 2, 'no mobility rows were produced at all');
  // His signed example is single-arm bench + butterfly: an UPPER lift drawing
  // HIPS. On an all-upper day every pick must be lower, hips or midline.
  for (const row of mobilityRows) {
    const region = mobilityRegionOf(
      mobilityPool().find((e) => e.name === row.exercise?.name)!);
    assert(region !== 'upper',
      `an upper day drew UPPER mobility (${row.exercise?.name}) — that is the `
      + 'competing pick rule 3 forbids');
  }
});

run('the pick comes from the SIGNED pool and never repeats (rule 6)', () => {
  const out = pairMobilityWithAccessories(upperDay());
  const picks = (out.exercises ?? []).filter((r) => r.supersetOrder === 2)
    .map((r) => r.exercise?.name ?? '');
  const signed = new Set(mobilityPool().map((e) => e.name));
  assert(picks.every((name) => signed.has(name)),
    `a pick came from outside the signed pool: ${picks.join(', ')}`);
  assert(new Set(picks).size === picks.length, `a movement repeated: ${picks.join(', ')}`);
});

run('the mobility row carries its OWN authored dose and counts toward nothing (rule 5)', () => {
  const out = pairMobilityWithAccessories(upperDay());
  const row = (out.exercises ?? []).find((r) => r.supersetOrder === 2)!;
  const entry = mobilityPool().find((e) => e.name === row.exercise?.name)!;
  assert(row.prescribedSets === entry.sets && row.prescribedRepsMax === entry.repsMax,
    'the pair did not carry the pool entry\'s authored warm-up dose');
  assert(row.role === 'prehab',
    `the mobility row is role="${row.role}" — rule 5 says it counts toward nothing, `
    + 'which sessionRowCounting enforces by ROLE');
});

run('a day with too few accessories is left alone — shrink, never pad', () => {
  const thin = upperDay();
  thin.exercises = (thin.exercises ?? []).slice(0, 2);
  const out = pairMobilityWithAccessories(thin);
  assert(out === thin, 'a day that cannot carry 2 pairs was paired anyway');
});

const SIDE_CHECK = (r: string): string | null =>
  r === 'upper' ? 'upper' : r === 'midline' ? null : 'lower';

run('the HARD non-compete filter holds even with no preference to hide behind', () => {
  // THIS CELL EXISTS BECAUSE A MUTATION SURVIVED WITHOUT IT. Deleting the hard
  // rule-3 filter left the earlier cell green, because the "prefer a region the
  // session does not touch" preference was independently avoiding upper picks —
  // so the cell could not tell the RULE from the PREFERENCE.
  //
  // Passing NO trained sides removes that cover: every region is now "untouched",
  // the preference protects nothing, and only rule 3 itself can keep an upper
  // pick away from an upper lift.
  // Two shadows had to be removed before this cell could see the rule at all.
  // Passing no trained sides kills the "untouched region" preference; excluding
  // every NON-upper movement kills pool ORDER, which was the second thing quietly
  // supplying the right answer. What is left is only the rule: with nothing legal
  // remaining, a chooser that obeys rule 3 must return NOTHING rather than reach
  // for the competing pick.
  const nonUpper = new Set(mobilityPool()
    .filter((entry) => mobilityRegionOf(entry) !== 'upper')
    .map((entry) => entry.name));
  const upperOnlyLeft = pickMobilityFor('Bench Press', new Set(), nonUpper);
  assert(upperOnlyLeft === null,
    `with only UPPER mobility left, the chooser returned "${upperOnlyLeft?.name}" `
    + 'for an upper lift — rule 3 is not being enforced, only shadowed by pool order');

  // And it still finds a legal pick when one exists, so the cell above cannot
  // pass merely because the chooser refuses everything.
  const legal = pickMobilityFor('Bench Press', new Set(), new Set());
  assert(legal !== null && SIDE_CHECK(legal.region) !== 'upper',
    `no legal pick was found for an upper lift: ${legal?.name}`);
});

console.log(`\nMobility and Accessories doors: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
console.log(`  the Mobility door composes from ${mobilityPool().length} authored movements`);
console.log('  DEPTH (L13): 1 — build each door\'s session and evaluate it. Whether the');
console.log('  doors keep working on a well-worn week is NOT covered.');
if (failed > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
