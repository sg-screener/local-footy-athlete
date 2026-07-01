/**
 * coachRevisionOverrideWriterTests — Stage 4A-3 date-level override writer.
 *
 * These tests apply approved CoachRevisionProposal snapshots through an
 * injected setManualOverride function only. There is no CoachScreen wiring.
 *
 * Run: ./node_modules/.bin/sucrase-node src/__tests__/coachRevisionOverrideWriterTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { OverrideContext, Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import {
  COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
  buildCoachRevisionWeekSnapshotFromProjectedDays,
  type CoachRevisionIntent,
  type CoachRevisionProposal,
  type CoachVisibleDaySnapshot,
  type CoachVisibleSectionSnapshot,
  type CoachVisibleWeekSnapshot,
} from '../utils/coachRevisionProposal';
import {
  applyCoachRevisionDateOverrides,
} from '../utils/coachRevisionOverrideWriter';

const MON = '2026-07-06';
const TUE = '2026-07-07';
const TODAY = '2026-07-01';

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

function ex(name: string, id: string, sets = 3): any {
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
      ex('Back Squat', 'strength-squat', 4),
      ex('Romanian Deadlift', 'strength-rdl', 3),
      ex('25min zone 2 bike', 'conditioning-bike', 1),
    ],
    createdAt: '',
    updatedAt: '',
  };
}

function strengthWorkout(): Workout {
  return {
    id: 'workout-tuesday-strength',
    microcycleId: 'mc',
    dayOfWeek: 2,
    name: 'Upper Strength',
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [
      ex('Bench Press', 'bench-press', 4),
      ex('Pull Up', 'pull-up', 3),
    ],
    createdAt: '',
    updatedAt: '',
  };
}

function visibleDay(date: string, workout: Workout | null): ResolvedDay {
  return {
    date,
    dayOfWeek: date === MON ? 1 : 2,
    short: date === MON ? 'MON' : 'TUE',
    isToday: false,
    workout,
    source: workout ? 'template' : 'rest',
    indicator: null,
  } as any;
}

function snapshot(days: ResolvedDay[]): CoachVisibleWeekSnapshot {
  return buildCoachRevisionWeekSnapshotFromProjectedDays(days);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function daySnap(week: CoachVisibleWeekSnapshot, date: string): CoachVisibleDaySnapshot {
  const found = week.days.find((day) => day.date === date);
  if (!found) throw new Error(`Missing ${date}`);
  return found;
}

function sectionOf(day: CoachVisibleDaySnapshot, kind: string): CoachVisibleSectionSnapshot {
  const found = day.workout?.sections.find((section) => section.kind === kind);
  if (!found) throw new Error(`Missing ${kind}`);
  return found;
}

function proposal(args: {
  intent: Pick<CoachRevisionIntent, 'intent' | 'targetDomain' | 'actionScope'>;
  dates: string[];
  revisedDays: CoachVisibleDaySnapshot[];
  protectedRefs?: string[];
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
      reason: 'writer_test',
    },
    scope: { mode: 'single_day', dates: args.dates },
    revisedDays: args.revisedDays,
    explanation: 'writer_test',
  };
}

function apply(args: {
  proposal: CoachRevisionProposal;
  visibleWeek: ResolvedDay[];
}) {
  const writes: Array<{ date: string; workout: Workout; context?: OverrideContext }> = [];
  const result = applyCoachRevisionDateOverrides({
    proposal: args.proposal,
    visibleWeek: args.visibleWeek,
    todayISO: TODAY,
    setManualOverride(date, workout, context) {
      writes.push({ date, workout, context });
    },
  });
  return { result, writes };
}

section('[1] approved strength removal writes conditioning-only override');
{
  const visibleWeek = [visibleDay(MON, mixedWorkout())];
  const before = snapshot(visibleWeek);
  const monday = daySnap(before, MON);
  const conditioning = sectionOf(monday, 'conditioning');
  const after = clone(monday);
  after.workout!.title = conditioning.title;
  after.workout!.workoutType = 'Conditioning';
  after.workout!.sections = [conditioning];
  const { result, writes } = apply({
    visibleWeek,
    proposal: proposal({
      intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
      dates: [MON],
      revisedDays: [after],
      protectedRefs: [conditioning.id],
    }),
  });

  eq('one write', writes.length, 1);
  eq('no rejects', result.rejected.length, 0);
  eq('projection matches accepted revision', result.applied[0].projectedDay, after);
  ok('override keeps conditioning block', !!writes[0].workout.conditioningBlock?.options.length, writes[0].workout);
  ok('override removes strength rows', !writes[0].workout.exercises.some((row: any) => /squat|deadlift/i.test(row.exercise?.name ?? '')), writes[0].workout.exercises);
}

section('[2] approved conditioning removal writes strength-only override');
{
  const visibleWeek = [visibleDay(MON, mixedWorkout())];
  const before = snapshot(visibleWeek);
  const monday = daySnap(before, MON);
  const strength = sectionOf(monday, 'strength');
  const after = clone(monday);
  after.workout!.sections = [strength];
  const { result, writes } = apply({
    visibleWeek,
    proposal: proposal({
      intent: { intent: 'remove', targetDomain: 'conditioning', actionScope: 'conditioning_section' },
      dates: [MON],
      revisedDays: [after],
      protectedRefs: [strength.id],
    }),
  });

  eq('one write', writes.length, 1);
  eq('no rejects', result.rejected.length, 0);
  eq('projection matches accepted revision', result.applied[0].projectedDay, after);
  ok('conditioning block removed', !writes[0].workout.conditioningBlock, writes[0].workout);
  ok('strength rows remain', writes[0].workout.exercises.some((row: any) => /squat/i.test(row.exercise?.name ?? '')), writes[0].workout.exercises);
}

section('[3] approved whole-session removal writes rest shell that projects as rest');
{
  const visibleWeek = [visibleDay(MON, mixedWorkout())];
  const before = snapshot(visibleWeek);
  const after = clone(daySnap(before, MON));
  after.workout = null;
  const { result, writes } = apply({
    visibleWeek,
    proposal: proposal({
      intent: { intent: 'remove', targetDomain: 'session', actionScope: 'whole_session' },
      dates: [MON],
      revisedDays: [after],
    }),
  });

  eq('one write', writes.length, 1);
  eq('rest shell written', writes[0].workout.name, 'Rest');
  eq('projection matches accepted rest revision', result.applied[0].projectedDay, after);
}

section('[4] approved conservative reduction writes reduced prescription');
{
  const visibleWeek = [visibleDay(TUE, strengthWorkout())];
  const before = snapshot(visibleWeek);
  const after = clone(daySnap(before, TUE));
  for (const item of sectionOf(after, 'strength').items) {
    if (item.prescription) item.prescription.sets = 2;
  }
  const { result, writes } = apply({
    visibleWeek,
    proposal: proposal({
      intent: { intent: 'reduce', targetDomain: 'strength', actionScope: 'strength_section' },
      dates: [TUE],
      revisedDays: [after],
    }),
  });

  eq('one write', writes.length, 1);
  eq('no rejects', result.rejected.length, 0);
  eq('projection matches accepted reduction', result.applied[0].projectedDay, after);
  ok('sets reduced in override', writes[0].workout.exercises.every((row: any) => row.prescribedSets === 2), writes[0].workout.exercises);
}

section('[5] invalid protected violation does not write');
{
  const visibleWeek = [visibleDay(MON, mixedWorkout())];
  const before = snapshot(visibleWeek);
  const monday = daySnap(before, MON);
  const conditioning = sectionOf(monday, 'conditioning');
  const after = clone(monday);
  after.workout!.sections = [sectionOf(monday, 'strength')];
  const { result, writes } = apply({
    visibleWeek,
    proposal: proposal({
      intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
      dates: [MON],
      revisedDays: [after],
      protectedRefs: [conditioning.id],
    }),
  });

  eq('no writes', writes.length, 0);
  ok('rejects protected violation', result.rejected.some((entry) => entry.code === 'protected_ref_changed'), result);
}

section('[6] unknown added IDs do not write');
{
  const visibleWeek = [visibleDay(MON, mixedWorkout())];
  const before = snapshot(visibleWeek);
  const after = clone(daySnap(before, MON));
  after.workout!.sections.push({
    id: 'section:hidden',
    kind: 'conditioning',
    title: 'Hidden',
    items: [{
      id: 'item:hidden',
      title: 'Hidden',
      domain: 'conditioning',
      source: 'conditioning_option',
      description: null,
      exerciseIds: [],
      durationMinutes: 20,
      prescription: null,
    }],
  });
  const { result, writes } = apply({
    visibleWeek,
    proposal: proposal({
      intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
      dates: [MON],
      revisedDays: [after],
    }),
  });

  eq('no writes', writes.length, 0);
  ok('rejects unknown id', result.rejected.some((entry) => entry.code === 'unknown_section_id'), result);
}

section('[7] app-derived presentation drift does not reject the contract');
{
  // The projection recomputes descriptions/durations/ordering after an edit.
  // The LLM cannot predict those derivations; only the change CONTRACT
  // (item identity + prescriptions + section kinds) must round-trip.
  const visibleWeek = [visibleDay(TUE, strengthWorkout())];
  const before = snapshot(visibleWeek);
  const after = clone(daySnap(before, TUE));
  const strength = sectionOf(after, 'strength');
  for (const item of strength.items) {
    if (item.prescription) item.prescription.sets = 2;
  }
  // Presentation drift the echo can't predict:
  strength.title = 'Strength (model-renamed)';
  strength.items.reverse();
  for (const item of strength.items) {
    item.description = 'model paraphrased this description';
    item.durationMinutes = 5;
  }
  const { result, writes } = apply({
    visibleWeek,
    proposal: proposal({
      intent: { intent: 'reduce', targetDomain: 'strength', actionScope: 'strength_section' },
      dates: [TUE],
      revisedDays: [after],
    }),
  });

  eq('one write despite presentation drift', writes.length, 1);
  eq('no rejects despite presentation drift', result.rejected.length, 0);
  ok('sets reduced in override',
    writes[0].workout.exercises.every((row: any) => row.prescribedSets === 2),
    writes[0].workout.exercises);
}

section('[8] contract violations still reject, and the reason names the divergence');
{
  // Accepted revision keeps an item the writer cannot actually produce
  // (its exerciseIds no longer reference any source exercise), so the
  // projected override loses it. That IS a contract breach — reject, and
  // say exactly where the projected day diverges from the accepted one.
  const visibleWeek = [visibleDay(TUE, strengthWorkout())];
  const before = snapshot(visibleWeek);
  const after = clone(daySnap(before, TUE));
  const strength = sectionOf(after, 'strength');
  for (const item of strength.items) {
    if (item.prescription) item.prescription.sets = 2;
  }
  strength.items[0].exerciseIds = ['ghost-exercise-id'];
  const { result, writes } = apply({
    visibleWeek,
    proposal: proposal({
      intent: { intent: 'reduce', targetDomain: 'strength', actionScope: 'strength_section' },
      dates: [TUE],
      revisedDays: [after],
    }),
  });

  eq('no writes on contract breach', writes.length, 0);
  ok('rejected as projected_override_mismatch',
    result.rejected.some((entry) => entry.code === 'projected_override_mismatch'),
    result.rejected);
  ok('reason names the divergence',
    result.rejected.some((entry) => entry.reason.includes('Contract divergence')),
    result.rejected);
}

console.log(`\ncoachRevisionOverrideWriterTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
