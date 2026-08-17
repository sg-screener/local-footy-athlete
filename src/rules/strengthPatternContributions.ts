import type { MovementPattern as ExerciseMovementPattern } from '../data/exerciseTags';

/**
 * Canonical weekly main-strength ledger. Accessories never add entries here.
 *
 * **WIDENED 2026-08-13 (R-087). Sam: *"each week should contain all the main
 * lifts i.e. squat, hinge, single leg knee, single leg hip, push pull in both
 * horizontal and vertical then accessories for uppers and lowers and some
 * core"*.** His sentence draws the line this type needs: the MAIN LIFTS are
 * named first, and *"then accessories… and some core"* is a separate clause.
 * **So the single-leg slots belong here and accessories still do not** — the
 * comment above stays true.
 *
 * **WHY IT HAD TO WIDEN AT ALL.** Measured over 174 worlds: all 102
 * `Full Body Strength` days ship no single-leg knee work and 68 no single-leg
 * hip either. They were never ASKED for it — a full-body day plans
 * `['squat','hinge','push','pull']` because those were the only four words this
 * type had. R-087: *"the composer's job is not to add two rows to a template.
 * It is to make a full body day ASK the week what is still open."* A day cannot
 * ask for a slot the vocabulary cannot name.
 *
 * **⚠ THE PLANE SPLIT IS NOT BUILT AND THAT IS DELIBERATE.** R-087 also names
 * *"push pull in both horizontal and vertical"*, which would take `push`/`pull`
 * to four members. **No measured defect stands behind that half**, and it
 * changes §18 exposure counting granularity — a week owing "a push" would start
 * owing two distinct ones. Splitting it is its own slice with its own
 * before/after. **This widening is the two slots the census actually found
 * empty**, and `ALL_MAIN_STRENGTH_PATTERNS` below is what stops the next member
 * arriving unhandled.
 */
export type MainStrengthPattern =
  | 'squat'
  | 'hinge'
  | 'single_leg_knee'
  | 'single_leg_hip'
  | 'push'
  | 'pull';

/**
 * THE TOTAL LIST, AND EVERY MAP OVER THE UNION IS BUILT FROM IT.
 *
 * **This exists because of `cod_decel`** — a category joined
 * `OffseasonConditioningCategory` on 2026-08-13, `categoryToFlavour`'s switch
 * was never extended, and it returned `undefined` at all seven call sites until
 * generation exited non-zero. Four sightings of that class in one day.
 * `satisfies` makes the next member a BUILD failure instead.
 */
export const ALL_MAIN_STRENGTH_PATTERNS = [
  'squat', 'hinge', 'single_leg_knee', 'single_leg_hip', 'push', 'pull',
] as const satisfies readonly MainStrengthPattern[];

/** A zeroed ledger over every member — the one place new members land. */
export function emptyMainStrengthLedger(): Record<MainStrengthPattern, number> {
  return { squat: 0, hinge: 0, single_leg_knee: 0, single_leg_hip: 0, push: 0, pull: 0 };
}

/**
 * WHAT THE WEEK HAS NOT COVERED YET — R-087's question, asked in one place.
 *
 * **Sam, 2026-08-13:** *"depends what's in the rest of the week / each week
 * should contain all the main lifts."* **THE WEEK IS THE UNIT OF COVERAGE, NOT
 * THE DAY**, so a full-body day has no fixed template: *"a full body day placed
 * after a lower day that already ran squat and hinge is a DIFFERENT SEVEN from
 * a full body day that is the week's first strength session."*
 *
 * `exclude` is the day being composed — it must not count its own current plan
 * as coverage, or it would ask what is open and be told "nothing, you have it".
 *
 * **IT CAN RETURN AN EMPTY LIST AND THAT IS INFORMATION, NOT A BUG.** An empty
 * result means the rest of the week already covers every main lift; the caller
 * decides what a day does with that, and R-087 is explicit that a week which
 * CANNOT pay its coverage is *"a real deficiency to report, not a template to
 * pad"*.
 */
export function uncoveredMainPatternsForWeek(
  weeklyPlan: ReadonlyArray<{
    strengthIntent?: StrengthIntent | null;
    strengthPatternContributions?: readonly MainStrengthPattern[];
  }>,
  exclude?: unknown,
): MainStrengthPattern[] {
  const others = weeklyPlan.filter((entry) => entry !== exclude);
  const ledger = strengthPatternLedger(others);
  return ALL_MAIN_STRENGTH_PATTERNS.filter((pattern) => ledger[pattern] === 0);
}

/**
 * R-089 — COVERAGE IS A PRIORITY ORDER, NOT A REPLACEMENT.
 *
 * **Sam, 2026-08-13:** *"if the lower day didnt have the single leg hip or
 * single leg knee then i'd rather put them on the wednesday but if it did then
 * yes squatting and hinging again is fine."*
 *
 * **THIS IS THE FIX FOR THE PASS THAT REFUSED TWELVE WORLDS.** `readiness`
 * built the same question as a REPLACEMENT — a full-body day's planned
 * patterns BECAME the uncovered set — and §18 refused twelve weeks, because it
 * counts main-strength exposures PER PATTERN and a day that stops planning
 * squat/hinge stops paying them. **Coverage and volume were two rules over one
 * number.**
 *
 * **AN ORDERING CANNOT HAVE THAT FAILURE, AND THAT IS THE WHOLE POINT.** The
 * multiset returned here is IDENTICAL to the one passed in — same members, same
 * count, every time. **Volume is untouched, §18 does not change, and the
 * main-strength target cannot drop**, because nothing is removed. Only the
 * order changes, so the slots the week has not covered are composed FIRST and
 * the rest repeat freely.
 *
 * **THE MULTISET IDENTITY IS THE LOAD-BEARING PROPERTY**, not a nicety — it is
 * the reason this can land where the replacement could not, so it is asserted
 * directly rather than trusted.
 */
export function orderPlannedByUncoveredFirst(
  planned: readonly MainStrengthPattern[],
  uncovered: readonly MainStrengthPattern[],
): MainStrengthPattern[] {
  const open = new Set(uncovered);
  // Stable partition: uncovered keep their relative order, so do the rest.
  return [
    ...planned.filter((pattern) => open.has(pattern)),
    ...planned.filter((pattern) => !open.has(pattern)),
  ];
}

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
  /**
   * Free-text inference is migration-only. Production callers must obtain
   * this value from shouldUseLegacyStrengthInference so modern plan/component
   * ownership cannot be overwritten by a display string.
   */
  allowTextInference?: boolean;
  /** Legacy scalar enums share the same controlled ingress boundary as text. */
  allowScalarInference?: boolean;
}

export interface LegacyStrengthIntentResolution {
  intent: StrengthIntent | null;
  diagnostics: string[];
  source: 'typed' | 'contributions' | 'enum' | 'content' | 'text' | 'none';
}

export interface StrengthOwnershipBoundaryInput {
  strengthIntent?: StrengthIntent | null;
  strengthPatternContributions?: readonly MainStrengthPattern[] | null;
  /** The planEntryId was joined to the allocated entry for this workout. */
  hasMatchedPlanEntry?: boolean;
  /** A plan/provenance identity exists, even if the join is now stale. */
  hasModernPlanIdentity?: boolean;
  /** Typed allocation/components say conditioning is the standalone owner. */
  standaloneConditioning?: boolean;
  /** Classified final-domain rows contain conditioning and no main strength. */
  canonicalConditioningOnly?: boolean;
  /** Registry/classified final-domain rows contain real main strength. */
  hasCanonicalMainStrengthRows?: boolean;
}

export interface StrengthOwnershipBoundaryResolution {
  owner:
    | 'typed_strength'
    | 'typed_no_strength'
    | 'canonical_strength_rows'
    | 'modern_unowned'
    | 'legacy';
  allowCanonicalRowInference: boolean;
  allowLegacyTextInference: boolean;
}

/**
 * Central ownership boundary between modern canonical data and legacy text.
 *
 * Typed allocation wins. A matched modern plan with no strength contract is
 * an explicit no-strength decision, not missing information. Canonical row
 * domains may migrate genuine legacy strength, while free text is consulted
 * only when neither modern provenance nor canonical row evidence exists.
 */
export function resolveStrengthOwnershipBoundary(
  input: StrengthOwnershipBoundaryInput,
): StrengthOwnershipBoundaryResolution {
  const typedIntentPatterns = input.strengthIntent
    ? normalizeStrengthIntent(input.strengthIntent).plannedPatterns
    : [];
  if (typedIntentPatterns.length > 0 || normalizeStrengthPatterns(input.strengthPatternContributions).length > 0) {
    return {
      owner: 'typed_strength',
      allowCanonicalRowInference: false,
      allowLegacyTextInference: false,
    };
  }
  /**
   * ⚠ **A PLAN THAT NAMES NO STRENGTH CANNOT OVERRULE A DAY THAT VISIBLY CONTAINS
   * FIVE MAIN LIFTS.**
   *
   * `typed_no_strength` means *"the typed plan owns this day and says there is no
   * main strength on it"*, and it makes `finaliseWorkoutAfterMutation` DELETE every
   * `strength_main` row (`modern_plan_has_no_strength_ownership`). That is correct
   * for a club night or a rest day — they have no canonical main rows, so they
   * still land here.
   *
   * It was NOT correct for a generated strength day. MEASURED on the real athlete
   * journey: `sched:2026-07-20:1:full_body` matches its plan entry, carries **no
   * `strengthIntent` and no `strengthPatternContributions`**, and holds five
   * classified main-strength rows. The matched-plan-entry arm fired, the
   * `hasCanonicalMainStrengthRows` arm below was never reached, and the canonicaliser
   * deleted `Bench Press` and `Pull-Ups` — rows the athlete had not touched — the
   * moment they swapped an unrelated exercise.
   *
   * **This is dormant until an edit**, which is why generation and every gate stayed
   * green: `finaliseWorkoutAfterMutation` only runs on mutation, so the contradiction
   * between "the plan names no strength" and "the day is five main lifts" was never
   * asked until the athlete tapped swap. Nine substitutions across two days, every
   * one destroyed or rejected.
   *
   * The rows are the stronger evidence and now win: a day holding canonical main
   * strength falls through to `canonical_strength_rows`, whose whole purpose is to
   * infer the intent from the content that is actually there. **Nothing is
   * weakened** — every world with no main rows resolves exactly as before, and the
   * conditioning arms are untouched.
   */
  const typedPlanSaysNoStrength = (input.strengthIntent || input.hasMatchedPlanEntry)
    && !input.hasCanonicalMainStrengthRows;
  if (typedPlanSaysNoStrength || input.standaloneConditioning || input.canonicalConditioningOnly) {
    return {
      owner: 'typed_no_strength',
      allowCanonicalRowInference: false,
      allowLegacyTextInference: false,
    };
  }
  if (input.hasCanonicalMainStrengthRows) {
    return {
      owner: 'canonical_strength_rows',
      allowCanonicalRowInference: true,
      allowLegacyTextInference: false,
    };
  }
  if (input.hasModernPlanIdentity) {
    return {
      owner: 'modern_unowned',
      allowCanonicalRowInference: true,
      allowLegacyTextInference: false,
    };
  }
  return {
    owner: 'legacy',
    allowCanonicalRowInference: true,
    allowLegacyTextInference: true,
  };
}

/** True only for genuinely legacy records lacking modern or canonical ownership. */
export function shouldUseLegacyStrengthInference(
  input: StrengthOwnershipBoundaryInput,
): boolean {
  return resolveStrengthOwnershipBoundary(input).allowLegacyTextInference;
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

  const legacyStrengthPattern = input.allowScalarInference === false
    ? undefined
    : input.strengthPattern;
  const enumPatterns = mainPatternsForLegacyStrengthPattern(legacyStrengthPattern);
  if (enumPatterns.length > 0) {
    const archetype = legacyArchetype(legacyStrengthPattern, enumPatterns)!;
    return {
      intent: createStrengthIntent({ archetype, plannedPatterns: enumPatterns }),
      diagnostics: [],
      source: 'enum',
    };
  }

  const contentPatterns = normalizeStrengthPatterns(input.contentPatterns);
  if (contentPatterns.length > 0) {
    const archetype = legacyArchetype(legacyStrengthPattern, contentPatterns) ?? inferStrengthArchetype(contentPatterns);
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

  if (input.allowTextInference === false) {
    return { intent: null, diagnostics: [], source: 'none' };
  }

  const legacyText = `${input.focus ?? ''} ${input.name ?? ''}`;
  if (
    (legacyStrengthPattern === 'full_body' || /\bfull[- ]?body\b/i.test(legacyText)) &&
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
    const archetype = legacyArchetype(legacyStrengthPattern, textPatterns) ?? inferStrengthArchetype(textPatterns);
    return {
      intent: archetype ? createStrengthIntent({ archetype, plannedPatterns: textPatterns }) : null,
      diagnostics: ['ambiguous_legacy_strength_intent_derived_from_text'],
      source: 'text',
    };
  }

  const ambiguous = !!legacyStrengthPattern;
  return {
    intent: null,
    diagnostics: ambiguous ? [`ambiguous_legacy_strength_intent:${legacyStrengthPattern}`] : [],
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
  const ledger: Record<MainStrengthPattern, number> = emptyMainStrengthLedger();
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
