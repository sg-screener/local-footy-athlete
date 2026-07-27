/**
 * The role-filtered choke point — Stage 2 of the power-row redesign.
 *
 *   docs/POWER_ROW_OWNERSHIP_REASSESSMENT_2026-07-27.md §4 and §7
 *
 * Two kinds of test here, and both are needed.
 *
 * BEHAVIOURAL: an exempt row changes no classification. Stated against the
 * taxonomy directly, and against `Explosive Push-up` in particular — the one
 * pool entry that matches `MAIN_LIFT_EXERCISE_RX`, and therefore the one that
 * would quietly hand a session main-lift proof if a name probe ever ran before
 * the role filter.
 *
 * STRUCTURAL: the taxonomy contains no un-filtered row iteration. This is the
 * one that earns its keep long-term. The behavioural tests pass today because
 * four probes were converted; a fifth probe added next year would pass them too
 * while reading the raw list, which is exactly the regression this unit exists
 * to make impossible. Same shape as the power selector's no-clock/no-randomness
 * assertion: check the SOURCE, because the behaviour cannot distinguish a
 * correct implementation from a lucky one.
 *
 * Run: npm run test:row-counting
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

import type { Workout, WorkoutExercise } from '../types/domain';
import { classifyDaySessions } from '../rules/sessionTaxonomy';
import { countWeeklyExposures } from '../rules/weeklyExposureCounts';
import {
  ROLES_EXEMPT_FROM_COUNTING,
  countingRows,
  exerciseBudgetRows,
  participatesInCounting,
} from '../rules/sessionRowCounting';
import { SESSION_ROLE_ORDER } from '../utils/sessionRoles';
import { POWER_EXERCISE_POOL } from '../rules/powerExercisePool';

const repoRoot = path.resolve(__dirname, '../..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

function row(name: string, index: number, role?: WorkoutExercise['role']): WorkoutExercise {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: `row:${slug}:${index}`,
    workoutId: 'w',
    exerciseId: `${slug}:${index}`,
    exerciseOrder: index,
    prescribedSets: 3,
    prescribedRepsMin: 8,
    prescribedRepsMax: 12,
    restSeconds: 60,
    ...(role ? { role } : {}),
    exercise: {
      id: `${slug}:${index}`,
      name,
      description: name,
      muscleGroups: [],
      exerciseType: 'Isolation',
      equipmentRequired: [],
      difficultyLevel: 'Beginner',
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
    },
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
  };
}

function session(rows: WorkoutExercise[], name = 'Gunshow & Prehab'): Workout {
  return {
    id: 'w',
    microcycleId: 'mc',
    dayOfWeek: 3,
    name,
    description: '',
    intensity: 'Moderate',
    workoutType: 'Strength',
    durationMinutes: 40,
    exercises: rows,
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
  } as unknown as Workout;
}

console.log('\n[1] The filter removes rows, and only exempt ones');

ok(
  'every exempt role is a real role in the shared vocabulary',
  [...ROLES_EXEMPT_FROM_COUNTING].every((role) => SESSION_ROLE_ORDER.includes(role)),
  [...ROLES_EXEMPT_FROM_COUNTING].join(', '),
);
ok('power is exempt', ROLES_EXEMPT_FROM_COUNTING.has('power'));
ok(
  'no other role is exempt yet — only power migrates',
  ROLES_EXEMPT_FROM_COUNTING.size === 1,
  [...ROLES_EXEMPT_FROM_COUNTING].join(', '),
);

// A row with no authored role counts. This is the property that lets Stage 2
// be byte-identical: the filter can only ever REMOVE, so an unauthored row is
// treated exactly as it is today.
ok(
  'a row with no authored role participates',
  participatesInCounting(row('Back Squat', 0)),
);
ok(
  'a row with a non-exempt role participates',
  SESSION_ROLE_ORDER.filter((role) => !ROLES_EXEMPT_FROM_COUNTING.has(role))
    .every((role) => participatesInCounting(row('Back Squat', 0, role))),
);
ok(
  'a power row does not participate',
  !participatesInCounting(row('Vertical Jump', 0, 'power')),
);

{
  const workout = session([
    row('Back Squat', 0),
    row('Vertical Jump', 1, 'power'),
    row('Cable Curl', 2, 'accessory'),
  ]);
  ok(
    'countingRows drops exactly the exempt row',
    countingRows(workout).map((item) => item.exercise?.name).join(', ') ===
      'Back Squat, Cable Curl',
    countingRows(workout).map((item) => item.exercise?.name).join(', '),
  );
  ok(
    'the exercise budget reads the same fence — one ruling, one filter',
    JSON.stringify(exerciseBudgetRows(workout)) === JSON.stringify(countingRows(workout)),
  );
}

console.log('\n[2] The Explosive Push-up trap — role filters before any name probe');

// The whole reason this choke point exists. `Explosive Push-up` matches
// MAIN_LIFT_EXERCISE_RX and is a horizontal_press exposure, so as an unfiltered
// row it supplies main-lift proof and turns this accessory-named session into
// `upper_strength` — contradicting the fence's `mainStrength: false`, and
// flowing into the 4-session cap and hard-day grading.
{
  const base = session([row('Cable Curl', 0), row('Triceps Pushdown', 1)]);
  const withPowerRow = session([
    row('Cable Curl', 0),
    row('Triceps Pushdown', 1),
    row('Explosive Push-up', 2, 'power'),
  ]);
  const unfenced = session([
    row('Cable Curl', 0),
    row('Triceps Pushdown', 1),
    row('Explosive Push-up', 2),
  ]);

  const categories = (workout: Workout) =>
    classifyDaySessions(workout).map((unit) => unit.category).join(', ');

  ok(
    'the baseline is gunshow_prehab, not strength',
    categories(base) === 'gunshow_prehab',
    categories(base),
  );
  ok(
    'a role:power Explosive Push-up row changes nothing',
    categories(withPowerRow) === categories(base),
    `base=${categories(base)} withPower=${categories(withPowerRow)}`,
  );

  // The negative control. Without this, the assertion above could pass because
  // the name probe is broken rather than because the filter works.
  ok(
    'the SAME row without the role does flip the session to strength',
    categories(unfenced) !== categories(base) &&
      categories(unfenced).includes('upper_strength'),
    categories(unfenced),
  );

  const days = (workout: Workout) => [{ date: '2026-07-15', workout }];
  const baseCounts = countWeeklyExposures(days(base));
  const powerCounts = countWeeklyExposures(days(withPowerRow));
  ok(
    'and no weekly count moves',
    baseCounts.mainStrengthExposures === powerCounts.mainStrengthExposures &&
      baseCounts.hardExposures === powerCounts.hardExposures &&
      baseCounts.hardDays === powerCounts.hardDays &&
      baseCounts.conditioningExposures === powerCounts.conditioningExposures,
    `main ${baseCounts.mainStrengthExposures}→${powerCounts.mainStrengthExposures}, ` +
    `hardDays ${baseCounts.hardDays}→${powerCounts.hardDays}`,
  );
}

console.log('\n[3] Every pool entry is fenced, not just the dangerous one');

// Six of seven pool entries are harmless to the name probes; one is not. Assert
// over the WHOLE pool so a future entry Sam adds — a name nobody has checked
// against MAIN_LIFT_EXERCISE_RX — is covered on the day it lands.
{
  const base = session([row('Cable Curl', 0), row('Triceps Pushdown', 1)]);
  const baseline = classifyDaySessions(base).map((unit) => unit.category).join(', ');
  const leaks = POWER_EXERCISE_POOL.filter((entry) => {
    const workout = session([
      row('Cable Curl', 0),
      row('Triceps Pushdown', 1),
      row(entry.name, 2, 'power'),
    ]);
    return classifyDaySessions(workout).map((unit) => unit.category).join(', ') !== baseline;
  });
  ok(
    'no power-pool entry changes the taxonomy when carried as a power row',
    leaks.length === 0,
    leaks.map((entry) => entry.name).join(', '),
  );
}

console.log('\n[4] STRUCTURAL — the taxonomy has no un-filtered row iteration');

{
  const source = fs.readFileSync(
    path.join(repoRoot, 'src/rules/sessionTaxonomy.ts'),
    'utf8',
  );
  // Comments stripped first — the module documents its one exception in prose,
  // and a doc mention is not a read.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const raw = code.match(/workout\.exercises/g) ?? [];
  ok(
    'sessionTaxonomy reads workout.exercises exactly once',
    raw.length === 1,
    `${raw.length} reference(s) — every classifying probe must use countingRows()`,
  );
  // …and that one read is the rest-stub emptiness check, which must see every
  // row: a day named Rest carrying a power row is not a rest day.
  ok(
    'the single raw read is the rest-stub emptiness check',
    /\(workout\.exercises \?\? \[\]\)\.length === 0/.test(source),
  );
  ok(
    'sessionTaxonomy imports the choke point',
    /import \{ countingRows \} from '\.\/sessionRowCounting'/.test(source),
  );
  ok(
    'every classifying probe goes through it',
    (source.match(/countingRows\(workout\)/g) ?? []).length >= 4,
    `${(source.match(/countingRows\(workout\)/g) ?? []).length} call(s)`,
  );
}

{
  const source = fs.readFileSync(
    path.join(repoRoot, 'src/rules/sessionRowCounting.ts'),
    'utf8',
  );
  // The fence must be decided by the AUTHORED role and nothing else. A name
  // probe or an exposure lookup creeping in here would rebuild the very
  // inference this unit removes — and the readiness family's principle applies
  // in full: dose, intensity and position never feed identity.
  ok(
    'the choke point reads no exercise name',
    !/\bname\b/.test(source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')),
  );
  ok(
    'the choke point classifies nothing — it only reads the authored role',
    !/classifyExercise|getExerciseTags|EXERCISE_|_RX/.test(
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''),
    ),
  );
}

console.log('\n[5] STRUCTURAL — no second strip path survives');

// The reassessment's other structural gate. Nine production sites removed power
// by deleting the field: `powerBlock: undefined`, or the spread-and-drop
// `({ powerBlock: _removed, ...rest }) => rest`. A field delete is invisible to
// every owner — nothing canonicalises after it, nothing records that content
// left, and the workout's name and type can go on describing work that is gone.
// Row removal goes back through the canonical owner instead.
//
// Asserted over PRODUCTION source only. Test fixtures may still name the field
// while the type exists (Stage 4 retires it), and forbidding it there would say
// nothing about how the app behaves.
{
  const productionFiles = execSync(
    "git ls-files 'src/**/*.ts' 'src/**/*.tsx' | grep -v '__tests__'",
    { cwd: repoRoot, encoding: 'utf8' },
  ).split('\n').filter(Boolean);

  const offenders = productionFiles.filter((file) => {
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    return /powerBlock:\s*undefined/.test(source) ||
      /powerBlock:\s*_removed/.test(source);
  });
  ok(
    'no production file strips power by deleting the field',
    offenders.length === 0,
    offenders.join(', '),
  );
}

console.log(
  `\nSession row counting: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
