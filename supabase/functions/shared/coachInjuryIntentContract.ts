export const INJURY_EPISODE_INTENT_KINDS = [
  'new_injury_report',
  'injury_severity_reply',
  'active_injury_followup',
] as const;

export type InjuryEpisodeIntentKind = typeof INJURY_EPISODE_INTENT_KINDS[number];

export type InjurySeverity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type InjuryFollowupKind = 'resolved' | 'improving' | 'worsening' | 'unchanged';

export interface InjuryEpisodeBasePayload {
  bodyPart?: string;
  severity?: InjurySeverity;
}

export interface ActiveInjuryFollowupPayload extends InjuryEpisodeBasePayload {
  followupKind: InjuryFollowupKind;
}

export type InjuryEpisodePayload = InjuryEpisodeBasePayload | ActiveInjuryFollowupPayload;

interface InjuryEpisodeIntentEnvelope {
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion?: string;
  rationale?: string;
}

export type InjuryEpisodeIntent =
  | (InjuryEpisodeIntentEnvelope & {
      intent: 'new_injury_report';
      payload: InjuryEpisodeBasePayload;
    })
  | (InjuryEpisodeIntentEnvelope & {
      intent: 'injury_severity_reply';
      payload: InjuryEpisodeBasePayload;
    })
  | (InjuryEpisodeIntentEnvelope & {
      intent: 'active_injury_followup';
      payload: ActiveInjuryFollowupPayload;
    });

export const INJURY_EPISODE_PROMPT_CONTRACT = `INJURY PAYLOAD CONTRACT

- new_injury_report payload accepts only optional bodyPart and optional severity.
- injury_severity_reply payload accepts only optional bodyPart and optional severity.
- active_injury_followup payload requires followupKind (resolved | improving | worsening | unchanged) and accepts only optional bodyPart and optional severity besides it.
- Missing severity is valid and must remain a classified injury intent. Never add non-injury fields to an injury payload.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isInjuryEpisodeIntentKind(value: unknown): value is InjuryEpisodeIntentKind {
  return typeof value === 'string' &&
    (INJURY_EPISODE_INTENT_KINDS as readonly string[]).includes(value);
}

function isInjurySeverity(value: unknown): value is InjurySeverity {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

export function parseInjuryEpisodePayload(
  value: unknown,
  intent: InjuryEpisodeIntentKind,
): InjuryEpisodePayload | null {
  const payload = value === undefined ? {} : value;
  if (!isRecord(payload)) return null;
  const allowedKeys = intent === 'active_injury_followup'
    ? new Set(['bodyPart', 'severity', 'followupKind'])
    : new Set(['bodyPart', 'severity']);
  if (Object.keys(payload).some((key) => !allowedKeys.has(key))) return null;
  if (hasOwn(payload, 'bodyPart') &&
    (typeof payload.bodyPart !== 'string' || !payload.bodyPart.trim())) return null;
  if (hasOwn(payload, 'severity') && !isInjurySeverity(payload.severity)) return null;

  const bodyPart = typeof payload.bodyPart === 'string' ? payload.bodyPart : undefined;
  const severity = isInjurySeverity(payload.severity) ? payload.severity : undefined;
  if (intent === 'active_injury_followup') {
    const followupKind = payload.followupKind;
    if (followupKind !== 'resolved' && followupKind !== 'improving' &&
      followupKind !== 'worsening' && followupKind !== 'unchanged') return null;
    return {
      ...(bodyPart === undefined ? {} : { bodyPart }),
      ...(severity === undefined ? {} : { severity }),
      followupKind,
    };
  }
  return {
    ...(bodyPart === undefined ? {} : { bodyPart }),
    ...(severity === undefined ? {} : { severity }),
  };
}

export function parseInjuryEpisodeIntent(raw: unknown): InjuryEpisodeIntent | null {
  if (!isRecord(raw) || !isInjuryEpisodeIntentKind(raw.intent)) return null;
  if (typeof raw.confidence !== 'number' || !Number.isFinite(raw.confidence) ||
    raw.confidence < 0 || raw.confidence > 1 || typeof raw.needsClarification !== 'boolean') {
    return null;
  }
  if (hasOwn(raw, 'clarificationQuestion') && typeof raw.clarificationQuestion !== 'string') {
    return null;
  }
  if (hasOwn(raw, 'rationale') && typeof raw.rationale !== 'string') return null;
  const payload = parseInjuryEpisodePayload(raw.payload, raw.intent);
  if (!payload) return null;

  const envelope = {
    confidence: raw.confidence,
    needsClarification: raw.needsClarification,
    ...(typeof raw.clarificationQuestion === 'string'
      ? { clarificationQuestion: raw.clarificationQuestion }
      : {}),
    ...(typeof raw.rationale === 'string' ? { rationale: raw.rationale } : {}),
  };
  if (raw.intent === 'active_injury_followup') {
    return {
      ...envelope,
      intent: raw.intent,
      payload: payload as ActiveInjuryFollowupPayload,
    };
  }
  return {
    ...envelope,
    intent: raw.intent,
    payload: payload as InjuryEpisodeBasePayload,
  };
}

export function isInjuryEpisodeIntent(value: unknown): value is InjuryEpisodeIntent {
  return parseInjuryEpisodeIntent(value) !== null;
}
