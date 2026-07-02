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
  // Adds must be authorized by app-side policy; the proposal's own
  // allowedAddedSectionKinds is not authorization (see [7b]).
  const result = validateCoachRevisionDiff({
    before,
    proposal: p,
    policy: { allowedAddedSectionKinds: ['conditioning'] },
  });

  eq('requires confirmation', result.status, 'needs_confirmation');
  ok('classified as replace/remove+add', result.diff.dateDiffs[0].sectionDiffs.some((entry) => entry.kind === 'removed' && entry.sectionKind === 'session'));
  ok('conditioning addition visible', result.diff.dateDiffs[0].sectionDiffs.some((entry) => entry.kind === 'added' && entry.sectionKind === 'conditioning'));

  section('[7b] proposal cannot self-authorize adds');
  {
    // Same proposal, but WITHOUT app-side policy: the LLM-supplied
    // userIntent.allowedAddedSectionKinds must not grant authorization.
    const selfAuthorized = validateCoachRevisionDiff({ before, proposal: p });
    eq('self-authorized add rejected', selfAuthorized.status, 'invalid');
    ok('unknown_section_id issue reported',
      selfAuthorized.issues.some((entry) => entry.code === 'unknown_section_id'),
      selfAuthorized.issues);
  }

  section('[7c] forged item into existing section is caught even alongside an authorized section add');
  {
    // Policy allows conditioning section adds. Proposal adds a conditioning
    // section AND injects a forged item into the EXISTING strength section.
    // Before the fix, any section add on the date skipped all item checks.
    const mixedBefore = snapshot([visibleDay(TUE, mixedWorkout())]);
    const mixedDay = daySnap(mixedBefore, TUE);
    const forged = clone(mixedDay);
    sectionOf(forged, 'strength').items.push({
      id: 'item:forged:extra-squat',
      title: 'Extra Back Squat',
      domain: 'strength',
      source: 'strength_exercise',
      description: null,
      exerciseIds: [],
      durationMinutes: 0,
      prescription: { sets: 5, repsMin: 5, repsMax: 5, intensity: null },
    });
    forged.workout!.sections.push({
      id: 'section:tuesday:extra-conditioning',
      kind: 'conditioning',
      title: 'Extra Conditioning',
      items: [{
        id: 'item:tuesday:extra-conditioning',
        title: '20min zone 2 row',
        domain: 'conditioning',
        source: 'conditioning_option',
        description: null,
        exerciseIds: [],
        durationMinutes: 20,
        prescription: null,
      }],
    });
    const forgedProposal = proposal({
      intent: { intent: 'add', targetDomain: 'conditioning', actionScope: 'conditioning_section' },
      dates: [TUE],
      revisedDays: [forged],
      requiresConfirmation: true,
    });
    const result = validateCoachRevisionDiff({
      before: mixedBefore,
      proposal: forgedProposal,
      policy: { allowedAddedSectionKinds: ['conditioning'] },
    });
    eq('forged item rejected', result.status, 'invalid');
    ok('unknown_item_id names the forged item',
      result.issues.some((entry) => entry.code === 'unknown_item_id' && entry.ref === 'item:forged:extra-squat'),
      result.issues);
  }
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

  section('[8b] nulling a populated prescription field is not a reduction');
  {
    const nulled = clone(daySnap(before, TUE));
    const strength = sectionOf(nulled, 'strength');
    strength.items[0].prescription!.repsMin = null;
    const p2 = proposal({
      intent: { intent: 'reduce', targetDomain: 'strength', actionScope: 'strength_section' },
      dates: [TUE],
      revisedDays: [nulled],
    });
    const result2 = validateCoachRevisionDiff({ before, proposal: p2 });
    eq('nullified field rejected', result2.status, 'invalid');
    ok('non_conservative_reduction issue',
      result2.issues.some((entry) => entry.code === 'non_conservative_reduction'),
      result2.issues);
  }

  section('[8d] whole-day reduce is valid when every change is conservative');
  {
    const mixedBefore = snapshot([visibleDay(TUE, mixedWorkout())]);
    const lighter = clone(daySnap(mixedBefore, TUE));
    for (const sectionSnap of lighter.workout!.sections) {
      for (const item of sectionSnap.items) {
        if (item.prescription?.sets != null) {
          item.prescription = { ...item.prescription, sets: Math.max(1, item.prescription.sets - 1) };
        }
      }
    }
    const pDay = proposal({
      intent: { intent: 'reduce', targetDomain: 'session', actionScope: 'session' },
      dates: [TUE],
      revisedDays: [lighter],
    });
    const resultDay = validateCoachRevisionDiff({ before: mixedBefore, proposal: pDay });
    eq('whole-day conservative reduce valid', resultDay.status, 'valid');
  }

  section('[8e] reduce is conservative everywhere, not just the labeled domain');
  {
    const mixedBefore = snapshot([visibleDay(TUE, mixedWorkout())]);
    const sneaky = clone(daySnap(mixedBefore, TUE));
    // Labeled strength reduce, but bumps a conditioning prescription UP.
    const strengthSection = sectionOf(sneaky, 'strength');
    strengthSection.items[0].prescription = {
      ...strengthSection.items[0].prescription!,
      sets: 2,
    };
    const conditioningSection = sectionOf(sneaky, 'conditioning');
    if (conditioningSection.items[0].prescription) {
      conditioningSection.items[0].prescription = {
        ...conditioningSection.items[0].prescription,
        sets: (conditioningSection.items[0].prescription.sets ?? 1) + 3,
      };
    } else {
      conditioningSection.items[0].prescription = { sets: 4, repsMin: 8, repsMax: 10, intensity: null };
    }
    const pSneaky = proposal({
      intent: { intent: 'reduce', targetDomain: 'strength', actionScope: 'strength_section' },
      dates: [TUE],
      revisedDays: [sneaky],
    });
    const resultSneaky = validateCoachRevisionDiff({ before: mixedBefore, proposal: pSneaky });
    eq('off-domain increase under reduce rejected', resultSneaky.status, 'invalid');
    ok('non_conservative issue raised',
      resultSneaky.issues.some((entry) => entry.code === 'non_conservative_reduction'),
      resultSneaky.issues);
  }

  section('[8c] dropping the whole prescription is not a reduction');
  {
    const dropped = clone(daySnap(before, TUE));
    const strength = sectionOf(dropped, 'strength');
    strength.items[0].prescription = null;
    const p3 = proposal({
      intent: { intent: 'reduce', targetDomain: 'strength', actionScope: 'strength_section' },
      dates: [TUE],
      revisedDays: [dropped],
    });
    const result3 = validateCoachRevisionDiff({ before, proposal: p3 });
    eq('dropped prescription rejected', result3.status, 'invalid');
    ok('non_conservative_reduction issue for dropped prescription',
      result3.issues.some((entry) => entry.code === 'non_conservative_reduction'),
      result3.issues);
  }
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

section('[10b] parse normalizes empty shells to canonical rest/null');
{
  const before = snapshot([visibleDay(MON, mixedWorkout())]);
  const monday = daySnap(before, MON);
  const shellDay = clone(monday);
  shellDay.workout = {
    id: monday.workout!.id,
    title: monday.workout!.title,
    workoutType: monday.workout!.workoutType,
    sections: [],
  };
  const parsed = parseCoachRevisionProposal(proposal({
    intent: { intent: 'remove', targetDomain: 'session', actionScope: 'whole_session' },
    dates: [MON],
    revisedDays: [shellDay],
  }));
  eq('shell proposal parses', parsed.ok, true);
  eq('empty shell normalized to null workout',
    parsed.proposal?.kind === 'revision' ? parsed.proposal.revisedDays[0].workout : 'unparsed',
    null);

  // Empty SECTION among non-empty ones is dropped, not fatal.
  const partialShell = clone(monday);
  const strengthSection = sectionOf(partialShell, 'strength');
  strengthSection.items = [];
  const parsedPartial = parseCoachRevisionProposal(proposal({
    intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
    dates: [MON],
    revisedDays: [partialShell],
  }));
  eq('partial shell parses', parsedPartial.ok, true);
  ok('empty section dropped, conditioning kept',
    parsedPartial.proposal?.kind === 'revision' &&
      parsedPartial.proposal.revisedDays[0].workout?.sections.length === 1 &&
      parsedPartial.proposal.revisedDays[0].workout?.sections[0].kind === 'conditioning',
    parsedPartial.proposal);
}

section('[10c] combined team day exposes the team-training portion as a session section');
{
  // Live 3A gap: "Team Training + Upper Pull" days only surfaced strength —
  // the team commitment had NO representation, so "only strength" edits had
  // nothing to remove. The snapshot must show every removable commitment.
  const teamPlusLift: Workout = {
    ...strengthOnlyWorkout('workout-tue-team-pull'),
    name: 'Team Training + Upper Pull',
    workoutType: 'Team Training',
    dayOfWeek: 2,
  };
  const before = snapshot([visibleDay(TUE, teamPlusLift)]);
  const tuesday = daySnap(before, TUE);
  const kinds = tuesday.workout!.sections.map((sectionSnap) => sectionSnap.kind);
  ok('strength section present', kinds.includes('strength'), kinds);
  ok('session section present alongside strength', kinds.includes('session'), kinds);
  const sessionSection = tuesday.workout!.sections.find((s) => s.kind === 'session');
  eq('session item id is the workout id (round-trips to pure-day projection)',
    sessionSection?.items[0]?.id,
    'workout-tue-team-pull');
}

section('[10d] optional-tier day in current week projects into the snapshot');
{
  // Live Friday sample refused with no_visible_diff — lock in that optional
  // tier days DO reach the snapshot with their content (model noise vs gap).
  const gunshow: Workout = {
    ...strengthOnlyWorkout('workout-fri-gunshow'),
    name: 'Gunshow',
    dayOfWeek: 5,
    sessionTier: 'optional' as any,
  };
  const before = snapshot([visibleDay(WED, gunshow)]);
  const day = daySnap(before, WED);
  ok('optional day has a workout in snapshot', !!day.workout, day);
  ok('optional day strength items present',
    (day.workout?.sections.find((s) => s.kind === 'strength')?.items.length ?? 0) > 0,
    day.workout?.sections);
}

section('[13] move conservation: relocated content must arrive exactly');
{
  const before = snapshot([visibleDay(MON, mixedWorkout()), visibleDay(WED, null)]);
  const monday = daySnap(before, MON);

  const movedDay = (mutate?: (day: CoachVisibleDaySnapshot) => void): CoachVisibleDaySnapshot[] => {
    const source: CoachVisibleDaySnapshot = { date: MON, workout: null };
    const dest = clone(monday);
    dest.date = WED;
    mutate?.(dest);
    return [source, dest];
  };
  const moveProposal = (revisedDays: CoachVisibleDaySnapshot[]) => proposal({
    intent: { intent: 'move', targetDomain: 'session', actionScope: 'whole_session' },
    dates: [MON, WED],
    revisedDays,
  });

  const valid = validateCoachRevisionDiff({ before, proposal: moveProposal(movedDay()) });
  eq('whole-day move onto rest day is valid', valid.status, 'valid');

  const lost = movedDay((day) => {
    const strength = sectionOf(day, 'strength');
    strength.items = strength.items.slice(1);
  });
  const lostResult = validateCoachRevisionDiff({ before, proposal: moveProposal(lost) });
  eq('losing an item in transit rejected', lostResult.status, 'invalid');
  ok('move_lost_content named',
    lostResult.issues.some((entry) => entry.code === 'move_lost_content'),
    lostResult.issues);

  const mutated = movedDay((day) => {
    const strength = sectionOf(day, 'strength');
    strength.items[0].prescription = { ...strength.items[0].prescription!, sets: 1 };
  });
  const mutatedResult = validateCoachRevisionDiff({ before, proposal: moveProposal(mutated) });
  eq('mutating content in transit rejected', mutatedResult.status, 'invalid');
  ok('move_changed_content named',
    mutatedResult.issues.some((entry) => entry.code === 'move_changed_content'),
    mutatedResult.issues);

  const invented = movedDay((day) => {
    sectionOf(day, 'strength').items.push({
      id: 'item:invented:on-the-way',
      title: 'Invented Curl',
      domain: 'strength',
      source: 'strength_exercise',
      description: null,
      exerciseIds: [],
      durationMinutes: null,
      prescription: { sets: 3, repsMin: 10, repsMax: 12, intensity: null },
    });
  });
  const inventedResult = validateCoachRevisionDiff({ before, proposal: moveProposal(invented) });
  eq('inventing content in transit rejected', inventedResult.status, 'invalid');
  ok('move_invented_content named',
    inventedResult.issues.some((entry) => entry.code === 'move_invented_content'),
    inventedResult.issues);

  // Destination already occupied (v1 unsupported): move Monday onto a day
  // holding team training.
  const occupiedBefore = snapshot([
    visibleDay(MON, mixedWorkout()),
    visibleDay(TUE, teamTrainingWorkout()),
  ]);
  const occupiedMonday = daySnap(occupiedBefore, MON);
  const occupiedDest = clone(occupiedMonday);
  occupiedDest.date = TUE;
  // Merge shape: destination keeps its own section plus arrivals.
  occupiedDest.workout!.sections = [
    ...clone(daySnap(occupiedBefore, TUE)).workout!.sections,
    ...occupiedDest.workout!.sections,
  ];
  const occupiedResult = validateCoachRevisionDiff({
    before: occupiedBefore,
    proposal: proposal({
      intent: { intent: 'move', targetDomain: 'session', actionScope: 'whole_session' },
      dates: [MON, TUE],
      revisedDays: [{ date: MON, workout: null }, occupiedDest],
    }),
  });
  eq('move onto occupied day rejected (v1)', occupiedResult.status, 'invalid');
  ok('move_destination_occupied named',
    occupiedResult.issues.some((entry) => entry.code === 'move_destination_occupied'),
    occupiedResult.issues);
}

section('[14] replace is label-agnostic: any domain label validates structurally');
{
  const { buildCoachRevisionTemplateSection } = require('../utils/coachRevisionTemplates');
  const { coachRevisionSectionBodySignature } = require('../utils/coachRevisionProposal');
  const templateSection = buildCoachRevisionTemplateSection('easy_zone2_bike', MON);
  const before = snapshot([visibleDay(MON, strengthOnlyWorkout('workout-mon-gunshow'))]);
  // Live 2026-07-02: the model labeled a swap targetDomain 'session' on a
  // strength-only day and the old label matching refused a valid proposal.
  const p = proposal({
    intent: { intent: 'replace', targetDomain: 'session', actionScope: 'session' },
    dates: [MON],
    revisedDays: [{
      date: MON,
      workout: {
        id: 'template-easy_zone2_bike',
        title: 'Easy Zone 2 Bike',
        workoutType: 'Conditioning',
        sections: [templateSection],
      },
    }],
    allowedAddedSectionKinds: ['conditioning'],
    requiresConfirmation: true,
  });
  const result = validateCoachRevisionDiff({
    before,
    proposal: p,
    policy: {
      allowedTemplateSectionSignatures: [coachRevisionSectionBodySignature(templateSection)],
      allowedAddedSectionKinds: [],
    },
  });
  eq('session-labeled swap on strength day needs confirmation (not invalid)',
    result.status,
    'needs_confirmation');
}

section('[15] all registry templates round-trip and self-identify');
{
  const { listCoachRevisionTemplates, buildCoachRevisionTemplateSection, templateIdFromRevisedWorkout } =
    require('../utils/coachRevisionTemplates');
  for (const template of listCoachRevisionTemplates()) {
    const section = buildCoachRevisionTemplateSection(template.templateId, MON);
    ok(`${template.templateId} builds a section`, !!section, template.templateId);
    eq(`${template.templateId} recovers its id from a revised workout`,
      templateIdFromRevisedWorkout({ sections: [section] }),
      template.templateId);
  }
}

section('[16] work-capacity templates are bye-week gated');
{
  const {
    buildCoachRevisionTemplateSection,
  } = require('../utils/coachRevisionTemplates');
  const { coachRevisionSectionBodySignature } = require('../utils/coachRevisionProposal');
  const emomSection = buildCoachRevisionTemplateSection('erg_emom', TUE);
  const flushSection = buildCoachRevisionTemplateSection('flushout_3030', TUE);
  const before = snapshot([visibleDay(TUE, strengthOnlyWorkout('workout-tue-gunshow'))]);
  const emomProposal = (section: any) => proposal({
    intent: { intent: 'replace', targetDomain: 'strength', actionScope: 'session' },
    dates: [TUE],
    revisedDays: [{
      date: TUE,
      workout: {
        id: `template-${section === emomSection ? 'erg_emom' : 'flushout_3030'}`,
        title: section.title,
        workoutType: 'Conditioning',
        sections: [section],
      },
    }],
    allowedAddedSectionKinds: ['conditioning'],
    requiresConfirmation: true,
  });
  const policyBase = {
    allowedAddedSectionKinds: [] as any,
    allowedTemplateSectionSignatures: [coachRevisionSectionBodySignature(flushSection)],
    byeOnlyTemplateSectionSignatures: [coachRevisionSectionBodySignature(emomSection)],
  };

  // Game week: TUE not bye-unlocked → EMOM refused with the named issue.
  const gameWeek = validateCoachRevisionDiff({
    before,
    proposal: emomProposal(emomSection),
    policy: { ...policyBase, byeUnlockedDates: [] },
  });
  eq('EMOM on a game week is invalid', gameWeek.status, 'invalid');
  ok('bye-only issue named',
    gameWeek.issues.some((entry) => entry.code === 'template_bye_week_only'),
    gameWeek.issues);

  // Bye week: same proposal allowed (needs confirmation as usual).
  const byeWeek = validateCoachRevisionDiff({
    before,
    proposal: emomProposal(emomSection),
    policy: { ...policyBase, byeUnlockedDates: [TUE] },
  });
  eq('EMOM on a bye week needs confirmation', byeWeek.status, 'needs_confirmation');

  // Flush-outs are fine on game weeks.
  const flushGameWeek = validateCoachRevisionDiff({
    before,
    proposal: emomProposal(flushSection),
    policy: { ...policyBase, byeUnlockedDates: [] },
  });
  eq('flush-out on a game week needs confirmation (allowed)',
    flushGameWeek.status,
    'needs_confirmation');
}

section('[11] snapshot workout IDs are stable across renames when workout.id is set');
{
  const original = mixedWorkout();
  const renamed = clone(original);
  renamed.name = 'Lower Strength (renamed)';
  const beforeSnap = snapshot([visibleDay(MON, original)]);
  const afterSnap = snapshot([visibleDay(MON, renamed)]);
  eq('rename keeps workout id',
    daySnap(afterSnap, MON).workout?.id,
    daySnap(beforeSnap, MON).workout?.id);
}

section('[12] name-based fallback id is deterministic for identical inputs');
{
  const noId = mixedWorkout();
  (noId as any).id = '';
  const first = snapshot([visibleDay(MON, noId)]);
  const second = snapshot([visibleDay(MON, clone(noId))]);
  const firstId = daySnap(first, MON).workout?.id ?? '';
  eq('fallback ids match across rebuilds', daySnap(second, MON).workout?.id, firstId);
  ok('fallback id derives from date + name', firstId.startsWith(`workout:${MON}:`), firstId);
}

console.log(`\ncoachRevisionProposalTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
