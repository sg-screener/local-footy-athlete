import type {
  CoachContextPacket,
  CoachIntent,
  PendingCoachProposal,
  ProgramAdjustmentConditioningOption,
} from './coachIntent';
import type { AdjustmentEvent } from './programAdjustmentEngine';
import { buildEvent } from './programAdjustmentEngine';
import type { ResolvedDay } from './sessionResolver';
import { logger } from './logger';

export type ProgramAdjustmentRequestOutcome =
  | {
      kind: 'unsupported';
      reply: string;
      mutationAttempted: false;
      events: AdjustmentEvent[];
      proposal?: undefined;
    }
  | {
      kind: 'clarifier';
      reply: string;
      mutationAttempted: false;
      events: AdjustmentEvent[];
      proposal: PendingCoachProposal;
    }
  | {
      kind: 'proposal';
      reply: string;
      mutationAttempted: false;
      events: AdjustmentEvent[];
      proposal: PendingCoachProposal;
    }
  | {
      kind: 'ready';
      mutationAttempted: true;
      events: AdjustmentEvent[];
      proposal: PendingCoachProposal;
      reply?: undefined;
    }
  | {
      kind: 'not_found';
      reply: string;
      mutationAttempted: false;
      events: AdjustmentEvent[];
      proposal?: undefined;
    };

export const UNSUPPORTED_PROGRAM_ADJUSTMENT_REPLY =
  "I can’t redesign the whole week automatically yet, but I can help with a smaller change — like adding/removing conditioning, moving a session, adjusting fatigue, or changing equipment. What would you like changed first?";

const LIGHT_AEROBIC_PRESCRIPTION =
  '8 x 2 min at 75–80% max HR with 1 min easy recovery';
const LIGHT_AEROBIC_MODALITY = 'bike or track';
const SHORT_BIKE_FLUSH_PRESCRIPTION =
  '12–20 min easy spin at 3–4/10 intensity';
const TEMPO_RUNNING_PRESCRIPTION =
  'controlled reps at around 6–7/10 intensity, not a hard sprint session';
const CONDITIONING_OPTIONS: ProgramAdjustmentConditioningOption[] = [
  'light_aerobic_intervals',
  'short_bike_flush',
  'tempo_running',
  'custom',
];
export const PENDING_PROGRAM_PROPOSAL_TTL_MS = 30 * 60 * 1000;

export function isProgramAdjustmentConfirmation(message: string): boolean {
  const m = message.trim().toLowerCase();
  return /^(sounds good|sound good|yep|yeah|yes|do it|go ahead|perfect|that works|works for me|lock it in|please do)([.! ]*)$/.test(m);
}

export function isProgramAdjustmentCancel(message: string): boolean {
  const m = message.trim().toLowerCase();
  return /^(cancel|cancel that|never mind|nevermind|leave it|don't worry|dont worry|scrap that|no thanks)([.! ]*)$/.test(m);
}

export function isPendingProgramProposalExpired(
  proposal: PendingCoachProposal | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!proposal) return false;
  return nowMs - proposal.createdAt > PENDING_PROGRAM_PROPOSAL_TTL_MS;
}

export function planProgramAdjustmentRequest(
  intent: CoachIntent,
  packet: CoachContextPacket,
): ProgramAdjustmentRequestOutcome {
  const message = packet.userMessage;
  const text = `${message} ${intent.payload?.concern ?? ''} ${intent.payload?.requestedSession ?? ''}`.toLowerCase();
  const prior = packet.pendingCoachProposal;

  const action = inferAction(text, prior);
  if (!action) {
    return {
      kind: 'unsupported',
      reply: UNSUPPORTED_PROGRAM_ADJUSTMENT_REPLY,
      mutationAttempted: false,
      events: [],
    };
  }

  if (action === 'move_session') {
    return {
      kind: 'unsupported',
      reply: UNSUPPORTED_PROGRAM_ADJUSTMENT_REPLY,
      mutationAttempted: false,
      events: [],
    };
  }

  const targetDay = inferDay(text, intent.payload?.requestedSession, prior?.targetDay);
  if (!targetDay) {
    return {
      kind: 'clarifier',
      reply: 'Which day should I adjust?',
      mutationAttempted: false,
      events: [],
      proposal: {
        type: 'program_adjustment',
        action,
        createdAt: Date.now(),
      },
    };
  }

  const targetSearch = findTargetSessions(packet, targetDay, prior);
  if (targetSearch.kind === 'not_found') {
    return {
      kind: 'not_found',
      reply: `I couldn't find a ${titleDay(targetDay)} session to edit.`,
      mutationAttempted: false,
      events: [],
    };
  }
  if (targetSearch.kind === 'non_strength_clarifier') {
    return {
      kind: 'clarifier',
      reply: `I found ${titleDay(targetDay)}, but it doesn't look like a strength session. Do you still want me to add light conditioning to it?`,
      mutationAttempted: false,
      events: [],
      proposal: {
        type: 'program_adjustment',
        targetDay: titleDay(targetDay),
        targetDate: targetSearch.target.date,
        targetSessionName: targetSearch.target.workout?.name ?? `${titleDay(targetDay)} session`,
        action,
        allowNonStrengthTarget: true,
        createdAt: Date.now(),
      },
    };
  }
  if (targetSearch.kind === 'ambiguous') {
    return {
      kind: 'clarifier',
      reply: "Do you mean this week's Monday session or next Monday?",
      mutationAttempted: false,
      events: [],
      proposal: {
        type: 'program_adjustment',
        targetDay: titleDay(targetDay),
        action,
        createdAt: Date.now(),
      },
    };
  }
  const targets = targetSearch.targets;

  if (action === 'add_conditioning') {
    const option = resolveConditioningOption(text, prior);
    const customNeedsDetails =
      option === 'custom' && /\bsomething else\b|\bother\b/.test(text);
    const spec = option && !customNeedsDetails ? getConditioningSpec(option, message) : null;
    const hasPrescription = !!spec || !!prior?.prescription;
    const proposal: PendingCoachProposal = {
      type: 'program_adjustment',
      target: `${titleDay(targetDay)} Lower Body Strength`,
      targetDay: titleDay(targetDay),
      targetDate: targets[0].date,
      targetSessionName: targets[0].workout?.name ?? 'Lower Body Strength',
      action,
      conditioningOption: spec?.option ?? prior?.conditioningOption,
      prescription: spec?.prescription ?? prior?.prescription ?? LIGHT_AEROBIC_PRESCRIPTION,
      modality: spec?.modality ?? prior?.modality ?? LIGHT_AEROBIC_MODALITY,
      createdAt: Date.now(),
    };

    if (!hasPrescription) {
      return {
        kind: 'clarifier',
        reply: getConditioningClarifierReply(prior, customNeedsDetails),
        mutationAttempted: false,
        events: [],
        proposal: {
          ...proposal,
          prescription: undefined,
          modality: undefined,
          conditioningOption: undefined,
          needs: 'conditioning_type',
          supportedOptions: CONDITIONING_OPTIONS,
        },
      };
    }

    if (prior && !isProgramAdjustmentConfirmation(message)) {
      return {
        kind: 'proposal',
        reply: getProgramAdjustmentProposalReply(proposal),
        mutationAttempted: false,
        events: [],
        proposal: {
          ...proposal,
          needs: undefined,
          supportedOptions: undefined,
        },
      };
    }

    const eventSpec = getConditioningSpec(
      proposal.conditioningOption ?? 'light_aerobic_intervals',
      message,
    );
    return {
      kind: 'ready',
      mutationAttempted: true,
      proposal,
      events: targets.map((d) =>
        buildEvent(
          'add_conditioning_block',
          d.date,
          eventSpec.coachNote,
          null,
          eventSpec.eventPayload,
        ),
      ),
    };
  }

  const proposal: PendingCoachProposal = {
    type: 'program_adjustment',
    target: `${titleDay(targetDay)} Lower Body Strength`,
    targetDay: titleDay(targetDay),
    targetDate: targets[0].date,
    targetSessionName: targets[0].workout?.name ?? 'Lower Body Strength',
    action,
    createdAt: Date.now(),
  };
  return {
    kind: 'ready',
    mutationAttempted: true,
    proposal,
    events: targets.map((d) =>
      buildEvent(
        'remove_conditioning_block',
        d.date,
        'Removed conditioning from this session',
      ),
    ),
  };
}

function inferAction(text: string, prior?: PendingCoachProposal | null): PendingCoachProposal['action'] | null {
  if (/remove|take\s+out|drop|delete/.test(text) && /conditioning|interval|aerobic/.test(text)) {
    return 'remove_conditioning';
  }
  if (/move|shift|swap\s+day|change\s+day/.test(text)) {
    return 'move_session';
  }
  if (/conditioning|interval|aerobic|bike|track|run/.test(text) || prior?.action === 'add_conditioning') {
    return 'add_conditioning';
  }
  return prior?.action ?? null;
}

function inferDay(
  text: string,
  requestedSession?: string,
  priorDay?: string,
): string | null {
  const hay = `${text} ${requestedSession ?? ''}`.toLowerCase();
  for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
    if (hay.includes(day)) return day;
  }
  return priorDay?.toLowerCase() ?? null;
}

interface ConditioningSpec {
  option: ProgramAdjustmentConditioningOption;
  prescription: string;
  modality?: string;
  coachNote: string;
  requiredText: string;
  proposalReply: string;
  doneReply: string;
  eventPayload: {
    title: string;
    description: string;
    notes: string;
    coachNote: string;
    sets?: number;
    minutes?: number;
    restSeconds?: number;
  };
}

function resolveConditioningOption(
  text: string,
  prior?: PendingCoachProposal | null,
): ProgramAdjustmentConditioningOption | null {
  const m = text.trim().toLowerCase();
  if (/\b(short\s+)?bike\s+flush\b|\beasy\s+spin\b|\bflush\b/.test(m)) {
    return 'short_bike_flush';
  }
  if (/\btempo\s+(running|run)\b|\btempo\b/.test(m)) {
    return 'tempo_running';
  }
  if (/\b(light\s+)?aerobic\s+intervals?\b|\bintervals?\b|\b75\s*[–%-]?\s*80\b/.test(m)) {
    return 'light_aerobic_intervals';
  }
  if (/\bsomething else\b|\bother\b|\bfree\s*text\b/.test(m)) {
    return 'custom';
  }
  return prior?.conditioningOption ?? null;
}

function getConditioningSpec(
  option: ProgramAdjustmentConditioningOption,
  rawText: string,
): ConditioningSpec {
  if (option === 'short_bike_flush') {
    return {
      option,
      prescription: SHORT_BIKE_FLUSH_PRESCRIPTION,
      modality: 'bike',
      coachNote: 'Added a short bike flush after strength',
      requiredText: 'bike',
      proposalReply:
        'I can add a short bike flush after Monday strength — 12–20 min easy spin at 3–4/10 intensity. Reply "sounds good" and I\'ll apply it.',
      doneReply: 'Done — Monday now finishes with a short bike flush after strength.',
      eventPayload: {
        title: 'Short Bike Flush',
        description: SHORT_BIKE_FLUSH_PRESCRIPTION,
        notes: 'Keep it very easy. Smooth spin, nasal-breathing pace if possible.',
        coachNote: 'Added a short bike flush after strength',
        sets: 1,
        minutes: 16,
        restSeconds: 0,
      },
    };
  }
  if (option === 'tempo_running') {
    return {
      option,
      prescription: TEMPO_RUNNING_PRESCRIPTION,
      modality: 'running',
      coachNote: 'Added tempo running after strength',
      requiredText: 'tempo',
      proposalReply:
        'I can add tempo running after Monday strength — controlled reps at around 6–7/10 intensity, not a hard sprint session. Reply "sounds good" and I\'ll apply it.',
      doneReply: 'Done — Monday now finishes with tempo running after strength.',
      eventPayload: {
        title: 'Tempo Running',
        description: TEMPO_RUNNING_PRESCRIPTION,
        notes: 'Controlled rhythm only. This should not become a sprint session.',
        coachNote: 'Added tempo running after strength',
        sets: 1,
        minutes: 16,
        restSeconds: 60,
      },
    };
  }
  if (option === 'custom') {
    const cleaned = rawText.trim();
    return {
      option,
      prescription: cleaned || 'custom conditioning',
      modality: 'custom',
      coachNote: 'Added conditioning after strength',
      requiredText: cleaned ? cleaned.split(/\s+/)[0].toLowerCase() : 'conditioning',
      proposalReply:
        'I can add that conditioning after Monday strength. Reply "sounds good" and I\'ll apply it.',
      doneReply: 'Done — Monday now finishes with the conditioning after strength.',
      eventPayload: {
        title: 'Conditioning',
        description: cleaned || 'Custom conditioning after strength.',
        notes: 'Keep it controlled and stop if it turns into a hard session.',
        coachNote: 'Added conditioning after strength',
        sets: 1,
        minutes: 12,
        restSeconds: 0,
      },
    };
  }
  return {
    option: 'light_aerobic_intervals',
    prescription: LIGHT_AEROBIC_PRESCRIPTION,
    modality: LIGHT_AEROBIC_MODALITY,
    coachNote: 'Added light aerobic intervals after strength',
    requiredText: 'aerobic',
    proposalReply:
      'I can add light aerobic intervals after Monday strength — 8 x 2 min at 75–80% max HR with 1 min easy recovery. Reply "sounds good" and I\'ll apply it.',
    doneReply: 'Done — Monday now finishes with light aerobic intervals after strength.',
    eventPayload: {
      title: 'Light Aerobic Intervals',
      description: `${LIGHT_AEROBIC_PRESCRIPTION}. Use ${LIGHT_AEROBIC_MODALITY}.`,
      notes: '75–80% max HR. Keep it aerobic; 1 min easy recovery between reps.',
      coachNote: 'Added light aerobic intervals after strength',
      sets: 8,
      minutes: 2,
      restSeconds: 60,
    },
  };
}

function getConditioningClarifierReply(
  prior?: PendingCoachProposal | null,
  customNeedsDetails = false,
): string {
  if (customNeedsDetails) {
    return 'Sure — what conditioning would you like me to add after Monday strength?';
  }
  if (prior?.needs === 'conditioning_type') {
    return 'I can do that — choose light aerobic intervals, a short bike flush, tempo running, or tell me the exact conditioning you want.';
  }
  return 'What type of conditioning are you after — light aerobic intervals, a short bike flush, tempo running, or something else?';
}

export function getProgramAdjustmentProposalReply(proposal: PendingCoachProposal): string {
  if (proposal.action !== 'add_conditioning') {
    return 'I can remove the conditioning from Monday. Reply "sounds good" and I\'ll apply it.';
  }
  return getConditioningSpec(
    proposal.conditioningOption ?? 'light_aerobic_intervals',
    proposal.prescription ?? '',
  ).proposalReply;
}

export function getProgramAdjustmentSuccessReply(proposal: PendingCoachProposal): string {
  if (proposal.action !== 'add_conditioning') {
    return 'Done — Monday no longer has the conditioning block.';
  }
  return getConditioningSpec(
    proposal.conditioningOption ?? 'light_aerobic_intervals',
    proposal.prescription ?? '',
  ).doneReply;
}

export function getProgramAdjustmentRequiredText(proposal: PendingCoachProposal): string | undefined {
  if (proposal.action !== 'add_conditioning') return undefined;
  return getConditioningSpec(
    proposal.conditioningOption ?? 'light_aerobic_intervals',
    proposal.prescription ?? '',
  ).requiredText;
}

type TargetSearch =
  | { kind: 'selected'; targets: ResolvedDay[] }
  | { kind: 'non_strength_clarifier'; target: ResolvedDay }
  | { kind: 'ambiguous' }
  | { kind: 'not_found' };

function findTargetSessions(
  packet: CoachContextPacket,
  targetDay: string,
  prior?: PendingCoachProposal | null,
): TargetSearch {
  const targetDow = dayNameToDow(targetDay);
  const current = packet.currentWeek.find((d) => d.dayOfWeek === targetDow) ?? null;
  const next = packet.nextWeek.find((d) => d.dayOfWeek === targetDow) ?? null;
  const currentCompleted = isCompletedOrLocked(packet, current);
  const nextCompleted = isCompletedOrLocked(packet, next);
  const currentHasStrength = hasStrengthWork(current?.workout ?? null);
  const nextHasStrength = hasStrengthWork(next?.workout ?? null);
  const currentIsPast = current ? current.date < packet.todayISO : false;

  let selected: ResolvedDay | null = null;
  let selectedReason = '';
  let failureReason = '';
  let result: TargetSearch;

  if (prior?.targetDate) {
    const priorTarget = [...packet.currentWeek, ...packet.nextWeek].find((d) => d.date === prior.targetDate) ?? null;
    const priorCompleted = isCompletedOrLocked(packet, priorTarget);
    const priorHasStrength = hasStrengthWork(priorTarget?.workout ?? null);
    if (priorTarget?.workout && !priorCompleted && (priorHasStrength || prior.allowNonStrengthTarget)) {
      selected = priorTarget;
      selectedReason = prior.allowNonStrengthTarget ? 'pending_non_strength_confirmed' : 'pending_target_date';
      result = { kind: 'selected', targets: [priorTarget] };
    } else {
      failureReason = priorCompleted ? 'pending_target_completed_or_locked' : 'pending_target_unavailable';
      result = { kind: 'not_found' };
    }
  } else if (current?.workout && !currentCompleted) {
    if (currentHasStrength) {
      selected = current;
      selectedReason = currentIsPast ? 'current_visible_past_editable_strength' : 'current_visible_strength';
      result = { kind: 'selected', targets: [current] };
    } else {
      selected = current;
      selectedReason = 'current_visible_non_strength_needs_confirmation';
      result = { kind: 'non_strength_clarifier', target: current };
    }
  } else if (next?.workout && !nextCompleted && nextHasStrength) {
    selected = next;
    selectedReason = current?.workout && currentCompleted ? 'current_completed_next_strength' : 'next_strength';
    result = { kind: 'selected', targets: [next] };
  } else if (next?.workout && !nextCompleted) {
    selected = next;
    selectedReason = 'next_non_strength_needs_confirmation';
    result = { kind: 'non_strength_clarifier', target: next };
  } else {
    failureReason = current?.workout || next?.workout ? 'monday_sessions_completed_or_locked' : 'no_monday_session';
    result = { kind: 'not_found' };
  }

  logger.debug('[coach-target-search]', {
    requestedDay: titleDay(targetDay),
    todayISO: packet.todayISO,
    visibleWeekStart: packet.currentWeek[0]?.date ?? null,
    currentWeekMondayDate: current?.date ?? null,
    currentWeekMondayName: current?.workout?.name ?? null,
    currentWeekMondayIsPast: currentIsPast,
    currentWeekMondayIsCompleted: currentCompleted,
    currentWeekMondayHasStrength: currentHasStrength,
    nextWeekMondayDate: next?.date ?? null,
    nextWeekMondayName: next?.workout?.name ?? null,
    nextWeekMondayHasStrength: nextHasStrength,
    selectedTargetDate: selected?.date ?? null,
    selectedTargetReason: selectedReason || null,
    failureReason: failureReason || null,
  });

  return result;
}

function isCompletedOrLocked(packet: CoachContextPacket, day: ResolvedDay | null): boolean {
  if (!day) return false;
  const feedback = packet.sessionFeedback?.[day.date];
  const completedByFeedback = feedback?.completion === 'full' || feedback?.completion === 'partial';
  const workout = day.workout as any;
  return !!(
    completedByFeedback ||
    (day as any).completed ||
    (day as any).locked ||
    workout?.completed ||
    workout?.locked ||
    workout?.isLocked
  );
}

function hasStrengthWork(workout: ResolvedDay['workout'] | null): boolean {
  if (!workout) return false;
  const type = String((workout as any).workoutType ?? '').toLowerCase();
  const name = String(workout.name ?? '').toLowerCase();
  if (type.includes('strength') || /strength|lower|upper|full\s*body|gym/.test(name)) {
    return true;
  }
  if (/conditioning|recovery|team training|game/.test(type)) return false;
  const strengthPattern =
    /\b(squat|deadlift|hinge|rdl|romanian|lunge|split squat|hip thrust|bench|press|row|pulldown|pull[- ]?up|chin[- ]?up|nordic|hamstring curl|calf raise|trap bar|clean|snatch|loaded carry)\b/i;
  return (workout.exercises ?? []).some((ex: any) => {
    const exercise = ex.exercise ?? {};
    const exerciseName = String(exercise.name ?? ex.exerciseName ?? ex.name ?? '').toLowerCase();
    const exerciseType = String(exercise.exerciseType ?? '').toLowerCase();
    return strengthPattern.test(exerciseName) || /compound|accessory|isolation|strength/.test(exerciseType);
  });
}

function dayNameToDow(day: string): number {
  const d = day.toLowerCase();
  if (d === 'sunday') return 0;
  if (d === 'monday') return 1;
  if (d === 'tuesday') return 2;
  if (d === 'wednesday') return 3;
  if (d === 'thursday') return 4;
  if (d === 'friday') return 5;
  return 6;
}

function titleDay(day: string): string {
  return day ? day[0].toUpperCase() + day.slice(1).toLowerCase() : day;
}
