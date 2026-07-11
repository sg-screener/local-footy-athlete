/**
 * weeklyPlanDisplayTests — Sam's weekly-plan taxonomy (2026-07-04).
 *
 * The weekly plan speaks in categories; the session screen speaks in
 * specifics. This suite pins every session in the inventory to its
 * approved category so a renamed template or a new session can't
 * silently mislabel the week.
 *
 * Run: ./node_modules/.bin/sucrase-node src/__tests__/weeklyPlanDisplayTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  classifyConditioningWorkout,
  combinedConditioningCategoryLabel,
  weeklyPlanTitle,
} from '../utils/weeklyPlanDisplay';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function eq(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}`);
    console.log(`       expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
  }
}

const conditioning = (name: string, workoutType = 'Conditioning') =>
  ({ name, workoutType }) as any;

console.log('weeklyPlanDisplayTests');

console.log('\n[1] strength / fixed days pass through canonically');
eq('Upper Push', weeklyPlanTitle({ name: 'Upper Push', workoutType: 'Strength' }), 'Upper Push');
eq('Lower Squat', weeklyPlanTitle({ name: 'Lower Squat', workoutType: 'Strength' }), 'Lower Squat');
eq('Lower Body Strength', weeklyPlanTitle({ name: 'Lower Body Strength', workoutType: 'Strength' }), 'Lower Body Strength');
eq('Upper Body Strength', weeklyPlanTitle({ name: 'Upper Body Strength', workoutType: 'Strength' }), 'Upper Body Strength');
eq('Full Body Strength', weeklyPlanTitle({ name: 'Full Body Strength', workoutType: 'Strength' }), 'Full Body Strength');
eq('team day leads with the strength half',
  weeklyPlanTitle({ name: 'Team Training + Upper Push', workoutType: 'Team Training' }), 'Upper Push');
eq('team-only day', weeklyPlanTitle({ name: 'Team Training', workoutType: 'Team Training' }), 'Team Training');
eq('Game Day', weeklyPlanTitle({ name: 'Game Day', workoutType: 'Game' }), 'Game Day');
eq('Gunshow keeps its name', weeklyPlanTitle({ name: 'Gunshow', workoutType: 'Strength' }), 'Gunshow');
eq('Prehab & Accessories reads as Accessories',
  weeklyPlanTitle({ name: 'Prehab & Accessories', workoutType: 'Strength' }), 'Accessories');

console.log('\n[2] recovery-tier days read as Recovery');
eq('Recovery Session', weeklyPlanTitle({ name: 'Recovery Session', workoutType: 'Recovery' }), 'Recovery');
eq('Recovery Flow (tier)', weeklyPlanTitle({ name: 'Recovery Flow', workoutType: 'Recovery', sessionTier: 'recovery' }), 'Recovery');

console.log('\n[3] Aerobic Base family');
for (const name of [
  'Long Nasal Run', 'Flush Run', 'Easy Bike', 'Easy Row', 'Easy Ski',
  'Easy Swim', 'Easy Zone 2 Bike', 'Easy Zone 2 Row', 'Easy Zone 2 Ski Erg',
]) {
  eq(name, weeklyPlanTitle(conditioning(name)), 'Aerobic Base');
}

console.log('\n[4] Flush Out family');
for (const name of [
  'Flush Out - 30:30 Intervals', 'Flush Out - 1min On / 1min Off',
  'Flush Out - 2min On / 1min Off', 'Easy Aerobic Flush',
]) {
  eq(name, weeklyPlanTitle(conditioning(name)), 'Flush Out');
}

console.log('\n[5] Sprint Work family');
for (const name of [
  'Flying Sprints', 'Free Sprint Session', 'Max Effort Sprint Accumulation',
  'Sprint Micro-Dose',
]) {
  eq(name, weeklyPlanTitle(conditioning(name)), 'Sprint Work');
}

console.log('\n[6] Hard Conditioning family');
for (const name of [
  '4x4 VO2', '1km Repeat Intervals', 'MAS 15:15 Blocks', 'Tabata Intervals',
  'Inverse Tabata', '200m/400m Repeat Runs', 'Footy Fartlek',
  'MetCon - Off-Legs', 'Erg EMOM - 10-15 cal',
]) {
  eq(name, weeklyPlanTitle(conditioning(name)), 'Hard Conditioning');
}

console.log('\n[7] combined days: strength title + conditioning category context');
const combinedHard = {
  name: 'Upper Pull',
  workoutType: 'Strength',
  hasCombinedConditioning: true,
  conditioningFlavour: 'aerobic',
  conditioningBlock: {
    intent: 'work_capacity',
    options: [{ title: 'Erg EMOM - 10-15 cal', description: 'hard erg efforts' }],
  },
} as any;
eq('combined title stays strength', weeklyPlanTitle(combinedHard), 'Upper Pull');
eq('combined EMOM context is Hard Conditioning',
  combinedConditioningCategoryLabel(combinedHard), 'Hard Conditioning');

const combinedLegacy = {
  name: 'Lower Body Strength',
  workoutType: 'Strength',
  hasCombinedConditioning: true,
  conditioningFlavour: 'aerobic',
} as any;
eq('mixed lower title stays Lower Body Strength',
  weeklyPlanTitle(combinedLegacy), 'Lower Body Strength');
eq('legacy flavour-only combined context is Aerobic Base',
  combinedConditioningCategoryLabel(combinedLegacy), 'Aerobic Base');
eq('non-combined day has no context',
  combinedConditioningCategoryLabel({ name: 'Upper Push' } as any), null);

console.log('\n[8] classification backstops');
eq('unknown easy conditioning defaults to Aerobic Base',
  classifyConditioningWorkout(conditioning('Mystery Session')), 'Aerobic Base');
eq('engine category field wins when names are silent',
  classifyConditioningWorkout({ name: 'Session 3', conditioningCategory: 'glycolytic' } as any),
  'Hard Conditioning');
eq('typed category beats a misleading legacy name',
  classifyConditioningWorkout({
    name: 'Sprint-labelled easy bike',
    workoutType: 'Conditioning',
    conditioningCategory: 'aerobic_base',
  } as any),
  'Aerobic Base');

console.log(`\nweeklyPlanDisplayTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(failures.join('\n'));
  process.exit(1);
}
