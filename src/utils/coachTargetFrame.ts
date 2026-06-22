import type { ResolvedDay } from './sessionResolver';
import type { CoachContextEntry } from '../store/coachContextStateStore';
import { COACH_CONTEXT_TTL_MS } from '../store/coachContextStateStore';
import type { PendingScheduleTransaction } from '../store/pendingCoachClarifierStore';
import type {
  CoachReferenceResolution,
  CoachReferenceTarget,
  CoachReferenceMethod,
} from './coachReferenceResolver';
import { isMutationLike } from './coachReferenceResolver';
import { extractVisibleProgramItemsFromWorkout } from './visibleProgramReadModel';

export type CoachTargetSource =
  | 'pending_transaction'
  | 'last_mutation'
  | 'explicit_message'
  | 'opened_session'
  | 'explained_session'
  | 'selected_day'
  | 'visible_week'
  | 'ambiguous';

export type CoachExplicitDateRole =
  | 'referent'
  | 'destination'
  | 'none'
  | 'ambiguous';

export type CoachResolvedTargetKind =
  | 'session'
  | 'conditioning_item'
  | 'exercise'
  | 'day';

export interface CoachResolvedTarget {
  kind: CoachResolvedTargetKind;
  date: string;
  sessionName?: string;
  itemId?: string;
  itemTitle?: string;
  domain?: 'session' | 'conditioning' | 'strength' | 'schedule';
  stillVisible: boolean;
}

export interface CoachTargetCandidateOption {
  label: string;
  date?: string;
  sessionName?: string;
  itemId?: string;
  itemTitle?: string;
}

export interface CoachTargetFrame {
  resolvedTarget: CoachResolvedTarget | null;
  confidence: number;
  targetSource: CoachTargetSource;
  missingFields: string[];
  candidateOptions: CoachTargetCandidateOption[];
  reason: string;
  explicitDateRole: CoachExplicitDateRole;
}

export interface ResolveCoachTargetFrameInput {
  userMessage: string;
  visibleWeek: ResolvedDay[];
  pendingTransaction?: PendingScheduleTransaction | null;
  lastMutationTarget?: CoachContextEntry | null;
  openedSession?: CoachContextEntry | null;
  explainedSession?: CoachContextEntry | null;
  selectedDate?: string | null;
  todayISO: string;
  now?: number;
}

const DOW_BY_NAME: Record<string, number> = {
  sun: 0, sunday: 0, sundays: 0,
  mon: 1, monday: 1, mondays: 1,
  tue: 2, tues: 2, tuesday: 2, tuesdays: 2,
  wed: 3, weds: 3, wednesday: 3, wednesdays: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, thursdays: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6, saturdays: 6,
};

const DAY_PATTERN =
  '(?:today|tomorrow|sun(?:day|days)?|mon(?:day|days)?|tue(?:s|sday|sdays|days)?|wed(?:nesday|nesdays|s)?|thu(?:rs(?:day|days)?|r|rs)?|fri(?:day|days)?|sat(?:urday|urdays|s)?)';

const TARGET_REFERENT_RE =
  /\b(?:it|that|this|them|those|there)\b|\b(?:that|this)\s+(?:conditioning|session|workout|day|one|flush|rower|bike|run|exercise)\b|\bthe\s+one\s+(?:you\s+)?(?:just\s+)?(?:added|changed|moved|mentioned)\b|\bthe\s+(?:conditioning|flush|rower|bike|run|session|workout|exercise)\b/i;

const MOVE_VERB_RE =
  /\b(?:mov(?:e|ed|es|ing)|shift(?:ed|ing|s)?|push(?:ed|ing|es)?|bump(?:ed|ing|s)?|reschedul(?:e|ed|es|ing)|switch(?:ed|ing|es)?|put)\b/i;

const OBJECT_TOKEN_RE =
  /\b(?:conditioning|flush|rower|row|bike|run|pilates|exercise|session|workout)\b/i;

export function resolveCoachTargetFrame(
  input: ResolveCoachTargetFrameInput,
): CoachTargetFrame {
  const now = input.now ?? Date.now();
  const message = String(input.userMessage ?? '').trim();
  const explicitDateRole = inferExplicitDateRole(message);
  const referential = hasReferentialCue(message);

  const pendingFrame = frameFromPendingTransaction(input.pendingTransaction, input.visibleWeek);
  if (pendingFrame) {
    return {
      ...pendingFrame,
      explicitDateRole,
    };
  }

  const lastMutation = freshEntry(input.lastMutationTarget ?? null, now);
  if (referential && lastMutation) {
    const target = targetFromContextEntry(lastMutation, input.visibleWeek, message, {
      requireNameMatch: true,
    });
    if (target) {
      return resolvedFrame(target, 'last_mutation', 0.92, 'last_mutation_referent', explicitDateRole);
    }
    return ambiguousFrame({
      reason: 'last_mutation_not_visible',
      explicitDateRole,
      missingFields: ['target'],
      candidateOptions: visibleWeekOptions(input.visibleWeek),
    });
  }

  const explicitFrame = frameFromExplicitMessage(message, input.visibleWeek, input.todayISO, explicitDateRole);
  if (explicitFrame) return explicitFrame;

  const opened = freshEntry(input.openedSession ?? null, now);
  if (referential && opened) {
    const target = targetFromContextEntry(opened, input.visibleWeek, message, {
      requireNameMatch: false,
    });
    if (target) {
      return resolvedFrame(target, 'opened_session', 0.8, 'opened_session_referent', explicitDateRole);
    }
  }

  const explained = freshEntry(input.explainedSession ?? null, now);
  if (referential && explained) {
    const target = targetFromContextEntry(explained, input.visibleWeek, message, {
      requireNameMatch: false,
    });
    if (target) {
      return resolvedFrame(target, 'explained_session', 0.78, 'explained_session_referent', explicitDateRole);
    }
  }

  if (input.selectedDate) {
    const selected = targetFromDate(input.selectedDate, input.visibleWeek, message);
    if (selected && !hasExplicitDateCue(message)) {
      return resolvedFrame(selected, 'selected_day', 0.64, 'selected_day_context', explicitDateRole);
    }
  }

  const visibleFrame = frameFromVisibleWeek(message, input.visibleWeek, explicitDateRole);
  if (visibleFrame) return visibleFrame;

  if (referential) {
    return ambiguousFrame({
      reason: 'referent_without_context',
      explicitDateRole,
      missingFields: ['target'],
      candidateOptions: visibleWeekOptions(input.visibleWeek),
    });
  }

  return {
    resolvedTarget: null,
    confidence: 0,
    targetSource: 'ambiguous',
    missingFields: [],
    candidateOptions: [],
    reason: 'no_target_reference',
    explicitDateRole,
  };
}

export function referenceResolutionFromTargetFrame(
  frame: CoachTargetFrame,
  userMessage: string,
): CoachReferenceResolution {
  const mutationLike = isMutationLike(userMessage);
  if (frame.resolvedTarget) {
    return {
      status: 'resolved',
      target: referenceTargetFromFrame(frame),
      confidence: frame.confidence,
      isMutationLike: mutationLike,
    };
  }

  const candidates = frame.candidateOptions
    .filter((candidate) => candidate.date)
    .map((candidate): CoachReferenceTarget => ({
      date: candidate.date!,
      sessionName: candidate.sessionName ?? candidate.itemTitle ?? candidate.label,
      method: methodForSource(frame.targetSource),
    }));

  if (frame.targetSource === 'ambiguous' && candidates.length > 1) {
    return {
      status: 'ambiguous',
      target: null,
      confidence: frame.confidence,
      candidates,
      failureReason: 'modality_multiple_matches',
      clarifierQuestion: targetFrameClarifier(frame),
      isMutationLike: mutationLike,
    };
  }

  if (frame.missingFields.length > 0) {
    return {
      status: 'no_target',
      target: null,
      confidence: frame.confidence,
      failureReason: 'pronoun_no_context',
      clarifierQuestion: targetFrameClarifier(frame),
      isMutationLike: mutationLike,
    };
  }

  return {
    status: 'no_reference',
    target: null,
    confidence: 0,
    failureReason: 'no_explicit_day_or_pronoun',
    isMutationLike: mutationLike,
  };
}

export function targetFrameFromReferenceTarget(input: {
  target: Pick<CoachReferenceTarget, 'date' | 'sessionName'>;
  targetSource: Exclude<CoachTargetSource, 'ambiguous'>;
  reason: string;
  explicitDateRole: CoachExplicitDateRole;
  confidence?: number;
}): CoachTargetFrame {
  return resolvedFrame(
    {
      kind: 'session',
      date: input.target.date,
      sessionName: input.target.sessionName,
      domain: 'session',
      stillVisible: true,
    },
    input.targetSource,
    input.confidence ?? 0.78,
    input.reason,
    input.explicitDateRole,
  );
}

function frameFromPendingTransaction(
  transaction: PendingScheduleTransaction | null | undefined,
  visibleWeek: ResolvedDay[],
): CoachTargetFrame | null {
  if (!transaction) return null;
  if (transaction.kind === 'move_session_transaction') {
    const date = transaction.sourceDate ?? transaction.targetDate ?? null;
    if (!date) {
      return ambiguousFrame({
        reason: 'pending_transaction_missing_target',
        explicitDateRole: 'none',
        missingFields: ['target'],
        candidateOptions: visibleWeekOptions(visibleWeek),
      });
    }
    const target = targetFromDate(
      date,
      visibleWeek,
      transaction.sourceSessionSnapshot?.summary ?? transaction.sourceSessionSnapshot?.sessionName ?? '',
    ) ?? {
      kind: 'session' as const,
      date,
      sessionName:
        transaction.sourceSessionSnapshot?.sessionName ??
        transaction.sourceSessionSnapshot?.summary ??
        undefined,
      domain: 'session' as const,
      stillVisible: false,
    };
    return resolvedFrame(target, 'pending_transaction', 0.99, 'pending_transaction_target', 'none');
  }

  if (transaction.kind === 'add_to_date_transaction') {
    if (!transaction.targetDate) {
      return ambiguousFrame({
        reason: 'pending_add_transaction_missing_target',
        explicitDateRole: 'none',
        missingFields: ['targetDate'],
        candidateOptions: visibleWeekOptions(visibleWeek),
      });
    }
    const target = targetFromDate(transaction.targetDate, visibleWeek, '');
    return resolvedFrame(
      target ?? {
        kind: 'day',
        date: transaction.targetDate,
        domain: 'schedule',
        stillVisible: false,
      },
      'pending_transaction',
      0.99,
      'pending_transaction_target',
      'none',
    );
  }

  return null;
}

function frameFromExplicitMessage(
  message: string,
  visibleWeek: ResolvedDay[],
  todayISO: string,
  explicitDateRole: CoachExplicitDateRole,
): CoachTargetFrame | null {
  const sourceDow = explicitMoveSourceDow(message);
  if (sourceDow != null) {
    const date = dateForDow(sourceDow, visibleWeek, todayISO);
    const target = targetFromDate(date, visibleWeek, message);
    return resolvedFrame(
      target ?? {
        kind: 'day',
        date,
        domain: 'schedule',
        stillVisible: false,
      },
      'explicit_message',
      0.9,
      'explicit_move_source_date',
      'referent',
    );
  }

  if (explicitDateRole === 'destination') return null;

  const explicitDate = firstExplicitDate(message, visibleWeek, todayISO);
  if (!explicitDate) return null;
  const target = targetFromDate(explicitDate, visibleWeek, message);
  return resolvedFrame(
    target ?? {
      kind: 'day',
      date: explicitDate,
      domain: 'schedule',
      stillVisible: false,
    },
    'explicit_message',
    0.86,
    'explicit_date_reference',
    'referent',
  );
}

function frameFromVisibleWeek(
  message: string,
  visibleWeek: ResolvedDay[],
  explicitDateRole: CoachExplicitDateRole,
): CoachTargetFrame | null {
  if (!OBJECT_TOKEN_RE.test(message)) return null;
  const matches: CoachResolvedTarget[] = [];
  const needle = normalise(message);
  for (const day of visibleWeek) {
    const workout = day.workout;
    if (!workout) continue;
    const workoutName = String(workout.name ?? '');
    if (tokenMatch(needle, workoutName)) {
      matches.push({
        kind: 'session',
        date: day.date,
        sessionName: workoutName,
        domain: 'session',
        stillVisible: true,
      });
    }
    for (const item of extractVisibleProgramItemsFromWorkout(workout)) {
      if (!tokenMatch(needle, item.title)) continue;
      matches.push({
        kind: item.domain === 'conditioning' ? 'conditioning_item' : 'exercise',
        date: day.date,
        sessionName: workoutName,
        itemId: item.id,
        itemTitle: item.title,
        domain: item.domain === 'conditioning' ? 'conditioning' : 'strength',
        stillVisible: true,
      });
    }
  }
  const unique = uniqueTargets(matches);
  if (unique.length === 1) {
    return resolvedFrame(unique[0], 'visible_week', 0.72, 'visible_week_unique_match', explicitDateRole);
  }
  if (unique.length > 1) {
    return ambiguousFrame({
      reason: 'visible_week_multiple_matches',
      explicitDateRole,
      missingFields: ['target'],
      candidateOptions: unique.map(optionFromTarget),
    });
  }
  return null;
}

function targetFromContextEntry(
  entry: CoachContextEntry,
  visibleWeek: ResolvedDay[],
  message: string,
  options: { requireNameMatch: boolean },
): CoachResolvedTarget | null {
  const day = visibleWeek.find((candidate) => candidate.date === entry.date);
  const workout = day?.workout ?? null;
  if (!day || !workout) return null;
  const workoutName = String(workout.name ?? '');
  const entryName = String(entry.sessionName ?? '');
  const nameMatches =
    !entryName ||
    normalise(workoutName) === normalise(entryName) ||
    extractVisibleProgramItemsFromWorkout(workout).some(
      (item) => normalise(item.title) === normalise(entryName),
    );
  if (options.requireNameMatch && !nameMatches) return null;

  const conditioningItems = extractVisibleProgramItemsFromWorkout(workout)
    .filter((item) => item.domain === 'conditioning');
  const wantsConditioning =
    /\b(?:conditioning|flush|rower|row|bike|run|pilates|longer|shorter|duration|minutes?|mins?)\b/i.test(message);
  if (wantsConditioning && conditioningItems.length === 1) {
    const item = conditioningItems[0];
    return {
      kind: 'conditioning_item',
      date: day.date,
      sessionName: workoutName,
      itemId: item.id,
      itemTitle: item.title,
      domain: 'conditioning',
      stillVisible: true,
    };
  }

  return {
    kind: 'session',
    date: day.date,
    sessionName: workoutName || entry.sessionName,
    domain: 'session',
    stillVisible: true,
  };
}

function targetFromDate(
  date: string,
  visibleWeek: ResolvedDay[],
  message: string,
): CoachResolvedTarget | null {
  const day = visibleWeek.find((candidate) => candidate.date === date);
  if (!day) return null;
  const workout = day.workout ?? null;
  if (!workout) {
    return {
      kind: 'day',
      date,
      domain: 'schedule',
      stillVisible: true,
    };
  }
  const workoutName = String(workout.name ?? '');
  const conditioningItems = extractVisibleProgramItemsFromWorkout(workout)
    .filter((item) => item.domain === 'conditioning');
  if (/\b(?:conditioning|flush|rower|row|bike|run|pilates)\b/i.test(message) && conditioningItems.length === 1) {
    const item = conditioningItems[0];
    return {
      kind: 'conditioning_item',
      date,
      sessionName: workoutName,
      itemId: item.id,
      itemTitle: item.title,
      domain: 'conditioning',
      stillVisible: true,
    };
  }
  return {
    kind: 'session',
    date,
    sessionName: workoutName,
    domain: 'session',
    stillVisible: true,
  };
}

function resolvedFrame(
  target: CoachResolvedTarget,
  targetSource: Exclude<CoachTargetSource, 'ambiguous'>,
  confidence: number,
  reason: string,
  explicitDateRole: CoachExplicitDateRole,
): CoachTargetFrame {
  return {
    resolvedTarget: target,
    confidence,
    targetSource,
    missingFields: [],
    candidateOptions: [],
    reason,
    explicitDateRole,
  };
}

function ambiguousFrame(args: {
  reason: string;
  explicitDateRole: CoachExplicitDateRole;
  missingFields: string[];
  candidateOptions: CoachTargetCandidateOption[];
}): CoachTargetFrame {
  return {
    resolvedTarget: null,
    confidence: 0,
    targetSource: 'ambiguous',
    missingFields: args.missingFields,
    candidateOptions: args.candidateOptions,
    reason: args.reason,
    explicitDateRole: args.explicitDateRole,
  };
}

function freshEntry(entry: CoachContextEntry | null, now: number): CoachContextEntry | null {
  if (!entry) return null;
  return now - entry.updatedAt <= COACH_CONTEXT_TTL_MS ? entry : null;
}

function inferExplicitDateRole(message: string): CoachExplicitDateRole {
  if (!hasExplicitDateCue(message)) return 'none';
  if (explicitMoveSourceDow(message) != null) return 'referent';
  if (hasReferentialCue(message) && MOVE_VERB_RE.test(message) && destinationDateCue(message)) {
    return 'destination';
  }
  if (MOVE_VERB_RE.test(message) && destinationDateCue(message)) return 'destination';
  return 'referent';
}

function hasReferentialCue(message: string): boolean {
  return TARGET_REFERENT_RE.test(message);
}

function hasExplicitDateCue(message: string): boolean {
  return new RegExp(`\\b${DAY_PATTERN}\\b`, 'i').test(message);
}

function destinationDateCue(message: string): boolean {
  return new RegExp(`\\b(?:to|onto|on|for)\\s+(?:next\\s+)?${DAY_PATTERN}\\b`, 'i').test(message);
}

function explicitMoveSourceDow(message: string): number | null {
  const re = new RegExp(`\\b(?:move|shift|push|reschedule|put)\\s+(?:my\\s+|the\\s+)?(?:session\\s+|workout\\s+)?(${DAY_PATTERN})\\b[\\s\\S]{0,80}?\\b(?:to|onto|on|for)\\s+(?:next\\s+)?(${DAY_PATTERN})\\b`, 'i');
  const match = message.match(re);
  if (!match) return null;
  return dowFromToken(match[1]);
}

function firstExplicitDate(
  message: string,
  visibleWeek: ResolvedDay[],
  todayISO: string,
): string | null {
  const match = message.match(new RegExp(`\\b(${DAY_PATTERN})\\b`, 'i'));
  if (!match) return null;
  const token = match[1].toLowerCase();
  if (/^today$/.test(token)) return todayISO;
  if (/^tomorrow$/.test(token)) return addDays(todayISO, 1);
  const dow = dowFromToken(token);
  if (dow == null) return null;
  return dateForDow(dow, visibleWeek, todayISO);
}

function dateForDow(dow: number, visibleWeek: ResolvedDay[], todayISO: string): string {
  const visible = visibleWeek.find((day) => isoDow(day.date) === dow);
  return visible?.date ?? nextISOForDow(todayISO, dow);
}

function dowFromToken(token: string): number | null {
  const lower = token.toLowerCase();
  if (lower === 'today' || lower === 'tomorrow') return null;
  return DOW_BY_NAME[lower] ?? null;
}

function nextISOForDow(todayISO: string, dow: number): string {
  const date = new Date(`${todayISO}T12:00:00`);
  const todayDow = date.getDay();
  const delta = ((dow - todayDow) + 7) % 7 || 7;
  date.setDate(date.getDate() + delta);
  return formatISO(date);
}

function addDays(todayISO: string, days: number): string {
  const date = new Date(`${todayISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatISO(date);
}

function isoDow(iso: string): number {
  return new Date(`${iso}T12:00:00`).getDay();
}

function formatISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function referenceTargetFromFrame(frame: CoachTargetFrame): CoachReferenceTarget {
  const target = frame.resolvedTarget!;
  return {
    date: target.date,
    sessionName: target.itemTitle ?? target.sessionName ?? 'session',
    method: methodForSource(frame.targetSource),
    contextSource: contextSourceForFrame(frame),
  };
}

function methodForSource(source: CoachTargetSource): CoachReferenceMethod {
  switch (source) {
    case 'pending_transaction':
    case 'last_mutation':
      return 'pronoun_last_discussed';
    case 'opened_session':
      return 'pronoun_last_opened';
    case 'explained_session':
      return 'pronoun_last_explained';
    case 'explicit_message':
      return 'explicit_day';
    case 'selected_day':
    case 'visible_week':
      return 'implicit_recent_context';
    case 'ambiguous':
      return 'no_match';
    default:
      return 'no_match';
  }
}

function contextSourceForFrame(
  frame: CoachTargetFrame,
): CoachReferenceTarget['contextSource'] | undefined {
  switch (frame.targetSource) {
    case 'last_mutation':
      return 'coach_mutation';
    case 'opened_session':
      return 'day_workout';
    case 'explained_session':
      return 'coach_explanation';
    case 'pending_transaction':
    case 'explicit_message':
    case 'selected_day':
    case 'visible_week':
    case 'ambiguous':
      return undefined;
    default:
      return undefined;
  }
}

function targetFrameClarifier(frame: CoachTargetFrame): string {
  if (frame.candidateOptions.length > 0) {
    return `Which one do you mean: ${frame.candidateOptions.map((option) => option.label).join(' or ')}?`;
  }
  return 'Which session or item do you mean?';
}

function visibleWeekOptions(visibleWeek: ResolvedDay[]): CoachTargetCandidateOption[] {
  return visibleWeek
    .filter((day) => !!day.workout)
    .map((day) => ({
      label: `${day.date}: ${day.workout?.name ?? 'session'}`,
      date: day.date,
      sessionName: day.workout?.name,
    }));
}

function optionFromTarget(target: CoachResolvedTarget): CoachTargetCandidateOption {
  return {
    label: `${target.date}: ${target.itemTitle ?? target.sessionName ?? 'session'}`,
    date: target.date,
    sessionName: target.sessionName,
    itemId: target.itemId,
    itemTitle: target.itemTitle,
  };
}

function uniqueTargets(targets: CoachResolvedTarget[]): CoachResolvedTarget[] {
  const seen = new Set<string>();
  const out: CoachResolvedTarget[] = [];
  for (const target of targets) {
    const key = `${target.kind}|${target.date}|${target.itemId ?? ''}|${target.itemTitle ?? ''}|${target.sessionName ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(target);
  }
  return out;
}

function tokenMatch(messageNeedle: string, title: string | undefined): boolean {
  const titleNorm = normalise(title ?? '');
  if (!titleNorm) return false;
  if (messageNeedle.includes(titleNorm)) return true;
  const titleTokens = titleNorm.split(' ').filter((token) => token.length >= 3);
  return titleTokens.some((token) => messageNeedle.includes(token));
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
