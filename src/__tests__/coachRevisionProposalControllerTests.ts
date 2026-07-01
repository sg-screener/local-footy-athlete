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
const PAST_MONDAY = '2026-06-29';
const NEXT_MONDAY = '2026-07-06';
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

function ex(name: string, id: string, sets = 3, workoutId = 'workout-thu-mixed'): any {
  return {
    id,
    workoutId,
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

function mixedWorkout(args: {
  id?: string;
  dayOfWeek?: number;
} = {}): Workout {
  const id = args.id ?? 'workout-thu-mixed';
  const conditioningId = `${id}-conditioning-bike`;
  return {
    id,
    microcycleId: 'mc-1',
    dayOfWeek: args.dayOfWeek ?? 4,
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
        exerciseIds: [conditioningId],
      }],
    },
    exercises: [
      ex('Back Squat', `${id}-strength-squat`, 4, id),
      ex('Romanian Deadlift', `${id}-strength-rdl`, 3, id),
      ex('25min zone 2 bike', conditioningId, 1, id),
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
    workouts: [
      mixedWorkout({ id: 'workout-mon-mixed', dayOfWeek: 1 }),
      mixedWorkout(),
    ],
    createdAt: '',
    updatedAt: '',
  };
  const nextMicrocycle: Microcycle = {
    ...microcycle,
    id: 'mc-2',
    weekNumber: 2,
    startDate: NEXT_MONDAY,
    endDate: '2026-07-12',
    workouts: [mixedWorkout({ id: 'workout-next-mon-mixed', dayOfWeek: 1 })],
  };
  const program: TrainingProgram = {
    id: 'program-1',
    userId: 'user-1',
    name: 'Test Program',
    description: '',
    programPhase: 'In-Season',
    startDate: '2026-06-29',
    endDate: '2026-07-26',
    microcycles: [microcycle, nextMicrocycle],
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

function dayByDate(
  input: SemanticCoachRevisionProposalAdapterInput,
  date: string,
): CoachVisibleDaySnapshot {
  const found = input.visibleSnapshot.days.find((item) => item.date === date);
  if (!found) throw new Error(`${date} not in visible snapshot`);
  return found;
}

function day(input: SemanticCoachRevisionProposalAdapterInput): CoachVisibleDaySnapshot {
  return dayByDate(input, THURSDAY);
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
  targetDate?: string;
}): CoachRevisionProposal {
  const targetDate = args.targetDate ?? args.revisedDay.date;
  return {
    schemaVersion: COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
    kind: 'revision',
    source: 'semantic',
    confidence: 0.92,
    userIntent: {
      intent: args.intent.intent,
      targetDomain: args.intent.targetDomain,
      actionScope: args.intent.actionScope,
      targetDates: [targetDate],
      protectedRefs: args.protectedRefs ?? [],
      reason: 'controller_revision_test',
    },
    scope: { mode: 'single_day', dates: [targetDate] },
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

function pendingResumeTargetDate(input: SemanticCoachRevisionProposalAdapterInput): string {
  const context = input.recentContext as any;
  return context?.pendingCoachRevision?.targetDateOverride ?? PAST_MONDAY;
}

function removeMondayStrengthKeepConditioningProposal(
  input: SemanticCoachRevisionProposalAdapterInput,
): CoachRevisionProposal {
  const targetDate = pendingResumeTargetDate(input);
  const current = dayByDate(input, targetDate);
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
    targetDate,
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
  seed?: boolean;
  visibleDate?: string;
}) {
  if (args.seed !== false) seedProgram();
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
  const visibleDate = args.visibleDate ?? THURSDAY;
  const visible = getResolvedVisibleProgramForDate({
    date: visibleDate,
    todayISO: TODAY,
    state: buildScheduleStateImperative(),
    overrideContext: programState.overrideContexts?.[visibleDate],
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
    pending: usePendingCoachClarifierStore.getState().pending,
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

  {
    const originalMessage = 'Can you drop the lower work Monday but keep the flush';
    const adapter = new RecordingRevisionAdapter(removeMondayStrengthKeepConditioningProposal);
    const first = await runControllerTurn({
      message: originalMessage,
      adapter,
      visibleDate: PAST_MONDAY,
    });
    eq('[5] first turn handled', first.handled.handled, true);
    ok('[5] asks stale-date clarification',
      /Monday 2026-06-29 is in the past\. Do you mean next Monday instead\?/.test(first.reply),
      first.reply);
    ok('[5] stores coach revision envelope',
      !!first.pending?.coachRevisionProposalEnvelope,
      first.pending);
    eq('[5] stored target domain',
      first.pending?.coachRevisionProposalEnvelope?.partialIntent.targetDomain,
      'strength');
    ok('[5] no override before answer',
      !first.dateOverrides[NEXT_MONDAY],
      first.dateOverrides);

    const second = await runControllerTurn({
      message: 'Yes',
      adapter,
      seed: false,
      visibleDate: NEXT_MONDAY,
    });
    eq('[5] adapter called twice', adapter.calls.length, 2);
    eq('[5] resume uses original wording', adapter.calls[1]?.userMessage, originalMessage);
    eq('[5] resume passes accepted date',
      (adapter.calls[1]?.recentContext as any)?.pendingCoachRevision?.targetDateOverride,
      NEXT_MONDAY);
    eq('[5] second turn handled', second.handled.handled, true);
    ok('[5] done reply after verified resume',
      /Done\. I removed the strength work on Mon 2026-07-06|Done\. I removed the strength work on 2026-07-06|Done\. I removed the strength work on Mon/.test(second.reply),
      second.reply);
    ok('[5] override written for next Monday',
      !!second.dateOverrides[NEXT_MONDAY],
      second.dateOverrides);
    eq('[5] next Monday strength removed', second.visible.strengthItems.length, 0);
    ok('[5] next Monday conditioning preserved',
      second.visible.conditioningItems.length > 0,
      second.visible.items);
    eq('[5] pending cleared after apply',
      usePendingCoachClarifierStore.getState().pending,
      null);
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
