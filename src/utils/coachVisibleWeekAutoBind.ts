/**
 * coachVisibleWeekAutoBind.ts — modality-uniqueness auto-bind.
 *
 * WHY THIS EXISTS
 *
 * In the live app the deterministic chain (router → parser →
 * orchestrator → executor) works perfectly on smoke fixture data —
 * inspect-coach-live-context.ts proves end-to-end success. The reason
 * the live second turn "Can you change to a bike?" leaks the forbidden
 * clarifier "Which session should I switch?" is that
 * `packet.referenceResolution.target` is null: the durable coach
 * context store (`lastDiscussedWorkout` / `lastExplainedSession` /
 * `lastOpenedWorkout`) has not yet been written by turn 1, so the
 * resolver has nothing to bind "it" / "the row" to. The router then
 * emits `needsClarification: true` at coachCommandRouter.ts:760.
 *
 * THE DURABLE RULE
 *
 * If the user asks for a modality swap (`parseModalitySwapRequest`
 * returns non-null) AND exactly one visible-week session matches the
 * source modality, bind that session automatically. Never ask "which
 * session?" when the answer is mechanically determinable from the
 * visible program.
 *
 * INPUTS
 *
 *   • The freshly-built CoachContextPacket. Caller has already run
 *     buildCoachContextPacket; we don't reach into Zustand here.
 *   • The user's raw message (the same string fed to the router).
 *
 * OUTPUT
 *
 *   A new packet with `referenceResolution` overridden when:
 *     (a) packet.referenceResolution.target is currently null, AND
 *     (b) parseModalitySwapRequest(userMessage) returns non-null, AND
 *     (c) exactly one visible-week session matches the source modality.
 *
 *   Otherwise the packet is returned unchanged.
 *
 * SOURCE-MODALITY RESOLUTION
 *
 *   • If `swap.from` is set ("change the rower to a bike") we filter
 *     visible-week sessions whose extracted modalities include that
 *     token.
 *   • If `swap.from` is null ("change to a bike" — `fromInferred=true`)
 *     we filter visible-week sessions whose extracted modalities
 *     include ANY conditioning token NOT matching `swap.to`. Empty
 *     modality lists never match.
 *
 * NON-GOALS
 *
 *   • Does NOT mutate any store.
 *   • Does NOT decide a target on its own when the message is not a
 *     modality swap — see the truth gate in CoachScreen for the
 *     `mutationLike` fallback.
 *   • Does NOT short-circuit when the resolver already resolved a
 *     target through explicit_day / modality_match / pronoun etc. —
 *     those paths are stricter and we trust them.
 */

import type { CoachContextPacket } from './coachIntent';
import type {
  CoachReferenceResolution,
  CoachReferenceTarget,
} from './coachReferenceResolver';
import { extractModalitiesFromSession } from './coachReferenceResolver';
import { parseModalitySwapRequest } from './coachModalitySwap';
import type { ConditioningModality } from '../data/exerciseTags';
import type { ResolvedDay } from './sessionResolver';
import { logger } from './logger';

// ─── Module-private modality alias map ──────────────────────────────
// We accept any of the tokens emitted by extractModalitiesFromSession,
// normalised back to the canonical ConditioningModality alphabet used
// by parseModalitySwapRequest.

const MODALITY_NORMALISE: Record<string, ConditioningModality> = {
  row: 'row',
  rower: 'row',
  rowing: 'row',
  bike: 'bike',
  cycling: 'bike',
  cycle: 'bike',
  spin: 'bike',
  run: 'run',
  running: 'run',
  runs: 'run',
  jog: 'run',
  ski: 'ski',
  skierg: 'ski',
  swim: 'swim',
};

function tokensToModalities(tokens: string[]): Set<ConditioningModality> {
  const out = new Set<ConditioningModality>();
  for (const t of tokens) {
    const canonical = MODALITY_NORMALISE[t.toLowerCase()];
    if (canonical) out.add(canonical);
  }
  return out;
}

// ─── Candidate filter ───────────────────────────────────────────────

interface Candidate {
  date: string;
  sessionName: string;
  modalities: Set<ConditioningModality>;
}

function visibleWeekCandidatesMatchingSource(
  currentWeek: ResolvedDay[],
  from: ConditioningModality | null,
  to: ConditioningModality,
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const day of currentWeek) {
    if (!day?.workout) continue;
    const tokens = extractModalitiesFromSession({
      name: day.workout.name,
      exercises: day.workout.exercises,
    });
    const modalities = tokensToModalities(tokens);
    if (modalities.size === 0) continue;
    if (from != null) {
      if (!modalities.has(from)) continue;
    } else {
      // No explicit source — accept any session whose modality set
      // does NOT include the target. Otherwise "change to a bike"
      // would match an existing bike session and propose swapping it
      // for itself.
      const hasNonTarget = Array.from(modalities).some((m) => m !== to);
      if (!hasNonTarget) continue;
    }
    candidates.push({
      date: day.date,
      sessionName: day.workout.name ?? 'Conditioning session',
      modalities,
    });
  }
  return candidates;
}

// ─── Public entry point ─────────────────────────────────────────────

export interface AutoBindOutcome {
  /** New packet — same identity as input when no bind happened. */
  packet: CoachContextPacket;
  /** True when we synthesised a referenceResolution. */
  bound: boolean;
  /** Set when bound — the synthesised target. */
  boundTarget?: CoachReferenceTarget;
  /** Diagnostic — number of candidates considered. */
  candidateCount: number;
  /** Diagnostic — short reason code suitable for logs. */
  reason:
    | 'no_modality_swap_intent'
    | 'reference_already_resolved'
    | 'no_candidates'
    | 'multiple_candidates'
    | 'bound';
}

export function autoBindUniqueModalityTarget(
  packet: CoachContextPacket,
  userMessage: string,
): AutoBindOutcome {
  // (1) Guard — leave packets with an already-resolved target alone.
  // We trust the deterministic resolver's explicit_day / modality_match
  // / pronoun_last_discussed / implicit_recent_context paths.
  if (packet.referenceResolution?.target) {
    return {
      packet,
      bound: false,
      candidateCount: 0,
      reason: 'reference_already_resolved',
    };
  }

  // (2) Parse the message for modality-swap intent. Non-swap turns
  // (questions, explanations, injuries) are out of scope here.
  const swap = parseModalitySwapRequest(userMessage);
  if (!swap) {
    return {
      packet,
      bound: false,
      candidateCount: 0,
      reason: 'no_modality_swap_intent',
    };
  }

  // (3) Scan the visible week.
  const candidates = visibleWeekCandidatesMatchingSource(
    packet.currentWeek ?? [],
    swap.from ?? null,
    swap.to,
  );

  if (candidates.length === 0) {
    return {
      packet,
      bound: false,
      candidateCount: 0,
      reason: 'no_candidates',
    };
  }
  if (candidates.length > 1) {
    return {
      packet,
      bound: false,
      candidateCount: candidates.length,
      reason: 'multiple_candidates',
    };
  }

  // (4) Exactly one candidate → synthesise resolved reference.
  const c = candidates[0];
  const target: CoachReferenceTarget = {
    date: c.date,
    sessionName: c.sessionName,
    method: 'implicit_recent_context',
  };
  const synthesised: CoachReferenceResolution = {
    status: 'resolved',
    target,
    confidence: 0.8,
    isMutationLike: true,
  };

  logger.debug('[coach-live-send] auto_bound_unique_modality', {
    swapFrom: swap.from,
    swapTo: swap.to,
    targetDate: target.date,
    targetSessionName: target.sessionName,
    candidateCount: 1,
  });

  return {
    packet: { ...packet, referenceResolution: synthesised },
    bound: true,
    boundTarget: target,
    candidateCount: 1,
    reason: 'bound',
  };
}
