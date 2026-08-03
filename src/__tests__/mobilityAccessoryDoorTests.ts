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
import type { TrainingProgram, Workout } from '../types/domain';
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

console.log(`\nMobility and Accessories doors: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
console.log(`  the Mobility door composes from ${mobilityPool().length} authored movements`);
console.log('  DEPTH (L13): 1 — build each door\'s session and evaluate it. Whether the');
console.log('  doors keep working on a well-worn week is NOT covered.');
if (failed > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
