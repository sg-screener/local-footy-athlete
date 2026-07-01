/**
 * semanticCoachRevisionProposalTests — Stage 4A-2 mocked semantic
 * CoachRevisionProposal harness.
 *
 * This does not wire CoachScreen, execute mutations, or write overrides.
 *
 * Run: ./node_modules/.bin/sucrase-node src/__tests__/semanticCoachRevisionProposalTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { Workout } from '../types/domain';
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
  MockSemanticCoachRevisionProposalAdapter,
  buildSemanticCoachRevisionProposal,
} from '../utils/semanticCoachRevisionProposal';

const MON = '2026-07-06';
const TUE = '2026-07-07';

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
      workoutExercise('25min zone 2 bike', 'conditioning-bike', 1),
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
      workoutExercise('Bench Press', 'bench-press', 4),
      workoutExercise('Pull Up', 'pull-up', 3),
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
  if (!found) throw new Error(`Missing ${kind} on ${day.date}`);
  return found;
}

function revision(args: {
  intent: Pick<CoachRevisionIntent, 'intent' | 'targetDomain' | 'actionScope'>;
  dates: string[];
  revisedDays: CoachVisibleDaySnapshot[];
  protectedRefs?: string[];
  allowedAddedSectionKinds?: CoachRevisionIntent['allowedAddedSectionKinds'];
  requiresConfirmation?: boolean;
  confidence?: number;
}): CoachRevisionProposal {
  const userIntent: CoachRevisionIntent = {
    intent: args.intent.intent,
    targetDomain: args.intent.targetDomain,
    actionScope: args.intent.actionScope,
    targetDates: args.dates,
    protectedRefs: args.protectedRefs ?? [],
    reason: 'semantic_revision_test',
  };
  if (args.allowedAddedSectionKinds) {
    userIntent.allowedAddedSectionKinds = args.allowedAddedSectionKinds;
  }
  if (args.requiresConfirmation !== undefined) {
    userIntent.requiresConfirmation = args.requiresConfirmation;
  }
  return {
    schemaVersion: COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
    kind: 'revision',
    source: 'semantic',
    confidence: args.confidence ?? 0.92,
    userIntent,
    scope: {
      mode: args.dates.length === 1 ? 'single_day' : 'visible_week',
      dates: args.dates,
    },
    revisedDays: args.revisedDays,
    explanation: 'semantic_revision_test',
  };
}

async function semanticResult(args: {
  before: CoachVisibleWeekSnapshot;
  message: string;
  output: unknown;
  validationPolicy?: Parameters<typeof buildSemanticCoachRevisionProposal>[0]['validationPolicy'];
}) {
  return buildSemanticCoachRevisionProposal({
    userMessage: args.message,
    visibleSnapshot: args.before,
    adapter: new MockSemanticCoachRevisionProposalAdapter(args.output),
    todayISO: '2026-07-01',
    nowISO: '2026-07-01T12:00:00.000Z',
    timezone: 'Australia/Melbourne',
    validationPolicy: args.validationPolicy,
  });
}

async function run() {
  section('[1] drop lower work Monday but keep the flush');
  {
    const before = snapshot([visibleDay(MON, mixedWorkout())]);
    const monday = daySnap(before, MON);
    const conditioning = sectionOf(monday, 'conditioning');
    const after = clone(monday);
    after.workout!.title = conditioning.title;
    after.workout!.workoutType = 'Conditioning';
    after.workout!.sections = [conditioning];
    const result = await semanticResult({
      before,
      message: 'drop lower work Monday but keep the flush',
      output: revision({
        intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
        dates: [MON],
        revisedDays: [after],
        protectedRefs: [conditioning.id],
      }),
    });
    eq('result is valid revision', result.kind, 'revision');
    ok('strength removed', result.kind === 'revision' && result.diagnostic.diffSummary[0].sectionsRemoved.some((item) => item.startsWith('strength:')), result);
    ok('conditioning protected', result.kind === 'revision' && result.diagnostic.protectedRefsPreserved.includes(conditioning.id), result);
  }

  section('[2] remove conditioning from Monday');
  {
    const before = snapshot([visibleDay(MON, mixedWorkout())]);
    const monday = daySnap(before, MON);
    const after = clone(monday);
    after.workout!.sections = [sectionOf(monday, 'strength')];
    const result = await semanticResult({
      before,
      message: 'remove conditioning from Monday',
      output: revision({
        intent: { intent: 'remove', targetDomain: 'conditioning', actionScope: 'conditioning_section' },
        dates: [MON],
        revisedDays: [after],
        protectedRefs: [sectionOf(monday, 'strength').id],
      }),
    });
    eq('result is valid revision', result.kind, 'revision');
    ok('conditioning removed', result.kind === 'revision' && result.diagnostic.diffSummary[0].sectionsRemoved.some((item) => item.startsWith('conditioning:')), result);
  }

  section('[3] remove everything Monday');
  {
    const before = snapshot([visibleDay(MON, mixedWorkout())]);
    const after = clone(daySnap(before, MON));
    after.workout = null;
    const result = await semanticResult({
      before,
      message: 'remove everything Monday',
      output: revision({
        intent: { intent: 'remove', targetDomain: 'session', actionScope: 'whole_session' },
        dates: [MON],
        revisedDays: [after],
      }),
    });
    eq('result is valid revision', result.kind, 'revision');
    ok('session removed', result.kind === 'revision' && result.diff.dateDiffs[0].workoutChange === 'removed', result);
  }

  section('[4] make tomorrow lighter');
  {
    const before = snapshot([visibleDay(TUE, strengthWorkout())]);
    const after = clone(daySnap(before, TUE));
    for (const item of sectionOf(after, 'strength').items) {
      if (item.prescription) item.prescription.sets = Math.max(1, (item.prescription.sets ?? 2) - 1);
    }
    const result = await semanticResult({
      before,
      message: 'make tomorrow lighter',
      output: revision({
        intent: { intent: 'reduce', targetDomain: 'strength', actionScope: 'strength_section' },
        dates: [TUE],
        revisedDays: [after],
      }),
    });
    eq('conservative reduction passes', result.kind, 'revision');
    ok('items changed conservatively', result.kind === 'revision' && result.diagnostic.diffSummary[0].itemsChanged.length > 0, result);
  }

  section('[5] replace team training tomorrow with easy bike');
  {
    const before = snapshot([visibleDay(TUE, teamTrainingWorkout())]);
    const after = clone(daySnap(before, TUE));
    after.workout = {
      id: 'revision-easy-bike',
      title: 'Easy Bike',
      workoutType: 'Conditioning',
      sections: [{
        id: 'section:tue:easy-bike',
        kind: 'conditioning',
        title: 'Easy Bike',
        items: [{
          id: 'item:tue:easy-bike',
          title: '25min zone 2 bike',
          domain: 'conditioning',
          source: 'conditioning_option',
          description: 'Easy aerobic bike',
          exerciseIds: [],
          durationMinutes: 25,
          prescription: null,
        }],
      }],
    };
    const replacementOutput = revision({
      intent: { intent: 'replace', targetDomain: 'session', actionScope: 'whole_session' },
      dates: [TUE],
      revisedDays: [after],
      allowedAddedSectionKinds: ['conditioning'],
      requiresConfirmation: true,
    });
    const result = await semanticResult({
      before,
      message: 'replace team training tomorrow with easy bike',
      output: replacementOutput,
      // Adds require app-side policy authorization (see [5b]).
      validationPolicy: { allowedAddedSectionKinds: ['conditioning'] },
    });
    eq('replacement needs confirmation', result.kind, 'needs_confirmation');
    ok('diagnostic flags confirmation', result.kind === 'needs_confirmation' && result.diagnostic.confirmationRequired, result);

    // [5b] Without app-side policy, the proposal's own
    // allowedAddedSectionKinds must NOT authorize the added section.
    const selfAuthorized = await semanticResult({
      before,
      message: 'replace team training tomorrow with easy bike',
      output: replacementOutput,
    });
    eq('self-authorized replacement rejected', selfAuthorized.kind, 'invalid');
    ok('unknown id diagnostic recorded',
      selfAuthorized.kind === 'invalid' && selfAuthorized.diagnostic.unknownIds.length > 0,
      selfAuthorized);
  }

  section('[6] protected violation fails');
  {
    const before = snapshot([visibleDay(MON, mixedWorkout())]);
    const monday = daySnap(before, MON);
    const after = clone(monday);
    after.workout!.sections = [sectionOf(monday, 'strength')];
    const result = await semanticResult({
      before,
      message: 'drop lower work Monday but keep the flush',
      output: revision({
        intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
        dates: [MON],
        revisedDays: [after],
        protectedRefs: [sectionOf(monday, 'conditioning').id],
      }),
    });
    eq('result invalid', result.kind, 'invalid');
    ok('protected violation diagnostic', result.kind === 'invalid' && result.diagnostic.protectedRefsViolated.length > 0, result);
  }

  section('[7] unknown ID invented fails');
  {
    const before = snapshot([visibleDay(MON, mixedWorkout())]);
    const monday = daySnap(before, MON);
    const after = clone(monday);
    after.workout!.sections.push({
      id: 'section:hidden:new',
      kind: 'conditioning',
      title: 'Hidden Conditioning',
      items: [{
        id: 'item:hidden:new',
        title: 'Hidden Bike',
        domain: 'conditioning',
        source: 'conditioning_option',
        description: null,
        exerciseIds: [],
        durationMinutes: 20,
        prescription: null,
      }],
    });
    const result = await semanticResult({
      before,
      message: 'drop lower work Monday',
      output: revision({
        intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
        dates: [MON],
        revisedDays: [after],
      }),
    });
    eq('result invalid', result.kind, 'invalid');
    ok('unknown ID diagnostic', result.kind === 'invalid' && result.diagnostic.unknownIds.includes('section:hidden:new'), result);
  }

  section('[8] malformed JSON fails safely');
  {
    const before = snapshot([visibleDay(MON, mixedWorkout())]);
    const result = await semanticResult({
      before,
      message: 'remove conditioning Monday',
      output: '{"schemaVersion":',
    });
    eq('invalid result', result.kind, 'invalid');
    ok('no mutation-shaped result', !('proposal' in result) || !result.proposal, result);
  }

  section('[9] adapter failure fails safely');
  {
    const before = snapshot([visibleDay(MON, mixedWorkout())]);
    const result = await buildSemanticCoachRevisionProposal({
      userMessage: 'remove conditioning Monday',
      visibleSnapshot: before,
      adapter: {
        buildProposal() {
          throw new Error('network offline');
        },
      },
    });
    eq('invalid result', result.kind, 'invalid');
    ok('adapter failure reason', result.kind === 'invalid' && result.reason === 'adapter_failed', result);
  }

  section('[10] shadow path does not mutate reply or visible snapshot');
  {
    const before = snapshot([visibleDay(MON, mixedWorkout())]);
    const beforeJson = JSON.stringify(before);
    let userFacingReply = 'legacy reply remains in charge';
    const monday = daySnap(before, MON);
    const after = clone(monday);
    after.workout!.sections = [sectionOf(monday, 'conditioning')];
    const result = await semanticResult({
      before,
      message: 'drop lower work Monday',
      output: revision({
        intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
        dates: [MON],
        revisedDays: [after],
      }),
    });
    eq('semantic shadow can validate', result.kind, 'revision');
    eq('visible snapshot unchanged', JSON.stringify(before), beforeJson);
    eq('user-facing reply unchanged by harness', userFacingReply, 'legacy reply remains in charge');
    userFacingReply = userFacingReply;
  }
}

run()
  .then(() => {
    console.log(`\nsemanticCoachRevisionProposalTests: ${pass} passed, ${fail} failed`);
    if (fail > 0) {
      console.error(failures.join('\n'));
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    fail++;
    failures.push(err instanceof Error ? err.stack ?? err.message : String(err));
    console.log(`\nsemanticCoachRevisionProposalTests: ${pass} passed, ${fail} failed`);
    console.error(failures.join('\n'));
    process.exit(1);
  });
