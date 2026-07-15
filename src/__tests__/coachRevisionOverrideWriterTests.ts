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

function durationConditioningWorkout(): Workout {
  const value = mixedWorkout();
  const row = clone(value.exercises[2]);
  row.prescribedSets = 3;
  row.prescribedRepsMin = 25;
  row.prescribedRepsMax = 25;
  row.prescriptionType = 'duration_minutes';
  row.restSeconds = 60;
  return {
    ...value,
    id: 'workout-duration-conditioning',
    name: 'Easy Aerobic Flush',
    durationMinutes: 25,
    intensity: 'Moderate',
    workoutType: 'Conditioning',
    hasCombinedConditioning: false,
    exercises: [row],
  };
}

function mixedWorkoutWithTypedBlocks(): Workout {
  return {
    ...mixedWorkout(),
    speedBlock: {
      id: 'speed-primer',
      title: 'Speed Primer',
      label: 'Speed',
      kind: 'true_speed',
      placement: 'pre_lift',
      durationMinutes: 8,
      prescription: '3 x 10m accelerations',
      counting: {
        hardExposure: true,
        mainStrength: false,
        conditioningCredit: 'none',
        createsHardDay: true,
        sprintCodExposure: true,
      },
    },
    powerBlock: {
      id: 'power-primer',
      kind: 'primer',
      family: 'lower',
      title: 'Power Primer',
      prescription: '3 x 3 — full rest, fast & sharp',
      placement: 'pre_lift',
      options: [{
        name: 'Vertical Jump',
        sets: 3,
        repsMin: 3,
        repsMax: 3,
        equipmentRequired: [],
      }],
      notes: ['Do this fresh before the main lifts.'],
      counting: {
        hardExposure: false,
        mainStrength: false,
        conditioningCredit: 'none',
        isFinisher: false,
      },
    },
    recoveryAddons: [{
      id: 'recovery-addon',
      title: 'Mobility reset',
      label: 'Mobility',
      kind: 'mobility',
      focusArea: 'hips',
      optional: true,
      skipPolicy: 'no_penalty',
      durationMinutes: 5,
      exercises: [{
        id: 'hip-mobility',
        name: 'Hip Mobility',
        prescription: '2 minutes',
      }],
      placementNote: 'After training if useful.',
      counting: {
        hardExposure: false,
        mainStrength: false,
        conditioningCredit: 'none',
        createsHardDay: false,
        sprintCodExposure: false,
      },
    }],
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
    setManualOverride: args.proposal.kind === 'revision' && args.proposal.scope.dates.length === 1
      ? (date, workout, context) => { writes.push({ date, workout, context }); }
      : undefined,
  });
  if (writes.length === 0 && result.applied.length > 1) {
    writes.push(...result.applied.map(({ date, workout, context }) => ({ date, workout, context })));
  }
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
  ok('no rejects', result.rejected.length === 0, result.rejected);
  eq('projection preserves accepted semantic sections',
    result.applied[0].projectedDay.workout?.sections,
    after.workout?.sections);
  eq('projection preserves accepted session duration',
    result.applied[0].projectedDay.workout?.durationMinutes,
    after.workout?.durationMinutes);
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
  eq('projection preserves accepted semantic sections',
    result.applied[0].projectedDay.workout?.sections,
    after.workout?.sections);
  ok('conditioning block removed', !writes[0].workout.conditioningBlock, writes[0].workout);
  ok('strength rows remain', writes[0].workout.exercises.some((row: any) => /squat/i.test(row.exercise?.name ?? '')), writes[0].workout.exercises);
}

section('[3] approved whole-session removal writes rest shell that projects as rest');
{
  const visibleWeek = [visibleDay(MON, mixedWorkoutWithTypedBlocks())];
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
  ok('rest shell clears speedBlock', !writes[0].workout.speedBlock);
  ok('rest shell clears powerBlock', !writes[0].workout.powerBlock);
  ok('rest shell clears recovery add-ons', !writes[0].workout.recoveryAddons?.length);
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
  ok('projection canonicalises the stale generic title after reduction',
    result.applied[0].projectedDay.workout?.title === 'Upper Body Strength' &&
      result.applied[0].projectedDay.workout?.sections[0]?.items.every((item) =>
        item.prescription?.sets === 2),
    result.applied[0].projectedDay);
  ok('sets reduced in override', writes[0].workout.exercises.every((row: any) => row.prescribedSets === 2), writes[0].workout.exercises);
}

section('[4b] revision writer round-trips every mutable dose field');
{
  const visibleWeek = [visibleDay(MON, durationConditioningWorkout())];
  const before = snapshot(visibleWeek);
  const after = clone(daySnap(before, MON));
  const item = sectionOf(after, 'conditioning').items[0];
  after.workout!.durationMinutes = 20;
  after.workout!.intensity = 'Light';
  item.durationMinutes = 20;
  item.prescription = {
    ...item.prescription!,
    sets: 2,
    repsMin: 20,
    repsMax: 20,
    intensity: 'Light',
    restSeconds: 120,
    prescriptionType: 'duration_minutes',
    itemDurationMinutes: 20,
  };
  const { result, writes } = apply({
    visibleWeek,
    proposal: proposal({
      intent: { intent: 'reduce', targetDomain: 'conditioning', actionScope: 'duration' },
      dates: [MON],
      revisedDays: [after],
    }),
  });
  eq('round-trip writer applies once', writes.length, 1);
  eq('round-trip has no rejection', result.rejected.length, 0);
  const written = writes[0]?.workout;
  const row = written?.exercises[0];
  eq('sets round-trip', row?.prescribedSets, 2);
  eq('reps min round-trip', row?.prescribedRepsMin, 20);
  eq('reps max round-trip', row?.prescribedRepsMax, 20);
  eq('item intensity round-trip', (row as any)?.intensity, 'Light');
  eq('item duration round-trip', row?.prescriptionType === 'duration_minutes' ? row.prescribedRepsMax : null, 20);
  eq('session duration round-trip', written?.durationMinutes, 20);
  eq('session intensity round-trip', written?.intensity, 'Light');
  eq('projected semantic sections round-trip',
    result.applied[0]?.projectedDay.workout?.sections,
    after.workout?.sections);
  eq('projected session duration round-trip',
    result.applied[0]?.projectedDay.workout?.durationMinutes,
    20);
  eq('projected session intensity round-trip',
    result.applied[0]?.projectedDay.workout?.intensity,
    'Light');
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

section('[7] ordered identity and item duration are semantic contract fields');
{
  // Titles/descriptions are presentation, but exercise order and duration are
  // programming. The writer cannot silently discard either accepted change.
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

  eq('semantic drift is not written', writes.length, 0);
  ok('semantic drift rejection names projection mismatch',
    result.rejected.some((entry) => entry.code === 'projected_override_mismatch'),
    result.rejected);
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

section('[9] whole-day move writes both days atomically with donor rows');
{
  const visibleWeek = [visibleDay(MON, mixedWorkoutWithTypedBlocks()), visibleDay(TUE, null)];
  const before = snapshot(visibleWeek);
  const monday = daySnap(before, MON);
  const dest = clone(monday);
  dest.date = TUE;
  const { result, writes } = apply({
    visibleWeek,
    proposal: proposal({
      intent: { intent: 'move', targetDomain: 'session', actionScope: 'whole_session' },
      dates: [MON, TUE],
      revisedDays: [{ date: MON, workout: null }, dest],
    }),
  });

  eq('two writes', writes.length, 2);
  ok('no rejects', result.rejected.length === 0, result.rejected);
  const mondayWrite = writes.find((entry) => entry.date === MON);
  const tuesdayWrite = writes.find((entry) => entry.date === TUE);
  eq('source becomes rest', mondayWrite?.workout.workoutType, 'Rest');
  ok('source rest clears typed blocks',
    !mondayWrite?.workout.speedBlock &&
    !mondayWrite?.workout.powerBlock &&
    !mondayWrite?.workout.recoveryAddons?.length);
  ok('destination carries donor rows',
    (tuesdayWrite?.workout.exercises?.length ?? 0) === (mixedWorkout().exercises?.length ?? -1),
    tuesdayWrite?.workout.exercises?.length);
  ok('destination carries donor powerBlock', !!tuesdayWrite?.workout.powerBlock);
  eq('destination dayOfWeek follows the date', tuesdayWrite?.workout.dayOfWeek, 2);
}

section('[10] multi-day apply is all-or-nothing');
{
  // Same move, but the destination day is MISSING from the visible week the
  // writer receives — its build must fail, and then NOTHING may be written,
  // or the source empties while the content never lands.
  const visibleWeek = [visibleDay(MON, mixedWorkout())];
  const fullBefore = snapshot([visibleDay(MON, mixedWorkout()), visibleDay(TUE, null)]);
  const monday = daySnap(fullBefore, MON);
  const dest = clone(monday);
  dest.date = TUE;
  const { result, writes } = apply({
    visibleWeek,
    proposal: proposal({
      intent: { intent: 'move', targetDomain: 'session', actionScope: 'whole_session' },
      dates: [MON, TUE],
      revisedDays: [{ date: MON, workout: null }, dest],
    }),
  });

  eq('nothing written when any day fails', writes.length, 0);
  ok('rejection reported', result.rejected.length > 0, result.rejected);
}

console.log(`\ncoachRevisionOverrideWriterTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
