import type { MovementPattern as ExerciseMovementPattern } from '../data/exerciseTags';

/** Canonical weekly main-strength ledger. Accessories never add entries here. */
export type MainStrengthPattern = 'squat' | 'hinge' | 'push' | 'pull';

export type LegacyStrengthPattern =
  | 'lower'
  | 'lower_combined'
  | 'push'
  | 'pull'
  | 'upper_combined'
  | 'full_body';

export function mainPatternsForLegacyStrengthPattern(
  pattern: LegacyStrengthPattern | null | undefined,
): MainStrengthPattern[] {
  switch (pattern) {
    case 'lower':
      return [];
    case 'lower_combined':
      return ['squat', 'hinge'];
    case 'push':
      return ['push'];
    case 'pull':
      return ['pull'];
    case 'upper_combined':
      return ['push', 'pull'];
    case 'full_body':
      return ['squat', 'hinge', 'push', 'pull'];
    default:
      return [];
  }
}

export function mainPatternForExerciseMovement(
  movement: ExerciseMovementPattern | null | undefined,
): MainStrengthPattern | null {
  if (movement === 'squat' || movement === 'lunge') return 'squat';
  if (movement === 'hinge') return 'hinge';
  if (movement === 'horizontal_push' || movement === 'vertical_push') return 'push';
  if (movement === 'horizontal_pull' || movement === 'vertical_pull') return 'pull';
  return null;
}

export function strengthPatternLedger(
  sessions: ReadonlyArray<{ strengthPatternContributions?: readonly MainStrengthPattern[] }>,
): Record<MainStrengthPattern, number> {
  const ledger: Record<MainStrengthPattern, number> = {
    squat: 0,
    hinge: 0,
    push: 0,
    pull: 0,
  };
  for (const session of sessions) {
    for (const pattern of new Set(session.strengthPatternContributions ?? [])) {
      ledger[pattern] += 1;
    }
  }
  return ledger;
}

export function stablePlanEntryId(args: {
  weekNumber?: number | null;
  dayOfWeek?: string | null;
  contributions?: readonly MainStrengthPattern[] | null;
  kind?: string | null;
}): string {
  const week = args.weekNumber && args.weekNumber > 0 ? args.weekNumber : 1;
  const day = String(args.dayOfWeek ?? 'TBD').toLowerCase();
  const patterns = (args.contributions ?? []).join('-') || 'none';
  const kind = String(args.kind ?? 'session').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `w${week}:${day}:${patterns}:${kind}`;
}
