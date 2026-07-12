import type { MovementPattern as ExerciseMovementPattern } from '../data/exerciseTags';

/** Canonical weekly main-strength ledger. Accessories never add entries here. */
export type MainStrengthPattern = 'squat' | 'hinge' | 'push' | 'pull';

export type StrengthArchetype = 'lower' | 'upper' | 'full_body';

/**
 * Canonical, serialisable strength-session contract.
 *
 * Ownership:
 * - allocation owns archetype, primaryPattern and plannedPatterns;
 * - final surviving main-strength rows own effectivePatterns;
 * - legacy enums, contribution arrays, names, focus and plan ids are projections
 *   only and must never overwrite an existing contract.
 */
export interface StrengthIntent {
  archetype: StrengthArchetype;
  primaryPattern: MainStrengthPattern | null;
  plannedPatterns: MainStrengthPattern[];
  effectivePatterns: MainStrengthPattern[];
}

export interface StrengthIntentDiagnostic {
  pattern: MainStrengthPattern;
  change: 'removed' | 'replaced';
  reason: string;
}

export const STRENGTH_PATTERN_ORDER: readonly MainStrengthPattern[] = [
  'squat',
  'hinge',
  'push',
  'pull',
];

const STRENGTH_PATTERN_SET = new Set<MainStrengthPattern>(STRENGTH_PATTERN_ORDER);

export function normalizeStrengthPatterns(
  patterns: readonly MainStrengthPattern[] | null | undefined,
): MainStrengthPattern[] {
  const values = new Set(
    (patterns ?? []).filter((pattern): pattern is MainStrengthPattern =>
      STRENGTH_PATTERN_SET.has(pattern)),
  );
  return STRENGTH_PATTERN_ORDER.filter((pattern) => values.has(pattern));
}

export function inferStrengthArchetype(
  patterns: readonly MainStrengthPattern[],
): StrengthArchetype | null {
  const normalized = normalizeStrengthPatterns(patterns);
  const lower = normalized.some((pattern) => pattern === 'squat' || pattern === 'hinge');
  const upper = normalized.some((pattern) => pattern === 'push' || pattern === 'pull');
  if (lower && upper) return 'full_body';
  if (lower) return 'lower';
  if (upper) return 'upper';
  return null;
}

export function normalizeStrengthIntent(
  intent: StrengthIntent,
): StrengthIntent {
  const plannedPatterns = normalizeStrengthPatterns(intent.plannedPatterns);
  const plannedSet = new Set(plannedPatterns);
  const effectivePatterns = normalizeStrengthPatterns(intent.effectivePatterns)
    .filter((pattern) => plannedSet.has(pattern));
  const primaryPattern = intent.primaryPattern && plannedSet.has(intent.primaryPattern)
    ? intent.primaryPattern
    : plannedPatterns[0] ?? null;
  return {
    archetype: intent.archetype,
    primaryPattern,
    plannedPatterns,
    effectivePatterns,
  };
}

export function createStrengthIntent(args: {
  archetype: StrengthArchetype;
  primaryPattern?: MainStrengthPattern | null;
  plannedPatterns: readonly MainStrengthPattern[];
  effectivePatterns?: readonly MainStrengthPattern[];
}): StrengthIntent {
  return normalizeStrengthIntent({
    archetype: args.archetype,
    primaryPattern: args.primaryPattern ?? null,
    plannedPatterns: [...args.plannedPatterns],
    effectivePatterns: [...(args.effectivePatterns ?? args.plannedPatterns)],
  });
}

export function strengthIntentsEqual(
  a: StrengthIntent | null | undefined,
  b: StrengthIntent | null | undefined,
): boolean {
  if (!a || !b) return a === b;
  const left = normalizeStrengthIntent(a);
  const right = normalizeStrengthIntent(b);
  return left.archetype === right.archetype &&
    left.primaryPattern === right.primaryPattern &&
    left.plannedPatterns.join('|') === right.plannedPatterns.join('|') &&
    left.effectivePatterns.join('|') === right.effectivePatterns.join('|');
}

export function withEffectiveStrengthPatterns(
  intent: StrengthIntent,
  effectivePatterns: readonly MainStrengthPattern[],
): StrengthIntent {
  return normalizeStrengthIntent({ ...intent, effectivePatterns: [...effectivePatterns] });
}

export type StrengthRegion = 'lower' | 'upper';

export function strengthRegionsForPatterns(
  patterns: readonly MainStrengthPattern[],
): StrengthRegion[] {
  const normalized = normalizeStrengthPatterns(patterns);
  const regions: StrengthRegion[] = [];
  if (normalized.some((pattern) => pattern === 'squat' || pattern === 'hinge')) regions.push('lower');
  if (normalized.some((pattern) => pattern === 'push' || pattern === 'pull')) regions.push('upper');
  return regions;
}

export type LegacyStrengthPattern =
  | 'lower'
  | 'lower_combined'
  | 'upper'
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
      // Full body is an archetype, not an exact contribution ledger. Actual
      // lower selection must come from typed intent or surviving main rows.
      return [];
    default:
      return [];
  }
}

export interface LegacyStrengthIntentInput {
  strengthIntent?: StrengthIntent | null;
  strengthPatternContributions?: readonly MainStrengthPattern[] | null;
  strengthPattern?: LegacyStrengthPattern | null;
  contentPatterns?: readonly MainStrengthPattern[] | null;
  focus?: string | null;
  name?: string | null;
}

export interface LegacyStrengthIntentResolution {
  intent: StrengthIntent | null;
  diagnostics: string[];
  source: 'typed' | 'contributions' | 'enum' | 'content' | 'text' | 'none';
}

function legacyArchetype(
  pattern: LegacyStrengthPattern | null | undefined,
  patterns: readonly MainStrengthPattern[],
): StrengthArchetype | null {
  if (pattern === 'lower' || pattern === 'lower_combined') return 'lower';
  if (pattern === 'upper' || pattern === 'push' || pattern === 'pull' || pattern === 'upper_combined') return 'upper';
  if (pattern === 'full_body') return 'full_body';
  return inferStrengthArchetype(patterns);
}

/** Last-resort persisted-data compatibility only. Never use in live planning. */
function patternsFromLegacyText(text: string): MainStrengthPattern[] {
  const patterns: MainStrengthPattern[] = [];
  if (/\b(?:squat|quad|knee[- ]dominant|lunge|leg press)\b/i.test(text)) patterns.push('squat');
  if (/\b(?:hinge|hip[- ]dominant|rdl|deadlift|hamstring)\b/i.test(text)) patterns.push('hinge');
  if (/\b(?:push|bench|overhead press|ohp|dip)\b/i.test(text)) patterns.push('push');
  if (/\b(?:pull|row|pull-up|chin-up|pulldown)\b/i.test(text)) patterns.push('pull');
  return normalizeStrengthPatterns(patterns);
}

/**
 * The only legacy ingress adapter. It is deliberately conservative: generic
 * lower/upper/full-body enums obtain exact credit from real main content; text
 * is consulted only when an old persisted record has no typed or row evidence.
 */
export function resolveLegacyStrengthIntent(
  input: LegacyStrengthIntentInput,
): LegacyStrengthIntentResolution {
  if (input.strengthIntent) {
    return { intent: normalizeStrengthIntent(input.strengthIntent), diagnostics: [], source: 'typed' };
  }

  const explicit = normalizeStrengthPatterns(input.strengthPatternContributions);
  if (explicit.length > 0) {
    const archetype = legacyArchetype(input.strengthPattern, explicit) ?? inferStrengthArchetype(explicit);
    return {
      intent: archetype ? createStrengthIntent({ archetype, plannedPatterns: explicit }) : null,
      diagnostics: [],
      source: 'contributions',
    };
  }

  const enumPatterns = mainPatternsForLegacyStrengthPattern(input.strengthPattern);
  if (enumPatterns.length > 0) {
    const archetype = legacyArchetype(input.strengthPattern, enumPatterns)!;
    return {
      intent: createStrengthIntent({ archetype, plannedPatterns: enumPatterns }),
      diagnostics: [],
      source: 'enum',
    };
  }

  const contentPatterns = normalizeStrengthPatterns(input.contentPatterns);
  if (contentPatterns.length > 0) {
    const archetype = legacyArchetype(input.strengthPattern, contentPatterns) ?? inferStrengthArchetype(contentPatterns);
    return {
      intent: archetype ? createStrengthIntent({
        archetype,
        plannedPatterns: contentPatterns,
        effectivePatterns: contentPatterns,
      }) : null,
      diagnostics: ['legacy_strength_intent_derived_from_main_content'],
      source: 'content',
    };
  }

  const legacyText = `${input.focus ?? ''} ${input.name ?? ''}`;
  if (
    (input.strengthPattern === 'full_body' || /\bfull[- ]?body\b/i.test(legacyText)) &&
    /\bsquat\s*(?:\/|or)\s*hinge\b/i.test(legacyText)
  ) {
    return {
      intent: null,
      diagnostics: ['ambiguous_legacy_full_body_lower_choice'],
      source: 'none',
    };
  }
  const textPatterns = patternsFromLegacyText(legacyText);
  if (textPatterns.length > 0) {
    const archetype = legacyArchetype(input.strengthPattern, textPatterns) ?? inferStrengthArchetype(textPatterns);
    return {
      intent: archetype ? createStrengthIntent({ archetype, plannedPatterns: textPatterns }) : null,
      diagnostics: ['ambiguous_legacy_strength_intent_derived_from_text'],
      source: 'text',
    };
  }

  const ambiguous = !!input.strengthPattern;
  return {
    intent: null,
    diagnostics: ambiguous ? [`ambiguous_legacy_strength_intent:${input.strengthPattern}`] : [],
    source: 'none',
  };
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
  sessions: ReadonlyArray<{
    strengthIntent?: StrengthIntent | null;
    strengthPatternContributions?: readonly MainStrengthPattern[];
  }>,
  source: 'planned' | 'effective' = 'planned',
): Record<MainStrengthPattern, number> {
  const ledger: Record<MainStrengthPattern, number> = {
    squat: 0,
    hinge: 0,
    push: 0,
    pull: 0,
  };
  for (const session of sessions) {
    const patterns = session.strengthIntent
      ? normalizeStrengthIntent(session.strengthIntent)[source === 'planned' ? 'plannedPatterns' : 'effectivePatterns']
      : normalizeStrengthPatterns(session.strengthPatternContributions);
    for (const pattern of patterns) {
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
  const kind = String(args.kind ?? 'session').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  // Identity describes the allocation slot, never its mutable contribution
  // projection. Strength intent travels as its own typed contract.
  // Retain the legacy neutral slot segment so unrelated deterministic hashes
  // (for example conditioning rotation) do not churn when pattern ownership
  // moves out of the id. The token is deliberately constant and unparseable.
  return `w${week}:${day}:none:${kind}`;
}
