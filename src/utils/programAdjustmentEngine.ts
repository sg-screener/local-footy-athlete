/**
 * programAdjustmentEngine.ts — Universal Adjustment Engine (skeleton)
 *
 * PURPOSE
 *   Single deterministic seam for ALL program adjustments triggered by athlete
 *   intent. This is the long-term replacement for direct LLM mutation tools,
 *   the standalone injury engine, and the resolver-side calendar-mark logic
 *   that currently shape-shifts a week.
 *
 *   Today's coach pipeline mutates state through three independent paths
 *   (LLM tool calls, the deterministic injury engine, and resolver protections),
 *   which produces hallucinated updates, wrong-date actions, no-op replies,
 *   and replies that don't match the Program tab.  The Universal Adjustment
 *   Engine is the central choke-point that fixes that:  every intent enters
 *   here, is validated against safety rules, and emits a structured
 *   AdjustmentResult that the UI/coach reply can build from.
 *
 * SCOPE — THIS FILE IS A SKELETON
 *   - Defines the public type surface (Intent / Request / Event / Rejected /
 *     Result).
 *   - Implements applyProgramAdjustment(request, state) with routing +
 *     safety validation only.
 *   - Resolves the current week using the existing resolver.
 *   - Filters to future sessions only (date >= todayISO).
 *   - Rejects any attempted past-date edit.
 *   - Returns a structured empty result for unsupported intents.
 *   - NEVER calls the LLM.  NEVER mutates store state.
 *
 *   The intent handlers (injury, fatigue, missed_session, busy_week,
 *   schedule_change, exercise_swap, preference_change, general_question) are
 *   intentionally stubs at this stage — they all route through the same
 *   `applied: false` path with a clear `reason` string.  Subsequent steps
 *   will fill them in one by one, each behind its own test gate.
 *
 *   Wiring into CoachScreen, removal of the existing injuryAdjustmentEngine,
 *   edge-function changes, and SYSTEM_PROMPT updates are EXPLICITLY out of
 *   scope here.  This module is built alongside the existing system.
 *
 * INVARIANTS
 *   I1.  applyProgramAdjustment is a pure function — no side effects.
 *   I2.  Past dates are immutable — any payload.date < todayISO is rejected.
 *   I3.  The resolved week considered for adjustments is filtered to
 *        date >= todayISO; past resolved days are not exposed to handlers.
 *   I4.  Result shape is stable: { applied, events, rejected, reply } is
 *        always returned, even on routing failures.
 *   I5.  No tool dispatch, no Zustand reach-through.  state is passed in.
 */

import {
  resolveWeekWithConditioning,
  type ScheduleState,
  type ResolvedDay,
} from './sessionResolver';
import {
  getExerciseTags,
  getConditioningMeta,
  type InjuryKey,
} from '../data/exerciseTags';
import { logger } from './logger';

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

/**
 * The kinds of intent the engine knows how to route.  Adding a new intent
 * is a typed change — every consumer that switches on `AdjustmentIntent`
 * will be flagged by the compiler.
 */
export type AdjustmentIntent =
  | 'injury'
  | 'fatigue'
  | 'missed_session'
  | 'busy_week'
  | 'schedule_change'
  | 'exercise_swap'
  | 'preference_change'
  | 'general_question';

/**
 * One athlete-initiated request to adjust the program.
 *
 *   intent     — what the athlete wants (classified upstream).
 *   todayISO   — the engine's clock (YYYY-MM-DD).  Always supplied; the
 *                engine never reads `new Date()` so it stays deterministic.
 *   message    — optional raw text, for handlers that re-parse for
 *                severity / body part / dates.
 *   payload    — handler-specific data (e.g. { date, exerciseId, severity }).
 *   source     — provenance, used for logs and future telemetry.
 */
export interface AdjustmentRequest {
  intent: AdjustmentIntent;
  todayISO: string;
  message?: string;
  payload?: Record<string, any>;
  source: 'client_guard' | 'llm_classifier' | 'manual_ui';
}

/**
 * The kinds of structural change the engine is allowed to emit.
 *
 * NOTE: emitting an event here is a DECLARATION of intent.  The skeleton
 * does not yet apply events to a store — that wiring lands later, behind
 * its own test gate.
 */
export type AdjustmentEventKind =
  | 'set_session_recovery'
  | 'lighten_session'
  | 'remove_exercise'
  | 'remove_strength_block'
  | 'reduce_strength_block'
  | 'replace_exercise'
  | 'swap_conditioning_modality'
  | 'add_conditioning_block'
  | 'remove_conditioning_block'
  | 'mark_session_optional'
  | 'add_session_note'
  | 'add_preference'
  | 'calendar_mark';

export interface AdjustmentEvent {
  id: string;
  kind: AdjustmentEventKind;
  date: string;
  reason: string;
  before?: any;
  after?: any;
}

/**
 * A request the engine declined to honour, with a human-readable reason.
 *
 *   kind  — categorical ("past_date_blocked", "unsupported_intent", …).
 *   date  — present when the rejection is tied to a specific date.
 */
export interface RejectedAdjustment {
  kind: string;
  date?: string;
  reason: string;
}

export interface AdjustmentResult {
  applied: boolean;
  events: AdjustmentEvent[];
  rejected: RejectedAdjustment[];
  reply: string;
}

// ─────────────────────────────────────────────────────────────────────────
// INTERNAL CONSTANTS
// ─────────────────────────────────────────────────────────────────────────

/** Categorical kinds for RejectedAdjustment so consumers can pattern-match. */
export const REJECT_KIND = {
  PAST_DATE: 'past_date_blocked',
  UNSUPPORTED_INTENT: 'unsupported_intent',
  INVALID_REQUEST: 'invalid_request',
} as const;

/** ISO-date sanity guard — `YYYY-MM-DD`, no time component. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Stable, time-independent event id (the skeleton does not emit events yet
 *  but the helper is here so handlers added later use a single shape). */
let eventCounter = 0;
function nextEventId(prefix: string): string {
  eventCounter += 1;
  return `${prefix}-${eventCounter}`;
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute the Monday of the calendar week containing `todayISO`.
 *
 * Driven by the supplied date string — does NOT call `new Date()` with
 * implicit clock — so the engine stays deterministic in tests.
 */
export function mondayOfISO(todayISO: string): string {
  if (!ISO_DATE_RE.test(todayISO)) {
    throw new Error(`mondayOfISO: invalid todayISO '${todayISO}'`);
  }
  const [y, m, d] = todayISO.split('-').map(Number);
  // Anchor at noon to avoid DST edge cases when shifting days.
  const anchor = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dow = anchor.getDay(); // 0 = Sun, 1 = Mon, … 6 = Sat
  const offset = dow === 0 ? -6 : -(dow - 1);
  anchor.setDate(anchor.getDate() + offset);
  const yy = anchor.getFullYear();
  const mm = String(anchor.getMonth() + 1).padStart(2, '0');
  const dd = String(anchor.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Pure helper — returns only the resolved days at or after `todayISO`.
 * Exported for tests and so handlers can reuse the same filter without
 * re-implementing it.
 */
export function filterFutureResolvedDays(
  days: ResolvedDay[],
  todayISO: string,
): ResolvedDay[] {
  return days.filter((d) => d.date >= todayISO);
}

/**
 * Validate an ISO-date string.  Returns true for `YYYY-MM-DD`.
 */
export function isValidISODate(s: unknown): s is string {
  return typeof s === 'string' && ISO_DATE_RE.test(s);
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────

/**
 * applyProgramAdjustment — central routing + safety pass.
 *
 * Skeleton behaviour (per build spec, step 1):
 *
 *   1. Validate request.todayISO; reject malformed input.
 *   2. Resolve the current week via the existing resolver.
 *   3. Filter resolved days to future-only (date >= todayISO).
 *   4. Reject any attempted past-date edit (payload.date < todayISO).
 *   5. Route by intent.  All intents are currently routed to
 *      `routeUnsupported` which returns applied=false with a stable
 *      AdjustmentResult shape.
 *   6. Never call the LLM.  Never mutate store state.
 */
export function applyProgramAdjustment(
  request: AdjustmentRequest,
  state: ScheduleState,
): AdjustmentResult {
  // ── 1. Input validation ───────────────────────────────────────────────
  if (!isValidISODate(request.todayISO)) {
    return {
      applied: false,
      events: [],
      rejected: [
        {
          kind: REJECT_KIND.INVALID_REQUEST,
          reason: `invalid todayISO: '${request.todayISO}'`,
        },
      ],
      reply: "I can't process that — the date the engine was given is invalid.",
    };
  }

  // ── 2. Resolve current week ───────────────────────────────────────────
  const monday = mondayOfISO(request.todayISO);
  const resolvedWeek = resolveWeekWithConditioning(monday, state);

  // ── 3. Future-only view ───────────────────────────────────────────────
  const futureDays = filterFutureResolvedDays(resolvedWeek, request.todayISO);

  // ── 4. Past-date guard ────────────────────────────────────────────────
  //
  //   We reject the request if it carries a payload.date that's strictly
  //   before todayISO.  This is the only safety rule the skeleton enforces
  //   directly; intent-specific guards land with their handlers.
  const rejected: RejectedAdjustment[] = [];
  const requestedDate = readPayloadDate(request);
  if (requestedDate !== null && requestedDate < request.todayISO) {
    rejected.push({
      kind: REJECT_KIND.PAST_DATE,
      date: requestedDate,
      reason: `cannot edit ${requestedDate}; only today (${request.todayISO}) and future dates are mutable`,
    });
    return {
      applied: false,
      events: [],
      rejected,
      reply:
        "I can't change a session that's already in the past — let's pick today or a day later in the week.",
    };
  }

  // ── 5. Route by intent ────────────────────────────────────────────────
  //
  //   The switch is exhaustive so the compiler flags any new intent that's
  //   added without a route.  Handlers are filled in one at a time, each
  //   behind its own test gate.
  switch (request.intent) {
    case 'injury':
      return handleInjuryIntent(request, futureDays, rejected);
    case 'fatigue':
    case 'missed_session':
    case 'busy_week':
    case 'schedule_change':
    case 'exercise_swap':
    case 'preference_change':
    case 'general_question':
      return routeUnsupported(request, futureDays, rejected);
    default: {
      // Exhaustiveness check.  If a new intent slips in, this branch keeps
      // the function total and surfaces the gap as a typed error.
      const _exhaustive: never = request.intent;
      void _exhaustive;
      return routeUnsupported(request, futureDays, rejected);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// INTERNAL ROUTING
// ─────────────────────────────────────────────────────────────────────────

/**
 * The skeleton's universal "I heard you, but I don't act on this yet" path.
 *
 * Returns a stable AdjustmentResult shape with applied=false, an empty
 * events array, the accumulated rejections, and a brief reply explaining
 * that nothing was changed.  Intent-specific handlers will replace this
 * route one at a time in subsequent steps.
 *
 * `futureDays` is currently unused but kept in the signature so that
 * handlers added later inherit the same future-only view without
 * re-resolving the week.
 */
function routeUnsupported(
  request: AdjustmentRequest,
  futureDays: ResolvedDay[],
  rejected: RejectedAdjustment[],
): AdjustmentResult {
  // Reference futureDays so noUnusedParameters / lint doesn't strip it
  // before the handlers are filled in.
  void futureDays;

  rejected.push({
    kind: REJECT_KIND.UNSUPPORTED_INTENT,
    reason: `intent '${request.intent}' is routed but no handler is wired yet`,
  });

  return {
    applied: false,
    events: [],
    rejected,
    reply:
      "I haven't been taught how to handle that one yet — give me a moment, I'll loop a coach in.",
  };
}

/**
 * Pull a date out of `request.payload`, normalising shape variations.
 * Returns null when no date is present.
 *
 * Looks at:
 *   - payload.date         — single-target intents (lighten, swap, …)
 *   - payload.fromDate     — schedule-change intents
 *   - payload.targetDate   — alias used by some upstream classifiers
 */
function readPayloadDate(request: AdjustmentRequest): string | null {
  const p = request.payload;
  if (!p || typeof p !== 'object') return null;
  const candidates = [p.date, p.fromDate, p.targetDate];
  for (const c of candidates) {
    if (isValidISODate(c)) return c;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT CONSTRUCTORS  (exported for handlers that land in later steps)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build a typed AdjustmentEvent.  Used by future intent handlers.  Exposed
 * here so the construction shape is centralised — a single place to change
 * if event semantics evolve.
 */
export function buildEvent(
  kind: AdjustmentEventKind,
  date: string,
  reason: string,
  before?: any,
  after?: any,
): AdjustmentEvent {
  return {
    id: nextEventId(kind),
    kind,
    date,
    reason,
    before,
    after,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// INJURY HANDLER  (intent: 'injury')
// ─────────────────────────────────────────────────────────────────────────
//
// Recreates the current severity-known injury behaviour as an event-emitting
// handler. NEVER mutates state. NEVER calls applyCoachAction. The handler's
// only output is a list of AdjustmentEvents that downstream wiring will
// later translate into store writes.
//
// Behaviour summary (matches build spec):
//   - severity < 5            → applied=false, no events, "no change required"
//   - severity ≥ 5 + bodyPart → walk future resolved sessions (date >= today),
//                                emit events for risky exercises / sessions
//                                / running-based conditioning
//   - severity ≥ 7            → caution-rated exercises also removed
//   - severity ≥ 8 + ≥50%
//     risky session            → emit set_session_recovery for the whole day
//   - lower-limb               → emit swap_conditioning_modality for any
//                                 future running-based conditioning session
//   - empty event list +
//     ≥1 future session        → fallback: emit a visible event on the next
//                                 future trainable session (recovery if ≥7,
//                                 lighten otherwise) so the coach reply
//                                 always references at least one real change
//   - no future sessions       → applied=false, no events, "no future sessions"
//
// Reply is built from events only — no template advice that isn't backed
// by a real emitted event.

/** Possible "buckets" — one per InjuryProfile field on ExerciseTag. */
export type InjuryBucket = InjuryKey;

/** Region classification used to drive coarse week-wide rules. */
export type InjuryRegion = 'lower' | 'upper' | 'back';

/**
 * Body-part free-text → InjuryBucket. Mirrors the mapping in
 * `injuryAdjustmentEngine.ts` so behaviour is consistent while the two
 * engines run in parallel. Comments mark proxy mappings (e.g. quad → knee).
 */
const BODY_PART_TO_BUCKET: Readonly<Record<string, InjuryBucket>> = {
  // posterior chain / hamstring family
  hamstring: 'hamstring',
  hamstrings: 'hamstring',
  hammy: 'hamstring',
  hammies: 'hamstring',
  hammie: 'hamstring',          // common misspelling — keep mapped
  hamy: 'hamstring',
  hamie: 'hamstring',
  hamstrng: 'hamstring',
  hammstring: 'hamstring',
  glute: 'hamstring',
  glutes: 'hamstring',

  // knee / quad
  knee: 'knee',
  knees: 'knee',
  quad: 'knee',
  quads: 'knee',
  quadricep: 'knee',
  quadriceps: 'knee',

  // calf / achilles
  calf: 'calf',
  calves: 'calf',
  achilles: 'calf',

  // ankle / foot
  ankle: 'ankle',
  ankles: 'ankle',
  foot: 'ankle',
  feet: 'ankle',

  // groin / hip
  groin: 'adductor',
  adductor: 'adductor',
  adductors: 'adductor',
  hip: 'lowerBack',
  hips: 'lowerBack',

  // back
  back: 'lowerBack',
  'lower back': 'lowerBack',
  'upper back': 'lowerBack',
  'lower-back': 'lowerBack',
  lowerback: 'lowerBack',

  // shoulder & adjacents
  shoulder: 'shoulder',
  shoulders: 'shoulder',
  pec: 'shoulder',
  pecs: 'shoulder',
  chest: 'shoulder',
  neck: 'shoulder',

  // elbow / arm
  elbow: 'elbow',
  elbows: 'elbow',
  bicep: 'elbow',
  biceps: 'elbow',
  tricep: 'elbow',
  triceps: 'elbow',
  forearm: 'elbow',
  forearms: 'elbow',

  // wrist
  wrist: 'wrist',
  wrists: 'wrist',
};

const LOWER_BUCKETS = new Set<InjuryBucket>([
  'hamstring',
  'knee',
  'calf',
  'ankle',
  'adductor',
]);
const UPPER_BUCKETS = new Set<InjuryBucket>(['shoulder', 'elbow', 'wrist']);
const BACK_BUCKETS = new Set<InjuryBucket>(['lowerBack']);

function classifyRegion(bucket: InjuryBucket): InjuryRegion {
  if (LOWER_BUCKETS.has(bucket)) return 'lower';
  if (UPPER_BUCKETS.has(bucket)) return 'upper';
  if (BACK_BUCKETS.has(bucket)) return 'back';
  // pubalgia is the only remaining bucket — group with back for safety.
  return 'back';
}

function normalizePart(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Resolve a free-text body-part token to an InjuryBucket. Returns null
 * when no mapping is known.
 */
export function resolveInjuryBucket(bodyPart: string): InjuryBucket | null {
  const norm = normalizePart(bodyPart);
  if (BODY_PART_TO_BUCKET[norm]) return BODY_PART_TO_BUCKET[norm];
  // Try multi-word hyphen / no-space fallbacks.
  const collapsed = norm.replace(/[\s-]+/g, '');
  for (const [k, v] of Object.entries(BODY_PART_TO_BUCKET)) {
    if (k.replace(/[\s-]+/g, '') === collapsed) return v;
  }
  return null;
}

/**
 * Per-exercise risk classification for a given bucket. Reads
 * `exerciseTags.injury[bucket]`. Returns 'unknown' if the exercise is not
 * tagged — we never act on unknown.
 */
type RiskRating = 'avoid' | 'caution' | 'good' | 'unknown';

function classifyExercise(name: string, bucket: InjuryBucket): RiskRating {
  if (!name) return 'unknown';
  const tag = getExerciseTags(name);
  if (!tag) return 'unknown';
  const rating = tag.injury[bucket];
  if (rating === 'avoid') return 'avoid';
  if (rating === 'caution') return 'caution';
  return 'good';
}

/**
 * Detect whether a workout is conditioning-flavoured AND running-based.
 * Used to fire `swap_conditioning_modality` for lower-limb injuries.
 */
function isRunningBased(workout: NonNullable<ResolvedDay['workout']>): boolean {
  const exercises = workout.exercises ?? [];
  for (const ex of exercises) {
    const name: string = (ex as any).exercise?.name || '';
    if (!name) continue;
    const meta = getConditioningMeta(name);
    if (meta && (meta.modality === 'run' || meta.impact === 'high')) return true;
  }
  // Fall back to workoutType / name heuristics for non-tagged conditioning.
  const wname = (workout.name || '').toLowerCase();
  if (workout.workoutType === 'Conditioning' && /sprint|run|interval|mas\b|km/.test(wname)) {
    return true;
  }
  return false;
}

/**
 * Skip workouts the engine should not touch (game stubs, empty shells,
 * already-recovery sessions).
 */
function isAdjustableWorkout(workout: ResolvedDay['workout']): workout is NonNullable<ResolvedDay['workout']> {
  if (!workout) return false;
  if ((workout as any).workoutType === 'Game') return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// RELEVANCE FILTER — never modify recovery; only target sessions whose load
// actually exposes the injured area.
// ─────────────────────────────────────────────────────────────────────────

/**
 * A session that is already recovery (or carries no meaningful training
 * load) must NEVER be modified by the injury engine. "Lightening" a
 * recovery session is a no-op that produces a misleading reply and a
 * bullet on the Program tab claiming we changed something we didn't.
 *
 * Detection paths (any one is sufficient):
 *   - workoutType === 'Recovery'
 *   - sessionTier === 'recovery'
 *   - workout.name matches /recovery/i
 *   - exercises array is empty AND name doesn't indicate team training
 *     (team-day shells are intentionally exercise-less but still carry
 *     real running load)
 */
function isRecoverySession(workout: NonNullable<ResolvedDay['workout']>): boolean {
  const wt = (workout as any).workoutType;
  if (wt === 'Recovery') return true;
  const tier = (workout as any).sessionTier;
  if (tier === 'recovery') return true;
  const name = (workout.name || '').trim().toLowerCase();
  if (/\brecovery\b/.test(name)) return true;
  // Empty-exercise shells that aren't team training are recovery-equivalent.
  const isTeam = name === 'team training' || /^team training\b/.test(name) || / \+ team training$/.test(name);
  if ((workout.exercises ?? []).length === 0 && !isTeam) return true;
  return false;
}

/**
 * Team-training session detector. Team training carries running/sprinting
 * exposure even though its `exercises` array is typically empty, so for
 * lower-limb injuries we consider it relevant and modify it via
 * lighten_session (which appends an "[Injury-lightened — optional this
 * week]" note that surfaces in the Program tab).
 */
function isTeamTraining(workout: NonNullable<ResolvedDay['workout']>): boolean {
  const name = (workout.name || '').trim().toLowerCase();
  if (!name) return false;
  return (
    name === 'team training' ||
    /^team training\s*\+/.test(name) ||
    /\+\s*team training$/.test(name)
  );
}

/**
 * Does this session carry exposure relevant to the injured bucket?
 *
 * Order of checks (any TRUE → relevant):
 *   1. Recovery sessions are NEVER relevant (rule 1 — protects recovery).
 *   2. Any tagged exercise in the session rated 'caution' or 'avoid' for
 *      this bucket. This catches the strong cases (RDLs for hamstring,
 *      back squat for knee, overhead press for shoulder, deadlift for
 *      lowerBack…) — the per-exercise pass will already handle these,
 *      but we need to know "is this session worth touching at all" for
 *      the fallback target selection.
 *   3. Conditioning + running-based AND bucket is lower-limb. The
 *      per-exercise pass swaps the modality; the fallback uses this to
 *      pick a target when nothing tagged exists in the week.
 *   4. Team training AND bucket is lower-limb (rule 4 — sprint/run
 *      exposure is not in the exercise array, so the per-exercise pass
 *      can't see it).
 *   5. Region-match against tagged exercises:
 *        - lower or back bucket  → any 'lower' or 'full' region exercise
 *        - upper bucket          → any 'upper' or 'full' region exercise
 *      This catches accessory-heavy strength days that otherwise have no
 *      direct injury tag (e.g. a hamstring-curl-free Lower Strength day
 *      with squat + lunge — squat would already be flagged at step 2,
 *      but a soft Lower would still match here).
 */
function isSessionRelevantToBucket(
  workout: NonNullable<ResolvedDay['workout']>,
  bucket: InjuryBucket,
): boolean {
  // 1. Recovery is never relevant — rule 1.
  if (isRecoverySession(workout)) return false;

  const exercises = workout.exercises ?? [];

  // 2. Direct exposure: any caution/avoid tag for this bucket.
  for (const ex of exercises) {
    const name = (ex as any).exercise?.name || '';
    if (!name) continue;
    const rating = classifyExercise(name, bucket);
    if (rating === 'avoid' || rating === 'caution') return true;
  }

  const region = classifyRegion(bucket);
  const isLowerBucket = region === 'lower' || region === 'back';

  // 3. Running-based conditioning is lower-limb exposure.
  if (isLowerBucket && isRunningBased(workout)) return true;

  // 4. Team training is lower-limb exposure (sprint/run).
  if (isLowerBucket && isTeamTraining(workout)) return true;

  // 5. Region match through exercise tags.
  for (const ex of exercises) {
    const name = (ex as any).exercise?.name || '';
    if (!name) continue;
    const tag = getExerciseTags(name);
    if (!tag) continue;
    if (isLowerBucket && (tag.region === 'lower' || tag.region === 'full')) return true;
    if (region === 'upper' && (tag.region === 'upper' || tag.region === 'full')) return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────
// EXPOSURE MAPPING — what specific stress to remove for each bucket
// ─────────────────────────────────────────────────────────────────────────
//
// The engine doesn't just "lighten the session" — it removes the actual
// thing that loads the injured area. This table is read by the per-day
// action chooser (handleInjuryIntent step 6) when deciding what to
// emit on running-conditioning days, team-training days, and generic
// region-relevant days.
//
//   removeExposure  — short prose listed in remove-event reasons
//   teamNote        — note attached via add_session_note when the only
//                     way to address the bucket on a team day is to
//                     instruct the athlete to limit specific exposure
//   conditioningNote— note used in swap_conditioning_modality reasons
//                     and in the no-relevant-session reply
//
// Buckets not in the table fall back to severity-anchored phrasing.

interface BucketExposureSpec {
  removeExposure: string;
  teamNote: string;
  conditioningNote: string;
}

const BUCKET_EXPOSURE: Readonly<Partial<Record<InjuryBucket, BucketExposureSpec>>> = {
  hamstring: {
    removeExposure: 'sprinting, high-speed running, hinge patterns',
    teamNote: 'no sprinting / no high-speed running',
    conditioningNote: 'avoid running — bike or row instead',
  },
  knee: {
    removeExposure: 'plyos, sprinting, knee-dominant loading',
    teamNote: 'no sprinting / no cutting / no plyos',
    conditioningNote: 'avoid running and plyos — bike or row instead',
  },
  calf: {
    removeExposure: 'running, plyos, heavy calf work',
    teamNote: 'no sprinting / no plyo work',
    conditioningNote: 'avoid running — bike or row instead',
  },
  ankle: {
    removeExposure: 'running, plyos, change-of-direction work',
    teamNote: 'no sprinting / no cutting / no plyos',
    conditioningNote: 'avoid running and plyos — bike or row instead',
  },
  adductor: {
    removeExposure: 'cutting, sprinting, adductor-heavy work',
    teamNote: 'no cutting / no sprinting',
    conditioningNote: 'avoid running and lateral work — bike or row instead',
  },
  pubalgia: {
    removeExposure: 'cutting, kicking, hinge patterns',
    teamNote: 'no cutting / no kicking',
    conditioningNote: 'avoid running and lateral work — bike or row instead',
  },
  shoulder: {
    removeExposure: 'pressing, overhead work, heavy push',
    teamNote: 'no contact drills / no overhead throwing',
    conditioningNote: 'no upper-body conditioning',
  },
  elbow: {
    removeExposure: 'heavy pressing, loaded pulling, gripping',
    teamNote: 'no heavy contact drills',
    conditioningNote: 'no rowing or upper-body conditioning',
  },
  wrist: {
    removeExposure: 'heavy pressing, loaded pulling, gripping',
    teamNote: 'no contact drills',
    conditioningNote: 'no rowing or upper-body conditioning',
  },
  lowerBack: {
    removeExposure: 'axial loading, heavy hinges, heavy squats',
    teamNote: 'no heavy contact / no high-load tackle drills',
    conditioningNote: 'avoid running impact — bike or row instead',
  },
};

function getBucketExposure(bucket: InjuryBucket): BucketExposureSpec | null {
  return BUCKET_EXPOSURE[bucket] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// GLOBAL INJURY POLICY — week-wide constraints derived from (bucket, severity)
// ─────────────────────────────────────────────────────────────────────────
//
// The per-day chooser handles "what to do on this session". The injury
// policy handles "what holds across the whole week" — the rules that
// must appear in the athlete's reply regardless of which sessions exist
// (e.g. "no sprinting" applies even on a 0-session week so the athlete
// knows what to avoid in pickup play).
//
// The chooser READS the policy to drive notes/reasons that match the
// week-wide rules; the reply builder PRINTS the policy as the
// "This week:" / "Keep:" sections.

export interface InjuryPolicy {
  bucket: InjuryBucket | null;
  severity: number;

  /** Forbidden exposures (week-wide). Drives consistency sweep + reply. */
  forbid: {
    sprinting: boolean;
    highSpeedRunning: boolean;
    runningImpact: boolean;
    plyos: boolean;
    cutting: boolean;
    heavyHinge: boolean;
    heavySquat: boolean;
    axialLoading: boolean;
    heavyPressing: boolean;
    overheadLoading: boolean;
    heavyPulling: boolean;
    contactDrills: boolean;
  };

  /** Bullet text for the "This week:" rules section. */
  globalRules: string[];

  /**
   * Bullet text for the "Instead:" replacement-suggestions section.
   * Each entry is a short prose alternative for the matching forbid
   * exposure (e.g. "Bike / rower / ski erg instead of sprint work").
   * Invariant: when `globalRules.length > 0`, `replacements.length > 0`
   * — the reply must never list ONLY restrictions.
   */
  replacements: string[];

  /** Bullet text for the "Keep:" preserve list. */
  preserveText: string[];

  /** Optional closing advice (e.g. "Get a physio to look at it."). */
  closingAdvice: string | null;
}

const EMPTY_FORBID: InjuryPolicy['forbid'] = {
  sprinting: false,
  highSpeedRunning: false,
  runningImpact: false,
  plyos: false,
  cutting: false,
  heavyHinge: false,
  heavySquat: false,
  axialLoading: false,
  heavyPressing: false,
  overheadLoading: false,
  heavyPulling: false,
  contactDrills: false,
};

/**
 * Build the global injury policy for a (bucket, severity) pair. Pure
 * function — depends only on its inputs.
 *
 * Severity tiers:
 *   5–6 — protective: forbid the strong-load exposures, preserve almost
 *         everything else
 *   7   — aggressive: forbid most loaded work in the bucket's region;
 *         physio recommended
 *   8+  — recovery-leaning: forbid all loaded work; physio strongly
 *         recommended
 *
 * Unknown bucket → severity-anchored generic policy with no specific
 * forbid flags (the chooser already handles unknown via fallback).
 */
export function buildInjuryPolicy(
  bucket: InjuryBucket | null,
  severity: number,
): InjuryPolicy {
  const isHigh = severity >= 7;
  const isSerious = severity >= 8;

  // Closing-advice helpers — same phrasing across buckets.
  const physioSoft = "If it's not improving in a few days, worth getting a physio to look at it.";
  const physioHard = 'Get a physio to look at it.';

  if (!bucket) {
    const rules: string[] = [];
    rules.push('Pull back from anything that aggravates it');
    if (isHigh) rules.push('Skip loaded sessions until pain settles');
    return {
      bucket: null,
      severity,
      forbid: { ...EMPTY_FORBID },
      globalRules: rules,
      replacements: [
        'Easy mobility or low-impact recovery work instead of loaded training',
      ],
      preserveText: ['Easy mobility', 'Recovery work'],
      closingAdvice: isHigh
        ? 'Worth getting it looked at by a physio.'
        : null,
    };
  }

  switch (bucket) {
    case 'hamstring': {
      const forbid = {
        ...EMPTY_FORBID,
        sprinting: true,
        highSpeedRunning: true,
        heavyHinge: true,
        ...(isHigh ? { runningImpact: true, plyos: true } : {}),
      };
      const rules: string[] = [
        'No sprinting or high-speed running',
        'No heavy hinge work (RDLs, deadlifts, nordics)',
      ];
      if (isHigh) rules.push('No running impact this week');
      const replacements: string[] = [
        'Bike / rower / ski erg instead of sprint or running work',
        'Light single-leg or isometric work instead of heavy hinges',
      ];
      if (isHigh) replacements.push('Pool or low-impact aerobic work instead of any running');
      const preserve = isSerious
        ? ['Upper body', 'Recovery work']
        : ['Upper body', 'Low-load accessories', 'Recovery work'];
      return {
        bucket, severity, forbid, globalRules: rules, replacements, preserveText: preserve,
        closingAdvice: isHigh ? physioHard : physioSoft,
      };
    }

    case 'knee': {
      const forbid = {
        ...EMPTY_FORBID,
        plyos: true,
        sprinting: true,
        heavySquat: true,
        cutting: true,
        ...(isHigh ? { runningImpact: true } : {}),
      };
      const rules: string[] = [
        'No plyos or jumping',
        'No sprinting or cutting',
        'No heavy knee-dominant lifts (back squat, lunge variations)',
      ];
      if (isHigh) rules.push('No running impact this week');
      return {
        bucket, severity, forbid, globalRules: rules,
        replacements: [
          'Bike / rower instead of running and plyos',
          'Hinge work (light RDL / hip thrust) instead of heavy squats and lunges',
          'Step-ups or split-squat isometrics instead of loaded knee-dominant work',
        ],
        preserveText: isSerious
          ? ['Upper body', 'Recovery work']
          : ['Upper body', 'Hinge work (light)', 'Low-load accessories', 'Recovery work'],
        closingAdvice: isHigh ? physioHard : physioSoft,
      };
    }

    case 'calf': {
      const forbid = {
        ...EMPTY_FORBID,
        sprinting: true,
        plyos: true,
        runningImpact: true,
        highSpeedRunning: true,
      };
      return {
        bucket, severity, forbid,
        globalRules: [
          'No sprinting or running',
          'No plyos or jumping',
          'No heavy calf loading',
        ],
        replacements: [
          'Bike / rower instead of running and plyos',
          'Hip-dominant strength work instead of calf-loaded lifts',
          'Seated calf isometrics instead of loaded calf raises',
        ],
        preserveText: ['Upper body', 'Hip-dominant lower work', 'Recovery work'],
        closingAdvice: isHigh ? physioHard : physioSoft,
      };
    }

    case 'ankle': {
      const forbid = {
        ...EMPTY_FORBID,
        sprinting: true,
        plyos: true,
        cutting: true,
        runningImpact: true,
      };
      return {
        bucket, severity, forbid,
        globalRules: [
          'No sprinting, cutting, or change-of-direction',
          'No plyos or jumping',
          'No loaded unilateral work that loads the ankle',
        ],
        replacements: [
          'Bike / rower instead of running and impact work',
          'Bilateral seated work instead of single-leg loading',
          'Linear-only patterning instead of cutting drills',
        ],
        preserveText: ['Upper body', 'Low-impact lower work', 'Recovery work'],
        closingAdvice: isHigh ? physioHard : physioSoft,
      };
    }

    case 'adductor':
    case 'pubalgia': {
      const forbid = {
        ...EMPTY_FORBID,
        sprinting: true,
        cutting: true,
        ...(bucket === 'pubalgia' ? { heavyHinge: true } : {}),
      };
      return {
        bucket, severity, forbid,
        globalRules: [
          'No sprinting or cutting',
          bucket === 'pubalgia' ? 'No heavy hinge or kicking work' : 'No adductor-heavy work',
        ],
        replacements: [
          'Bike / rower instead of running and cutting',
          'Bilateral lower work (goblet squat, hip thrust) instead of adductor-heavy work',
          ...(bucket === 'pubalgia'
            ? ['Light single-leg patterning instead of heavy hinges']
            : []),
        ],
        preserveText: ['Upper body', 'Light bilateral lower work', 'Recovery work'],
        closingAdvice: isHigh ? physioHard : physioSoft,
      };
    }

    case 'shoulder': {
      const forbid = {
        ...EMPTY_FORBID,
        heavyPressing: true,
        overheadLoading: true,
        ...(isHigh ? { heavyPulling: true, contactDrills: true } : {}),
      };
      const rules: string[] = [
        'No heavy pressing',
        'No overhead loading',
      ];
      if (isHigh) rules.push('No heavy pulling or contact drills');
      const replacements: string[] = [
        'Landmine press or light DB pressing instead of barbell / overhead work',
        'Isometric holds (push-up plank, scap pull-up hold) instead of loaded pressing',
      ];
      if (isHigh) replacements.push('Bodyweight or band work instead of heavy pulling');
      return {
        bucket, severity, forbid, globalRules: rules, replacements,
        preserveText: isSerious
          ? ['Lower body', 'Recovery work']
          : ['Lower body', 'Light upper accessories', 'Recovery work'],
        closingAdvice: isHigh ? physioHard : physioSoft,
      };
    }

    case 'elbow':
    case 'wrist': {
      const forbid = {
        ...EMPTY_FORBID,
        heavyPressing: true,
        heavyPulling: true,
      };
      return {
        bucket, severity, forbid,
        globalRules: [
          'No heavy pressing or pulling',
          'Avoid loaded gripping work',
        ],
        replacements: [
          'Lower body sessions instead of heavy upper work',
          'Light isometric or band work instead of loaded gripping',
        ],
        preserveText: ['Lower body', 'Recovery work'],
        closingAdvice: isHigh ? physioHard : physioSoft,
      };
    }

    case 'lowerBack': {
      const forbid = {
        ...EMPTY_FORBID,
        axialLoading: true,
        heavyHinge: true,
        heavySquat: true,
        ...(isHigh ? { contactDrills: true } : {}),
      };
      const rules: string[] = [
        'No axial loading (back squat, heavy carries)',
        'No heavy hinges or deadlifts',
      ];
      if (isHigh) rules.push('No heavy contact drills');
      return {
        bucket, severity, forbid, globalRules: rules,
        replacements: [
          'Machine or supported lower work instead of axial loading',
          'Hip-dominant unilateral work (split squat, hip thrust) instead of heavy deadlifts',
          'Bird-dog / dead-bug instead of loaded core / spinal work',
        ],
        preserveText: isSerious
          ? ['Recovery work', 'Light mobility']
          : ['Upper body', 'Light unilateral lower (no axial load)', 'Recovery work'],
        closingAdvice: isHigh ? physioHard : physioSoft,
      };
    }
  }

  // Defensive — TypeScript exhaustiveness should make this unreachable.
  return {
    bucket, severity,
    forbid: { ...EMPTY_FORBID },
    globalRules: [],
    replacements: [],
    preserveText: [],
    closingAdvice: null,
  };
}

interface InjuryPayload {
  bodyPart: string;
  severity: number;
}

function readInjuryPayload(request: AdjustmentRequest): InjuryPayload | null {
  const p = request.payload;
  if (!p || typeof p !== 'object') return null;
  // bodyPart is OPTIONAL: 'unknown' is the sentinel the upstream extractor
  // emits when no body-part token was found in the message. The handler
  // still acts on severity alone (region-agnostic protective fallback).
  const rawBodyPart = (p.bodyPart ?? p.injuryArea) as unknown;
  const bodyPart =
    typeof rawBodyPart === 'string' && rawBodyPart.trim() !== ''
      ? rawBodyPart.trim()
      : 'unknown';
  const severityRaw = p.severity as unknown;
  const severity =
    typeof severityRaw === 'number'
      ? severityRaw
      : typeof severityRaw === 'string' && /^\d+(\.\d+)?$/.test(severityRaw.trim())
      ? Number(severityRaw)
      : NaN;
  if (!Number.isFinite(severity) || severity < 1 || severity > 10) return null;
  return { bodyPart, severity };
}

function empathyLine(severity: number, bodyPart: string): string {
  // Unknown body part → severity-anchored phrasing that doesn't pretend to
  // know what's hurting. Keeps the reply grounded in what the athlete
  // actually told us.
  if (bodyPart === 'unknown') {
    if (severity >= 8) return `Got it — ${severity}/10 is serious, pulling things right back.`;
    if (severity >= 6) return `Got it — ${severity}/10 is enough to pull things back a bit.`;
    return `Got it — ${severity}/10, let's ease off for a few days.`;
  }
  if (severity >= 8) return `That's a serious one — let's pull back hard on the ${bodyPart}.`;
  if (severity >= 6) return `Sounds rough — let's take pressure off the ${bodyPart} this week.`;
  return `Got it — let's protect the ${bodyPart} for a few days.`;
}

const DAY_SHORT: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

function dowOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

export function eventToBullet(ev: AdjustmentEvent): string {
  const day = DAY_SHORT[dowOf(ev.date)] ?? ev.date;
  switch (ev.kind) {
    case 'remove_exercise':
      return `${day}: removed ${String(ev.before ?? 'exercise')}`;
    case 'set_session_recovery':
      return `${day}: switched to recovery${ev.before ? ` (was ${String(ev.before)})` : ''}`;
    case 'lighten_session':
      return `${day}: lightened${ev.before ? ` ${String(ev.before)}` : ' session'}`;
    case 'mark_session_optional':
      return `${day}: marked optional${ev.before ? ` (${String(ev.before)})` : ''}`;
    case 'swap_conditioning_modality':
      return `${day}: swapped running for ${String(ev.after ?? 'off-feet conditioning')}`;
    case 'add_conditioning_block': {
      const title =
        ev.after && typeof ev.after === 'object' && typeof ev.after.title === 'string'
          ? ev.after.title.trim()
          : '';
      if (title && title !== 'Light Aerobic Intervals') {
        return `${day}: added ${title.toLowerCase()} after strength`;
      }
      return `${day}: added light aerobic intervals after strength`;
    }
    case 'remove_conditioning_block':
      return `${day}: removed conditioning`;
    case 'remove_strength_block':
      return `${day}: removed strength`;
    case 'reduce_strength_block':
      return `${day}: reduced strength`;
    case 'add_session_note': {
      // Reply must reflect the actual exposure, not "lightened Team
      // Training". `event.after` carries the bucket-specific note text
      // (e.g. "no sprinting / no high-speed running"); `event.before`
      // names the session being modified.
      const note = String(ev.after ?? 'modify session');
      const where = ev.before ? ` in ${String(ev.before)}` : '';
      return `${day}: ${note}${where}`;
    }
    case 'replace_exercise':
      return `${day}: replaced ${String(ev.before ?? 'exercise')} with ${String(ev.after ?? 'alternative')}`;
    case 'add_preference':
      return `Preference recorded: ${ev.reason}`;
    case 'calendar_mark':
      return `${day}: ${String(ev.after ?? 'calendar mark')}`;
    default: {
      const _e: never = ev.kind;
      void _e;
      return `${day}: change`;
    }
  }
}

/**
 * Render a "This week:" / "Instead:" / "Keep:" / closing-advice block
 * from the policy. Used by both the applied=true and applied=false
 * reply paths so the athlete sees the same week-wide guidance either
 * way.
 *
 * Section order in the final reply:
 *   This week:    (restrictions — what NOT to do)
 *   Instead:      (replacements — what TO do)
 *   Program changes:  (per-day events; only when applied=true)
 *   Keep:         (still trainable)
 *   closingAdvice (physio note)
 */
function renderPolicyBlocks(policy: InjuryPolicy): {
  thisWeek: string | null;
  instead: string | null;
  keep: string | null;
  closing: string | null;
} {
  const thisWeek = policy.globalRules.length
    ? `This week:\n${policy.globalRules.map((r) => `• ${r}`).join('\n')}`
    : null;
  const instead = policy.replacements.length
    ? `Instead:\n${policy.replacements.map((r) => `• ${r}`).join('\n')}`
    : null;
  const keep = policy.preserveText.length
    ? `Keep:\n${policy.preserveText.map((t) => `• ${t}`).join('\n')}`
    : null;
  const closing = policy.closingAdvice ?? null;
  return { thisWeek, instead, keep, closing };
}

function buildInjuryReply(
  events: AdjustmentEvent[],
  severity: number,
  bodyPart: string,
  policy: InjuryPolicy,
): string {
  const head = empathyLine(severity, bodyPart);
  if (events.length === 0) {
    // Caller should only invoke this with events.length > 0.
    return head;
  }
  const { thisWeek, instead, keep, closing } = renderPolicyBlocks(policy);
  const bullets = events.map(eventToBullet).map((b) => `• ${b}`).join('\n');
  const programChanges = `Program changes:\n${bullets}`;

  // Compose sections in priority order. "Instead:" sits BETWEEN the
  // restriction list and the program changes so the athlete reads
  // (a) what to avoid, (b) what to do instead, (c) what we already
  // adjusted for them, (d) what's still trainable, (e) physio note.
  const parts: string[] = [head];
  if (thisWeek) parts.push(thisWeek);
  if (instead) parts.push(instead);
  parts.push(programChanges);
  if (keep) parts.push(keep);
  if (closing) parts.push(closing);
  parts.push('Program updated — check your week.');
  return parts.join('\n\n');
}

/**
 * Honest reply for when severity ≥ 5 but no future session this week
 * actually loads the injured area. Used by rule 3 — never fabricate a
 * change on a recovery / unrelated session just to satisfy the
 * "applied=true if severity ≥ 5" reflex.
 *
 * Surfaces the global policy rules even when we made no changes — the
 * athlete still needs to know what to avoid in pickup play / training
 * outside the prescribed week.
 */
function buildNoRelevantSessionReply(
  severity: number,
  bodyPart: string,
  bucket: InjuryBucket | null,
  policy: InjuryPolicy,
): string {
  const head = empathyLine(severity, bodyPart);
  const { thisWeek, instead, keep, closing } = renderPolicyBlocks(policy);
  const honest = bucket
    ? `But there aren't any future sessions this week that load the ${bodyPart}, so I left the program unchanged.`
    : `There aren't any future sessions this week to adjust, so I left the program unchanged.`;
  const parts: string[] = [head, honest];
  if (thisWeek) parts.push(thisWeek);
  if (instead) parts.push(instead);
  if (keep) parts.push(keep);
  if (closing) parts.push(closing);
  return parts.join('\n\n');
}

/**
 * Injury intent handler. Pure function — emits events only, never mutates.
 */
function handleInjuryIntent(
  request: AdjustmentRequest,
  futureDays: ResolvedDay[],
  rejected: RejectedAdjustment[],
): AdjustmentResult {
  // ── 1. Validate payload ──────────────────────────────────────────────
  const payload = readInjuryPayload(request);
  if (!payload) {
    rejected.push({
      kind: REJECT_KIND.INVALID_REQUEST,
      reason:
        "injury intent requires payload.bodyPart (or injuryArea) + payload.severity (1..10)",
    });
    return {
      applied: false,
      events: [],
      rejected,
      reply:
        "I need a body part and a pain rating (1-10) before I can adjust anything.",
    };
  }

  const { bodyPart, severity } = payload;

  // ── 2. Severity gate ─────────────────────────────────────────────────
  if (severity < 5) {
    return {
      applied: false,
      events: [],
      rejected,
      reply: `${bodyPart} ${severity}/10 — that's manageable, no program change required. Train through it and we'll watch how it tracks.`,
    };
  }

  // ── 3. Map body-part → bucket (optional) ─────────────────────────────
  //
  // 'unknown' bodyPart (no token found upstream) and bodyParts not in our
  // bucket map both fall through to a region-agnostic protective fallback:
  // the engine still emits ≥1 event when severity ≥ 5. We never tell the
  // athlete "I can't help" once severity is provided — that contract is
  // enforced by the empty-events fallback in step 7 below.
  const bucket = bodyPart === 'unknown' ? null : resolveInjuryBucket(bodyPart);
  if (bodyPart !== 'unknown' && !bucket) {
    // Body part was named but not in our map (e.g. "forelimb"). Note the
    // rejection for telemetry but continue down the fallback path so we
    // still mutate the program — the contract is "act when severity ≥ 5".
    rejected.push({
      kind: 'unknown_body_part',
      reason: `body part '${bodyPart}' is not in the injury bucket map — using region-agnostic fallback`,
    });
  }

  const region: InjuryRegion | null = bucket ? classifyRegion(bucket) : null;

  // ── 3.5 Build global injury policy (week-wide constraints) ───────────
  //
  // The policy is the single source of truth for "what NOT to do this
  // week" (forbid flags) and for the reply's "This week:" / "Keep:"
  // sections. The per-day chooser also reads it for the post-loop
  // consistency sweep — any day with running exposure that didn't get
  // an event when policy.forbid.sprinting is true gets a fallback note.
  const policy = buildInjuryPolicy(bucket, severity);

  // ── 4. No future sessions in current week ────────────────────────────
  const adjustableDays = futureDays.filter((d) => isAdjustableWorkout(d.workout));
  if (adjustableDays.length === 0) {
    const replyBodyPart = bucket ? bodyPart : 'unknown';
    return {
      applied: false,
      events: [],
      rejected,
      reply: buildNoRelevantSessionReply(severity, replyBodyPart, bucket, policy),
    };
  }

  // ── 5. Severity tier flags ───────────────────────────────────────────
  //
  // Threshold rationale:
  //   sev ≥ 5  — remove 'avoid'-tagged exposure (the strong cases:
  //              RDL/deadlift for hammy, depth-jumps for knee, …)
  //   sev ≥ 6  — also remove 'caution'-tagged exposure (NEW). The user
  //              spec is "what specific stress is being removed" — at
  //              6/10 the engine should target the actual exposure
  //              (e.g. pressing for shoulder), not a generic lighten.
  //   sev ≥ 8  — escalate to recovery shell on heavy-risk sessions.
  const removeAvoid = severity >= 5;
  const removeCaution = severity >= 6;
  const recoveryShellActive = severity >= 8;
  const fallbackUsesRecovery = severity >= 7;

  const events: AdjustmentEvent[] = [];

  // ── 6. EXPOSURE-LEVEL PER-DAY ACTION CHOOSER ─────────────────────────
  //
  // For each adjustable, NON-recovery future day we pick the most
  // specific action that addresses the injured area. The priority list
  // (per the spec) is:
  //
  //   (1) tagged risky exercises    → remove_exercise (or recovery shell
  //                                    on ≥8 + heavy-risk session)
  //   (2) running conditioning      → swap_conditioning_modality
  //   (3) team training             → add_session_note (lower-limb only)
  //   (4) generic relevant session  → lighten_session
  //                                    (set_session_recovery at sev ≥7)
  //
  // (1) is ALSO compounded with (2) when the same day has both tagged
  // exercises AND running conditioning — we want both addressed.
  //
  // RECOVERY EXCLUSION (rule 1): recovery sessions are NEVER touched.
  // Lightening recovery is a no-op that produces a misleading bullet.
  for (const day of adjustableDays) {
    const workout = day.workout!;
    if (isRecoverySession(workout)) continue;

    const dayBefore = events.length;

    // ── (1) Tagged risky exercises ──────────────────────────────────────
    if (bucket && region) {
      const exercises = workout.exercises ?? [];
      const avoidNames: string[] = [];
      const cautionNames: string[] = [];
      for (const ex of exercises) {
        const name: string = (ex as any).exercise?.name || '';
        if (!name) continue;
        const rating = classifyExercise(name, bucket);
        if (rating === 'avoid') avoidNames.push(name);
        else if (rating === 'caution') cautionNames.push(name);
      }
      const removable = removeCaution ? [...avoidNames, ...cautionNames] : [...avoidNames];
      const riskShare = removable.length / Math.max(1, exercises.length);

      // ≥8 + ≥50% risky + ≥2 risky → recovery shell INSTEAD of removal.
      if (recoveryShellActive && removable.length >= 2 && riskShare >= 0.5) {
        events.push(
          buildEvent(
            'set_session_recovery',
            day.date,
            `${bucket} ${severity}/10 — heavy ${region} load (${removable.length}/${exercises.length} risky)`,
            workout.name,
            'Recovery',
          ),
        );
        continue; // recovery is terminal for this day
      }

      // ── Session-level decision ─────────────────────────────────────
      // Classify the session as HIGH / MODERATE / LOW. HIGH sessions
      // get a session-level rebuild note + prefer replace_exercise
      // (so the athlete sees a substituted movement, not just a
      // missing one). MODERATE prefers replace where a curated
      // alternative exists, falls back to remove. LOW (no risky tag)
      // stays untouched. The risk lookups don't fire here because the
      // session passed the per-exercise filter — but for HIGH we add
      // a coachNote summarising the rebuild rationale.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { classifySessionRisk, getReplacementForBucket, summariseRebuild } =
        require('./injurySessionClassifier');
      const risk = classifySessionRisk(workout, bucket);
      if (risk !== 'LOW') {
        for (const name of removable) {
          const replacement = getReplacementForBucket(name, bucket);
          if (replacement) {
            events.push(
              buildEvent(
                'replace_exercise',
                day.date,
                `${bucket} ${severity}/10 — ${region}-region risk; safe alt`,
                name,
                replacement,
              ),
            );
          } else {
            events.push(
              buildEvent(
                'remove_exercise',
                day.date,
                `${bucket} ${severity}/10 — ${region}-region risk`,
                name,
                null,
              ),
            );
          }
        }
        // HIGH-risk sessions get a rebuild summary attached so the
        // athlete sees WHY the session was reshaped on the Program
        // tab (not just a list of removals).
        if (risk === 'HIGH' && removable.length > 0) {
          events.push(
            buildEvent(
              'add_session_note',
              day.date,
              `${bucket} ${severity}/10 — session rebuilt`,
              workout.name,
              `Rebuilt for ${bucket} — ${summariseRebuild(bucket)}`,
            ),
          );
        }
      }
    }

    // ── (2) Lower-limb + running-based conditioning swap ────────────────
    // Compounded with (1) — a running conditioning day that ALSO has a
    // hamstring-curl exercise gets both treatments.
    if (bucket && region === 'lower' && isRunningBased(workout)) {
      events.push(
        buildEvent(
          'swap_conditioning_modality',
          day.date,
          `${bucket} ${severity}/10 — off-feet conditioning`,
          'running',
          'bike or row',
        ),
      );
    }

    // If the day already has events (1)/(2), skip (3)/(4) — the more
    // specific action wins.
    if (events.length > dayBefore) continue;

    // ── (3) Team training — lower-limb buckets ──────────────────────────
    // Sprint/run exposure is in the team-day shell, not in `exercises`,
    // so the only way to address it is to attach a note.
    if (bucket && region === 'lower' && isTeamTraining(workout)) {
      const exposure = getBucketExposure(bucket);
      const note = exposure?.teamNote ?? 'no sprinting / no high-speed work';
      events.push(
        buildEvent(
          'add_session_note',
          day.date,
          `${bucket} ${severity}/10 — modify team training`,
          workout.name,
          note,
        ),
      );
      continue;
    }

    // ── (4) Generic relevant session — lighten or recover ───────────────
    if (bucket && isSessionRelevantToBucket(workout, bucket)) {
      const useRecovery = fallbackUsesRecovery;
      const reason = `${bucket} ${severity}/10 — protective fallback (no specific exposure tagged on this day)`;
      events.push(
        buildEvent(
          useRecovery ? 'set_session_recovery' : 'lighten_session',
          day.date,
          reason,
          workout.name ?? null,
          useRecovery ? 'Recovery' : 'Lightened',
        ),
      );
      continue;
    }
  }

  // ── 7. Unknown bucket fallback ──────────────────────────────────────
  //
  // When bodyPart is 'unknown' / unmapped we have no way to score
  // relevance, but the contract is still "act when severity ≥ 5". Pick
  // the first non-recovery adjustable day and emit lighten/recover.
  if (events.length === 0 && !bucket) {
    const target = adjustableDays.find(
      (d) => d.workout != null && !isRecoverySession(d.workout),
    );
    if (target && target.workout) {
      const useRecovery = fallbackUsesRecovery;
      events.push(
        buildEvent(
          useRecovery ? 'set_session_recovery' : 'lighten_session',
          target.date,
          `${severity}/10 — protective fallback (body part not specified)`,
          target.workout.name ?? null,
          useRecovery ? 'Recovery' : 'Lightened',
        ),
      );
    }
  }

  // ── 7.5 Consistency sweep — every running exposure addressed ─────────
  //
  // The per-day chooser handles tagged exercises (1), running cond (2),
  // team training (3), and region-relevant generics (4). This sweep
  // catches the gap: a day with running exposure that didn't trigger
  // any of (1)–(4) — e.g. a "Conditioning" day named "Tempo Run" with
  // no specifically tagged exercises — when `policy.forbid.sprinting`
  // is true. We emit a fallback `add_session_note` so the athlete sees
  // a consistent week ("no sprinting" must hold across ALL sessions).
  if (bucket && policy.forbid.sprinting) {
    const teamNote = getBucketExposure(bucket)?.teamNote ?? 'no sprinting / no high-speed running';
    const datesWithEvents = new Set(events.map((e) => e.date));
    for (const day of adjustableDays) {
      const w = day.workout!;
      if (isRecoverySession(w)) continue;
      if (datesWithEvents.has(day.date)) continue;
      const hasRunningExposure =
        isRunningBased(w) || isTeamTraining(w);
      if (!hasRunningExposure) continue;
      events.push(
        buildEvent(
          'add_session_note',
          day.date,
          `${bucket} ${severity}/10 — week-wide policy (no sprinting)`,
          w.name,
          teamNote,
        ),
      );
      datesWithEvents.add(day.date);
    }
  }

  // ── 8. Final result ──────────────────────────────────────────────────
  if (events.length === 0) {
    // No session this week loads the injured area (or we couldn't
    // identify the area at all). Stay honest — applied=false, no claim
    // of change, no recovery-session lightening.
    const replyBodyPart = bucket ? bodyPart : 'unknown';
    logger.debug('[adjustment-engine] events_emitted', {
      intent: 'injury',
      count: 0,
      reason: 'no_relevant_session',
      bucket,
      severity,
    });
    return {
      applied: false,
      events: [],
      rejected,
      reply: buildNoRelevantSessionReply(severity, replyBodyPart, bucket, policy),
    };
  }

  // When the bucket is null (unknown sentinel OR unmapped body part), use
  // severity-anchored phrasing so the reply doesn't claim knowledge of a
  // body part the engine couldn't act on specifically.
  const replyBodyPart = bucket ? bodyPart : 'unknown';

  // [adjustment-engine] events_emitted — pipeline-step #1 log so
  // every emitted event is visible BEFORE applyAdjustmentEvents runs.
  // If the apply step rejects an event, the gap between this log and
  // [apply-events] applied makes the failure obvious.
  logger.debug('[adjustment-engine] events_emitted', {
    intent: 'injury',
    count: events.length,
    bucket,
    severity,
    events: events.map((e) => ({
      kind: e.kind,
      date: e.date,
      before: e.before ?? null,
      after: e.after ?? null,
      reason: e.reason,
    })),
  });

  return {
    applied: true,
    events,
    rejected,
    reply: buildInjuryReply(events, severity, replyBodyPart, policy),
  };
}
