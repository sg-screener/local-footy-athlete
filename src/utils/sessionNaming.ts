/**
 * Session Naming — Single Source of Truth for Athlete-Facing Session Names
 *
 * This module is the ONE place session display names are computed.
 * No UI component or builder should assemble session names ad hoc.
 *
 * Canonical labels (strict — no other names allowed for strength days):
 *
 *   LOWER BODY
 *     squat only                   → "Lower Squat"
 *     hinge only                   → "Lower Hinge"
 *     squat + hinge                → "Lower Body Strength"
 *
 *   UPPER BODY
 *     push only                    → "Upper Push"
 *     pull only                    → "Upper Pull"
 *     push + pull                  → "Upper Body Strength"
 *
 *   FULL BODY
 *     upper + lower patterns       → "Full Body Strength"
 *
 *   TEAM DAYS (priority)
 *     team only                    → "Team Training"
 *     team + strength label        → "Team Training + <canonical strength>"
 *
 * Conditioning / recovery / optional sessions keep their domain-specific
 * template names (e.g. "Long Nasal Run", "Tabata Intervals",
 * "Mobility, foam rolling, light movement"). Team-day priority still applies.
 *
 * FORBIDDEN outputs (internal terminology must never reach the athlete):
 *   "Lower Strength", "Upper Strength", "Upper Pull + Upper Push",
 *   "Lower Squat + Lower Hinge", "Lower Combined", "Upper Combined",
 *   any "X + Team Training" ordering, any "L-co" / "U-co" code.
 */

import {
  normalizeStrengthIntent,
  resolveLegacyStrengthIntent,
  shouldUseLegacyStrengthInference,
  type MainStrengthPattern,
  type StrengthIntent,
} from '../rules/strengthPatternContributions';
import {
  strengthVariantByLabel,
  strengthVariantForPatterns,
} from '../data/strengthSessionVariants';

/**
 * THE MAIN-LIFT PATTERNS, AND THIS IS AN ALIAS BECAUSE IT WAS A COPY.
 *
 * **Until 2026-08-13 (R-087) this was its own hand-written
 * `'squat'|'hinge'|'push'|'pull'`** — the same concept as
 * `MainStrengthPattern`, spelled again, under a name that ALSO belongs to a
 * different 13-member type in `data/exerciseTags`. **One concept, two
 * word-lists, plus a homonym on top.** Widening the real union left this behind
 * and every naming call site stopped type-checking, which is how it was found.
 *
 * It is an alias rather than a deletion because the exported name has callers;
 * aliasing makes them all speak the one vocabulary in a single line.
 */
export type MovementPattern = MainStrengthPattern;

export type StrengthPatternMetadata =
  | 'lower'
  | 'lower_combined'
  | 'push'
  | 'pull'
  | 'upper_combined'
  | 'full_body';

/** Tier type mirrors the domain's SessionTier. Kept permissive for callers. */
export type SessionTierLoose = 'core' | 'optional' | 'recovery' | string;

export interface SessionNameInput {
  /** Engine-authoritative structural label — primary source for pattern inference. */
  focus?: string;
  /** AI-generated / existing workout name — fallback source for conditioning/recovery pass-through. */
  name?: string;
  /** Optional explicit patterns. When present, overrides text inference. */
  movementPatterns?: MovementPattern[];
  /**
   * Final visible exercise rows. When the typed intent is a generic lower or
   * upper session, meaningful main-pattern evidence can make the display name
   * more specific (or broader) without changing workout classification.
   */
  exercises?: ReadonlyArray<{
    name?: string;
    exercise?: { name?: string | null } | null;
  } | null>;
  /** Typed engine strength pattern. Used before any legacy text inference. */
  strengthPattern?: StrengthPatternMetadata;
  /** Canonical typed contract. When present, no display text may override it. */
  strengthIntent?: StrengthIntent;
  /** Team-day flag — when true, name ALWAYS leads with "Team Training". */
  isTeamDay?: boolean;
  /** Presence of a conditioning flavour marks this as a conditioning-bearing session. */
  conditioningFlavour?: string;
  /** True when conditioning is appended to a strength session (combined S+C). */
  hasCombinedConditioning?: boolean;
  /** Session tier for recovery short-circuiting. */
  tier?: SessionTierLoose;
}

/** Regex hits for each pattern, applied to lowercased source text. */
const PATTERN_PROBES: Array<[MovementPattern, RegExp]> = [
  ['squat', /\bsquat\b|quad[- ]?dominant|\blunge\b|leg press|front squat|back squat|goblet/],
  ['hinge', /\bhinge\b|hip[- ]?dominant|\brdl\b|deadlift|hip thrust|hamstring|good morning|kettlebell swing/],
  // NOTE: "\bpress\b" alone would false-match "leg press" (squat accessory),
  // so push requires a more specific token: push/bench/OHP/overhead press/dips/push-up.
  ['push',  /\bpush\b|\bbench\b|\bohp\b|overhead press|\bdips?\b|push[- ]?up/],
  ['pull',  /\bpull\b|\brow\b|chin[- ]?up|pull[- ]?up|face pull|lat pulldown|pulldown/],
];

/**
 * Main-pattern probes for content-aware display identity. These deliberately
 * exclude support-only work such as Face Pulls, Nordics and lunges: one small
 * support exercise must not turn a genuine Upper Push or Lower Hinge session
 * into a mixed-region title. Direct anchors such as Box Squat + Hip Thrust or
 * Bench Press + Cable Row are meaningful evidence of both patterns.
 */
const MEANINGFUL_EXERCISE_PATTERN_PROBES: Array<[MovementPattern, RegExp]> = [
  ['squat', /\b(?:back|front|box|goblet|hack|belt|zercher|safety(?: bar)?)?\s*squats?\b|\bleg press\b/i],
  ['hinge', /\b(?:trap bar\s+)?deadlifts?\b|\bromanian deadlifts?\b|\brdls?\b|\bhip thrusts?\b|\bgood mornings?\b|\bkettlebell swings?\b/i],
  ['push', /\bbench press\b|\boverhead press\b|\bshoulder press\b|\blandmine press\b|\bohp\b|\bdips?\b|\bpush[- ]?ups?\b/i],
  ['pull', /\b(?:cable|dumbbell|barbell|machine|seated|chest[- ]?supported|inverted|pendlay|t[- ]?bar|bent[- ]?over|single[- ]?arm)\s+rows?\b|\brows\b|\bpull[- ]?ups?\b|\bchin[- ]?ups?\b|\b(?:lat |neutral[- ]?grip |single[- ]?arm )?pulldowns?\b/i],
];

/**
 * Shared conditioning-text detector. Guards strength inference from erg /
 * finisher wording such as "bike/row/ski", where "row" is not a strength pull.
 */
const CONDITIONING_TEXT_RX =
  /flush|aerobic|conditioning|finisher|intervals?|metcon|tempo|fartlek|\brun\b|\bbike\b|\brow(?:er)?\b|rowing|\bski\b|\berg\b|\bsprints?\b|\bmas\b|zone\s*2|\bkm\b|off[- ]?feet/i;

/**
 * Explicit strength wording. Used to distinguish combined strength + finisher
 * text from pure conditioning names that happen to mention row/bike/ski.
 */
const EXPLICIT_STRENGTH_TEXT_RX =
  /strength|upper body|lower body|full body|squat|hinge|hip[- ]?dominant|quad[- ]?dominant|bench|\bpress\b|push[- ]?up|pull[- ]?up|chin[- ]?up|deadlift|\brdl\b|lunge|push emphasis|pull emphasis|\blift/i;

export function hasConditioningText(text: string | undefined): boolean {
  return !!text && CONDITIONING_TEXT_RX.test(text);
}

export function hasExplicitStrengthText(text: string | undefined): boolean {
  return !!text && EXPLICIT_STRENGTH_TEXT_RX.test(text);
}

export function isConditioningOnlyText(text: string | undefined): boolean {
  return hasConditioningText(text) && !hasExplicitStrengthText(text);
}

/**
 * Keep movement-pattern inference scoped to the strength component. Engine
 * focus strings often append " + easy off-feet aerobic finisher
 * (bike/row/ski)"; the suffix must never add a fake pull pattern.
 */
export function strengthTextForMovementInference(text: string | undefined): string {
  if (!text) return '';
  const plusSeparator = /\s\+\s/g;
  let match: RegExpExecArray | null;
  while ((match = plusSeparator.exec(text))) {
    const tail = text.slice(match.index + match[0].length);
    const nextPlus = tail.search(/\s\+\s/);
    const immediatePart = nextPlus >= 0 ? tail.slice(0, nextPlus) : tail;
    if (hasConditioningText(immediatePart) && !hasExplicitStrengthText(immediatePart)) {
      return text.slice(0, match.index).trim();
    }
  }

  const dashSeparator = /\s[—–-]\s/g;
  while ((match = dashSeparator.exec(text))) {
    const tail = text.slice(match.index + match[0].length);
    const nextDash = tail.search(/\s[—–-]\s/);
    const immediatePart = nextDash >= 0 ? tail.slice(0, nextDash) : tail;
    if (hasConditioningText(immediatePart) && !hasExplicitStrengthText(immediatePart)) {
      return text.slice(0, match.index).trim();
    }
  }

  return text.trim();
}

/**
 * Extract movement patterns from a focus or name string.
 * Uses deterministic keyword matching against the engine's buildFocus outputs
 * and typical AI-generated names. Returns patterns in canonical order.
 */
export function inferMovementPatterns(text: string | undefined): MovementPattern[] {
  if (!text) return [];
  const t = text.toLowerCase();
  const found: MovementPattern[] = [];
  for (const [pattern, rx] of PATTERN_PROBES) {
    if (rx.test(t)) found.push(pattern);
  }
  return found;
}

export function inferStrengthMovementPatterns(text: string | undefined): MovementPattern[] {
  const strengthText = strengthTextForMovementInference(text);
  if (!strengthText || isConditioningOnlyText(strengthText)) return [];
  return inferMovementPatterns(strengthText);
}

export function inferMeaningfulExerciseMovementPatterns(
  exercises: SessionNameInput['exercises'],
): MovementPattern[] {
  const found = new Set<MovementPattern>();
  for (const row of exercises ?? []) {
    const name = String(row?.exercise?.name ?? row?.name ?? '').trim();
    if (!name) continue;
    for (const [pattern, probe] of MEANINGFUL_EXERCISE_PATTERN_PROBES) {
      if (probe.test(name)) found.add(pattern);
    }
  }
  return (['squat', 'hinge', 'push', 'pull'] as MovementPattern[])
    .filter((pattern) => found.has(pattern));
}

function lowerPatternDetailsFromText(text: string | undefined): MovementPattern[] {
  return inferStrengthMovementPatterns(text).filter(
    (pattern): pattern is 'squat' | 'hinge' => pattern === 'squat' || pattern === 'hinge',
  );
}

export function movementPatternsFromStrengthPattern(
  strengthPattern: StrengthPatternMetadata | undefined,
  sourceText?: string,
): MovementPattern[] {
  switch (strengthPattern) {
    case 'lower': {
      const lowerDetails = lowerPatternDetailsFromText(sourceText);
      return lowerDetails;
    }
    case 'lower_combined':
      return ['squat', 'hinge'];
    case 'push':
      return ['push'];
    case 'pull':
      return ['pull'];
    case 'upper_combined':
      return ['push', 'pull'];
    case 'full_body':
      // Full-body is layout metadata, not an exact contribution ledger.
      // New callers provide strengthIntent; ambiguous legacy callers must use
      // visible main content or retain their existing display name.
      return [];
    default:
      return [];
  }
}

function movementPatternsFromVisibleContent(input: SessionNameInput): MovementPattern[] {
  if (!input.exercises?.length) return [];
  const sourceText = strengthTextForMovementInference(input.focus || input.name);
  const isStrengthIntent = !!input.strengthPattern || hasExplicitStrengthText(sourceText);
  if (!isStrengthIntent) return [];

  // Combined/full-body metadata is already explicit and must remain stable.
  if (
    input.strengthPattern === 'lower_combined' ||
    input.strengthPattern === 'upper_combined' ||
    input.strengthPattern === 'full_body'
  ) {
    return [];
  }
  return inferMeaningfulExerciseMovementPatterns(input.exercises);
}

/**
 * Map an unordered set of movement patterns to the canonical athlete-facing
 * strength label. Returns null when no strength patterns are present.
 */
/**
 * IT NO LONGER KNOWS THE SEVEN — IT ASKS.
 *
 * This function held the mapping, and the coach revision registry held a
 * FOUR-entry list of the same sessions, and neither could see the other: the
 * athlete's Lower Body door could only hand back combined squat+hinge, while
 * Lower Squat and Lower Hinge — which the generator places every week and which
 * this function has always had names for — were unreachable through any door.
 * Two representations of one decision, which `docs/NORTH_STAR.md` presumes wrong.
 *
 * `data/strengthSessionVariants.ts` is the authored set now and this is a lookup
 * into it, so a card's name and a picker's name cannot drift.
 */
export function canonicalStrengthLabel(
  patterns: MovementPattern[],
): string | null {
  return strengthVariantForPatterns(patterns)?.label ?? null;
}

/** Canonical team-session name (team day with no strength load). */
export const TEAM_ONLY_NAME = 'Team Training';

/**
 * THE TYPE NAMES ITSELF — canonical conditioning identity by intent.
 *
 * Ruled 2026-08-06 (`docs/CORE_PLACER_NAMING_AND_SCOPE_RULING_2026-08-06.md` §1)
 * on the charter's type-names-itself rule, the L-P6 precedent the deep walker
 * already enforces for Gunshow. A conditioning session's IDENTITY is its intent;
 * the structure family it happens to be built from ("Hard Intervals", a
 * `CONDITIONING_VISIBLE_LABELS` entry) is its CONTENT and never its name.
 *
 * This exists so there is ONE producer of those three words. Before it, the
 * literals lived inline in `workoutCanonicalisation`'s typed fallback and again
 * in `fixtureMinimalReplan` — and that second module is what R5.3 leg (i)
 * deletes, which is exactly how a name gets deleted along with its composer.
 */
export function canonicalConditioningLabel(
  intent: 'tempo' | 'high-intensity' | 'aerobic' | string,
): string {
  return intent === 'tempo'
    ? 'Tempo Conditioning'
    : intent === 'high-intensity'
      ? 'Hard Conditioning'
      : 'Aerobic Conditioning';
}

/** Clean a raw name/focus string so it's presentable as a fallback. */
function fallbackFromText(text: string | undefined): string {
  if (!text) return '';
  // Strip anything after the first " — " or " + " separator so legacy verbose
  // engine focus strings don't leak full descriptions into the user label.
  const firstSep = text.search(/\s[—–-]\s|\s\+\s/);
  const head = firstSep > 0 ? text.slice(0, firstSep) : text;
  return head.trim();
}

/**
 * Resolve the single authoritative display name for a session.
 *
 * Precedence:
 *   1. Team-day priority prefix (always leads).
 *   2. Explicit movementPatterns (when provided, overrides inference).
 *   3. Meaningful patterns from final visible exercises for generic strength.
 *   4. Typed strengthPattern from the engine/session allocation.
 *   5. Inferred patterns from strength-scoped focus (legacy fallback).
 *   6. DELETED (Task 11) — inferred patterns from strength-scoped name.
 *   7. Name pass-through for conditioning / recovery / other. The CLEANED-FOCUS
 *      half of this step is DELETED (Task 11).
 *
 * WHAT THIS FUNCTION IS TO THE COACH, AND WHY TWO RULES SURVIVED — Task 11.
 *
 * Its output IS `workout.name`, and `workout.name` is a FROZEN matching key: the
 * router compares `entry.sessionName` case-insensitively against the classifier's
 * `targetSessionName` (`coachCommandRouter.ts:787`), the executor regexes it
 * (`coachCommandExecutor.ts:1870`), and the packet's `stripDay` hands it to the
 * LLM as the ONLY vocabulary it can name a session with (task-10-report §2.2).
 * Changing what an untyped session resolves to is therefore a silent
 * coach-pipeline behaviour change, which LR-6 forbids. So the rules were not
 * deleted on the strength of the argument that nothing should read them; each was
 * MEASURED first, by recording every `(input -> output)` pair this function
 * produced across a full `npm run test:bible` run (30,937 distinct inputs, 31,036
 * calls) and replaying the corpus against each candidate deletion:
 *
 *   rule 6, name inference   — 0 of 30,937 changed.  DELETED.
 *   rule 7, cleaned focus    — 0 of 30,937 changed.  DELETED. This one was
 *                              defect 3's exact mechanism: `allocation.focus`
 *                              reaching a card through a punctuation tidier
 *                              ("easy off-feet aerobic finisher (bike/row/ski/
 *                              erg, 15-20min)" was a session NAME). It is now
 *                              structurally unable to become a name.
 *   rule 5, focus inference  — 2 distinct inputs / 6 calls changed. KEPT.
 *                              The load-bearing one is a legacy team day whose
 *                              only evidence of its strength half is the focus
 *                              text: `{focus: "Team training + Upper body -
 *                              balanced push + pull (…)", isTeamDay: true, name:
 *                              "Team Training", exercises: []}` resolves to
 *                              "Team Training + Upper Body Strength" and would
 *                              silently become "Team Training".
 *   rule 7, name pass-through — 9 distinct inputs / 9 calls changed. KEPT.
 *                              Hand-composed and coach-authored sessions
 *                              ("Strength Session", "Upper Strength") carry a
 *                              name and no typed classification; without it they
 *                              become "Session" and the coach loses the key.
 *
 * The three EARLY guards below (recovery tier, accessory/prehab wording,
 * standalone conditioning) are the same channel and are the LOUDEST: 972
 * distinct inputs / 987 calls change without them, because they are what gives
 * every conditioning and recovery session its template name.
 *
 * THE ATHLETE SURFACES DO NOT DEPEND ON ANY OF THIS, and that is the property
 * this unit bought. `project()` calls this function with `strengthIntent`,
 * `exercises`, `isTeamDay` and `tier` and DELIBERATELY passes neither `focus`
 * nor `name` (`projectVisibleWeek.ts` `partHeadline`), so no surviving rule can
 * fire through the athlete's own projection. That omission is pinned by a source
 * contract (`projectionOwnershipTests`) so it cannot be undone by accident.
 * What remains is coach-pipeline debt, owned by whoever lifts LR-6.
 */
export function resolveSessionDisplayName(input: SessionNameInput): string {
  const isTeam = !!input.isTeamDay;
  const existingName = (input.name || '').trim();
  const auxiliaryText = `${input.name ?? ''} ${input.focus ?? ''}`;
  const isStandaloneConditioning =
    !!input.conditioningFlavour && !input.hasCombinedConditioning;

  // Recovery and accessory identities are already honest domain labels. They
  // must never be promoted to main strength from words in mobility/prehab rows.
  if (!isTeam && input.tier === 'recovery') {
    return existingName || fallbackFromText(input.focus) || 'Recovery';
  }
  if (
    !isTeam &&
    !input.strengthIntent &&
    !input.strengthPattern &&
    /\b(gunshow|prehab|accessor|pump|mobility|recovery)\b/i.test(auxiliaryText)
  ) {
    return existingName || fallbackFromText(input.focus) || 'Session';
  }

  // A standalone conditioning slot may be a row/bike/run prescription even
  // when the planner focus still carries a stale strength label. Do not let
  // "row" infer "Upper Pull" for an erg session.
  if (!isTeam && isStandaloneConditioning) {
    if (existingName) return existingName;
  }

  // Step 1: determine strength label (if any).
  let patterns: MovementPattern[] = [];
  const typedIntent = input.strengthIntent
    ? normalizeStrengthIntent(input.strengthIntent)
    : null;
  if (typedIntent) {
    /**
     * ⚠ **EMPTY `effectivePatterns` FALLS BACK TO `plannedPatterns` — AND NOT
     * DOING SO LEFT EVERY SESSION IN THE APP CALLED "Strength" (R-224).**
     *
     * Measured 2026-08-25 over `generateProgramLocally` for all three season
     * phases: **42 of 42 sessions carrying exercises resolved to "Session"** and
     * fell through to the generic label. 26 of them held a typed intent that
     * said exactly what they were — `plannedPatterns: ["pull"]`, primary
     * `pull`, archetype `upper` — with `effectivePatterns: []`.
     *
     * ⚠ **THE FALLBACK IS NOT INVENTED HERE. `classifyGenerationSession` HAS
     * ALWAYS DONE IT**, on the same field, for the same reason: an empty
     * `effectivePatterns` means nothing was recorded about delivery, not that
     * nothing was planned. **Two owners of one question disagreed, and the
     * quieter one won on every athlete-facing surface** — the day card, the week
     * row and the board all read this path.
     *
     * This is a TYPED field, not text: it is the authored plan, so nothing here
     * infers a name from prose. `focus`/`name` remain deliberately unread (see
     * `partHeadline`) — that pass-through is a different defect and stays shut.
     */
    patterns = typedIntent.effectivePatterns.length > 0
      ? [...typedIntent.effectivePatterns]
      : [...typedIntent.plannedPatterns];
  } else {
    const visibleContentPatterns = movementPatternsFromVisibleContent(input);
    const legacyFocus = strengthTextForMovementInference(input.focus);
    const allowLegacyTextInference = shouldUseLegacyStrengthInference({
      strengthIntent: input.strengthIntent,
      standaloneConditioning: isStandaloneConditioning,
      canonicalConditioningOnly: !!input.exercises?.length &&
        visibleContentPatterns.length === 0 &&
        input.exercises.every((row) => isConditioningOnlyText(
          row?.exercise?.name ?? row?.name ?? '',
        )),
      hasCanonicalMainStrengthRows: visibleContentPatterns.length > 0,
    });
    const legacy = resolveLegacyStrengthIntent({
      strengthPattern: input.strengthPattern,
      contentPatterns: input.movementPatterns?.length
        ? input.movementPatterns
        : visibleContentPatterns,
      focus: isConditioningOnlyText(legacyFocus) ? undefined : legacyFocus,
      // RULE 6 DELETED (Task 11). `name` was the AI-generated-name inference
      // channel into the legacy adapter's `patternsFromLegacyText`. Measured over
      // the whole bible corpus it changed nothing (0 of 30,937 distinct inputs),
      // so it is gone rather than kept "just in case" — a channel nothing travels
      // is still a channel a future edit can start using.
      allowTextInference: allowLegacyTextInference,
      allowScalarInference: allowLegacyTextInference,
    });
    patterns = legacy.intent?.effectivePatterns ?? [];
  }
  const strengthLabel = canonicalStrengthLabel(patterns);

  // Step 2: team-day composition (always leads with "Team Training").
  if (isTeam) {
    if (strengthLabel) return `${TEAM_ONLY_NAME} + ${strengthLabel}`;
    return TEAM_ONLY_NAME;
  }

  // Step 3: strength session (no team) — use canonical label.
  if (strengthLabel) return strengthLabel;

  // Step 4: conditioning / recovery / other — pass through name.
  //
  // THE CLEANED-FOCUS HALF IS DELETED (Task 11). It used to be
  // `fallbackFromText(input.focus)` — a punctuation tidier that cut the engine's
  // focus string at its first separator and handed the head to the athlete as a
  // session name. That is defect 3 in `surfaceAgreementTests` cell 3, stated as a
  // mechanism instead of a symptom: "easy off-feet aerobic finisher
  // (bike/row/ski/erg, 15-20min)" was a NAME, not a leak from somewhere else.
  // Measured over the whole bible corpus it produced nothing (0 of 30,937
  // distinct inputs), so `allocation.focus` can no longer become a name by any
  // route through this function.
  if (existingName) return existingName;
  return 'Session';
}

/**
 * NAME THE STRENGTH COMPONENT FROM ITSELF — the successor to `splitSessionName`.
 *
 * `splitSessionName` is DELETED (Task 11). It took a composed day name like
 * "Team Training + Upper Push", looked for a " + ", and asked whether either
 * half happened to be one of seven strings — a PARSER that turned a name back
 * into structure. `visibleProjection.ts`'s own header names its existence as the
 * proof that names were being used as a data channel between layers, and the
 * unit that header belongs to exists to end that.
 *
 * Both of its remaining callers wanted the same thing and asked the wrong
 * question to get it. A Bin that leaves the strength work standing has to name
 * what is left; they named it by parsing the name of the day it came out of.
 * When the strength arrived by a later ADD the day is called "Team Training +
 * Easy Zone 2 Ski Erg", NEITHER half is a strength label, and the parser falls
 * back to the LEFT one — which is exactly the defect `sessionComponents`
 * already paid for the half that LEAVES ("WHAT LEAVES IS NAMED FROM ITSELF, NOT
 * FROM THE DAY IT LEFT"). This is that same fix for the half that STAYS.
 *
 * TWO SOURCES OF EVIDENCE, IN PRECEDENCE ORDER, AND NEITHER IS A NAME.
 *
 *   1. `strengthIntent` — the typed contract. Present in 29,896 of the 30,937
 *      distinct inputs a whole `test:bible` run produces, so this is the answer
 *      almost always.
 *   2. THE ROWS — WHICHEVER ROWS THE CALLER HANDS OVER, AND THAT IS THE CALLER'S
 *      JOB TO GET RIGHT. `inferMeaningfulExerciseMovementPatterns` reads exercise
 *      names against the locked selectable vocabulary and returns movement
 *      patterns — `resolveSessionDisplayName`'s precedence step 2, consulted only
 *      when there is no typed intent.
 *
 *      THIS FUNCTION CANNOT CHECK THE SCOPE OF WHAT IT IS GIVEN, and the first
 *      version of this docblock said "the component's own exercise names" as
 *      though it could. Both callers were passing the PRE-REMOVAL WHOLE-DAY row
 *      list, so one row from another surviving section widened the pattern set
 *      and FABRICATED a canonical label — two squat rows plus an attached
 *      finisher's push-up resolved "Full Body Strength" for a day with nothing
 *      full-body on it, written into `workout.name`, a frozen coach matching key.
 *      Callers now scope with `strengthComponentRows` (`sessionComponents.ts`),
 *      which reuses the section-id filter `materializeAcceptedVisibleSections`
 *      already applies to the rows the survivor keeps — so the name and the
 *      content are derived from the same evidence. A wider list still produces a
 *      wider name; that is the contract, not a bug in it.
 *
 * Step 2 is here because of a review finding, and the finding is worth keeping:
 * WITHOUT it, this function's fallback fired for every untyped day — even one
 * whose rows are Barbell Bench Press and Barbell Row. `resolveSessionDisplayName`
 * only consults visible content when `strengthPattern` is set or the focus/name
 * text says "strength" (`movementPatternsFromVisibleContent`), and this call
 * deliberately passes NEITHER focus nor name, so real strength rows were being
 * ignored and the day's title came back instead. Deriving the patterns here and
 * handing them over as `movementPatterns` restores content evidence without
 * reopening the text channel: exercise names come from the authored vocabulary,
 * a composed session name does not.
 *
 * THE FALLBACK, AND EXACTLY WHEN IT DIFFERS FROM THE DELETED PARSER. When there
 * is neither typed intent nor a classifiable row, the day's own title is
 * returned. For an UNCOMPOSED title that is byte-for-byte what the parser
 * returned (no " + " -> `title === name`). For a COMPOSED title it is NOT: the
 * parser returned one half ("Team Training + Upper Push" -> "Upper Push") and
 * this returns the whole string — which, after a partial Bin, can name the
 * component that was just removed. That is a real divergence and it is recorded
 * rather than hidden:
 *
 *   - it is UNREACHABLE in every world the harness reaches (whole-bible day-name
 *     differential: empty, 1,705 observations), because the population it needs
 *     is a day with a composed title, no typed intent AND no classifiable row;
 *   - the honest closure is for a strength SECTION to carry its own title
 *     instead of the day's — `buildVisibleSections` sets it to
 *     `cleanText(workout.name)`, so the snapshot cannot tell a component's name
 *     from its day's. That is a change to `coachRevisionProposal.ts`, which is on
 *     the LR-6 frozen list, so it is NOT available to this unit;
 *   - the deleted parser had the SAME defect class from the other side: on
 *     "Easy Zone 2 Ski Erg + Upper Push" with the conditioning binned, its
 *     left-half fallback named the removed component too.
 *
 * Carried to the boundary report as residual risk on the untyped-legacy
 * population, with a device-pass line attached.
 *
 * `isTeamDay: false` is not a claim about the day. It is the same argument the
 * departing half passes: the strength component's own name is asked for, not the
 * day's.
 */
export function strengthComponentDisplayName(args: {
  strengthIntent?: StrengthIntent;
  exercises?: SessionNameInput['exercises'];
  fallbackTitle: string;
}): string {
  const named = resolveSessionDisplayName({
    strengthIntent: args.strengthIntent,
    // Consulted only when `strengthIntent` is absent — the typed contract wins
    // inside `resolveSessionDisplayName` before patterns are read at all.
    movementPatterns: inferMeaningfulExerciseMovementPatterns(args.exercises),
    exercises: args.exercises,
    isTeamDay: false,
    tier: 'core',
  });
  return isCanonicalStrengthSessionLabel(named) ? named : args.fallbackTitle;
}

/**
 * Is this string one of the authored strength-session labels?
 *
 * Read from `data/strengthSessionVariants.ts`, the authored set — NOT from a
 * hand-written list beside it. `splitSessionName` carried its own seven-string
 * copy of the same labels, which is the two-representations shape the authored
 * table was introduced to end (see `canonicalStrengthLabel` above). An eighth
 * variant is now automatically recognised here.
 */
export function isCanonicalStrengthSessionLabel(name: string): boolean {
  return strengthVariantByLabel(name) !== null;
}
