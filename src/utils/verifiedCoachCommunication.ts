/** Truth gate shared by the current read-only Coach answers and change outcomes. */
import { logger } from './logger';

export type AppliedChangeKind =
  | 'session_replaced'
  | 'session_lightened'
  | 'exercise_removed'
  | 'exercise_replaced'
  | 'conditioning_changed'
  | 'volume_reduced'
  | 'coach_note_added';

export interface AppliedChange {
  date: string;
  sessionName: string;
  kind: AppliedChangeKind;
  before?: string;
  after?: string;
  visible: boolean;
}

export interface VerifiedCoachCommunication {
  appliedChanges: AppliedChange[];
  activeGuidance: string[];
  optionalAdvice: string[];
  unchangedReason?: string;
  canSayProgramUpdated: boolean;
  canSayProgramChanged: boolean;
}

export const FORBIDDEN_WHEN_NO_APPLIED: readonly RegExp[] = [
  /\bprogram\s+updated\b/i,
  /\bI\s+changed\b/i,
  /\bI\s+reduced\b/i,
  /\blighter\s+loads?\b/i,
  /\bsubbed?\s+in\b/i,
  /\bcap(p|ping|ped)\s+the\s+hard\s+sessions?\b/i,
  /\badjusted\s+your\s+week\b/i,
  /\bI\s+adjusted\b/i,
  /\bI\s+removed\b/i,
  /\bI\s+swapped\b/i,
  /\bI\s+pulled\s+back\b/i,
  /\bI(?:'ve|\s+have)?\s+pulled\s+back\b/i,
  /\bpulled\s+back\b/i,
  /\bnow\s+adjusted\b/i,
  /\bI\s+moved\b/i,
  /\bI(?:'ve|\s+have)\s+moved\b/i,
  /\bmoved\s+your\b/i,
] as const;

export interface ValidateInput {
  communication: VerifiedCoachCommunication;
  replyText?: string;
  cardData?: {
    appliedChanges?: AppliedChange[];
    activeGuidance?: string[];
    optionalAdvice?: string[];
    substituteWith?: string[];
  };
}

export interface ValidationResult {
  ok: boolean;
  violations: string[];
}

export function validateCoachCommunicationTruth(
  input: ValidateInput,
): ValidationResult {
  const violations: string[] = [];
  const communication = input.communication;

  if (input.replyText && !communication.canSayProgramUpdated) {
    for (const pattern of FORBIDDEN_WHEN_NO_APPLIED) {
      if (pattern.test(input.replyText)) {
        violations.push(`reply contains forbidden claim: ${pattern.source}`);
      }
    }
  }

  if (input.cardData) {
    const card = input.cardData;
    if (
      card.appliedChanges &&
      card.appliedChanges.length > communication.appliedChanges.length
    ) {
      violations.push('card.appliedChanges has more entries than verified');
    }

    const verifiedKeys = new Set(
      communication.appliedChanges.map(
        (change) =>
          `${change.date}|${change.kind}|${change.before ?? ''}|${change.after ?? ''}`,
      ),
    );
    for (const change of card.appliedChanges ?? []) {
      const key =
        `${change.date}|${change.kind}|${change.before ?? ''}|${change.after ?? ''}`;
      if (!verifiedKeys.has(key)) {
        violations.push(`card.appliedChanges contains unverified entry: ${key}`);
      }
    }

    if (
      card.substituteWith &&
      card.substituteWith.length > 0 &&
      !communication.canSayProgramUpdated
    ) {
      violations.push('card.substituteWith presented as applied but no visible changes');
    }
  }

  const ok = violations.length === 0;
  if (ok) logger.debug('[truth-gate] validation_passed');
  else logger.warn('[truth-gate] validation_failed', { violations });
  return { ok, violations };
}
