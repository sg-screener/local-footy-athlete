/**
 * THE ATHLETE'S GOALS — typed, with one parsing rule instead of two.
 *
 * SAM'S RULING, 2026-07-30 (`docs/UNAUTHORED_TRANSLATIONS_SHEET_2026-07-30.md` §3):
 *
 *   > motivation becomes typed goals: `MotivationGoal[]`, display string derived at
 *   > render; read-ingress lift for stored strings (L15); both `.split(', ')` sites
 *   > deleted; the goal OPTION list pinned as an authored set, gated both directions.
 *
 * WHAT WAS WRONG. `motivation` was stored as ONE STRING — the selected labels joined with
 * `", "` — and two separate modules split it back apart to recover the list:
 *
 *     goals: data.motivation ? data.motivation.split(', ') : []          // coachingEngine
 *     goals: args.profile.motivation ? args.profile.motivation.split(', ') : []  // recoveryAddonBuilder
 *
 * Three defects in one shape, and the third is the one that matters:
 *
 *  1. TWO COPIES OF ONE PARSING RULE, either of which could drift.
 *  2. SEPARATOR-FRAGILE — and not hypothetically. The Motivation screen's "Other" option
 *     writes UNVALIDATED FREE TEXT into the joined string, so an athlete who types
 *     "get fit, feel good" produces two goals, one of which is "feel good" and leans
 *     freshness. Nothing anywhere reports it.
 *  3. IT STORES A DERIVED SHAPE. The athlete picked several goals; the app stored a
 *     sentence and re-derived the list. The north star is the other way round — store the
 *     decisions, derive the presentation — so the sentence is now DERIVED and the
 *     selection is what persists.
 *
 * UNDER L15 (one write format): `goals` + `motivationOther` are the only shapes written
 * from now on. `motivation` is READ-INGRESS ONLY — lifted for profiles that predate this,
 * never written again by anything.
 */

import type { MotivationGoal, OnboardingData } from '../types/domain';

export type { MotivationGoal };

/**
 * THE AUTHORED OPTION SET.
 *
 * These are the seven tiles on the Motivation screen, which are Sam's own onboarding
 * copy. The screen imports this list rather than declaring its own, so "a goal the app
 * can lean on" and "a goal the athlete can pick" are the same list by construction —
 * that is the "gated both directions" half of the ruling, and `motivationGoalsTests`
 * fails in either direction.
 *
 * The `MotivationGoal` union itself lives in `types/domain.ts` beside the other onboarding
 * answer unions, and is re-exported here so consumers have one import.
 */
export interface MotivationGoalOption {
  readonly id: MotivationGoal;
  /** The athlete-facing label. Also the token the bias reads — see `motivationBiasTokens`. */
  readonly label: string;
}

export const MOTIVATION_GOAL_OPTIONS: readonly MotivationGoalOption[] = [
  { id: 'make_senior_team', label: 'Make the senior team' },
  { id: 'dominate_level', label: 'Dominate your level' },
  { id: 'fresh_on_game_day', label: 'Feel fresh on game day' },
  { id: 'stay_injury_free', label: 'Stay injury-free' },
  { id: 'stronger_and_fitter', label: 'Get stronger & fitter' },
  { id: 'build_muscle', label: 'Build muscle' },
  { id: 'stay_consistent', label: 'Stay consistent' },
];

/** How many goals the athlete may pick. Sam's screen copy: "Pick up to 3 goals". */
export const MAX_MOTIVATION_GOALS = 3;

const BY_ID: ReadonlyMap<MotivationGoal, MotivationGoalOption> =
  new Map(MOTIVATION_GOAL_OPTIONS.map((option) => [option.id, option]));

export function isMotivationGoal(value: unknown): value is MotivationGoal {
  return typeof value === 'string' && BY_ID.has(value as MotivationGoal);
}

export function motivationGoalLabel(goal: MotivationGoal): string {
  return BY_ID.get(goal)!.label;
}

/**
 * The athlete's goals as they were chosen, plus any free text.
 *
 * `other` is kept SEPARATE rather than folded into the list, because it is a different
 * kind of answer: the seven are decisions from an authored set and `other` is prose. The
 * old string could not tell them apart, which is precisely how a comma in the prose became
 * an extra goal.
 */
export interface ResolvedMotivation {
  readonly goals: readonly MotivationGoal[];
  readonly other: string | null;
}

const EMPTY: ResolvedMotivation = { goals: [], other: null };

/** Compare labels the way athletes type them, not the way we store them. */
function normaliseLabel(value: string): string {
  return value.trim().toLowerCase().replace(/&/g, ' and ').replace(/\s+/g, ' ');
}

const BY_NORMALISED_LABEL: ReadonlyMap<string, MotivationGoal> = new Map(
  MOTIVATION_GOAL_OPTIONS.map((option) => [normaliseLabel(option.label), option.id]),
);

/**
 * THE READ-INGRESS LIFT (L15) — the `powerBlock` / hydration precedent.
 *
 * A stored `motivation` sentence becomes typed goals. Tokens that match an authored label
 * become that goal; anything else is the athlete's own words and becomes `other`, REJOINED
 * in the order it was written.
 *
 * WHY UNKNOWN TOKENS ARE NOT DROPPED. The lift's job is to lose nothing. An athlete who
 * typed a comma into "Other" produced fragments that were never goals; rejoining them
 * restores the sentence they actually wrote rather than inventing goals from it. It cannot
 * recover which fragments were one answer — that information was destroyed at write time,
 * which is the defect — but it can decline to make it worse.
 */
export function liftStoredMotivation(stored: string | null | undefined): ResolvedMotivation {
  const sentence = String(stored ?? '').trim();
  if (!sentence) return EMPTY;

  const goals: MotivationGoal[] = [];
  const leftovers: string[] = [];
  for (const token of sentence.split(',')) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const goal = BY_NORMALISED_LABEL.get(normaliseLabel(trimmed));
    if (goal && !goals.includes(goal)) goals.push(goal);
    else if (!goal) leftovers.push(trimmed);
  }
  return { goals, other: leftovers.length > 0 ? leftovers.join(', ') : null };
}

/**
 * THE ONE READER. Both `.split(', ')` sites now call this instead of parsing for
 * themselves — the single parsing rule the ruling asked for.
 *
 * Typed `goals` win when present. `motivation` is consulted ONLY as read-ingress for
 * profiles written before the typed shape existed.
 */
export function resolveMotivation(
  profile: Pick<OnboardingData, 'goals' | 'motivation' | 'motivationOther'> | null | undefined,
): ResolvedMotivation {
  if (!profile) return EMPTY;

  const typed = (profile.goals ?? []).filter(isMotivationGoal);
  if (typed.length > 0 || profile.motivationOther) {
    return {
      goals: typed,
      other: profile.motivationOther?.trim() || null,
    };
  }
  return liftStoredMotivation(profile.motivation);
}

/**
 * THE DISPLAY STRING, DERIVED — never stored.
 *
 * This is what `motivation` used to hold. Review rows, the profile screen and the coach
 * prompt all render this; nothing writes it back.
 */
export function motivationDisplay(resolved: ResolvedMotivation): string {
  const parts = resolved.goals.map(motivationGoalLabel);
  if (resolved.other) parts.push(resolved.other);
  return parts.join(', ');
}

/**
 * What `programmingBias` reads.
 *
 * The bias matches SUBSTRINGS over goal text ('injury', 'speed', 'muscle', …), so the
 * tokens it receives are the authored labels — unchanged from what the split used to hand
 * it, which is why this migration moves no athlete's program.
 *
 * The free text is still passed through, deliberately and behaviour-preservingly: it did
 * reach the bias before, and silently cutting it off would be a programming change riding
 * inside a storage change. Whether it SHOULD reach the bias is a live question for Sam —
 * see the boundary report; it is the goals-side twin of the injury "Other" partial swallow
 * (`docs/INJURY_OTHER_PATH_TRACE_2026-07-30.md`).
 */
export function motivationBiasTokens(resolved: ResolvedMotivation): string[] {
  const tokens = resolved.goals.map(motivationGoalLabel);
  if (resolved.other) tokens.push(resolved.other);
  return tokens;
}
