/**
 * coachRevisionProposalBehaviorMatrixTests — Stage 4A-6 end-to-end
 * behaviour matrix for the dev-active snapshot/diff/override path.
 *
 * Run: ./node_modules/.bin/sucrase-node src/__tests__/coachRevisionProposalBehaviorMatrixTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { Microcycle, TrainingProgram, Workout } from '../types/domain';
import { useCoachContextStateStore } from '../store/coachContextStateStore';
import { usePendingCoachClarifierStore } from '../store/pendingCoachClarifierStore';
import { useProgramStore } from '../store/programStore';
import {
  COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
  snapshotProjectedDay,
  type CoachRevisionIntent,
  type CoachRevisionProposal,
  type CoachVisibleDaySnapshot,
  type CoachVisibleSectionSnapshot,
} from '../utils/coachRevisionProposal';
import {
  handleCoachTurn,
  type CoachTurnDebug,
  type CoachTurnMessage,
} from '../utils/coachTurnController';
import type {
  SemanticCoachRevisionProposalAdapter,
  SemanticCoachRevisionProposalAdapterInput,
} from '../utils/semanticCoachRevisionProposal';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { getMondayForDate } from '../utils/sessionResolver';
import {
  buildProgramTabProjectedWeek,
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
  microcycleId?: string;
} = {}): Workout {
  const id = args.id ?? 'workout-thu-mixed';
  const conditioningId = `${id}-conditioning-bike`;
  return {
    id,
    microcycleId: args.microcycleId ?? 'mc-1',
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
    startDate: PAST_MONDAY,
    endDate: '2026-07-05',
    miniCycleNumber: 1,
    intensityMultiplier: 1,
    workouts: [
      mixedWorkout({ id: 'workout-mon-mixed', dayOfWeek: 1, microcycleId: 'mc-1' }),
      mixedWorkout({ id: 'workout-thu-mixed', dayOfWeek: 4, microcycleId: 'mc-1' }),
    ],
    createdAt: '',
    updatedAt: '',
  };
  const nextMicrocycle: Microcycle = {
    id: 'mc-2',
    programId: 'program-1',
    weekNumber: 2,
    startDate: NEXT_MONDAY,
    endDate: '2026-07-12',
    miniCycleNumber: 2,
    intensityMultiplier: 1,
    workouts: [mixedWorkout({ id: 'workout-next-mon-mixed', dayOfWeek: 1, microcycleId: 'mc-2' })],
    createdAt: '',
    updatedAt: '',
  };
  const program: TrainingProgram = {
    id: 'program-1',
    userId: 'user-1',
    name: 'Test Program',
    description: '',
    programPhase: 'In-Season',
    startDate: PAST_MONDAY,
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

function sectionOf(day: CoachVisibleDaySnapshot, kind: string): CoachVisibleSectionSnapshot {
  const found = day.workout?.sections.find((section) => section.kind === kind);
  if (!found) throw new Error(`Missing ${kind}`);
  return found;
}

function revision(args: {
  intent: Pick<CoachRevisionIntent, 'intent' | 'targetDomain' | 'actionScope'>;
  revisedDays: CoachVisibleDaySnapshot[];
  targetDate: string;
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
      targetDates: [args.targetDate],
      protectedRefs: args.protectedRefs ?? [],
      allowedAddedSectionKinds: args.allowedAddedSectionKinds,
      requiresConfirmation: args.requiresConfirmation,
      reason: 'coach_revision_behavior_matrix',
    },
    scope: { mode: 'single_day', dates: [args.targetDate] },
    revisedDays: args.revisedDays,
    explanation: 'coach_revision_behavior_matrix',
  };
}

function strengthRemovedDay(day: CoachVisibleDaySnapshot): CoachVisibleDaySnapshot {
  const conditioning = sectionOf(day, 'conditioning');
  const after = clone(day);
  after.workout!.title = conditioning.title;
  after.workout!.workoutType = 'Conditioning';
  after.workout!.sections = [conditioning];
  return after;
}

function conditioningRemovedDay(day: CoachVisibleDaySnapshot): CoachVisibleDaySnapshot {
  const after = clone(day);
  after.workout!.sections = [sectionOf(day, 'strength')];
  return after;
}

function strengthReductionDay(day: CoachVisibleDaySnapshot): CoachVisibleDaySnapshot {
  const after = clone(day);
  const strength = sectionOf(after, 'strength');
  for (const item of strength.items) {
    if (item.prescription?.sets != null) {
      item.prescription.sets = Math.max(1, item.prescription.sets - 1);
    }
  }
  return after;
}

function wholeSessionRemovedDay(day: CoachVisibleDaySnapshot): CoachVisibleDaySnapshot {
  const after = clone(day);
  after.workout = null;
  return after;
}

function removeStrengthKeepFlush(input: SemanticCoachRevisionProposalAdapterInput): CoachRevisionProposal {
  const targetDate = targetDateFromPendingContext(input) ?? THURSDAY;
  const current = dayByDate(input, targetDate);
  const conditioning = sectionOf(current, 'conditioning');
  return revision({
    intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
    revisedDays: [strengthRemovedDay(current)],
    targetDate,
    protectedRefs: [conditioning.id],
  });
}

function removePastMondayStrengthKeepFlush(input: SemanticCoachRevisionProposalAdapterInput): CoachRevisionProposal {
  const targetDate = targetDateFromPendingContext(input) ?? PAST_MONDAY;
  const current = dayByDate(input, targetDate);
  const conditioning = sectionOf(current, 'conditioning');
  return revision({
    intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
    revisedDays: [strengthRemovedDay(current)],
    targetDate,
    protectedRefs: [conditioning.id],
  });
}

function removeConditioningKeepStrength(input: SemanticCoachRevisionProposalAdapterInput): CoachRevisionProposal {
  const current = dayByDate(input, THURSDAY);
  const strength = sectionOf(current, 'strength');
  return revision({
    intent: { intent: 'remove', targetDomain: 'conditioning', actionScope: 'conditioning_section' },
    revisedDays: [conditioningRemovedDay(current)],
    targetDate: THURSDAY,
    protectedRefs: [strength.id],
  });
}

function removeWholeSession(input: SemanticCoachRevisionProposalAdapterInput): CoachRevisionProposal {
  const current = dayByDate(input, THURSDAY);
  return revision({
    intent: { intent: 'remove', targetDomain: 'session', actionScope: 'whole_session' },
    revisedDays: [wholeSessionRemovedDay(current)],
    targetDate: THURSDAY,
  });
}

function makeLighter(input: SemanticCoachRevisionProposalAdapterInput): CoachRevisionProposal {
  const current = dayByDate(input, THURSDAY);
  return revision({
    intent: { intent: 'reduce', targetDomain: 'strength', actionScope: 'strength_section' },
    revisedDays: [strengthReductionDay(current)],
    targetDate: THURSDAY,
  });
}

function protectedViolation(input: SemanticCoachRevisionProposalAdapterInput): CoachRevisionProposal {
  const current = dayByDate(input, THURSDAY);
  const conditioning = sectionOf(current, 'conditioning');
  return revision({
    intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
    revisedDays: [conditioningRemovedDay(current)],
    targetDate: THURSDAY,
    protectedRefs: [conditioning.id],
  });
}

function unknownIdProposal(input: SemanticCoachRevisionProposalAdapterInput): CoachRevisionProposal {
  const current = dayByDate(input, THURSDAY);
  const after = strengthRemovedDay(current);
  // Invented section must carry content: parse normalization strips truly
  // EMPTY shells (they add nothing visible), so the unknown-id guard is about
  // invented content, not invented empty wrappers.
  after.workout!.sections.push({
    id: 'section:unknown:recovery',
    kind: 'recovery',
    title: 'Invented Recovery',
    items: [{
      id: 'item:unknown:recovery-walk',
      title: 'Invented Recovery Walk',
      domain: 'recovery',
      source: 'conditioning_option',
      description: null,
      exerciseIds: [],
      durationMinutes: 20,
      prescription: null,
    }],
  });
  return revision({
    intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
    revisedDays: [after],
    targetDate: THURSDAY,
  });
}

function unrelatedDayProposal(input: SemanticCoachRevisionProposalAdapterInput): CoachRevisionProposal {
  const thursday = dayByDate(input, THURSDAY);
  const monday = dayByDate(input, NEXT_MONDAY);
  return revision({
    intent: { intent: 'remove', targetDomain: 'strength', actionScope: 'strength_section' },
    revisedDays: [strengthRemovedDay(thursday), strengthRemovedDay(monday)],
    targetDate: THURSDAY,
  });
}

function malformedProposal(): unknown {
  return {
    schemaVersion: COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
    kind: 'revision',
    confidence: 0.95,
  };
}

function targetDateFromPendingContext(input: SemanticCoachRevisionProposalAdapterInput): string | null {
  const context = input.recentContext as any;
  return context?.pendingCoachRevision?.targetDateOverride ?? null;
}

async function runTurn(args: {
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
    dateOverrides: programState.dateOverrides,
    overrideContexts: programState.overrideContexts,
    pending: usePendingCoachClarifierStore.getState().pending,
    visible,
  };
}

function programTabDaySnapshot(date: string) {
  const programState = useProgramStore.getState();
  const week = buildProgramTabProjectedWeek({
    mondayISO: getMondayForDate(date),
    todayISO: TODAY,
    state: buildScheduleStateImperative(),
    overrideContexts: programState.overrideContexts ?? {},
  });
  const found = week.find((day) => day.date === date);
  if (!found) throw new Error(`${date} missing from Program tab projection`);
  return snapshotProjectedDay(found);
}

function detailDaySnapshot(date: string) {
  const programState = useProgramStore.getState();
  const visible = getResolvedVisibleProgramForDate({
    date,
    todayISO: TODAY,
    state: buildScheduleStateImperative(),
    overrideContext: programState.overrideContexts?.[date],
    overrideContexts: programState.overrideContexts,
  });
  return snapshotProjectedDay(visible.day);
}

async function run() {
  console.log('coachRevisionProposalBehaviorMatrixTests');

  {
    const adapter = new RecordingRevisionAdapter(removeStrengthKeepFlush);
    const result = await runTurn({
      message: "I'm cooked, bin the leg stuff tomorrow",
      adapter,
    });
    ok('[1] messy strength removal handled', result.handled.handled, result.handled);
    ok('[1] no legacy classifier fallback', result.classifierCalls === 0, result.classifierCalls);
    ok('[1] strength removed', result.visible.strengthItems.length === 0, result.visible.items);
    ok('[1] conditioning preserved', result.visible.conditioningItems.length > 0, result.visible.items);
  }

  {
    const adapter = new RecordingRevisionAdapter(removeConditioningKeepStrength);
    const result = await runTurn({
      message: 'remove conditioning from tomorrow',
      adapter,
    });
    ok('[2] conditioning removed', result.visible.conditioningItems.length === 0, result.visible.items);
    ok('[2] strength preserved', result.visible.strengthItems.length > 0, result.visible.items);
    ok('[2] no legacy fallback', result.classifierCalls === 0, result.classifierCalls);
  }

  {
    const adapter = new RecordingRevisionAdapter(removeWholeSession);
    const result = await runTurn({
      message: 'remove everything tomorrow',
      adapter,
    });
    eq('[3] whole session removed', result.visible.day.workout, null);
    ok('[3] no legacy fallback', result.classifierCalls === 0, result.classifierCalls);
  }

  {
    const adapter = new RecordingRevisionAdapter(makeLighter);
    const result = await runTurn({
      message: 'make tomorrow lighter',
      adapter,
    });
    ok('[4] lighter edit keeps strength visible', result.visible.strengthItems.length > 0, result.visible.items);
    ok('[4] lighter edit writes override', !!result.dateOverrides[THURSDAY], result.dateOverrides);
    ok('[4] no legacy fallback', result.classifierCalls === 0, result.classifierCalls);
  }

  {
    const originalMessage = 'drop the lower work Monday but keep the flush';
    const adapter = new RecordingRevisionAdapter(removePastMondayStrengthKeepFlush);
    const first = await runTurn({
      message: originalMessage,
      adapter,
      visibleDate: PAST_MONDAY,
    });
    ok('[5] stale date asks clarification', /Do you mean next Monday instead/.test(first.reply), first.reply);
    ok('[5] pending stores revision', !!first.pending?.coachRevisionProposalEnvelope, first.pending);
    const second = await runTurn({
      message: 'yeah',
      adapter,
      seed: false,
      visibleDate: NEXT_MONDAY,
    });
    eq('[5] resume uses original wording', adapter.calls[1]?.userMessage, originalMessage);
    eq('[5] resume patches target date',
      (adapter.calls[1]?.recentContext as any)?.pendingCoachRevision?.targetDateOverride,
      NEXT_MONDAY);
    ok('[5] resumed strength removal applied', second.visible.strengthItems.length === 0, second.visible.items);
    ok('[5] resumed conditioning preserved', second.visible.conditioningItems.length > 0, second.visible.items);
    eq('[5] pending cleared after resume', second.pending, null);
  }

  {
    const adapter = new RecordingRevisionAdapter(protectedViolation);
    const result = await runTurn({
      message: 'drop lower work tomorrow but keep the flush',
      adapter,
    });
    ok('[6] protected violation blocked', /left the plan unchanged/.test(result.reply), result.reply);
    ok('[6] no override on protected violation', !result.dateOverrides[THURSDAY], result.dateOverrides);
    ok('[6] no legacy fallback after invalid revision', result.classifierCalls === 0, result.classifierCalls);
  }

  {
    const adapter = new RecordingRevisionAdapter(unknownIdProposal);
    const result = await runTurn({
      message: 'drop lower work tomorrow',
      adapter,
    });
    ok('[7] unknown ids blocked', /left the plan unchanged/.test(result.reply), result.reply);
    ok('[7] no override on unknown ids', !result.dateOverrides[THURSDAY], result.dateOverrides);
    ok('[7] no legacy fallback on unknown ids', result.classifierCalls === 0, result.classifierCalls);
  }

  {
    const adapter = new RecordingRevisionAdapter(unrelatedDayProposal);
    const result = await runTurn({
      message: 'drop lower work tomorrow',
      adapter,
    });
    ok('[8] unrelated day change blocked', /left the plan unchanged/.test(result.reply), result.reply);
    ok('[8] requested day unchanged', !result.dateOverrides[THURSDAY], result.dateOverrides);
    ok('[8] unrelated next Monday unchanged', !result.dateOverrides[NEXT_MONDAY], result.dateOverrides);
  }

  {
    const adapter = new RecordingRevisionAdapter(malformedProposal);
    const result = await runTurn({
      message: 'drop lower work tomorrow',
      adapter,
    });
    ok('[9] malformed proposal blocked', /left the plan unchanged/.test(result.reply), result.reply);
    ok('[9] no legacy fallback after malformed proposal', result.classifierCalls === 0, result.classifierCalls);
    ok('[9] no override after malformed proposal', !result.dateOverrides[THURSDAY], result.dateOverrides);
  }

  {
    const adapter = new RecordingRevisionAdapter(removeStrengthKeepFlush);
    const result = await runTurn({
      message: 'drop lower work tomorrow but keep the flush',
      adapter,
      visibleDate: THURSDAY,
    });
    const programTab = programTabDaySnapshot(THURSDAY);
    const detail = detailDaySnapshot(THURSDAY);
    ok('[10] override projection matches Program tab/detail',
      JSON.stringify(programTab) === JSON.stringify(detail),
      { programTab, detail });
    ok('[10] Program tab/detail show conditioning only',
      (programTab.workout?.sections ?? []).length === 1 &&
        programTab.workout?.sections[0]?.kind === 'conditioning',
      programTab);
    ok('[10] no Done without visible override',
      /Done\./.test(result.reply) && !!result.dateOverrides[THURSDAY],
      { reply: result.reply, overrides: result.dateOverrides });
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
