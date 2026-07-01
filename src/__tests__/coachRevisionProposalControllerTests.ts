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

/** Simulates transport failure (404/timeout/network) the way the live
 *  LLMSemanticCoachRevisionProposalAdapter surfaces it: by throwing. */
class ThrowingRevisionAdapter implements SemanticCoachRevisionProposalAdapter {
  calls = 0;

  constructor(private readonly message: string) {}

  buildProposal(): unknown {
    this.calls++;
    throw new Error(this.message);
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

/** Live-app topology: ONE microcycle only. Dates beyond it (e.g. next
 *  Monday) exist purely as template projections, not materialized workouts.
 *  The default two-microcycle seed masks failures in that projection path. */
function seedSingleMicrocycleProgram() {
  useProgramStore.getState().clear();
  useCoachContextStateStore.getState().clearCoachContext();
  usePendingCoachClarifierStore.getState().clearPending();
  const microcycle: Microcycle = {
    id: 'mc-only',
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
  const program: TrainingProgram = {
    id: 'program-1',
    userId: 'user-1',
    name: 'Single Cycle Program',
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

function reduceStrengthAt(
  input: SemanticCoachRevisionProposalAdapterInput,
  targetDate: string,
): CoachRevisionProposal {
  const current = dayByDate(input, targetDate);
  const conditioning = sectionOf(current, 'conditioning');
  const after = clone(current);
  const strength = after.workout!.sections.find((section) => section.kind === 'strength')!;
  for (const item of strength.items) {
    if (item.prescription?.sets != null) {
      item.prescription = { ...item.prescription, sets: Math.max(1, item.prescription.sets - 2) };
    }
  }
  return revision({
    input,
    intent: { intent: 'reduce', targetDomain: 'strength', actionScope: 'strength_section' },
    revisedDay: after,
    protectedRefs: [conditioning.id],
    targetDate,
  });
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

function clarifyProposal(args: {
  question?: string;
  missingField?: string;
  intent?: CoachRevisionProposal extends { kind: 'clarify' } ? never : unknown;
} = {}): unknown {
  return {
    schemaVersion: COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
    kind: 'clarify',
    confidence: 0.9,
    question: args.question ?? 'Which Monday do you mean?',
    missingField: args.missingField ?? 'targetDate',
    candidateOptions: [],
    partialIntent: {
      intent: 'remove',
      targetDomain: 'strength',
      actionScope: 'strength_section',
      targetDates: [],
      protectedRefs: [],
      reason: 'controller_clarify_test',
    },
    reason: 'ambiguous_date',
  };
}

function removeStrengthKeepConditioningAt(
  input: SemanticCoachRevisionProposalAdapterInput,
  targetDate: string,
): CoachRevisionProposal {
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
  adapter: SemanticCoachRevisionProposalAdapter | null;
  seed?: boolean;
  seedFn?: () => void;
  visibleDate?: string;
}) {
  if (args.seed !== false) (args.seedFn ?? seedProgram)();
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

  {
    // Stage 1 date bound: a proposal changing a date outside the visible
    // snapshot must fail diff validation via app-side policy — the LLM's own
    // scope.dates can no longer define its own boundary.
    const OUT_OF_WINDOW = '2026-08-15';
    const adapter = new RecordingRevisionAdapter((input) => {
      const current = day(input);
      const after = clone(current);
      after.date = OUT_OF_WINDOW;
      return revision({
        input,
        intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
        revisedDay: after,
        targetDate: OUT_OF_WINDOW,
      });
    });
    const result = await runControllerTurn({
      message: 'drop the strength on August 15',
      adapter,
    });
    eq('[9] handled', result.handled.handled, true);
    eq('[9] invalid route',
      (result.debug as CoachTurnDebug | null)?.route,
      'coach-revision-proposal-invalid:diff_validation_failed');
    ok('[9] safe no-change reply', /left the plan unchanged/.test(result.reply), result.reply);
    eq('[9] legacy classifier not called', result.classifierCalls, 0);
    ok('[9] no override written anywhere',
      Object.keys(result.dateOverrides).length === 0,
      result.dateOverrides);
  }

  {
    // Stage 0 fail-loud: active mode + null adapter must dead-end with a dev
    // misconfig reply — never continue into legacy mutation paths.
    const result = await runControllerTurn({
      message: 'drop lower work tomorrow but keep the flush',
      adapter: null,
    });
    eq('[6] handled', result.handled.handled, true);
    eq('[6] misconfigured route',
      (result.debug as CoachTurnDebug | null)?.route,
      'coach-revision-proposal-misconfigured');
    ok('[6] dev misconfig reply',
      /\[dev\] Coach revision mode is active but the endpoint adapter is missing/.test(result.reply),
      result.reply);
    eq('[6] legacy classifier not called', result.classifierCalls, 0);
    ok('[6] no override written', !result.dateOverrides[THURSDAY], result.dateOverrides);
    ok('[6] visible program unchanged',
      result.visible.strengthItems.length > 0 && result.visible.conditioningItems.length > 0,
      result.visible.items);
  }

  {
    // Stage 0 fail-loud: endpoint 404 (adapter throws like the live adapter
    // does) must reply with an explicit endpoint-failure message, make no
    // mutation, and never fall back to legacy paths.
    const adapter = new ThrowingRevisionAdapter('coach revision proposal endpoint HTTP 404');
    const result = await runControllerTurn({
      message: 'drop lower work tomorrow but keep the flush',
      adapter,
    });
    eq('[7] adapter attempted', adapter.calls, 1);
    eq('[7] handled', result.handled.handled, true);
    eq('[7] invalid route',
      (result.debug as CoachTurnDebug | null)?.route,
      'coach-revision-proposal-invalid:adapter_failed');
    ok('[7] dev endpoint-failure reply',
      /\[dev\] Coach revision endpoint failed \(.*HTTP 404.*\)\. No changes made/.test(result.reply),
      result.reply);
    ok('[7] does not claim validation failure',
      !/couldn't safely validate/.test(result.reply),
      result.reply);
    eq('[7] legacy classifier not called', result.classifierCalls, 0);
    ok('[7] no override written', !result.dateOverrides[THURSDAY], result.dateOverrides);
  }

  {
    // Stage 0 fail-loud: timeout/network failure gets the same dev endpoint
    // message (distinguishing detail carried in the error text).
    const adapter = new ThrowingRevisionAdapter('Aborted');
    const result = await runControllerTurn({
      message: 'remove conditioning tomorrow',
      adapter,
    });
    eq('[8] handled', result.handled.handled, true);
    ok('[8] dev endpoint-failure reply on abort',
      /\[dev\] Coach revision endpoint failed \(Aborted\)/.test(result.reply),
      result.reply);
    eq('[8] legacy classifier not called', result.classifierCalls, 0);
    ok('[8] no override written', !result.dateOverrides[THURSDAY], result.dateOverrides);
  }

  {
    // Clarification transaction: a clarify response stores pending state, and
    // the short answer resumes with ORIGINAL wording + the answered slot —
    // the "which Monday?" → "next Monday" flow must converge in one round.
    const originalMessage = 'drop the lower work but keep the flush';
    let call = 0;
    const adapter = new RecordingRevisionAdapter((input) => {
      call++;
      if (call === 1) return clarifyProposal({ question: 'Which Monday do you mean: 2026-06-29 or 2026-07-06?' });
      const context = input.recentContext as any;
      const targetDate = context?.pendingCoachRevision?.targetDateOverride ?? NEXT_MONDAY;
      return removeStrengthKeepConditioningAt(input, targetDate);
    });

    const first = await runControllerTurn({ message: originalMessage, adapter });
    eq('[10] first turn asks the clarify question', first.handled.handled, true);
    ok('[10] clarify question relayed', /Which Monday/.test(first.reply), first.reply);
    ok('[10] pending envelope stored on clarify',
      !!first.pending?.coachRevisionProposalEnvelope,
      first.pending);
    eq('[10] one outstanding clarification round',
      first.pending?.coachRevisionProposalEnvelope?.clarifications?.length,
      1);
    eq('[10] envelope keeps original wording',
      first.pending?.coachRevisionProposalEnvelope?.originalUserWording,
      originalMessage);
    ok('[10] no override before answer',
      Object.keys(first.dateOverrides).length === 0,
      first.dateOverrides);

    const second = await runControllerTurn({
      message: 'next Monday',
      adapter,
      seed: false,
      visibleDate: NEXT_MONDAY,
    });
    eq('[10] adapter called twice', adapter.calls.length, 2);
    eq('[10] resume uses original wording', adapter.calls[1]?.userMessage, originalMessage);
    eq('[10] raw answer carried to resume',
      (adapter.calls[1]?.recentContext as any)?.pendingCoachRevision?.clarificationAnswer,
      'next Monday');
    ok('[10] answered round recorded',
      ((adapter.calls[1]?.recentContext as any)?.pendingCoachRevision?.clarifications ?? [])
        .some((entry: any) => entry.answer === 'next Monday'),
      (adapter.calls[1]?.recentContext as any)?.pendingCoachRevision);
    ok('[10] done reply after convergence', /^Done\./.test(second.reply), second.reply);
    ok('[10] override written for resolved Monday',
      !!second.dateOverrides[NEXT_MONDAY],
      second.dateOverrides);
    eq('[10] strength removed on resolved Monday', second.visible.strengthItems.length, 0);
    ok('[10] conditioning preserved on resolved Monday',
      second.visible.conditioningItems.length > 0,
      second.visible.items);
    eq('[10] pending cleared after apply',
      usePendingCoachClarifierStore.getState().pending,
      null);
    eq('[10] legacy classifier never called', second.classifierCalls, 0);
  }

  {
    // LIVE REPRO: single-microcycle program (live topology), stale Monday →
    // "Yes" → resumed reduce-intent revision on the PROJECTED next Monday.
    // This is the exact live flow that ended in "couldn't safely apply".
    const originalMessage = 'Can you drop the lower work Monday but keep the flush';
    const adapter = new RecordingRevisionAdapter((input) => {
      const context = input.recentContext as any;
      const targetDate = context?.pendingCoachRevision?.targetDateOverride ?? PAST_MONDAY;
      return reduceStrengthAt(input, targetDate);
    });

    const first = await runControllerTurn({
      message: originalMessage,
      adapter,
      seedFn: seedSingleMicrocycleProgram,
      visibleDate: PAST_MONDAY,
    });
    ok('[12] stale-date question asked', /in the past/.test(first.reply), first.reply);
    ok('[12] revision envelope stored', !!first.pending?.coachRevisionProposalEnvelope, first.pending);

    const second = await runControllerTurn({
      message: 'Yes',
      adapter,
      seed: false,
      visibleDate: NEXT_MONDAY,
    });
    eq('[12] resume adapter got projected next Monday',
      (adapter.calls[1]?.recentContext as any)?.pendingCoachRevision?.targetDateOverride,
      NEXT_MONDAY);
    ok('[12] projected-date snapshot contains next Monday',
      !!adapter.calls[1]?.visibleSnapshot.days.find((day) => day.date === NEXT_MONDAY),
      adapter.calls[1]?.visibleSnapshot.days.map((day) => day.date));
    ok('[12] resumed reduce applied on projected date',
      /^Done\./.test(second.reply),
      { reply: second.reply, debugRoute: (second.debug as CoachTurnDebug | null)?.route });
    ok('[12] override written for projected next Monday',
      !!second.dateOverrides[NEXT_MONDAY],
      Object.keys(second.dateOverrides));
    ok('[12] strength remains but reduced',
      second.visible.strengthItems.length > 0,
      second.visible.items);
    ok('[12] conditioning untouched',
      second.visible.conditioningItems.length > 0,
      second.visible.items);
  }

  {
    // Round cap: a model that clarifies forever gets cut off honestly after
    // COACH_REVISION_MAX_CLARIFY_ROUNDS, with no mutation and no legacy path.
    const adapter = new RecordingRevisionAdapter(() =>
      clarifyProposal({ question: 'Which session do you mean?' }));
    const first = await runControllerTurn({ message: 'change my plan a bit', adapter });
    ok('[11] round 1 pending stored', !!first.pending?.coachRevisionProposalEnvelope, first.pending);

    const second = await runControllerTurn({ message: 'the usual one', adapter, seed: false });
    eq('[11] round 2 outstanding',
      second.pending?.coachRevisionProposalEnvelope?.clarifications?.length,
      2);
    const third = await runControllerTurn({ message: 'hmm', adapter, seed: false });
    eq('[11] round 3 outstanding',
      third.pending?.coachRevisionProposalEnvelope?.clarifications?.length,
      3);
    const fourth = await runControllerTurn({ message: 'that one', adapter, seed: false });
    ok('[11] rounds exhausted declines honestly',
      /left the plan as is/.test(fourth.reply),
      fourth.reply);
    eq('[11] pending cleared after exhaustion',
      usePendingCoachClarifierStore.getState().pending,
      null);
    ok('[11] no override ever written',
      Object.keys(fourth.dateOverrides).length === 0,
      fourth.dateOverrides);
    eq('[11] legacy classifier never called', fourth.classifierCalls, 0);
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
