/**
 * coachContextStateStore.ts — durable "what are we talking about?" state
 * for the coach pipeline.
 *
 * THE PROBLEM
 *
 * After the coach explains the Wednesday Easy Aerobic Flush rower, "Can
 * you change it to a bike?" has no deterministic anchor. There is no
 * stored target, so the message classifies as a vague mutation request,
 * the legacy fallback fires, and the user gets either the wrong answer
 * or a Monday Lower Body strength reply.
 *
 * THE FIX (Phase 2)
 *
 * A tiny in-memory store that records the workout the athlete most
 * recently OPENED (DayWorkoutScreen mount), most recently received an
 * EXPLANATION about (coach reply), and a "last discussed" pointer that
 * always reflects the most-recently touched of the two. The reference
 * resolver consumes this so "it" / "that session" / "the row" can bind
 * to a concrete date + workout name without LLM guessing.
 *
 * EXPIRY
 *
 * State is per-session — we deliberately DO NOT persist across cold
 * starts. A workout opened yesterday does not anchor "it" today. A
 * 30-minute TTL covers the realistic window: open the day, switch to
 * Coach tab, ask the question. Anything older asks a clarifier.
 *
 * BOUNDARY
 *
 * This module is presentation-pure: it stores ISO date + workout name +
 * source + timestamp. It does NOT carry the full Workout object — the
 * resolver re-reads the visible projection by date when it needs the
 * exercise list. That keeps the store cheap and means we never have a
 * stale workout body floating around.
 */

import { create } from 'zustand';

/** Where the context entry came from. */
export type CoachContextSource =
  | 'program_tab'
  | 'day_workout'
  | 'coach_explanation'
  | 'coach_mutation';

export interface CoachContextEntry {
  /** ISO YYYY-MM-DD of the session. */
  date: string;
  /** Athlete-facing session name (canonical / display name). */
  sessionName: string;
  /** ms since epoch — used for TTL. */
  updatedAt: number;
  /** What surface wrote this entry. */
  source: CoachContextSource;
  /**
   * Optional — short list of modality tokens detected in the session
   * (rower / bike / sprint / long-run / strength etc). Lets the
   * resolver bind "the row" to the right session without re-reading
   * the visible projection. Lowercase, deduped.
   */
  modalities?: string[];
  /** Optional mutation metadata when source === 'coach_mutation'. */
  lastMutationType?: string;
  targetSessionId?: string | null;
  newlyAdded?: boolean;
}

interface CoachContextState {
  /**
   * Workout the athlete is actively viewing in the DayWorkout screen.
   * Cleared on screen unmount only when explicit; otherwise the entry
   * lives until TTL expiry.
   */
  lastOpenedWorkout: CoachContextEntry | null;
  /**
   * Workout the coach most recently explained (program_explanation,
   * session_mismatch_question, or any reply that names a session).
   */
  lastExplainedSession: CoachContextEntry | null;
  /**
   * Convenience pointer: whichever of the above is most recent.
   * Always equals the entry with the larger `updatedAt`.
   */
  lastDiscussedWorkout: CoachContextEntry | null;
  /**
   * Most recent verified coach mutation target. This is separate from
   * opened/explained context because a visible screen mount can refresh
   * `lastOpenedWorkout` after a mutation, but pronouns like "it" should
   * still refer to the thing the coach just changed.
   */
  lastMutationTarget: CoachContextEntry | null;

  /** Set the currently-opened workout (DayWorkoutScreen mount). */
  setLastOpenedWorkout: (entry: Omit<CoachContextEntry, 'updatedAt' | 'source'> & { source?: CoachContextSource }) => void;
  /** Record the workout the coach just explained. */
  setLastExplainedSession: (entry: Omit<CoachContextEntry, 'updatedAt' | 'source'> & { source?: CoachContextSource }) => void;
  /** Record the target of a verified coach mutation. */
  setLastMutationTarget: (entry: Omit<CoachContextEntry, 'updatedAt' | 'source'> & { source?: CoachContextSource }) => void;
  /** Clear everything (used by tests + reset coach controls). */
  clearCoachContext: () => void;
}

/**
 * How long an entry is treated as "recent enough" to anchor a pronoun.
 * 30 minutes — long enough to cover open-day → switch-to-coach →
 * compose-question, short enough that yesterday's workout never
 * silently anchors "it".
 */
export const COACH_CONTEXT_TTL_MS = 30 * 60 * 1000;

function pickMostRecent(
  a: CoachContextEntry | null,
  b: CoachContextEntry | null,
): CoachContextEntry | null {
  if (!a) return b;
  if (!b) return a;
  return a.updatedAt >= b.updatedAt ? a : b;
}

export const useCoachContextStateStore = create<CoachContextState>()((set, get) => ({
  lastOpenedWorkout: null,
  lastExplainedSession: null,
  lastDiscussedWorkout: null,
  lastMutationTarget: null,

  setLastOpenedWorkout: (entry) => {
    const now = Date.now();
    const stored: CoachContextEntry = {
      date: entry.date,
      sessionName: entry.sessionName,
      modalities: entry.modalities ? dedupeLower(entry.modalities) : undefined,
      updatedAt: now,
      source: entry.source ?? 'day_workout',
    };
    const prev = get();
    const lastDiscussedWorkout = pickMostRecent(stored, prev.lastExplainedSession);
    set({ lastOpenedWorkout: stored, lastDiscussedWorkout });
  },

  setLastExplainedSession: (entry) => {
    const now = Date.now();
    const stored: CoachContextEntry = {
      date: entry.date,
      sessionName: entry.sessionName,
      modalities: entry.modalities ? dedupeLower(entry.modalities) : undefined,
      updatedAt: now,
      source: entry.source ?? 'coach_explanation',
    };
    const prev = get();
    const lastDiscussedWorkout = pickMostRecent(stored, prev.lastOpenedWorkout);
    set({ lastExplainedSession: stored, lastDiscussedWorkout });
  },

  setLastMutationTarget: (entry) => {
    const now = Date.now();
    const stored: CoachContextEntry = {
      date: entry.date,
      sessionName: entry.sessionName,
      modalities: entry.modalities ? dedupeLower(entry.modalities) : undefined,
      lastMutationType: entry.lastMutationType,
      targetSessionId: entry.targetSessionId ?? null,
      newlyAdded: entry.newlyAdded,
      updatedAt: now,
      source: entry.source ?? 'coach_mutation',
    };
    set({ lastMutationTarget: stored, lastDiscussedWorkout: stored });
  },

  clearCoachContext: () =>
    set({
      lastOpenedWorkout: null,
      lastExplainedSession: null,
      lastDiscussedWorkout: null,
      lastMutationTarget: null,
    }),
}));

function dedupeLower(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const lower = v.trim().toLowerCase();
    if (!lower || seen.has(lower)) continue;
    seen.add(lower);
    out.push(lower);
  }
  return out;
}

/**
 * Imperative getter — returns the live entries with TTL applied.
 * Anything older than `COACH_CONTEXT_TTL_MS` is treated as missing.
 *
 * Pure read — does NOT clear expired entries from the store. (We let
 * a fresh write overwrite stale data so a "coach explanation" from
 * yesterday does not have to be actively scrubbed when the user opens
 * the app today.)
 */
export function getCoachContextSnapshot(now: number = Date.now()): {
  lastOpenedWorkout: CoachContextEntry | null;
  lastExplainedSession: CoachContextEntry | null;
  lastDiscussedWorkout: CoachContextEntry | null;
  lastMutationTarget: CoachContextEntry | null;
} {
  const s = useCoachContextStateStore.getState();
  const fresh = (e: CoachContextEntry | null): CoachContextEntry | null =>
    e && now - e.updatedAt <= COACH_CONTEXT_TTL_MS ? e : null;
  const lastOpenedWorkout = fresh(s.lastOpenedWorkout);
  const lastExplainedSession = fresh(s.lastExplainedSession);
  const lastMutationTarget = fresh(s.lastMutationTarget);
  return {
    lastOpenedWorkout,
    lastExplainedSession,
    lastDiscussedWorkout: lastMutationTarget ?? pickMostRecent(lastOpenedWorkout, lastExplainedSession),
    lastMutationTarget,
  };
}
