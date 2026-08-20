import type { Workout } from '../types/domain';
import {
  parseGameSessionOutcome,
  parseTeamTrainingSessionOutcome,
  parseSessionOutcomeReason,
  type FeedbackCompletion,
  type FeedbackPartialReason,
  type FeedbackSkipReason,
  type RecordSessionOutcomeComponentIntent,
  type RecordSessionOutcomeIntent,
  type SessionOutcomeReason,
  type SessionOutcomeSourceMetadata,
  type SessionOutcomeTransactionReceipt,
} from '../types/sessionOutcome';
import {
  useProgramStore,
  type SessionFeedback,
  type SessionFeedbackComponent,
} from './programStore';
import { runCoachMutationTransaction } from './coachMutationTransaction';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { buildDayWorkoutProjectedDay } from '../utils/visibleProgramReadModel';
import { resolveDateWithConditioning } from '../utils/sessionResolver';
import { appDateNow, todayISOLocal } from '../utils/appDate';
import {
  getSessionComponents,
  type SessionComponent,
} from '../utils/sessionComponents';
import { deriveAggregateCompletion } from '../utils/sessionFeedbackForm';
import { deriveSessionExecutionItemCompletion } from '../utils/sessionExecutionChecklist';
import { classifyDaySessions } from '../rules/sessionTaxonomy';
import { injurySessionOutcomeRefusal } from '../rules/injuryWithheldRows';
import { isTeamTrainingSession } from '../utils/teamTraining';
import { buildStrengthPerformanceLogs } from '../utils/strengthLogging';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';
import {
  beginAthleteActionTrace,
  emitAthleteActionEvent,
} from '../utils/athleteActionDiagnostics';

export class SessionOutcomeValidationError extends Error {
  readonly code = 'session_outcome_validation_failed';

  constructor(public readonly detailCode: string, message: string) {
    super(message);
    this.name = 'SessionOutcomeValidationError';
  }
}

export type SessionOutcomeTransactionResult =
  | {
      ok: true;
      status: 'committed' | 'idempotent';
      normalizedIntent: RecordSessionOutcomeIntent;
      feedback: SessionFeedback;
      receipt: SessionOutcomeTransactionReceipt;
      persistedEnvelope: string;
    }
  | {
      ok: false;
      code: string;
      reason: string;
    };

export interface ResolvedSessionOutcomeTarget {
  date: string;
  workout: Workout;
  components: SessionComponent[];
}

/**
 * WHY THIS OUTCOME CANNOT BE RECORDED, or `null` when it can.
 *
 * THE RULE HAS ONE OWNER AND TWO READERS. `resolveSessionOutcomeTarget` refuses
 * below by consuming exactly this answer; `SessionFeedbackPanel` asks it before
 * offering "Save & Finish". Until 2026-08-06 only the door knew, so the panel
 * rendered the control for a session that had not happened yet, the athlete
 * tapped it, the door refused, and the handler's `if (!result.ok) return;`
 * dropped the refusal on the floor — the button did nothing and said nothing
 * (Sam, R3 door pass, finding 4).
 *
 * A DATE COMPARISON COPIED INTO THE PANEL WOULD HAVE FIXED THE SYMPTOM AND
 * REBUILT THE CAUSE: two owners of one rule, drifting apart at the next change.
 * `sessionOutcomeControlOwnershipTests` cell 4 sweeps for exactly that copy.
 */
export function sessionOutcomeRecordableRefusal(
  date: string,
  todayISO: string = todayISOLocal(),
): { code: string; message: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { code: 'invalid_date', message: `Invalid session date: ${date}` };
  }
  if (date > todayISO) {
    return {
      code: 'future_session_outcome',
      message: 'Session outcomes can only be recorded for today or a past session.',
    };
  }
  /* ── A RED-FLAG INJURY MAKES THE DAY UNCOMPLETABLE ───────────────────────
   *
   * Sam, 2026-08-20: *"the injured date cannot be completed as normal ... or
   * block the session if necessary."* His Bible's serious-issue rule is the
   * same sentence from the other end — *"the app should stop affected training
   * and recommend physio/medical advice"* — and a session the athlete can tick
   * off as done is not stopped.
   *
   * IT LANDS HERE AND NOWHERE ELSE **because this function already has two
   * readers**: the write door below, and `SessionFeedbackPanel`, which asks it
   * before offering "Save & Finish". Putting the rule anywhere else would give
   * the panel a session it will offer and the door will refuse — the exact
   * defect this function's own header records from 2026-08-06. It also means
   * the UI lane needs no change to honour the ruling.
   *
   * Only a RED FLAG blocks. An ordinary injury substitutes and the athlete
   * trains, so refusing there would stop training the app is meant to keep. */
  const injuryRefusal = injurySessionOutcomeRefusal({
    workout: visibleWorkoutForRefusal(date),
    dateISO: date,
    facts: useProgramStore.getState().acceptedMaterialContext?.temporarySourceFacts,
  });
  if (injuryRefusal) return injuryRefusal;
  return null;
}

/**
 * The day the ACCEPTED PROGRAM plus the live injury fact describes.
 *
 * ⚠ **DELIBERATELY NOT `buildDayWorkoutProjectedDay`, AND MEASURED THAT WAY.**
 * That owner runs `projectVisibleDay`, which BLANKS the session outright while a
 * red-flag injury constraint is active — measured identically on `main`
 * `9f081efa` and on this branch, so it is the visible-projection lane's
 * behaviour and not this unit's. Asking it here made the refusal answer
 * *"No visible session exists on 2026-07-20"* about a day that holds five
 * exercises, which tells the athlete the wrong thing about the right outcome.
 *
 * `resolveDateWithConditioning` is the resolver those projections are built
 * FROM, and under this unit it returns the accepted rows with the injury's
 * marks on them — which is exactly the question this refusal asks.
 */
function visibleWorkoutForRefusal(date: string): Workout | null {
  try {
    return resolveDateWithConditioning(date, buildScheduleStateImperative()).workout ?? null;
  } catch {
    // A day that cannot be resolved is not a day this rule can speak about.
    return null;
  }
}

export function resolveSessionOutcomeTarget(
  date: string,
  todayISO: string = todayISOLocal(),
): ResolvedSessionOutcomeTarget {
  const refusal = sessionOutcomeRecordableRefusal(date, todayISO);
  if (refusal) {
    throw new SessionOutcomeValidationError(refusal.code, refusal.message);
  }
  const programState = useProgramStore.getState();
  const day = buildDayWorkoutProjectedDay({
    date,
    todayISO,
    state: buildScheduleStateImperative(),
    overrideContext: programState.overrideContexts[date],
  });
  if (!day.workout) {
    throw new SessionOutcomeValidationError(
      'session_not_found',
      `No visible session exists on ${date}.`,
    );
  }
  return { date, workout: day.workout, components: getSessionComponents(day.workout) };
}

/** Tap adapter: convert the existing feedback form payload into the shared intent. */
export function createRecordSessionOutcomeIntentFromFeedback(args: {
  date: string;
  feedback: SessionFeedback;
  workout?: Workout | null;
  source: SessionOutcomeSourceMetadata;
  todayISO?: string;
}): RecordSessionOutcomeIntent {
  const target = args.workout
    ? { workout: args.workout, components: getSessionComponents(args.workout) }
    : resolveSessionOutcomeTarget(args.date, args.todayISO);
  const componentOutcomes = args.feedback.components?.length
    ? args.feedback.components.map(
        (component): RecordSessionOutcomeComponentIntent => ({
          componentId: component.componentId,
          kind: component.kind,
          label: component.label,
          completion: component.completion,
          reason: component.completion === 'partial'
            ? component.partialReason ?? null
            : component.completion === 'skipped'
              ? component.skipReason ?? null
              : null,
        }),
      )
    : target.components.map((component): RecordSessionOutcomeComponentIntent => ({
        componentId: component.id,
        kind: component.kind,
        label: component.label,
        completion: args.feedback.completion,
        reason: args.feedback.completion === 'partial'
          ? args.feedback.partialReason ?? null
          : args.feedback.completion === 'skipped'
            ? args.feedback.skipReason ?? null
            : null,
      }));
  return {
    date: args.date,
    sessionIdentity: {
      workoutId: target.workout.id,
      ...(target.workout.planEntryId ? { planEntryId: target.workout.planEntryId } : {}),
    },
    completion: args.feedback.completion,
    feeling: args.feedback.feeling ?? null,
    soreness: args.feedback.soreness ?? null,
    reason: args.feedback.completion === 'partial'
      ? args.feedback.partialReason ?? null
      : args.feedback.completion === 'skipped'
        ? args.feedback.skipReason ?? null
        : null,
    componentOutcomes,
    ...(args.feedback.strength ? { strength: args.feedback.strength } : {}),
    ...(args.feedback.conditioning ? { conditioning: args.feedback.conditioning } : {}),
    ...(args.feedback.notes ? { notes: args.feedback.notes } : {}),
    ...(Number.isFinite(args.feedback.difficulty)
      ? { difficulty: args.feedback.difficulty }
      : {}),
    ...(Number.isFinite(args.feedback.actualMinutes) && Number(args.feedback.actualMinutes) > 0
      ? { actualMinutes: args.feedback.actualMinutes }
      : {}),
    ...(args.feedback.executionItems ? { executionItems: args.feedback.executionItems } : {}),
    ...(args.feedback.game ? { game: args.feedback.game } : {}),
    ...(args.feedback.teamTraining ? { teamTraining: args.feedback.teamTraining } : {}),
    source: { ...args.source },
  };
}

/**
 * The only live session-outcome writer. It resolves and validates the visible
 * target, publishes one feedback/progression fact, durably acknowledges it,
 * and never changes workout content or Coach Note state.
 */
export async function commitSessionOutcomeTransaction(
  intent: RecordSessionOutcomeIntent,
  todayISO: string = todayISOLocal(),
): Promise<SessionOutcomeTransactionResult> {
  // THE DOOR'S CLOCK IS AN INPUT, like every other fact it reads.
  //
  // Its two siblings in this file — `resolveSessionOutcomeTarget` and
  // `createRecordSessionOutcomeIntentFromFeedback` — already take `todayISO`
  // with exactly this default. This one read the wall clock and could not be
  // told otherwise, which made any world-based test of it depend on the day it
  // was RUN rather than on the world it declares.
  //
  // That is not hypothetical: `sessionOutcomeControlOwnershipTests` cell 1 asks
  // this door to refuse a future session in a world pinned to 2026-08-05. It
  // passed while the wall clock agreed and went red the moment the date rolled
  // over, because the session it calls "tomorrow" had become the real today.
  // A suite that changes its answer overnight is not a gate.
  //
  // Production behaviour is unchanged — every caller that omits this argument
  // still gets the athlete's real today.
  const commandTodayISO = todayISO;
  const trace = beginAthleteActionTrace({
    source: intent.source.entryPoint,
    actionType: 'session_feedback',
    route: 'commit_session_outcome_transaction',
    sessionDate: intent.date,
    targetDate: intent.date,
    planEntryId: intent.sessionIdentity.planEntryId ?? null,
    workoutId: intent.sessionIdentity.workoutId ?? null,
  });
  emitAthleteActionEvent(trace, 'athlete_action_parsed', {
    completionState: intent.completion,
    componentCount: intent.componentOutcomes.length,
  });
  emitAthleteActionEvent(trace, 'athlete_action_route_selected', {
    selectedRoute: 'session_outcome_transaction',
    producer: 'commitSessionOutcomeTransaction',
  });

  let normalizedIntent: RecordSessionOutcomeIntent;
  let candidateFeedback: SessionFeedback;
  let receipt: SessionOutcomeTransactionReceipt;
  try {
    const target = resolveSessionOutcomeTarget(intent.date, commandTodayISO);
    normalizedIntent = normalizeIntent(intent, target);
    candidateFeedback = feedbackFromIntent(normalizedIntent);
    const semanticHash = deterministicHash(semanticOutcomeFact(candidateFeedback));
    receipt = {
      protocolVersion: 1,
      transactionId: `session-outcome:${intent.date}:${target.workout.planEntryId ?? target.workout.id}:${semanticHash}`,
      semanticFingerprint: semanticHash,
      committedAt: appDateNow().toISOString(),
      date: intent.date,
      sessionIdentity: {
        workoutId: target.workout.id,
        ...(target.workout.planEntryId ? { planEntryId: target.workout.planEntryId } : {}),
      },
      componentIds: normalizedIntent.componentOutcomes.map((component) => component.componentId),
      source: {
        ...intent.source,
        traceId: intent.source.traceId ?? trace.traceId,
      },
    };
    candidateFeedback = { ...candidateFeedback, outcomeReceipt: receipt };
  } catch (error) {
    const code = error instanceof SessionOutcomeValidationError
      ? error.detailCode
      : 'session_outcome_normalization_failed';
    emitAthleteActionEvent(trace, 'athlete_action_failed', {
      outcome: 'rejected',
      internalResultCode: code,
      originalRejectionCode: code,
      firstFailingBoundary: 'normalizeSessionOutcomeIntent',
      previousStateRestored: true,
    });
    return { ok: false, code, reason: error instanceof Error ? error.message : String(error) };
  }

  type Publication = {
    status: 'committed' | 'idempotent';
    feedback: SessionFeedback;
    receipt: SessionOutcomeTransactionReceipt;
  };
  try {
    const transaction = await runCoachMutationTransaction<Publication>({
      todayISO: commandTodayISO,
      extraDates: [intent.date],
      allowAcceptedStateOnlyChange: true,
      allowIdempotentNoop: true,
      mutate: () => {
        const state = useProgramStore.getState();
        const existing = state.sessionFeedback[intent.date];
        const sameSemanticOutcome = !!existing &&
          semanticFingerprint(semanticOutcomeFact(existing)) ===
            semanticFingerprint(semanticOutcomeFact(candidateFeedback));
        if (sameSemanticOutcome && existing.outcomeReceipt) {
          return {
            status: 'idempotent',
            feedback: existing,
            receipt: existing.outcomeReceipt,
          };
        }
        useProgramStore.setState({
          sessionFeedback: {
            ...state.sessionFeedback,
            [intent.date]: candidateFeedback,
          },
        });
        return { status: 'committed', feedback: candidateFeedback, receipt };
      },
      didApply: () => true,
      verifyAfterPersistence: () => {
        const persisted = useProgramStore.getState().sessionFeedback[intent.date];
        const expected = semanticFingerprint(semanticOutcomeFact(candidateFeedback));
        return {
          ok: !!persisted && semanticFingerprint(semanticOutcomeFact(persisted)) === expected,
          reason: 'session_outcome_fact_changed_after_persistence',
        };
      },
    });
    if (transaction.ok === false) {
      emitAthleteActionEvent(trace, 'athlete_action_failed', {
        outcome: 'rejected',
        internalResultCode: transaction.route,
        originalRejectionCode: transaction.route,
        firstFailingBoundary: 'runCoachMutationTransaction',
        previousStateRestored: transaction.rollbackVerified,
      });
      return { ok: false, code: transaction.route, reason: transaction.reason };
    }
    emitAthleteActionEvent(trace, 'persistence_result', {
      persistenceOperation: 'write',
      persistenceStore: 'program-store',
      persistenceSucceeded: true,
    });
    emitAthleteActionEvent(trace, 'accepted_state_publication_result', {
      published: true,
      outcome: transaction.value.status,
      acceptedStateVersion: useProgramStore.getState().acceptedMaterialContext.revision,
    });
    emitAthleteActionEvent(trace, 'athlete_action_completed', {
      outcome: transaction.value.status,
      internalResultCode: `session_outcome_${transaction.value.status}`,
    });
    return {
      ok: true,
      status: transaction.value.status,
      normalizedIntent,
      feedback: transaction.value.feedback,
      receipt: transaction.value.receipt,
      persistedEnvelope: transaction.persistedEnvelope,
    };
  } catch (error) {
    const code = (error as { code?: string })?.code ?? 'session_outcome_transaction_failed';
    emitAthleteActionEvent(trace, 'athlete_action_failed', {
      outcome: 'failed',
      internalResultCode: code,
      originalRejectionCode: code,
      firstFailingBoundary: 'commitSessionOutcomeTransaction',
      previousStateRestored: true,
    });
    return { ok: false, code, reason: error instanceof Error ? error.message : String(error) };
  }
}

function normalizeIntent(
  intent: RecordSessionOutcomeIntent,
  target: ResolvedSessionOutcomeTarget,
): RecordSessionOutcomeIntent {
  validateTargetIdentity(intent, target.workout);
  const actualById = new Map<string, SessionComponent>(
    target.components.map((component) => [component.id, component]),
  );
  const seen = new Set<string>();
  const suppliedById = new Map<string, RecordSessionOutcomeComponentIntent>();
  for (const supplied of intent.componentOutcomes) {
    if (seen.has(supplied.componentId)) {
      throw new SessionOutcomeValidationError(
        'duplicate_component_identity',
        `Component ${supplied.componentId} was supplied more than once.`,
      );
    }
    seen.add(supplied.componentId);
    const actual = actualById.get(supplied.componentId);
    if (!actual || actual.kind !== supplied.kind) {
      throw new SessionOutcomeValidationError(
        'component_identity_mismatch',
        `Component ${supplied.componentId} is not part of the visible session.`,
      );
    }
    validateReason(supplied.completion, supplied.reason, supplied.componentId);
    suppliedById.set(supplied.componentId, {
      componentId: actual.id,
      kind: actual.kind,
      label: actual.label,
      completion: supplied.completion,
      reason: supplied.completion === 'full' ? null : supplied.reason,
    });
  }
  const componentOutcomes = target.components
    .map((component) => suppliedById.get(component.id))
    .filter((component): component is RecordSessionOutcomeComponentIntent => !!component);
  if (componentOutcomes.length !== target.components.length) {
    throw new SessionOutcomeValidationError(
      'incomplete_component_outcomes',
      'Every visible session component must have an outcome before feedback is recorded.',
    );
  }
  const componentAggregate = deriveAggregateCompletion(
    target.components,
    Object.fromEntries(componentOutcomes.map((component) => [
      component.componentId,
      component.completion,
    ])),
    intent.completion,
  ) ?? intent.completion;
  const executionAggregate = intent.executionItems?.length
    ? deriveSessionExecutionItemCompletion(intent.executionItems)
    : null;
  const aggregate = executionAggregate ?? componentAggregate;
  validateReason(aggregate, intent.reason, 'session');

  const strengthCompletion = componentOutcomes.find((component) =>
    component.kind === 'strength')?.completion ?? aggregate;
  const conditioningCompletion = componentOutcomes.find((component) =>
    component.kind === 'conditioning' || component.kind === 'finisher')?.completion ?? aggregate;
  const strength = strengthCompletion === 'skipped'
    ? undefined
    : intent.strength?.length
      ? intent.strength
      : target.components.some((component) => component.kind === 'strength')
        ? buildStrengthPerformanceLogs(
            target.workout,
            useProgramStore.getState().weightOverrides[intent.date] ?? {},
            strengthCompletion,
          )
        : undefined;
  const conditioning = conditioningCompletion === 'skipped'
    ? undefined
    : intent.conditioning;
  const notes = intent.notes?.trim();
  const skipped = aggregate === 'skipped';
  const parsedGame = intent.game === undefined ? null : parseGameSessionOutcome(intent.game);
  const parsedTeamTraining = intent.teamTraining === undefined
    ? null
    : parseTeamTrainingSessionOutcome(intent.teamTraining);
  if (intent.game !== undefined && parsedGame === null) {
    throw new SessionOutcomeValidationError(
      'invalid_game_outcome',
      'The game result is incomplete or invalid.',
    );
  }
  const targetIsGame = classifyDaySessions(target.workout)
    .some((unit) => unit.category === 'game');
  if (parsedGame && !targetIsGame) {
    throw new SessionOutcomeValidationError(
      'game_outcome_on_non_game',
      'Game feedback can only be recorded for a game or practice match.',
    );
  }
  if (intent.teamTraining !== undefined && parsedTeamTraining === null) {
    throw new SessionOutcomeValidationError(
      'invalid_team_training_outcome',
      'The team-training duration or effort is incomplete or invalid.',
    );
  }
  if (parsedTeamTraining && !isTeamTrainingSession(target.workout)) {
    throw new SessionOutcomeValidationError(
      'team_training_outcome_on_non_team_session',
      'Team-training feedback can only be recorded for a session containing team training.',
    );
  }
  if (parsedTeamTraining && skipped) {
    throw new SessionOutcomeValidationError(
      'team_training_outcome_on_skipped_session',
      'Team-training feedback cannot be recorded when the session was skipped.',
    );
  }
  return {
    date: intent.date,
    sessionIdentity: {
      workoutId: target.workout.id,
      ...(target.workout.planEntryId ? { planEntryId: target.workout.planEntryId } : {}),
    },
    completion: aggregate,
    feeling: skipped ? null : intent.feeling,
    soreness: skipped ? null : intent.soreness,
    reason: aggregate === 'full' ? null : intent.reason,
    componentOutcomes,
    ...(strength && strength.length > 0 ? { strength } : {}),
    ...(conditioning ? { conditioning } : {}),
    ...(notes ? { notes } : {}),
    ...(!skipped && Number.isFinite(intent.difficulty)
      ? { difficulty: Math.max(1, Math.min(10, Math.round(intent.difficulty!))) }
      : {}),
    ...(!skipped && Number.isFinite(intent.actualMinutes) && Number(intent.actualMinutes) > 0
      ? { actualMinutes: Math.round(intent.actualMinutes!) }
      : {}),
    ...(intent.executionItems ? { executionItems: intent.executionItems } : {}),
    ...(parsedGame ? { game: parsedGame } : {}),
    ...(parsedTeamTraining ? { teamTraining: parsedTeamTraining } : {}),
    source: { ...intent.source },
  };
}

function validateTargetIdentity(intent: RecordSessionOutcomeIntent, workout: Workout): void {
  if (intent.sessionIdentity.workoutId !== workout.id) {
    throw new SessionOutcomeValidationError(
      'workout_identity_mismatch',
      'The target workout changed before the outcome could be recorded.',
    );
  }
  if (
    intent.sessionIdentity.planEntryId &&
    intent.sessionIdentity.planEntryId !== workout.planEntryId
  ) {
    throw new SessionOutcomeValidationError(
      'plan_entry_identity_mismatch',
      'The target plan entry changed before the outcome could be recorded.',
    );
  }
}

function validateReason(
  completion: FeedbackCompletion,
  reason: SessionOutcomeReason | null,
  subject: string,
): void {
  if (reason === null || completion === 'full') return;
  if (parseSessionOutcomeReason(completion, reason) === reason) return;
  if (completion === 'partial') {
    throw new SessionOutcomeValidationError(
      'invalid_partial_reason',
      `${subject} has an invalid partial-completion reason.`,
    );
  }
  if (completion === 'skipped') {
    throw new SessionOutcomeValidationError(
      'invalid_skip_reason',
      `${subject} has an invalid skip reason.`,
    );
  }
}

function feedbackFromIntent(intent: RecordSessionOutcomeIntent): SessionFeedback {
  const components = intent.componentOutcomes.map((component): SessionFeedbackComponent => ({
    componentId: component.componentId,
    kind: component.kind,
    label: component.label,
    completion: component.completion,
    ...(component.completion === 'partial' && component.reason
      ? { partialReason: component.reason as FeedbackPartialReason }
      : {}),
    ...(component.completion === 'skipped' && component.reason
      ? { skipReason: component.reason as FeedbackSkipReason }
      : {}),
  }));
  return {
    dateStr: intent.date,
    completion: intent.completion,
    ...(components.length > 0 ? { components } : {}),
    ...(intent.feeling ? { feeling: intent.feeling } : {}),
    ...(intent.soreness ? { soreness: intent.soreness } : {}),
    ...(intent.completion === 'partial' && intent.reason
      ? { partialReason: intent.reason as FeedbackPartialReason }
      : {}),
    ...(intent.completion === 'skipped' && intent.reason
      ? { skipReason: intent.reason as FeedbackSkipReason }
      : {}),
    ...(intent.strength ? { strength: intent.strength } : {}),
    ...(intent.conditioning ? { conditioning: intent.conditioning } : {}),
    ...(intent.notes ? { notes: intent.notes } : {}),
    ...(Number.isFinite(intent.difficulty) ? { difficulty: intent.difficulty } : {}),
    ...(intent.executionItems ? { executionItems: intent.executionItems } : {}),
    ...(intent.game ? { game: intent.game } : {}),
    ...(intent.teamTraining ? { teamTraining: intent.teamTraining } : {}),
  };
}

function semanticOutcomeFact(feedback: SessionFeedback): Omit<SessionFeedback, 'outcomeReceipt'> {
  const { outcomeReceipt: _receipt, ...fact } = feedback;
  return fact;
}

function deterministicHash(value: unknown): string {
  const input = semanticFingerprint(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
