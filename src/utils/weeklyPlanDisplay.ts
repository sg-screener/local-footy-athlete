/**
 * Weekly plan display owns placement; conditioningVisibleIdentity owns every
 * canonical conditioning label and dose.
 */

import type { Workout } from '../types/domain';
import {
  CONDITIONING_VISIBLE_LABELS,
  projectConditioningVisibleIdentity,
  type ConditioningVisibleIdentity,
} from './conditioningVisibleIdentity';

export type ConditioningDisplayCategory = ConditioningVisibleIdentity['primaryLabel'];

export const WEEKLY_CONDITIONING_ICON_KIND = 'pulse' as const;

const WEEKLY_CONDITIONING_LABEL_KEYS = new Set([
  ...Object.values(CONDITIONING_VISIBLE_LABELS),
  // Controlled legacy display labels use the same original Aerobic Base icon.
  'Aerobic Base',
  'Flush Out',
  'Sprint Work',
  'Hard Conditioning',
].map((label) => label.toLowerCase()));

export type WeeklyDisplayWorkout = Partial<Workout> & {
  name?: string | null;
  workoutType?: string | null;
  sessionTier?: string | null;
};

function legacyConditioningText(workout: WeeklyDisplayWorkout): string {
  return [
    workout.name,
    workout.description,
    ...(workout.exercises ?? []).flatMap((row: any) => [
      row?.exercise?.name,
      row?.exercise?.description,
      row?.notes,
    ]),
  ].filter(Boolean).join(' ');
}

/** One icon family owns every conditioning identity on weekly cards. */
export function weeklyConditioningIconKind(
  label: string | null | undefined,
): typeof WEEKLY_CONDITIONING_ICON_KIND | null {
  const key = String(label ?? '')
    .replace(/^\+\s*/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (WEEKLY_CONDITIONING_LABEL_KEYS.has(key)) return WEEKLY_CONDITIONING_ICON_KIND;
  // Sam, 2026-08-26: "conditioing on weekly view has like a list icon - it
  // should be a pulse icon". A bare "Conditioning" title (and any future
  // conditioning-flavoured name outside the canonical set) fell through the
  // enumerated keys to the generic activity glyph. Anything that SAYS
  // conditioning wears the pulse.
  if (key.includes('conditioning')) return WEEKLY_CONDITIONING_ICON_KIND;
  return null;
}

/** Controlled display-only fallback for genuinely legacy, untyped records. */
function legacyConditioningLabel(workout: WeeklyDisplayWorkout): ConditioningDisplayCategory {
  const text = legacyConditioningText(workout);
  if (/\b(?:sprint|speed|flying)\b/i.test(text)) return 'Speed Conditioning';
  if (/\b(?:vo2|glycolytic|tabata|mas|hard|all[-\s]?out|work.?capacity|emom)\b/i.test(text)) {
    return 'Hard Intervals';
  }
  if (/\btempo\b/i.test(text)) return 'Tempo Intervals';
  if (/\b(?:aerobic\s+flush|flush(?:\s+out)?)\b/i.test(text)) return 'Aerobic Flush';
  if (/\brecovery\b/i.test(text)) return 'Recovery Conditioning';
  const repeated = text.match(/\b(\d+)\s*(?:x|×)\s*\(?\s*(\d+(?:\.\d+)?)\s*(?:min|minute|sec|second|s)\b/i);
  if (repeated) {
    const duration = Number(repeated[2]);
    const seconds = /(?:sec|second|s)\b/i.test(repeated[0]) && !/min|minute/i.test(repeated[0])
      ? duration
      : duration * 60;
    return seconds >= 180 ? 'Long Aerobic Intervals' : 'Short Aerobic Intervals';
  }
  if (/\b\d+(?:\.\d+)?\s*(?:min|minute)s?\b/i.test(text)) return 'Continuous Aerobic';
  return 'Aerobic Conditioning';
}

/** Canonical structure/purpose identity, with a legacy fallback only when no typed owner exists. */
export function classifyConditioningWorkout(
  workout: WeeklyDisplayWorkout,
): ConditioningDisplayCategory {
  return projectConditioningVisibleIdentity(workout as Partial<Workout>)?.primaryLabel ??
    legacyConditioningLabel(workout);
}

export function conditioningIdentityForWeeklyPlan(
  workout: WeeklyDisplayWorkout | null | undefined,
): ConditioningVisibleIdentity | null {
  if (!workout) return null;
  return projectConditioningVisibleIdentity(workout as Partial<Workout>);
}

/** Structure label for the conditioning half of an attached session. */
export function combinedConditioningCategoryLabel(
  workout: WeeklyDisplayWorkout,
): ConditioningDisplayCategory | null {
  if (!workout?.hasCombinedConditioning && !workout?.conditioningBlock?.attachedKind) return null;
  return projectConditioningVisibleIdentity(workout as Partial<Workout>)?.attachedLabel ??
    legacyConditioningLabel(workout);
}

function isStandaloneConditioning(workout: WeeklyDisplayWorkout): boolean {
  if (workout.hasCombinedConditioning || workout.conditioningBlock?.attachedKind) return false;
  return !!projectConditioningVisibleIdentity(workout as Partial<Workout>) ||
    /\b(?:conditioning|aerobic|tempo|interval|sprint|run|flush)\b/i.test(
      `${workout.workoutType ?? ''} ${workout.name ?? ''}`,
    );
}

/** Primary title shown on the weekly plan. */
export function weeklyPlanTitle(workout: WeeklyDisplayWorkout): string {
  const name = String(workout.name ?? '').trim();
  if (!name) return '';

  const identity = projectConditioningVisibleIdentity(workout as Partial<Workout>);
  if (identity && isStandaloneConditioning(workout)) return identity.primaryLabel;

  const isRecovery = workout.workoutType === 'Recovery' || workout.sessionTier === 'recovery';
  if (isRecovery) return 'Recovery';
  if (name === 'Prehab & Accessories') return 'Accessories';

  if (isStandaloneConditioning(workout)) return legacyConditioningLabel(workout);
  // TASK 11 — this read `splitSessionName(name).title`, which parsed a composed
  // day name for its strength half. The name is already the canonical one
  // `resolveSessionDisplayName` produced; a card that wants the parts asks the
  // projection for them (`project()` -> `day.parts[].headline`), which is what
  // the shipping week card does since Task 5. This surface is the CLASSIC home
  // screen's, which `HomeScreen.tsx` no longer reaches (`DESIGN_VERSION = 'v2'`,
  // returning `<HomeScreenV2 />` before `HomeScreenClassic` is constructed), so
  // no pixel changes; the parser is gone from the one place it could have been
  // revived.
  return name;
}

/** Weekly conditioning context exists only when conditioning is attached. */
export function weeklyPlanContextLabel(
  workout: WeeklyDisplayWorkout | null | undefined,
): string | null {
  if (!workout) return null;
  const identity = projectConditioningVisibleIdentity(workout as Partial<Workout>);
  if (workout.hasCombinedConditioning || workout.conditioningBlock?.attachedKind) {
    return identity?.attachedLabel ?? legacyConditioningLabel(workout);
  }
  return null;
}

/** Complete secondary line for weekly cards, with conditioning placement enforced. */
export function weeklyPlanSecondaryLabel(
  workout: WeeklyDisplayWorkout | null | undefined,
): string | null {
  if (!workout) return null;
  const conditioningContext = weeklyPlanContextLabel(workout);
  if (conditioningContext) return `+ ${conditioningContext}`;

  const identity = projectConditioningVisibleIdentity(workout as Partial<Workout>);
  if (identity && isStandaloneConditioning(workout)) return null;

  // TASK 11 — the remaining branch used to be `splitSessionName(name).context`,
  // i.e. "re-read the day's name and hand back whichever half the title did not
  // take". Conditioning context is the ONLY secondary this function owns (the
  // branch above), and every other kind of second line on a card is a part, which
  // the projection carries as `day.parts[].headline`. See `weeklyPlanTitle`.
  return null;
}
