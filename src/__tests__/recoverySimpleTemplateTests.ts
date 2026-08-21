/**
 * Standalone Mobility and Recovery are distinct low-load sessions which share
 * the ordinary session template and exercise-card UI.
 *
 * Run: npm run test:recovery-template
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { buildDerivedSession, DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import { buildSessionTemplate, sessionListLabels } from '../utils/sessionTemplate';
import { buildSessionExecutionPlan } from '../utils/sessionExecutionChecklist';
import { getSessionComponents, getSessionComponentRows } from '../utils/sessionComponents';
import {
  MOBILITY_REGIONS,
  mobilityRegionOf,
} from '../rules/mobilitySessionComposition';
import {
  BREATHING_RESET_POOL,
  EASY_CARDIO_POOL,
  MOBILITY_POOL,
  TISSUE_QUALITY_POOL,
} from '../data/exercisePools';
import { formatLowLoadSetsReps } from '../screens/home/dayWorkoutHelpers';
import { project } from '../rules/projectVisibleWeek';
import type { ResolvedDay } from '../utils/sessionResolver';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
}

const DATE = '2026-08-21';
const recovery = buildDerivedSession(
  'recovery', DATE, 'microcycle', 'Recovery day', DEFAULT_ATHLETE_CONTEXT,
);
const mobility = buildDerivedSession(
  'mobility', DATE, 'microcycle', 'Mobility day', DEFAULT_ATHLETE_CONTEXT,
);

console.log('\n[1] The two sessions keep distinct content identities');
{
  const recoveryComponents = getSessionComponents(recovery).map((component) => component.kind);
  const mobilityComponents = getSessionComponents(mobility).map((component) => component.kind);
  ok('Recovery owns a recovery component', recoveryComponents.join(',') === 'recovery', recoveryComponents);
  ok('Mobility owns a mobility component', mobilityComponents.join(',') === 'mobility', mobilityComponents);

  const recoveryRows = getSessionComponentRows(recovery);
  const mobilityRows = getSessionComponentRows(mobility);
  ok('Recovery rows never leak into Mobility',
    recoveryRows.recoveryRows.length === recovery.exercises.length
      && recoveryRows.mobilityRows.length === 0);
  ok('Mobility rows never leak into Recovery',
    mobilityRows.mobilityRows.length === mobility.exercises.length
      && mobilityRows.recoveryRows.length === 0);
}

console.log('\n[2] Recovery is SAM\'S shape — 2 tissue, 3 spread mobility, cardio, breathing');
{
  /**
   * SAM, 2026-08-21, re-authoring the recipe on a day that gave him Toe Stretch
   * AND Calf Stretch: *"i don't like the toe stretch and calf stretch either
   * one or the other is fine, but not both, maybe it should be 1 hip, 1 upper
   * body, and one extra / 2 soft tissues - 1 light cardio for 10 min and
   * breathing to finish"*.
   *
   * ⚠ **THE SPREAD IS THE POINT, NOT THE COUNT.** "3 mobility rows" was true of
   * the shape he rejected too — two of them just happened to be lower-body. So
   * the cell below asserts one HIPS row and one UPPER row by his signed region
   * table, which is the property that stops the pair he objected to.
   */
  const names = new Set(recovery.exercises.map((row) => row.exercise?.name));
  const countFrom = (pool: readonly { name: string }[]) =>
    pool.filter((entry) => names.has(entry.name)).length;
  ok('Recovery has seven exercises', recovery.exercises.length === 7, recovery.exercises.length);
  ok('Recovery has two soft-tissue rows', countFrom(TISSUE_QUALITY_POOL) === 2);
  ok('Recovery has three mobility rows', countFrom(MOBILITY_POOL) === 3);

  const pickedRegions = MOBILITY_POOL
    .filter((entry) => names.has(entry.name))
    .map((entry) => mobilityRegionOf(entry));
  ok('one of them is a hip movement', pickedRegions.filter((r) => r === 'hips').length === 1,
    pickedRegions);
  ok('one of them is an upper-body movement', pickedRegions.filter((r) => r === 'upper').length === 1,
    pickedRegions);
  ok('and the third is neither — the "one extra"',
    pickedRegions.filter((r) => r !== 'hips' && r !== 'upper').length === 1, pickedRegions);

  ok('Recovery has one light-cardio row', countFrom(EASY_CARDIO_POOL) === 1);
  ok('Recovery has one breathing row', countFrom(BREATHING_RESET_POOL) === 1);
  ok('breathing finishes the session — Sam\'s "to finish"',
    BREATHING_RESET_POOL.some((entry) =>
      entry.name === recovery.exercises[recovery.exercises.length - 1]?.exercise?.name),
    recovery.exercises[recovery.exercises.length - 1]?.exercise?.name);
  ok('every recovery cardio option is authored at 5-10 minutes',
    EASY_CARDIO_POOL.every((row) => row.repsMin === 5 && row.repsMax === 10),
    EASY_CARDIO_POOL.map((row) => [row.name, row.repsMin, row.repsMax]));
}

console.log('\n[3] Mobility is mobility-only and full-body');
{
  const mobilityByName = new Map(MOBILITY_POOL.map((entry) => [entry.name, entry] as const));
  const picked = mobility.exercises
    .map((row) => mobilityByName.get(String(row.exercise?.name ?? '')))
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);
  const regions = new Set(picked.map(mobilityRegionOf).filter(Boolean));
  ok('Mobility contains only the mobility pool', picked.length === mobility.exercises.length);
  ok('Mobility stays inside the signed 5-8 cap',
    mobility.exercises.length >= 5 && mobility.exercises.length <= 8,
    mobility.exercises.length);
  ok('Mobility covers lower, hips, midline and upper',
    MOBILITY_REGIONS.every((region) => regions.has(region)), [...regions]);
}

console.log('\n[4] Both sessions use the ordinary template and checklist');
for (const [name, workout, expectedPresentation, expectedSection] of [
  ['Recovery', recovery, 'recovery', 'recovery'],
  ['Mobility', mobility, 'mobility', 'mobility'],
] as const) {
  const template = buildSessionTemplate(workout);
  const exerciseItems = template.items.filter((item) => item.kind === 'exercise');
  const plan = buildSessionExecutionPlan({ workout, template, mobilityFlow: null });
  ok(`${name} uses the normal list template`, template.mode === 'badged_list');
  ok(`${name} carries every stored row into that list`, exerciseItems.length === workout.exercises.length);
  ok(`${name} uses its own row presentation`,
    exerciseItems.every((item) => item.kind === 'exercise' && item.presentation === expectedPresentation));
  ok(`${name} numbers every exercise`, sessionListLabels(template.items).filter(Boolean).length === workout.exercises.length);
  ok(`${name} checklist has one matching section`,
    plan.sections.length === 1
      && plan.sections[0].id === expectedSection
      && plan.sections[0].items.length === workout.exercises.length,
    plan.sections.map((section) => [section.id, section.items.length]));
}

console.log('\n[5] Low-load doses use one high-end target');
{
  ok('rep rows show the high target with no range',
    formatLowLoadSetsReps({
      prescribedSets: 2, prescribedRepsMin: 8, prescribedRepsMax: 10,
      prescriptionType: 'reps', perSide: true, exercise: { name: 'Open Book Rotation' },
    }) === '2 × 10 / side');
  ok('cardio rows show the high target in minutes',
    formatLowLoadSetsReps({
      prescribedSets: 1, prescribedRepsMin: 5, prescribedRepsMax: 10,
      prescriptionType: 'duration_minutes', exercise: { name: 'Outdoor Walk' },
    }) === '1 × 10 min');
}

console.log('\n[6] Day cards carry the same rows instead of an empty part');
for (const [name, workout] of [['Recovery', recovery], ['Mobility', mobility]] as const) {
  const day = { date: DATE, source: 'plan', workout } as unknown as ResolvedDay;
  const visible = project({ week: [day], weekStart: DATE }).days[0];
  const part = visible.parts[0];
  ok(`${name} projects one low-load part`, visible.parts.length === 1 && part.kind === 'recovery');
  ok(`${name} day card carries every exercise row`,
    part.rows.length === workout.exercises.length,
    { visible: part.rows.length, stored: workout.exercises.length });
}

console.log('\n[7] The screen has one shared exercise-card route');
{
  const screen = fs.readFileSync(
    path.resolve(__dirname, '../screens/home/DayWorkoutScreenV2.tsx'), 'utf8',
  );
  const listStart = screen.indexOf('function SessionList');
  const listEnd = screen.indexOf('function withholdingOfTemplateItem', listStart);
  /* An `indexOf` that misses returns -1, and `slice(-1, …)` reads from the END
     of the file — the cell would then assert something true about the wrong
     region and PASS. Proven found before either is used as a bound. */
  ok('the session-list function is findable', listStart >= 0 && listEnd >= 0,
    `${listStart} ${listEnd}`);
  const list = listStart >= 0 && listEnd > listStart ? screen.slice(listStart, listEnd) : '';
  ok('the shared SessionList region was found', list.length > 1000, list.length);
  ok('Mobility and Recovery both route through StrengthExerciseCard',
    /item\.presentation === 'mobility' \|\| item\.presentation === 'recovery'/.test(list)
      && /<StrengthExerciseCard/.test(list));
  ok('the old standalone RecoveryBlock is gone', !/function RecoveryBlock\b|<RecoveryBlock\b/.test(screen));
  ok('the screen no longer branches on recovery template mode',
    !/sessionTemplate\.mode === 'recovery'/.test(screen));
  ok('the shared card receives the low-load dose formatter',
    /prescriptionLabel=\{isLowLoad \? formatLowLoadSetsReps\(item\.row\) : undefined\}/.test(list));
}

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
