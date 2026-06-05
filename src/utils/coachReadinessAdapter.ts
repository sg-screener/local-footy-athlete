import { extractBodyPart } from './injuryAdjustmentEngine';
import { parsePendingSeverity } from './pendingInjuryResolver';
import {
  buildReadinessSignalPatch,
  type ReadinessSignal,
} from './readiness';

export interface PendingReadinessClarifier {
  kind: 'soreness_body_part';
  originalMessage: string;
  createdAt: number;
}

export type CoachReadinessAction =
  | {
      kind: 'apply_signal';
      signal: Omit<Partial<ReadinessSignal>, 'date' | 'updatedAt'>;
      reply: string;
      reason: string;
      clearPending: boolean;
    }
  | {
      kind: 'clarify';
      reply: string;
      pending: PendingReadinessClarifier;
      reason: string;
    }
  | {
      kind: 'pass';
      reason: string;
      clearPending?: boolean;
    };

const PENDING_READINESS_TTL_MS = 10 * 60 * 1000;

const PAIN_OR_INJURY_RE = /\b(pain|painful|hurt|hurts|hurting|injur(?:y|ed)|tweak(?:ed)?|strain(?:ed)?|pulled|pinged|pop|popped|snap|snapped|tear|tore|worse|better|cleared|gone)\b/i;
const BODY_SORENESS_RE = /\b(sore|soreness|tight|tightness|stiff|aching|ache|cooked|fried|wrecked|smoked|shit|shitty|crap|crappy|rough|ordinary|not\s+right)\b/i;
const GENERAL_SORENESS_RE = /\b(sore|soreness|tight|tightness|stiff|aching|ache)\b/i;
const FATIGUE_RE = /\b(cooked|smoked|fried|wrecked|toast|flat|exhausted|fatigued|drained|knackered|low energy|no energy|shit|shitty|crap|crappy|terrible|awful|rough|ordinary|off|not\s+feeling\s+(?:good|great|fresh|right)|not\s+(?:good|great|fresh|right))\b/i;
const TIME_RE = /\b(short on time|limited time|not much time|only got|only have|just got|just have|in a rush)\b/i;
const PROGRAM_DURATION_EDIT_RE =
  /\b(?:make|set|change|adjust|extend|increase|reduce|trim|lengthen|shorten)\b[\s\S]{0,48}\b\d{1,3}\s*(?:min|mins|minute|minutes)\b/i;
const PROGRAM_ADD_DURATION_RE =
  /\b(?:add|include|chuck|throw\s+in|put\s+in|slot\s+in|tack\s+on|add\s+on)\b[\s\S]{0,80}\b\d{1,3}\s*(?:min|mins|minute|minutes)\b/i;
const NAMED_ACTIVITY_DURATION_RE =
  /\b(?:pilates|bike|run|walk|row|rower|ski\s*erg|skierg|ski|mobility|conditioning|sprints?|intervals?)\b[\s\S]{0,64}\b\d{1,3}\s*(?:min|mins|minute|minutes)\b/i;
const DURATION_NAMED_ACTIVITY_RE =
  /\b\d{1,3}\s*(?:min|mins|minute|minutes)\b[\s\S]{0,64}\b(?:pilates|bike|run|walk|row|rower|ski\s*erg|skierg|ski|mobility|conditioning|sprints?|intervals?)\b/i;

function extractMinutes(message: string): number | null {
  const numeric = message.match(/\b(\d{1,3})\s*(?:min|mins|minute|minutes)\b/i);
  if (numeric) {
    const n = Number(numeric[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (/\bhalf an hour\b/i.test(message)) return 30;
  return null;
}

function hasSeverity(message: string): boolean {
  return parsePendingSeverity(message) != null;
}

function looksLikeProgramDurationEdit(message: string): boolean {
  if (TIME_RE.test(message)) return false;
  return (
    PROGRAM_DURATION_EDIT_RE.test(message) ||
    PROGRAM_ADD_DURATION_RE.test(message) ||
    NAMED_ACTIVITY_DURATION_RE.test(message) ||
    DURATION_NAMED_ACTIVITY_RE.test(message)
  );
}

function isFreshPending(
  pending: PendingReadinessClarifier | null | undefined,
  now: number,
): pending is PendingReadinessClarifier {
  return !!pending && now - pending.createdAt <= PENDING_READINESS_TTL_MS;
}

export function routeCoachReadinessMessage(input: {
  message: string;
  pending?: PendingReadinessClarifier | null;
  now?: number;
}): CoachReadinessAction {
  const message = input.message.trim();
  if (!message) return { kind: 'pass', reason: 'empty' };

  const now = input.now ?? Date.now();
  const pending = input.pending ?? null;
  const bodyPart = extractBodyPart(message)?.toLowerCase() ?? null;
  const painOrInjury = PAIN_OR_INJURY_RE.test(message);
  const severityKnown = hasSeverity(message);

  if (pending && !isFreshPending(pending, now)) {
    return { kind: 'pass', reason: 'pending_stale', clearPending: true };
  }

  if (
    pending?.kind === 'soreness_body_part' &&
    isFreshPending(pending, now) &&
    bodyPart &&
    !painOrInjury &&
    !severityKnown
  ) {
    return {
      kind: 'apply_signal',
      signal: {
        ...buildReadinessSignalPatch('sore'),
        bodyPart,
        source: 'coach_message',
      },
      reply:
        `Got it — sore ${bodyPart} today. ` +
        `Keep work around that area pain-free, and tell me a rough pain score out of 10 if it feels sharper than soreness.`,
      reason: 'pending_soreness_body_part_resolved',
      clearPending: true,
    };
  }

  const minutes = extractMinutes(message);
  if (minutes != null && looksLikeProgramDurationEdit(message)) {
    return { kind: 'pass', reason: 'program_duration_edit' };
  }
  if ((minutes != null && minutes < 45) || (TIME_RE.test(message) && minutes == null)) {
    return {
      kind: 'apply_signal',
      signal: {
        ...buildReadinessSignalPatch('short_time'),
        timeAvailableMinutes: minutes ?? 25,
        source: 'coach_message',
      },
      reply:
        `Got it — I’ll treat today as a short-time session. ` +
        `Main work first, trim the extras.`,
      reason: 'short_time_reported',
      clearPending: true,
    };
  }

  if (bodyPart && BODY_SORENESS_RE.test(message) && !painOrInjury && !severityKnown) {
    return {
      kind: 'apply_signal',
      signal: {
        ...buildReadinessSignalPatch('sore'),
        bodyPart,
        source: 'coach_message',
      },
      reply:
        `Got it — sore ${bodyPart} today. ` +
        `Keep work around that area pain-free, and tell me a rough pain score out of 10 if it feels sharper than soreness.`,
      reason: 'body_part_soreness_reported',
      clearPending: true,
    };
  }

  if (!bodyPart && GENERAL_SORENESS_RE.test(message) && !painOrInjury && !severityKnown) {
    return {
      kind: 'clarify',
      reply: "Where are you sore? For example: calves, quads, hammy, shoulder.",
      pending: {
        kind: 'soreness_body_part',
        originalMessage: message,
        createdAt: now,
      },
      reason: 'soreness_needs_body_part',
    };
  }

  if (!bodyPart && FATIGUE_RE.test(message) && !painOrInjury && !severityKnown) {
    return {
      kind: 'apply_signal',
      signal: {
        ...buildReadinessSignalPatch('flat'),
        source: 'coach_message',
      },
      reply:
        `Got it — I’ll dial today down. ` +
        `We’ll keep the useful work and trim anything that would dig a hole.`,
      reason: 'fatigue_reported',
      clearPending: true,
    };
  }

  if (pending && isFreshPending(pending, now) && !bodyPart) {
    return { kind: 'pass', reason: 'pending_abandoned', clearPending: true };
  }

  return { kind: 'pass', reason: 'no_readiness_match' };
}
