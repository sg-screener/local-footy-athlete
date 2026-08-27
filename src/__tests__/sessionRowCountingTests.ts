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

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

import type { Workout, WorkoutExercise } from '../types/domain';
import { classifyDaySessions } from '../rules/sessionTaxonomy';
import { countWeeklyExposures } from '../rules/weeklyExposureCounts';
import {
  ROLES_EXEMPT_FROM_COUNTING,
  SECTION18_ROW_ROLES_WITHOUT_SESSION_ROLE,
  SESSION_ROLE_TO_SECTION18_ROW_ROLE,
  SESSION_ROLES_WITHOUT_SECTION18_ROW_ROLE,
  SESSION_SIZE_FLOOR,
  NON_COUNTING_ROW_INDEX,
  countingIndices,
  countingRows,
  exerciseBudgetRows,
  participatesInCounting,
} from '../rules/sessionRowCounting';
import { selectExercises, type SessionIntent } from './support/legacyExerciseScorer';
import type { FilterContext } from '../utils/exerciseFilter';
import { EXERCISE_TAGS } from '../data/exerciseTags';
import { SESSION_ROLE_ORDER, type SessionRole } from '../utils/sessionRoles';
import { classifyProgressionEligibility } from '../utils/strengthProgressionIntegration';
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
  // WIDENED 2026-08-13 TO FOUR, NOT DELETED — the exemption set's history stays
  // readable. "Only power migrates" was true until Sam ruled team training out
  // of the strength accounting, then mobility followed, and now conditioning:
  // *"yes it should be its own thing and not count as a strength exercise -
  // thats stupid"*.
  //
  // THIS CELL DID ITS JOB TODAY. It went RED the moment `conditioning` was
  // added, which is exactly what it is for — the module's header calls adding a
  // role here a counting change that must come with a GOLDEN DIFF. That diff was
  // run before this line moved: 100 gym sessions, over-cap 8 -> 0, and every
  // session byte-identical (same rows, same ids) because only the COUNT changed.
  // Updating it without that diff would have been the unannounced arrival it
  // exists to refuse.
  'exactly power, team training, mobility and conditioning are exempt — a fifth may not arrive unannounced',
  ROLES_EXEMPT_FROM_COUNTING.size === 4
    && ROLES_EXEMPT_FROM_COUNTING.has('power')
    && ROLES_EXEMPT_FROM_COUNTING.has('team_training')
    && ROLES_EXEMPT_FROM_COUNTING.has('mobility')
    && ROLES_EXEMPT_FROM_COUNTING.has('conditioning'),
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
  // ⚠ THIS CELL USED TO ASSERT THE TWO FENCES WERE IDENTICAL — "one ruling, one
  // filter". **R-088 REPEALED THAT (Sam, 2026-08-13)** and the cell survived the
  // repeal GREEN, because this fixture holds no `prehab` row and the two fences
  // only differ on one. **A cell that agrees with a law it no longer describes
  // is the green-and-empty shape**, so it now asserts the split itself.
  ok(
    'the two fences agree where they still agree',
    JSON.stringify(exerciseBudgetRows(workout)) === JSON.stringify(countingRows(workout)),
  );
}

{
  // R-088: *"there should be a mobility warm up and prehab stuff… the mobility
  // portion does not count"*. The TAXONOMY still counts a prehab row — §18 is a
  // different question and this ruling did not touch it — and **the CAP does
  // not**. This is the one row where the two fences part.
  const withPrehab = session([
    row('Back Squat', 0),
    row('Band Pull-Apart', 1, 'prehab'),
  ]);
  ok(
    'R-088: the CAP does not count a prehab row',
    exerciseBudgetRows(withPrehab).map((item) => item.exercise?.name).join(', ') === 'Back Squat',
    exerciseBudgetRows(withPrehab).map((item) => item.exercise?.name).join(', '),
  );
  ok(
    'R-088: and the TAXONOMY still does — the split is the cap\'s alone',
    countingRows(withPrehab).map((item) => item.exercise?.name).join(', ')
      === 'Back Squat, Band Pull-Apart',
    countingRows(withPrehab).map((item) => item.exercise?.name).join(', '),
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
    // `gunshow` since Sam's split of 2026-07-30 — this fixture is a Gunshow by name
    // and by content (curls, pushdowns), so it lands on the arms type rather than on
    // the shared category that could not tell the two apart.
    'the baseline is gunshow, not strength',
    categories(base) === 'gunshow',
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

console.log('\n[5] The role vocabularies map 1:1, in both directions');

// Sam's condition on Stage 4. Three things in this codebase are called a row
// "role", and deleting around them is exactly when they drift:
//
//   `SessionRole`        (6)  what a row IS — authored, ordered by, counted by
//   `Section18RowRole`   (7)  the same fact in Section 18's spelling
//   `classifyProgressionEligibility` in strengthProgressionIntegration — was a
//                             third vocabulary: it answers "may this row
//                             progress" with primary/secondary/null. Pinned
//                             renamed in Stage 5 so nobody imports the wrong
//                             one believing it returns a session role; the
//                             disjointness assertion below keeps a future
//                             re-merge loud.
//
// The first two are a genuine second representation and are queued for collapse
// as their own unit. Until then the crosswalk is the one bridge and these
// assertions red the suite the moment either side grows a member.
{
  const sessionRoles = [...SESSION_ROLE_ORDER];
  const mapped = Object.keys(SESSION_ROLE_TO_SECTION18_ROW_ROLE) as SessionRole[];
  ok(
    // NARROWED 2026-08-13 TO "EVERY ROLE IS ACCOUNTED FOR", which is the claim
    // that was always meant: a role must either have a §18 spelling or be a
    // DECLARED exception. `team_training` is the first of the latter, because a
    // team night is already credited at the SESSION level by the taxonomy and a
    // row spelling would count it twice. The cell still fails on a role that is
    // neither mapped nor declared, which is the drift it guards.
    'every SessionRole is either mapped to Section 18 or declared exempt from it',
    sessionRoles.every((role) =>
      mapped.includes(role) || SESSION_ROLES_WITHOUT_SECTION18_ROW_ROLE.includes(role))
      && mapped.length + SESSION_ROLES_WITHOUT_SECTION18_ROW_ROLE.length === sessionRoles.length,
    `roles=${sessionRoles.join(',')} mapped=${mapped.join(',')} `
      + `declared=${SESSION_ROLES_WITHOUT_SECTION18_ROW_ROLE.join(',')}`,
  );

  ok(
    'a declared Section 18 exception must not ALSO be mapped',
    !SESSION_ROLES_WITHOUT_SECTION18_ROW_ROLE.some((role) => mapped.includes(role)),
    SESSION_ROLES_WITHOUT_SECTION18_ROW_ROLE.join(','),
  );

  const targets = Object.values(SESSION_ROLE_TO_SECTION18_ROW_ROLE);
  ok(
    'the mapping is injective — no two roles share a Section 18 spelling',
    new Set(targets).size === targets.length,
    targets.join(','),
  );

  // The reverse direction. Read the union's members out of the source so a new
  // member cannot be added without this test seeing it.
  const contractSource = fs.readFileSync(
    path.join(repoRoot, 'src/rules/weeklyExposureContractV2.ts'),
    'utf8',
  );
  const union = contractSource
    .slice(contractSource.indexOf('export type Section18RowRole ='))
    .split(';')[0];
  const declared = Array.from(union.matchAll(/'([a-z_]+)'/g)).map((match) => match[1]);
  const covered = [...targets, ...SECTION18_ROW_ROLES_WITHOUT_SESSION_ROLE];
  ok(
    'every Section18RowRole is either mapped or a declared exception',
    declared.length > 0 && declared.every((role) => covered.includes(role as never)),
    `declared=${declared.join(',')} covered=${covered.join(',')}`,
  );
  ok(
    'the only unmapped Section 18 role is the legacy ingress sentinel',
    JSON.stringify(SECTION18_ROW_ROLES_WITHOUT_SESSION_ROLE) === JSON.stringify(['legacy_unknown']),
    SECTION18_ROW_ROLES_WITHOUT_SESSION_ROLE.join(','),
  );

  // The homonym. `strengthProgressionIntegration.classifyProgressionEligibility` no longer shares a
  // NAME with `sessionRoles.classifyExerciseRole` and answers a different
  // question with a disjoint vocabulary. Asserting disjointness is what makes a
  // future accidental merge of the two loud.
  const progressionRoles = ['primary_strength', 'secondary_strength'];
  ok(
    "the progression classifier's vocabulary is disjoint from SessionRole",
    progressionRoles.every((role) => !SESSION_ROLE_ORDER.includes(role as never)) &&
      progressionRoles.every((role) => !targets.includes(role as never)),
    progressionRoles.join(','),
  );
  ok(
    'the progression classifier answers eligibility, not identity (null is a valid answer)',
    classifyProgressionEligibility('Something The Pools Never Heard Of') === null,
  );
}

console.log('\n[6] STRUCTURAL — no second strip path survives');

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

  const stripComments = (source: string): string => source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  const readSource = (file: string): string =>
    stripComments(fs.readFileSync(path.join(repoRoot, file), 'utf8'));

  const offenders = productionFiles.filter((file) => {
    const source = readSource(file);
    return /powerBlock:\s*undefined/.test(source) ||
      /powerBlock:\s*_removed/.test(source);
  });
  ok(
    'no production file strips power by deleting the field',
    offenders.length === 0,
    offenders.join(', '),
  );

  // …and nothing WRITES the legacy field either. `powerBlock` survives on the
  // type as a read-only door, because the program store has no `partialize` and
  // therefore serialised it into every program generated before 2026-07-28.
  // Stage 5 migrates those; until then the field must be inert. A write would
  // resurrect the representation this unit removed.
  //
  // A WRITE is `powerBlock:` in an object literal, or `.powerBlock =`.
  //
  // A destructuring BINDING PATTERN — `const { powerBlock: _lifted, ...rest } =
  // workout` — is the exact opposite: it lifts the field OFF the object, and is
  // how the one sanctioned remover (`legacyPowerBlockMigration`, DELETED
  // 2026-08-10 on Sam's "kill it") retired stored blocks. The distinction is
  // kept rather than simplified away: it is what stops this cell reading any
  // future lift's removal as the write it exists to forbid. What distinguishes it is position: a binding pattern sits to the
  // LEFT of `=`, an object literal never does. So binding patterns are removed
  // before the write test runs. Detecting on `powerBlock:` alone cannot tell the
  // two apart, and read the migration that DELETES the field as the write it
  // exists to prevent.
  const writesPowerBlock = (source: string): boolean => {
    const code = stripComments(source).replace(/\{[^{}]*\}\s*=(?!=)/g, '');
    return /(^|[^.?])\bpowerBlock\s*:/m.test(code) || /\.powerBlock\s*=/.test(code);
  };

  // The detector is a regex over source text and it was just made narrower, so
  // prove it still fires on a real write. A guard loosened until it passes is
  // worse than no guard: this pins the narrowing to destructuring alone.
  ok('the write detector catches an object-literal write',
    writesPowerBlock('const w = { powerBlock: block };'));
  ok('the write detector catches a property assignment',
    writesPowerBlock('workout.powerBlock = block;'));
  ok('the write detector allows a plain read',
    !writesPowerBlock('const b = workout.powerBlock ?? null;'));
  ok('the write detector allows destructuring removal',
    !writesPowerBlock('const { powerBlock: _lifted, ...rest } = workout;'));

  const writers = productionFiles.filter((file) => writesPowerBlock(readSource(file)));
  ok(
    'nothing writes the legacy powerBlock field — it is a reader-only door',
    writers.length === 0,
    writers.join(', '),
  );
}

// ── THE SESSION-SIZE FLOOR HAS ONE OWNER, AND ITS READER PROVES IT ──────────
//
// The floor was `MIN_SESSION_SIZE`, private to `exerciseScorer`. Session size
// therefore had TWO representations in two files — that private floor and the
// authored ceiling on the training-age policy — and only one of them could be
// found by anyone looking for "how big is a session".
//
// A MOVED CONSTANT WITH NO CELL IS A CONSTANT THAT CAN BE SILENTLY UN-MOVED.
// So this is deliberately BEHAVIOURAL, not a source grep: it drives the real
// selector with an under-filling intent and asserts the session it builds is
// sized by the shared owner. Change `SESSION_SIZE_FLOOR` and this cell moves —
// which is the only thing that proves the scorer READS it rather than merely
// importing it.
console.log('\n[SESSION SIZE] the floor has one owner');
{
  const candidates = Object.keys(EXERCISE_TAGS);
  const ctx: FilterContext = {
    daysToGame: null,
    daysSinceGame: null,
    dayOfWeek: 3,
    inSeason: false,
    activeInjuries: {},
  };
  // ONE slot, but room for more: slot-filling under-fills, so the filler branch
  // — the only reader of the floor — is the thing under test. An intent that
  // already fills itself would make this cell green and VACUOUS.
  const intent: SessionIntent = {
    targetMovements: ['squat'],
    targetRegion: 'lower',
    exerciseCount: 6,
    slots: [{
      role: 'primary',
      preferredMovements: ['squat'],
      maxLoad: null,
      maxFatigue: null,
      requireUnilateral: null,
    }],
  };
  const selected = selectExercises(candidates, intent, ctx, new Set<string>());

  ok('the floor is the shared owner, not a private copy',
    SESSION_SIZE_FLOOR === 4, `SESSION_SIZE_FLOOR=${SESSION_SIZE_FLOOR}`);
  ok('an under-filled session is topped up TO the shared floor',
    selected.length === SESSION_SIZE_FLOOR,
    `one slot asked for 1 exercise; the selector returned ${selected.length}, floor is ${SESSION_SIZE_FLOOR}`);
  // The floor is a FLOOR, never a target: the intent's own count still caps it.
  const capped = selectExercises(
    candidates, { ...intent, exerciseCount: 2 }, ctx, new Set<string>());
  ok('the intent\'s own exercise count still caps the top-up',
    capped.length <= 2,
    `exerciseCount 2 produced ${capped.length} — the floor overrode the intent`);
}

// ── `countingIndices` RETURNS A PARALLEL ARRAY, NOT A LIST OF INDICES ───────
//
// ITS NAME INVITES EXACTLY ONE MISTAKE AND I MADE IT (2026-08-13). It returns
// one entry PER ROW — that row's counting position, or NON_COUNTING_ROW_INDEX —
// so `.length` is ALWAYS the total row count and never a count of counted rows.
// I read `.length` as "how many strength rows this session has", measured 52
// generated sessions, and reported to Sam that his 6-exercise cap was being
// breached by seven-row sessions. It was not: those are six counted rows plus
// one non-counting row, which is what the counting rule is FOR.
//
// ALL FOUR PRODUCTION CALLERS USE IT CORRECTLY — workoutCanonicalisation (x2),
// sessionBuilder and section18WorkoutEvidence all index it in parallel with the
// rows. The misuse was mine, in a probe. These cells pin the CONTRACT so the
// shape cannot quietly change into the one I assumed, and so the trap is stated
// where the next reader is already looking.
{
  const rows = [
    row('Back Squat', 0, 'main_lift'),
    row('Trap Bar Jump', 1, 'power'),
    row('Romanian Deadlift', 2, 'main_lift'),
  ];
  const indices = countingIndices(rows);

  ok('countingIndices returns ONE ENTRY PER ROW — its length is not a count',
    indices.length === rows.length,
    `${indices.length} entries for ${rows.length} rows`);
  // The trap, stated as an assertion: length and counted-count DISAGREE here.
  const counted = indices.filter((index) => index !== NON_COUNTING_ROW_INDEX).length;
  ok('a non-counting row makes length and counted-count differ — the trap is real',
    counted < indices.length && counted === 2,
    `counted=${counted} length=${indices.length}`);
  ok('counting positions are consecutive from zero, skipping non-counting rows',
    indices[0] === 0 && indices[2] === 1 && indices[1] === NON_COUNTING_ROW_INDEX,
    JSON.stringify(indices));
  // NON-VACUITY: with no exempt row the two DO agree, so the cell above is
  // asserting the exemption and not simply that filtering shrinks an array.
  const allCounting = countingIndices([
    row('Back Squat', 0, 'main_lift'),
    row('Romanian Deadlift', 1, 'main_lift'),
  ]);
  ok('with no exempt row, length and counted-count agree',
    allCounting.filter((index) => index !== NON_COUNTING_ROW_INDEX).length === allCounting.length);
}

// ── SAM'S RULING: CONDITIONING IS NOT A STRENGTH EXERCISE (2026-08-13) ──────
//
// *"yes it should be its own thing and not count as a strength exercise - thats
// stupid"*. It is the FIFTH case of the shape this exempt set exists for, and
// the one his own team-training exemption used as its REFERENCE — "looked at
// more like conditioning" — while conditioning itself went on counting.
//
// BOTH HALVES ARE ASSERTED, because either alone is inert: the ROLE must be
// exempt, AND the emitter must actually stamp it. `participatesInCounting` is
// `!row.role || !EXEMPT.has(role)`, so an untagged row counts no matter what
// the set says.
{
  const condRow = row('Tempo Run', 0, 'conditioning');
  ok('[R-034] a conditioning row does NOT count as a strength exercise',
    !participatesInCounting(condRow));
  ok('[R-034] conditioning is in the exempt set by ROLE',
    ROLES_EXEMPT_FROM_COUNTING.has('conditioning'));
  // THE HALF A ROLE-ONLY FIX WOULD MISS: an untagged row still counts, which is
  // why the emitter had to be changed too.
  ok('[R-034] an UNTAGGED row still counts — the default is COUNT',
    participatesInCounting(row('Mystery Row', 1)));
  // A combined day: 6 lifts + 1 conditioning block reads as SIX, not seven.
  const combined = [
    row('Back Squat', 0, 'main_lift'), row('RDL', 1, 'main_lift'),
    row('Split Squat', 2, 'accessory'), row('Hip Thrust', 3, 'accessory'),
    row('Pallof Press', 4, 'midline'), row('Curl', 5, 'accessory'),
    row('Tempo Run', 6, 'conditioning'),
  ];
  const counted = countingIndices(combined)
    .filter((index) => index !== NON_COUNTING_ROW_INDEX).length;
  ok('[R-034] six lifts plus a conditioning block is SIX, not seven — his cap holds',
    counted === 6, `counted=${counted}`);
}

console.log(
  `\nSession row counting: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
