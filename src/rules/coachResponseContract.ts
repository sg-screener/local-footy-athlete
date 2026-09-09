import type { CoachSnapshot } from './liveAthleteSnapshot';

/** Pure automatic response boundary shared by Coach Lab and the live endpoint. */

export type CoachResponseBasis =
  | 'athlete_snapshot'
  | 'lfa_rule'
  | 'coaching_judgement'
  | 'general_s_and_c'
  /** The answer names a door of the app — a control the athlete can tap (slice S3, 2026-09-10). */
  | 'app_door';

export type CoachResponseSnapshotField = keyof Pick<
  CoachSnapshot,
  | 'visibleWeek' | 'thisWeek' | 'readiness' | 'load' | 'progress' | 'restrictions'
  // R-397 (slice S1): the projection's new top-level blocks.
  | 'situation' | 'history' | 'injuries' | 'mas'
> | 'estimates';

export interface CoachResponseKnowledgeSource {
  readonly id: string;
  readonly authority: 'lfa_bible' | 'active_rule' | 'canonical_source' | 'approved_example' | 'app_map';
  readonly sourceReference: string;
}

export interface CoachResponseProgramAction {
  readonly kind: string;
  readonly label: string;
}

export interface CoachResponsePayload {
  readonly message: string;
  readonly answerMode: 'answer' | 'focused_question' | 'honest_limit' | 'generic_refusal';
  readonly basis: readonly CoachResponseBasis[];
  readonly snapshotFieldsUsed: readonly CoachResponseSnapshotField[];
  readonly knowledgeSources: readonly CoachResponseKnowledgeSource[];
  readonly judgementLabel: 'not_needed' | 'labelled' | 'missing';
  readonly programActions: readonly CoachResponseProgramAction[];
}

export interface CoachResponseAutomaticChecks {
  readonly schemaValid: boolean;
  readonly useful: boolean;
  readonly readOnly: boolean;
  readonly programFactsGrounded: boolean;
  readonly lfaClaimsGrounded: boolean;
  readonly judgementTransparent: boolean;
  readonly concise: boolean;
  readonly changeClaimsTruthful: boolean;
  /** The words do not name a readiness tier when nothing was recorded. */
  readonly readinessClaimsGrounded: boolean;
  /** The words do not put a game on a day the visible week has no game. */
  readonly fixtureClaimsGrounded: boolean;
  /** The words do not name a season phase the snapshot does not carry (R-397). */
  readonly phaseClaimsGrounded: boolean;
  /** Every control the words tell the athlete to tap is a door the app map holds (slice S3). */
  readonly doorClaimsGrounded: boolean;
}

/**
 * The snapshot facts an answer's WORDS are checked against — F14 of Sam's
 * 2026-09-09 walkthrough, where the Coach said "readiness recorded as flat"
 * with nothing recorded and "Game Day Saturday and Sunday" with one Saturday
 * game. Until then the contract accepted a self-declared grounding receipt and
 * never compared a claim with a snapshot value. The facts are READ from the
 * model projection (`projectCoachSnapshotForModel`), the one owner of weekday
 * names and the fixture list; nothing here re-derives a weekday from a date.
 */
export interface CoachResponseGroundingFacts {
  readonly readinessReported: boolean;
  /** Weekday names ("Saturday") of every game in the visible week. */
  readonly gameWeekdays: readonly string[];
  /**
   * The owned season phase ("In-season"), or null when the app could not say.
   * R-397 (2026-09-10): the coach used to infer "in-season" from a game in
   * the week; now the app's owner is the only source and the words are held
   * to it.
   */
  readonly seasonPhase: string | null;
  /**
   * Every on-screen label the app map holds, lower-cased (slice S3). The
   * words may tell the athlete to tap only these; the list is the map's, not
   * the model's, so a renamed button changes the gate on the next build.
   */
  readonly doorLabels: readonly string[];
}

export function coachResponseGroundingFacts(snapshot: {
  readonly readiness: { readonly reported: boolean };
  readonly visibleWeek: { readonly fixtures: readonly { readonly weekday: string }[] };
  readonly situation?: { readonly season: { readonly phase: string } | null };
}, doorLabels: readonly string[]): CoachResponseGroundingFacts {
  return {
    readinessReported: snapshot.readiness.reported,
    gameWeekdays: snapshot.visibleWeek.fixtures.map((fixture) => fixture.weekday),
    seasonPhase: snapshot.situation?.season?.phase ?? null,
    doorLabels: doorLabels.map((label) => label.toLowerCase()),
  };
}

/**
 * The door labels as the SERVER learns them: from the generated app map inside
 * the knowledge bundle, never from `coachAppMap.ts` (which reaches the signed
 * sheet and the app's copy modules, none of which belong in the function).
 * The app passes `COACH_APP_DOOR_LABELS` directly; `coachAppMapTests` holds
 * the two lists equal.
 */
export function doorLabelsFromKnowledge(
  sources: readonly { readonly authority: string; readonly content: string }[],
): readonly string[] {
  const labels = new Set<string>();
  for (const source of sources) {
    if (source.authority !== 'app_map') continue;
    const pattern = /Label: "([^"\n]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source.content)) !== null) labels.add(match[1]);
  }
  return [...labels];
}

/**
 * "tap X", "press the X button", "open X", "use the X option": X is a control
 * the athlete is being sent to. Held to the map when X is QUOTED — a quoted
 * label is a claim about the app's glass. An unquoted Title-Case phrase after
 * the same verbs is checked only when it begins like a known door; ordinary
 * prose ("Use Monday's session…") is never refused, because a false refusal
 * costs the athlete a good answer and the instruction already asks for the
 * exact label.
 */
const DOOR_CLAIM = /\b(?:[Tt]ap|[Pp]ress|[Hh]it|[Oo]pen|[Uu]se|[Ss]elect|[Cc]hoose)\s+(?:on\s+)?(?:the\s+)?(?:["“']([^"”'\n]{2,60})["”']|((?:[A-Z][\w'’%?]*)(?:\s+(?:[A-Z][\w'’%?]*|100%\?|a|an|the|of|to|this|my|it|as|is)){1,5}))/g;

function doorMatches(named: string, labels: readonly string[]): boolean {
  return labels.some((label) => label === named || named.startsWith(label) || label.startsWith(named));
}

export function doorClaimGrounded(message: string, facts: CoachResponseGroundingFacts): boolean {
  const pattern = new RegExp(DOOR_CLAIM.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(message)) !== null) {
    const quoted = match[1] !== undefined;
    const named = (match[1] ?? match[2] ?? '').trim().replace(/[.,;:!?]+$/, '').toLowerCase();
    if (!named) continue;
    if (quoted) {
      if (!doorMatches(named, facts.doorLabels)) return false;
      continue;
    }
    const firstWord = named.split(/\s+/)[0];
    const looksLikeADoor = facts.doorLabels.some((label) => label.startsWith(firstWord));
    if (looksLikeADoor && !doorMatches(named, facts.doorLabels)) return false;
  }
  return true;
}

/**
 * A season phase attributed to the athlete as a fact: "you're in-season",
 * "this is pre-season", "currently off season". A conditional ("if you're in
 * season…") or a phase named as a general rule ("in-season Nordics stay") is
 * not a claim about this athlete. Held by `coachChatIntegrationTests`.
 */
const PHASE_CLAIM = /\b(?:you(?:'|’)?re|you are|we(?:'|’)?re|we are|this is|it(?:'|’)?s|currently|right now|you(?:'|’)?ve (?:just )?(?:entered|started|moved into)|(?:your|the|this) (?:week|block|program|phase) is)\s+(?:now\s+|still\s+|deep\s+|early\s+|late\s+|well\s+)?(?:in|into|at)?\s*(?:the\s+|your\s+)?(pre|off|in|mid)[- ]?season\b/gi;
/** The words immediately before the claim make it a hypothesis, not a fact. */
const PHASE_CONDITIONAL = /\b(?:if|when|whether|unless|once|should|suppose|say)\s*$/i;

function claimedPhase(word: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}-season`;
}

export function phaseClaimGrounded(
  message: string,
  facts: CoachResponseGroundingFacts,
): boolean {
  const pattern = new RegExp(PHASE_CLAIM.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(message)) !== null) {
    const before = message.slice(Math.max(0, match.index - 24), match.index);
    if (PHASE_CONDITIONAL.test(before)) continue;
    const claimed = claimedPhase(match[1]);
    if (claimed === 'Mid-season') continue;
    if (facts.seasonPhase === null || facts.seasonPhase.toLowerCase() !== claimed.toLowerCase()) {
      return false;
    }
  }
  return true;
}

/**
 * A readiness tier attributed to the athlete as something recorded:
 * "readiness is recorded as flat", "your check-in says you're good".
 * Advice that merely uses a tier word ("if you feel flat, log it") does not
 * match; the claim needs a readiness noun, a stating verb and a tier.
 */
const READINESS_TIER_CLAIM = /\b(?:readiness|check-?in|quick check)\b[^.!?\n]*?\b(?:is|was|as|reads?|shows?|says?|at)\s+(?:\w+['’]?\w*\s+){0,2}['"“]?(?:flat|good|wrecked|cooked)\b/i;

export function readinessClaimGrounded(
  message: string,
  facts: CoachResponseGroundingFacts,
): boolean {
  return facts.readinessReported || !READINESS_TIER_CLAIM.test(message);
}

const GAME_WORD = /^(?:game|games|match|matches|fixture|fixtures)$/i;
const WEEKDAY_WORD = /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)$/i;
/** A weekday next to one of these is being described as something other than a game. */
const NON_GAME_ACTIVITY_WORD = /^(?:rest|off|recovery|training|session|sessions|light|easy|lift|lifts|lifting|strength|conditioning|gym|run|running|sprint|sprints|mobility|primer|gunshow|deload|hard)$/i;
const NO_GAME_THIS_WEEK = /\bno\s+(?:game|match|fixture)s?\s+this\s+week(?:end)?\b/i;
const GAME_CLAIM_WINDOW_WORDS = 4;
const ACTIVITY_NEIGHBOUR_WORDS = 2;

function weekdayKey(word: string): string | null {
  const bare = word.replace(/['’]s$/i, '');
  return WEEKDAY_WORD.test(bare) ? bare.slice(0, 3).toLowerCase() : null;
}

function sentenceWords(sentence: string): readonly string[] {
  return sentence
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z]+|[^A-Za-z'’]+$/g, ''))
    .filter(Boolean);
}

/**
 * A weekday named within a few words of "game" is a claim that the week has a
 * game on that day, unless the weekday is itself described as another
 * activity ("Saturday's game and Sunday is rest"). Every such day must be in
 * the fixture list, and the real game may not be denied.
 */
export function fixtureClaimGrounded(
  message: string,
  facts: CoachResponseGroundingFacts,
): boolean {
  if (facts.gameWeekdays.length > 0 && NO_GAME_THIS_WEEK.test(message)) return false;
  const allowed = new Set(facts.gameWeekdays.map((day) => day.slice(0, 3).toLowerCase()));
  for (const sentence of message.split(/(?<=[.!?;])\s+/)) {
    const words = sentenceWords(sentence);
    for (let index = 0; index < words.length; index += 1) {
      if (!GAME_WORD.test(words[index])) continue;
      const from = Math.max(0, index - GAME_CLAIM_WINDOW_WORDS);
      const to = Math.min(words.length - 1, index + GAME_CLAIM_WINDOW_WORDS);
      for (let at = from; at <= to; at += 1) {
        const day = weekdayKey(words[at]);
        if (!day || allowed.has(day)) continue;
        const neighbours = words.slice(
          Math.max(0, at - ACTIVITY_NEIGHBOUR_WORDS),
          at + ACTIVITY_NEIGHBOUR_WORDS + 1,
        );
        if (neighbours.some((word) => NON_GAME_ACTIVITY_WORD.test(word))) continue;
        return false;
      }
    }
  }
  return true;
}

export interface CoachResponseContractEvaluation {
  readonly ok: boolean;
  readonly automaticChecks: CoachResponseAutomaticChecks;
  readonly violations: readonly (keyof CoachResponseAutomaticChecks)[];
}

const BASIS = new Set<string>([
  'athlete_snapshot',
  'lfa_rule',
  'coaching_judgement',
  'general_s_and_c',
  'app_door',
]);
const SNAPSHOT_FIELDS = new Set<string>([
  'visibleWeek',
  'thisWeek',
  'readiness',
  'load',
  'progress',
  'restrictions',
  // R-397 (slice S1, 2026-09-10): the projection's new top-level blocks.
  'situation',
  'history',
  'injuries',
  'mas',
  'estimates',
]);
const ANSWER_MODES = new Set<string>([
  'answer',
  'focused_question',
  'honest_limit',
  'generic_refusal',
]);
const JUDGEMENT_LABELS = new Set<string>(['not_needed', 'labelled', 'missing']);
const SOURCE_AUTHORITIES = new Set<string>([
  'app_map',
  'lfa_bible',
  'active_rule',
  'canonical_source',
  'approved_example',
]);

export const COACH_RESPONSE_MAX_ANSWER_WORDS = 100;

/**
 * Last-resort semantic tripwire for the false-authority class the retired
 * Coach exhibited: claiming a program mutation when none can have happened.
 */
export const READ_ONLY_FALSE_CHANGE_PATTERNS: readonly RegExp[] = [
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

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringArray(value: unknown, allowed: ReadonlySet<string>): value is readonly string[] {
  return Array.isArray(value)
    && value.every((entry) => typeof entry === 'string' && allowed.has(entry));
}

function validKnowledgeSource(value: unknown): value is CoachResponseKnowledgeSource {
  return record(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.sourceReference === 'string'
    && value.sourceReference.length > 0
    && typeof value.authority === 'string'
    && SOURCE_AUTHORITIES.has(value.authority);
}

function validProgramAction(value: unknown): value is CoachResponseProgramAction {
  return record(value)
    && typeof value.kind === 'string'
    && typeof value.label === 'string';
}

export function isCoachResponsePayload(value: unknown): value is CoachResponsePayload {
  return record(value)
    && typeof value.message === 'string'
    && value.message.trim().length > 0
    && typeof value.answerMode === 'string'
    && ANSWER_MODES.has(value.answerMode)
    && stringArray(value.basis, BASIS)
    && stringArray(value.snapshotFieldsUsed, SNAPSHOT_FIELDS)
    && Array.isArray(value.knowledgeSources)
    && value.knowledgeSources.every(validKnowledgeSource)
    && typeof value.judgementLabel === 'string'
    && JUDGEMENT_LABELS.has(value.judgementLabel)
    && Array.isArray(value.programActions)
    && value.programActions.every(validProgramAction);
}

function wordCount(message: string): number {
  return message.trim().split(/\s+/).filter(Boolean).length;
}

export interface CoachResponseGroundingPolicy {
  readonly requiresLiveProgramFacts: boolean;
  readonly allowedKnowledgeSourceIds: readonly string[];
  /** Required: a contract that can be evaluated without the facts can be skipped. */
  readonly facts: CoachResponseGroundingFacts;
}

export type CoachResponseContractFailureCode = 'invalid_answer' | 'refused';

/**
 * Usability failures mean the provider produced no answer the app can show.
 * Truth, grounding and read-only failures are refusals. Keeping this decision
 * beside the checks prevents the transport from turning "too long" into a
 * false safety claim about the athlete's question.
 */
export function coachResponseContractFailureCode(
  evaluation: CoachResponseContractEvaluation,
): CoachResponseContractFailureCode | null {
  if (evaluation.ok) return null;
  const checks = evaluation.automaticChecks;
  if (!checks.schemaValid) return 'invalid_answer';
  if (!checks.readOnly
    || !checks.programFactsGrounded
    || !checks.lfaClaimsGrounded
    || !checks.judgementTransparent
    || !checks.changeClaimsTruthful
    || !checks.readinessClaimsGrounded
    || !checks.fixtureClaimsGrounded
    || !checks.phaseClaimsGrounded
    || !checks.doorClaimsGrounded) {
    return 'refused';
  }
  return 'invalid_answer';
}

export function evaluateCoachResponseContract(
  response: unknown,
  policy: CoachResponseGroundingPolicy,
): CoachResponseContractEvaluation {
  const schemaValid = isCoachResponsePayload(response);
  const payload = schemaValid ? response : null;
  const basis = payload?.basis ?? [];
  const snapshotFields = payload?.snapshotFieldsUsed ?? [];
  const sources = payload?.knowledgeSources ?? [];
  const usesSnapshot = basis.includes('athlete_snapshot');
  const claimsLfaRule = basis.includes('lfa_rule');
  const usesJudgement = basis.includes('coaching_judgement');
  // Slice S3: a "how do I" answer is grounded in the app's doors, not the
  // athlete's week. It counts as live-program grounding only when it cites
  // the DOOR chunk it read (v12's first tapes refused nine of ten door
  // answers because they carried no snapshot basis).
  const usesDoor = basis.includes('app_door')
    && sources.some((source) => source.authority === 'app_map');
  const focusedQuestionWithoutFacts = payload?.answerMode === 'focused_question'
    && !usesSnapshot
    && snapshotFields.length === 0;
  const snapshotReceiptConsistent = usesSnapshot
    ? snapshotFields.length > 0
    : snapshotFields.length === 0;
  const allowedIds = new Set(policy.allowedKnowledgeSourceIds);
  const sourcesWereRetrieved = sources.every((source) => allowedIds.has(source.id));
  const checks: CoachResponseAutomaticChecks = {
    schemaValid,
    useful: payload !== null && payload.answerMode !== 'generic_refusal',
    readOnly: payload !== null && payload.programActions.length === 0,
    programFactsGrounded: payload !== null
      && snapshotReceiptConsistent
      && (!policy.requiresLiveProgramFacts
        || focusedQuestionWithoutFacts
        || usesSnapshot
        || usesDoor),
    lfaClaimsGrounded: payload !== null
      && sourcesWereRetrieved
      // A door named as a basis must be receipted by a DOOR chunk.
      && (!basis.includes('app_door') || sources.some((source) => source.authority === 'app_map'))
      && (!claimsLfaRule || sources.some(
        (source) => source.authority === 'lfa_bible' || source.authority === 'active_rule',
      )),
    judgementTransparent: payload !== null
      && (!usesJudgement || payload.judgementLabel === 'labelled'),
    concise: payload !== null
      && wordCount(payload.message) <= COACH_RESPONSE_MAX_ANSWER_WORDS,
    changeClaimsTruthful: payload !== null
      && !READ_ONLY_FALSE_CHANGE_PATTERNS.some((pattern) => pattern.test(payload.message)),
    readinessClaimsGrounded: payload !== null
      && readinessClaimGrounded(payload.message, policy.facts),
    fixtureClaimsGrounded: payload !== null
      && fixtureClaimGrounded(payload.message, policy.facts),
    phaseClaimsGrounded: payload !== null
      && phaseClaimGrounded(payload.message, policy.facts),
    doorClaimsGrounded: payload !== null
      && doorClaimGrounded(payload.message, policy.facts),
  };
  const violations = (Object.keys(checks) as (keyof CoachResponseAutomaticChecks)[])
    .filter((name) => !checks[name]);
  return { ok: violations.length === 0, automaticChecks: checks, violations };
}
