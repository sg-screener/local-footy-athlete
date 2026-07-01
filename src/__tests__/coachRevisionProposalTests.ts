/**
 * coachRevisionProposalTests — Stage 4A-1 snapshot/diff/override prototype.
 *
 * These tests stop before mutation. They prove one-off coach edits can be
 * represented as proposed visible state, diffed, and safety-validated without
 * routing through command operations or target-item guards.
 *
 * Run: ./node_modules/.bin/sucrase-node src/__tests__/coachRevisionProposalTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import {
  COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
  buildCoachRevisionDiff,
  buildCoachRevisionWeekSnapshotFromProjectedDays,
  parseCoachRevisionProposal,
  validateCoachRevisionDiff,
  type CoachRevisionIntent,
  type CoachRevisionProposal,
  type CoachVisibleDaySnapshot,
  type CoachVisibleSectionSnapshot,
  type CoachVisibleWeekSnapshot,
} from '../utils/coachRevisionProposal';

const MON = '2026-07-06';
const TUE = '2026-07-07';
const WED = '2026-07-08';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function section(name: string) {
  console.log(`\n${name}`);
}

function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? `: ${JSON.stringify(detail)}` : ''}`);
    console.log(`  FAIL ${name}`);
    if (detail) console.log(`       ${JSON.stringify(detail)}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

function workoutExercise(name: string, id: string, sets = 3): any {
  return {
    id,
    workoutId: 'workout',
    exerciseId: id,
    exerciseOrder: 0,
    prescribedSets: sets,
    prescribedRepsMin: 6,
    prescribedRepsMax: 8,
    prescribedWeightKg: 0,
    restSeconds: 90,
    exercise: {
      id,
      name,
      description: name,
      exerciseType: 'Compound',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
  };
}

function mixedWorkout(): Workout {
  const conditioning = workoutExercise('25min zone 2 bike', 'conditioning-bike', 1);
  return {
    id: 'workout-monday-mixed',
    microcycleId: 'mc',
    dayOfWeek: 1,
    name: 'Lower Body Strength',
    description: '',
    durationMinutes: 75,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    hasCombinedConditioning: true,
    conditioningFlavour: 'aerobic',
    conditioningCategory: 'aerobic_base',
    conditioningBlock: {
      intent: 'aerobic',
      options: [{
        title: 'Easy Aerobic Flush',
        description: '25min zone 2 bike',
        exerciseIds: ['conditioning-bike'],
      }],
    },
    exercises: [
      workoutExercise('Back Squat', 'strength-squat', 4),
      workoutExercise('Romanian Deadlift', 'strength-rdl', 3),
      conditioning,
    ],
    createdAt: '',
    updatedAt: '',
  };
}

function strengthOnlyWorkout(id = 'workout-strength-only'): Workout {
  return {
    id,
    microcycleId: 'mc',
    dayOfWeek: 1,
    name: 'Lower Body Strength',
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [
      workoutExercise('Back Squat', `${id}-squat`, 4),
      workoutExercise('Split Squat', `${id}-split-squat`, 3),
    ],
    createdAt: '',
    updatedAt: '',
  };
}

function teamTrainingWorkout(): Workout {
  return {
    id: 'team-training-tuesday',
    microcycleId: 'mc',
    dayOfWeek: 2,
    name: 'Team Training',
    description: 'Club session',
    durationMinutes: 90,
    intensity: 'High',
    workoutType: 'Team Training',
    sessionTier: 'core',
    exercises: [],
    createdAt: '',
    updatedAt: '',
  };
}

function visibleDay(date: string, workout: Workout | null): ResolvedDay {
  return {
    date,
    dayOfWeek: 1,
    short: 'MON',
    isToday: false,
    workout,
    source: workout ? 'template' : 'rest',
    indicator: null,
  } as any;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function snapshot(days: ResolvedDay[]): CoachVisibleWeekSnapshot {
  return buildCoachRevisionWeekSnapshotFromProjectedDays(days);
}

function daySnap(week: CoachVisibleWeekSnapshot, date: string): CoachVisibleDaySnapshot {
  const found = week.days.find((day) => day.date === date);
  if (!found) throw new Error(`Missing day ${date}`);
  return found;
}

function sectionOf(day: CoachVisibleDaySnapshot, kind: string): CoachVisibleSectionSnapshot {
  const found = day.workout?.sections.find((section) => section.kind === kind);
  if (!found) throw new Error(`Missing ${kind} section on ${day.date}`);
  return found;
}

function proposal(args: {
  intent: Partial<CoachRevisionIntent> & Pick<CoachRevisionIntent, 'intent' | 'targetDomain' | 'actionScope'>;
  dates: string[];
  revisedDays: CoachVisibleDaySnapshot[];
  protectedRefs?: string[];
  allowedAddedSectionKinds?: CoachRevisionIntent['allowedAddedSectionKinds'];
  requiresConfirmation?: boolean;
}): CoachRevisionProposal {
  return {
    schemaVersion: COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
    kind: 'revision',
    source: 'semantic',
    confidence: 0.92,
    userIntent: {
      intent: args.intent.intent,
      targetDomain: args.intent.targetDomain,
      actionScope: args.intent.actionScope,
      targetDates: args.dates,
      protectedRefs: args.protectedRefs ?? [],
      allowedAddedSectionKinds: args.allowedAddedSectionKinds,
      requiresConfirmation: args.requiresConfirmation,
      reason: args.intent.reason ?? 'test intent',
    },
    scope: {
      mode: args.dates.length === 1 ? 'single_day' : 'visible_week',
      dates: args.dates,
    },
    revisedDays: args.revisedDays,
    explanation: 'test proposal',
  };
}

section('[1] remove strength while keeping conditioning');
{
  const before = snapshot([visibleDay(MON, mixedWorkout())]);
  const monday = daySnap(before, MON);
  const conditioning = sectionOf(monday, 'conditioning');
  const after = clone(monday);
  after.workout!.title = conditioning.title;
  after.workout!.workoutType = 'Conditioning';
  after.workout!.sections = [conditioning];

  const p = proposal({
    intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
    dates: [MON],
    revisedDays: [after],
    protectedRefs: [conditioning.id],
  });
  const diff = buildCoachRevisionDiff({ before, proposal: p });
  const result = validateCoachRevisionDiff({ before, proposal: p });

  eq('changed Monday only', diff.changedDates, [MON]);
  ok('strength section removed', diff.dateDiffs[0].sectionDiffs.some((entry) => entry.kind === 'removed' && entry.sectionKind === 'strength'));
  ok('conditioning section preserved', diff.dateDiffs[0].sectionDiffs.some((entry) => entry.kind === 'preserved' && entry.sectionId === conditioning.id));
  eq('validator passes', result.status, 'valid');
}

section('[2] remove conditioning while keeping strength');
{
  const before = snapshot([visibleDay(MON, mixedWorkout())]);
  const monday = daySnap(before, MON);
  const strength = sectionOf(monday, 'strength');
  const after = clone(monday);
  after.workout!.sections = [strength];

  const p = proposal({
    intent: { intent: 'remove', targetDomain: 'conditioning', actionScope: 'conditioning_section' },
    dates: [MON],
    revisedDays: [after],
    protectedRefs: [strength.id],
  });
  const result = validateCoachRevisionDiff({ before, proposal: p });

  eq('validator passes', result.status, 'valid');
  ok('conditioning section removed', result.diff.dateDiffs[0].sectionDiffs.some((entry) => entry.kind === 'removed' && entry.sectionKind === 'conditioning'));
  ok('strength section preserved', result.diff.dateDiffs[0].sectionDiffs.some((entry) => entry.kind === 'preserved' && entry.sectionId === strength.id));
}

section('[3] remove whole session');
{
  const before = snapshot([visibleDay(MON, strengthOnlyWorkout())]);
  const after = clone(daySnap(before, MON));
  after.workout = null;
  const p = proposal({
    intent: { intent: 'remove', targetDomain: 'session', actionScope: 'whole_session' },
    dates: [MON],
    revisedDays: [after],
  });
  const result = validateCoachRevisionDiff({ before, proposal: p });

  eq('validator passes', result.status, 'valid');
  eq('workout removed', result.diff.dateDiffs[0].workoutChange, 'removed');
}

section('[4] protected conditioning violation');
{
  const before = snapshot([visibleDay(MON, mixedWorkout())]);
  const monday = daySnap(before, MON);
  const conditioning = sectionOf(monday, 'conditioning');
  const after = clone(monday);
  after.workout!.sections = [sectionOf(monday, 'strength')];
  const p = proposal({
    intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
    dates: [MON],
    revisedDays: [after],
    protectedRefs: [conditioning.id],
  });
  const result = validateCoachRevisionDiff({ before, proposal: p });

  eq('validator fails', result.status, 'invalid');
  ok('protected ref changed', result.issues.some((entry) => entry.code === 'protected_ref_changed'));
}

section('[5] unrelated day changed');
{
  const before = snapshot([
    visibleDay(MON, mixedWorkout()),
    visibleDay(WED, strengthOnlyWorkout('workout-wed-strength')),
  ]);
  const monday = daySnap(before, MON);
  const wednesday = clone(daySnap(before, WED));
  wednesday.workout = null;
  const p = proposal({
    intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
    dates: [MON],
    revisedDays: [monday, wednesday],
  });
  const result = validateCoachRevisionDiff({ before, proposal: p });

  eq('validator fails', result.status, 'invalid');
  ok('unrelated day flagged', result.issues.some((entry) => entry.code === 'unrelated_day_changed' && entry.date === WED));
}

section('[6] invented hidden ID');
{
  const before = snapshot([visibleDay(MON, strengthOnlyWorkout())]);
  const after = clone(daySnap(before, MON));
  after.workout!.sections.push({
    id: 'section:hidden-conditioning',
    kind: 'conditioning',
    title: 'Secret Conditioning',
    items: [{
      id: 'hidden-conditioning-item',
      title: 'Hidden Bike',
      domain: 'conditioning',
      source: 'conditioning_option',
      description: null,
      exerciseIds: [],
      durationMinutes: 20,
      prescription: null,
    }],
  });
  const p = proposal({
    intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
    dates: [MON],
    revisedDays: [after],
  });
  const result = validateCoachRevisionDiff({ before, proposal: p });

  eq('validator fails', result.status, 'invalid');
  ok('unknown section rejected', result.issues.some((entry) => entry.code === 'unknown_section_id'));
}

section('[7] replace team training with conditioning requires confirmation');
{
  const before = snapshot([visibleDay(TUE, teamTrainingWorkout())]);
  const team = daySnap(before, TUE);
  const after = clone(team);
  after.workout = {
    id: 'revision-conditioning-tuesday',
    title: 'Easy Conditioning',
    workoutType: 'Conditioning',
    sections: [{
      id: 'section:tuesday:new-conditioning',
      kind: 'conditioning',
      title: 'Easy Conditioning',
      items: [{
        id: 'item:tuesday:new-conditioning',
        title: '25min zone 2 bike',
        domain: 'conditioning',
        source: 'conditioning_option',
        description: 'Easy aerobic work',
        exerciseIds: [],
        durationMinutes: 25,
        prescription: null,
      }],
    }],
  };
  const p = proposal({
    intent: { intent: 'replace', targetDomain: 'session', actionScope: 'whole_session' },
    dates: [TUE],
    revisedDays: [after],
    allowedAddedSectionKinds: ['conditioning'],
    requiresConfirmation: true,
  });
  const result = validateCoachRevisionDiff({ before, proposal: p });

  eq('requires confirmation', result.status, 'needs_confirmation');
  ok('classified as replace/remove+add', result.diff.dateDiffs[0].sectionDiffs.some((entry) => entry.kind === 'removed' && entry.sectionKind === 'session'));
  ok('conditioning addition visible', result.diff.dateDiffs[0].sectionDiffs.some((entry) => entry.kind === 'added' && entry.sectionKind === 'conditioning'));
}

section('[8] make tomorrow lighter via conservative reduction');
{
  const before = snapshot([visibleDay(TUE, strengthOnlyWorkout('workout-tomorrow-strength'))]);
  const after = clone(daySnap(before, TUE));
  const strength = sectionOf(after, 'strength');
  strength.items[0].prescription!.sets = 2;
  strength.items[1].prescription!.sets = 2;
  const p = proposal({
    intent: { intent: 'reduce', targetDomain: 'strength', actionScope: 'strength_section' },
    dates: [TUE],
    revisedDays: [after],
  });
  const result = validateCoachRevisionDiff({ before, proposal: p });

  eq('validator passes', result.status, 'valid');
  ok('strength items changed', result.diff.dateDiffs[0].itemDiffs.some((entry) => entry.kind === 'changed' && entry.sectionKind === 'strength'));
}

section('[9] malformed proposal fails schema validation');
{
  const parsed = parseCoachRevisionProposal({
    schemaVersion: COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
    kind: 'revision',
    confidence: 0.8,
    revisedDays: [{ date: 'not-a-date', workout: {} }],
  });

  eq('parse fails', parsed.ok, false);
  ok('issues returned', parsed.issues.length > 0, parsed.issues);
}

section('[10] empty shell rejected');
{
  const before = snapshot([visibleDay(MON, mixedWorkout())]);
  const after = clone(daySnap(before, MON));
  after.workout = {
    id: 'empty-shell',
    title: 'Easy Aerobic Flush',
    workoutType: 'Conditioning',
    sections: [],
  };
  const p = proposal({
    intent: { intent: 'remove', targetDomain: 'conditioning', actionScope: 'conditioning_section' },
    dates: [MON],
    revisedDays: [after],
  });
  const result = validateCoachRevisionDiff({ before, proposal: p });

  eq('validator fails', result.status, 'invalid');
  ok('empty shell flagged', result.issues.some((entry) => entry.code === 'empty_workout_shell'));
}

console.log(`\ncoachRevisionProposalTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
