/**
 * coachRevisionProposalControllerTests — Stage 4A-4 dev-active
 * CoachRevisionProposal one-off path.
 *
 * Run: ./node_modules/.bin/sucrase-node src/__tests__/coachRevisionProposalControllerTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { Microcycle, TrainingProgram, Workout } from '../types/domain';
import { useCoachContextStateStore } from '../store/coachContextStateStore';
import { usePendingCoachClarifierStore } from '../store/pendingCoachClarifierStore';
import { useProgramStore } from '../store/programStore';
import {
  COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
  type CoachRevisionIntent,
  type CoachRevisionProposal,
  type CoachVisibleDaySnapshot,
  type CoachVisibleSectionSnapshot,
} from '../utils/coachRevisionProposal';
import {
  handleCoachTurn,
  type CoachRevisionProposalControllerDiagnostic,
  type CoachTurnDebug,
  type CoachTurnMessage,
} from '../utils/coachTurnController';
import type {
  SemanticCoachRevisionProposalAdapter,
  SemanticCoachRevisionProposalAdapterInput,
} from '../utils/semanticCoachRevisionProposal';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import {
  getResolvedVisibleProgramForDate,
} from '../utils/visibleProgramReadModel';

const TODAY = '2026-07-01';
const THURSDAY = '2026-07-02';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    const suffix = detail == null ? '' : `\n    ${typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)}`;
    failures.push(`${name}${suffix}`);
    console.log(`  FAIL ${name}${suffix}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(name, actual === expected, `expected ${String(expected)}, got ${String(actual)}`);
}

class RecordingRevisionAdapter implements SemanticCoachRevisionProposalAdapter {
  calls: SemanticCoachRevisionProposalAdapterInput[] = [];

  constructor(private readonly output: (input: SemanticCoachRevisionProposalAdapterInput) => unknown) {}

  buildProposal(input: SemanticCoachRevisionProposalAdapterInput): unknown {
    this.calls.push(input);
    return this.output(input);
  }
}

function ex(name: string, id: string, sets = 3): any {
  return {
    id,
    workoutId: 'workout-thu-mixed',
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
    id: 'workout-thu-mixed',
    microcycleId: 'mc-1',
    dayOfWeek: 4,
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

function seedProgram() {
  useProgramStore.getState().clear();
  useCoachContextStateStore.getState().clearCoachContext();
  usePendingCoachClarifierStore.getState().clearPending();
  const microcycle: Microcycle = {
    id: 'mc-1',
    programId: 'program-1',
    weekNumber: 1,
    startDate: '2026-06-29',
    endDate: '2026-07-05',
    miniCycleNumber: 1,
    intensityMultiplier: 1,
    workouts: [mixedWorkout()],
    createdAt: '',
    updatedAt: '',
  };
  const program: TrainingProgram = {
    id: 'program-1',
    userId: 'user-1',
    name: 'Test Program',
    description: '',
    programPhase: 'In-Season',
    startDate: '2026-06-29',
    endDate: '2026-07-26',
    microcycles: [microcycle],
    primaryFocus: 'Test',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };
  useProgramStore.getState().setCurrentProgram(program);
  useProgramStore.getState().setCurrentMicrocycle(microcycle);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function day(input: SemanticCoachRevisionProposalAdapterInput): CoachVisibleDaySnapshot {
  const found = input.visibleSnapshot.days.find((item) => item.date === THURSDAY);
  if (!found) throw new Error('Thursday not in visible snapshot');
  return found;
}

function sectionOf(day: CoachVisibleDaySnapshot, kind: string): CoachVisibleSectionSnapshot {
  const found = day.workout?.sections.find((section) => section.kind === kind);
  if (!found) throw new Error(`Missing ${kind}`);
  return found;
}

function revision(args: {
  input: SemanticCoachRevisionProposalAdapterInput;
  intent: Pick<CoachRevisionIntent, 'intent' | 'targetDomain' | 'actionScope'>;
  revisedDay: CoachVisibleDaySnapshot;
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
      targetDates: [THURSDAY],
      protectedRefs: args.protectedRefs ?? [],
      reason: 'controller_revision_test',
    },
    scope: { mode: 'single_day', dates: [THURSDAY] },
    revisedDays: [args.revisedDay],
    explanation: 'controller_revision_test',
  };
}

function removeStrengthProposal(input: SemanticCoachRevisionProposalAdapterInput): CoachRevisionProposal {
  const current = day(input);
  const conditioning = sectionOf(current, 'conditioning');
  const after = clone(current);
  after.workout!.title = conditioning.title;
  after.workout!.workoutType = 'Conditioning';
  after.workout!.sections = [conditioning];
  return revision({
    input,
    intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
    revisedDay: after,
    protectedRefs: [conditioning.id],
  });
}

function removeConditioningProposal(input: SemanticCoachRevisionProposalAdapterInput): CoachRevisionProposal {
  const current = day(input);
  const strength = sectionOf(current, 'strength');
  const after = clone(current);
  after.workout!.sections = [strength];
  return revision({
    input,
    intent: { intent: 'remove', targetDomain: 'conditioning', actionScope: 'conditioning_section' },
    revisedDay: after,
    protectedRefs: [strength.id],
  });
}

function removeWholeSessionProposal(input: SemanticCoachRevisionProposalAdapterInput): CoachRevisionProposal {
  const after = clone(day(input));
  after.workout = null;
  return revision({
    input,
    intent: { intent: 'remove', targetDomain: 'session', actionScope: 'whole_session' },
    revisedDay: after,
  });
}

function protectedViolationProposal(input: SemanticCoachRevisionProposalAdapterInput): CoachRevisionProposal {
  const current = day(input);
  const conditioning = sectionOf(current, 'conditioning');
  const after = clone(current);
  after.workout!.sections = [sectionOf(current, 'strength')];
  return revision({
    input,
    intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
    revisedDay: after,
    protectedRefs: [conditioning.id],
  });
}

async function runControllerTurn(args: {
  message: string;
  adapter: SemanticCoachRevisionProposalAdapter;
}) {
  seedProgram();
  const messages: CoachTurnMessage[] = [];
  const userMessage: CoachTurnMessage = {
    id: `turn-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: args.message,
  };
  let debug: CoachTurnDebug | null = null;
  let classifierCalls = 0;
  const diagnostics: CoachRevisionProposalControllerDiagnostic[] = [];
  const handled = await handleCoachTurn({
    userMessage,
    messages,
    todayISO: TODAY,
    classifier: {
      classify: async () => {
        classifierCalls++;
        return {
          intent: 'conversation',
          confidence: 0,
          needsClarification: false,
        } as any;
      },
    },
    pendingCoachProposal: null,
    pendingReadiness: null,
    pendingInjury: null,
    smokeCoachBikeFlow: false,
    isFocused: true,
    smokeWednesdayMissingReason: null,
    smokeWednesdayOpenTarget: null,
    setPendingCoachProposal: () => {},
    setPendingReadiness: () => {},
    appendUser: () => messages.push(userMessage),
    appendAssistant: (message) => messages.push(message),
    appendUserAndAssistant: (message) => messages.push(userMessage, message),
    clearInput: () => {},
    setIsLoading: () => {},
    setCoachProgressLabel: () => {},
    startSetupRebuildProgress: () => {},
    clearSetupRebuildProgress: () => {},
    setLastCoachDebug: (nextDebug) => {
      debug = nextDebug;
    },
    coachRevisionProposalMode: 'active',
    coachRevisionProposalRawMode: 'active',
    coachRevisionProposalActiveAllowed: true,
    coachRevisionProposalAdapter: args.adapter,
    onCoachRevisionProposalDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    semanticProgramEditDraftMode: 'off',
    semanticProgramEditDraftActiveAllowed: false,
    semanticProgramEditDraftAdapter: null,
  });
  const programState = useProgramStore.getState();
  const visible = getResolvedVisibleProgramForDate({
    date: THURSDAY,
    todayISO: TODAY,
    state: buildScheduleStateImperative(),
    overrideContext: programState.overrideContexts?.[THURSDAY],
    overrideContexts: programState.overrideContexts,
  });
  return {
    handled,
    messages,
    reply: messages.filter((message) => message.role === 'assistant').at(-1)?.content ?? '',
    debug,
    classifierCalls,
    diagnostics,
    dateOverrides: programState.dateOverrides,
    visible,
  };
}

async function run() {
  console.log('coachRevisionProposalControllerTests');

  {
    const adapter = new RecordingRevisionAdapter(removeStrengthProposal);
    const result = await runControllerTurn({
      message: 'drop lower work tomorrow but keep the flush',
      adapter,
    });
    eq('[1] adapter called once', adapter.calls.length, 1);
    eq('[1] handled', result.handled.handled, true);
    eq('[1] legacy classifier not called', result.classifierCalls, 0);
    ok('[1] done reply only after revision apply', /Done\. I removed the strength work/.test(result.reply), result.reply);
    ok('[1] override written', !!result.dateOverrides[THURSDAY], result.dateOverrides);
    ok('[1] visible conditioning remains', result.visible.conditioningItems.length > 0, result.visible.items);
    eq('[1] visible strength removed', result.visible.strengthItems.length, 0);
  }

  {
    const adapter = new RecordingRevisionAdapter(removeConditioningProposal);
    const result = await runControllerTurn({
      message: 'remove conditioning tomorrow',
      adapter,
    });
    eq('[2] handled', result.handled.handled, true);
    ok('[2] done reply for conditioning', /Done\. I removed conditioning/.test(result.reply), result.reply);
    ok('[2] strength remains', result.visible.strengthItems.length > 0, result.visible.items);
    eq('[2] conditioning removed', result.visible.conditioningItems.length, 0);
  }

  {
    const adapter = new RecordingRevisionAdapter(removeWholeSessionProposal);
    const result = await runControllerTurn({
      message: 'remove the whole session tomorrow',
      adapter,
    });
    eq('[3] handled', result.handled.handled, true);
    ok('[3] done reply for session removal', /Done\. I removed the session/.test(result.reply), result.reply);
    eq('[3] projected workout is rest/null', result.visible.day.workout, null);
  }

  {
    const adapter = new RecordingRevisionAdapter(protectedViolationProposal);
    const result = await runControllerTurn({
      message: 'drop lower work tomorrow but keep the flush',
      adapter,
    });
    eq('[4] handled', result.handled.handled, true);
    eq('[4] legacy classifier not called after invalid revision', result.classifierCalls, 0);
    ok('[4] safe no-change reply', /left the plan unchanged/.test(result.reply), result.reply);
    ok('[4] no override written', !result.dateOverrides[THURSDAY], result.dateOverrides);
    ok('[4] diagnostic captured protected violation',
      result.diagnostics.some((diagnostic) =>
        diagnostic.diagnostic.protectedRefsViolated.length > 0,
      ),
      result.diagnostics);
  }
}

run()
  .then(() => {
    console.log(`\n- Summary -`);
    console.log(`  Pass: ${pass}`);
    console.log(`  Fail: ${fail}`);
    if (fail > 0) {
      console.log(`\n- Failures -`);
      for (const f of failures) console.log(`  - ${f}`);
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    fail++;
    failures.push(err instanceof Error ? err.stack ?? err.message : String(err));
    console.log(`\n- Summary -`);
    console.log(`  Pass: ${pass}`);
    console.log(`  Fail: ${fail}`);
    console.log(`\n- Failures -`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  });
