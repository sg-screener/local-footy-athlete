/**
 * exerciseSubstitutes — Pattern-preserving substitution intelligence.
 *
 * `getSubstituteCandidates(name, ctx)` is the runtime grounding for the
 * Coach's substitution rule. Given an exercise the athlete wants to swap
 * out, it returns up to 2 alternatives drawn from the same movement
 * family, filtered by injury / equipment / fatigue, and chosen so the
 * pair is meaningfully different along load / structure / spinal-stress
 * axes.
 *
 * DESIGN GOAL:
 *   The Coach LLM no longer has to memorise a static ladder. It calls
 *   `suggest_substitutes` with the exercise name and the live athlete
 *   context, and gets two real names to work with. The "meaningfully
 *   different" requirement is enforced at the algorithm level, not in
 *   prose.
 *
 * SOURCES:
 *   • Pattern lookup        → EXERCISE_TAGS[name].movement
 *                          or findPoolEntry(name).slot
 *   • Candidate pool        → STRENGTH_POOLS[slot].anchor + .accessory
 *   • Injury filtering      → exerciseFilter:passesInjuryFilter rules
 *   • Equipment routing     → EXERCISE_LOAD_MAP[name].equipment
 *
 * RETURN CONTRACT:
 *   • [] if no movement family is identified (core, conditioning,
 *     non-pool exercises) or if every candidate is filtered out / fails
 *     the meaningful-difference rule.
 *   • Exactly 2 entries when 2+ candidates survive filtering and the
 *     pair differs from each other on at least one axis.
 *   • Exactly 1 entry when only one candidate is meaningfully different
 *     from both the original and the first pick. We never force a weak
 *     pair just to hit two — a single sensible option beats a noisy pair.
 *
 * CROSS-PATTERN FALLBACK (vertical_pull → horizontal_pull):
 *   Vertical / overhead pulling is sometimes the constraint, not the
 *   exercise. When `activeInjuries.shoulder === 'avoid'` (or the explicit
 *   `avoidOverheadPull` flag is set), vertical_pull substitution swaps
 *   pools entirely to horizontal_pull (rows). When shoulder is on
 *   'caution', we widen the candidate set to include both pools so the
 *   row-based options can compete on score. When the vertical_pull pool
 *   is too small to surface a meaningfully-different candidate (e.g.
 *   Pull-Ups → Chin-Ups is a near-twin), we widen to horizontal_pull as
 *   a last resort. Upper-pull balance is preserved in all cases — both
 *   slots are pull patterns.
 *
 * NOT IN SCOPE:
 *   • Plyo / carry / isolation_lower / isolation_upper substitution
 *     (those slots have different rotation rules; substitution there is
 *     usually deletion, not replacement).
 *   • Conditioning substitution (handled by conditioningRules.ts via
 *     tier/modality, not this helper).
 *   • Cross-pattern substitution beyond the vertical/horizontal pull
 *     fallback above ("I can't do any pulls — give me a push") — that's
 *     a structural call, not a substitution.
 */

import {
  EXERCISE_TAGS,
  type ExerciseTag,
  type InjuryKey,
  type MovementPattern,
} from '../data/exerciseTags';
import {
  STRENGTH_POOLS,
  patternToSlot,
  classifyPoolSlot,
  findPoolEntry,
  type PoolSlotKey,
  type PoolEntry,
} from '../data/exercisePoolsStrength';
import {
  EXERCISE_LOAD_MAP,
  resolveExerciseName,
  type EquipmentClass,
} from './loadEstimation';

// ─── Types ───

export interface SubstituteContext {
  /**
   * Active injury map from athlete prefs / profile. Severity matters:
   * 'avoid' triggers the strict pattern rules in passesInjuryFilter,
   * 'caution' only excludes injury='avoid' rated entries (caution-rated
   * entries are kept and deprioritised in scoring).
   */
  activeInjuries?: Partial<Record<InjuryKey, 'caution' | 'avoid'>>;
  /**
   * Equipment the athlete can reach this session. If provided, candidates
   * whose equipment isn't in the set are dropped. Bodyweight is always
   * allowed regardless of this list.
   */
  availableEquipment?: ReadonlyArray<EquipmentClass>;
  /**
   * If true, candidates with fatigue='high' are kept. Default false —
   * substitution requests are usually downgrades, so we prefer
   * lower-fatigue alternatives.
   */
  allowHigherFatigue?: boolean;
  /**
   * Explicit signal that overhead / vertical pulling is the constraint,
   * not the specific exercise. When true and the original exercise is in
   * the vertical_pull slot, candidates are pulled from the horizontal_pull
   * pool instead (rows). Inferred automatically when
   * `activeInjuries.shoulder === 'avoid'`; set this flag to force the
   * fallback even without an injury rating (e.g. athlete says "overhead
   * stuff bothers me but my shoulder isn't injured").
   */
  avoidOverheadPull?: boolean;
}

export interface SubstituteCandidate {
  /** Canonical exercise name from the pool. */
  name: string;
  /**
   * Pool slot the candidate is drawn from. May differ from the original's
   * slot when the cross-pattern fallback fires (e.g. original was
   * vertical_pull, candidate is horizontal_pull).
   */
  slot: PoolSlotKey;
  /** Anchor or accessory role within the slot. */
  role: 'anchor' | 'accessory';
  /** Numeric load relative to the slot's reference exercise (1.00 = same). */
  loadRatio: number;
  /** Per-exercise tags (movement, fatigue, injury ratings, etc.). */
  tags: ExerciseTag | null;
  /** Equipment class for this exercise (from EXERCISE_LOAD_MAP). */
  equipment: EquipmentClass | null;
  /**
   * The dimensions on which this candidate differs from the original
   * exercise. Surfaced for the LLM so its reply can name *why* the
   * downgrade is meaningful. ALWAYS non-empty for returned candidates —
   * zero-diff candidates are rejected before this list is exposed.
   */
  differsOn: ReadonlyArray<DiffAxis>;
  /**
   * Short human-readable explanation of why this candidate is being
   * offered (e.g. "lower spinal load", "avoids overhead pull"). Used by
   * the LLM to ground its reply in the athlete's actual constraint
   * rather than a generic "here's another option". Optional — null when
   * no single dominant reason emerges (the differsOn axes still tell the
   * full story).
   */
  reason?: string;
}

export type DiffAxis =
  | 'load'              // loadRatio differs by ≥ 0.20
  | 'structure'         // bilateral ↔ unilateral
  | 'spinal_stress'     // injury.lowerBack rating differs
  | 'equipment'         // different EquipmentClass
  | 'fatigue';          // fatigue level differs

// ─── Equipment lookup ───

function equipmentOf(name: string): EquipmentClass | null {
  const profile = EXERCISE_LOAD_MAP[name];
  return profile?.equipment ?? null;
}

// ─── Injury filtering (mirrors exerciseFilter:passesInjuryFilter) ───

/**
 * Returns true if the candidate is acceptable given the active injuries.
 * This intentionally re-implements the rules in `exerciseFilter.ts` so
 * substitution doesn't need a FilterContext (no daysToGame / dayOfWeek)
 * — it's a stateless query against the tag system.
 */
function passesInjurySubFilter(
  tag: ExerciseTag,
  injuries: Partial<Record<InjuryKey, 'caution' | 'avoid'>>,
): boolean {
  for (const [areaRaw, severity] of Object.entries(injuries) as Array<
    [InjuryKey, 'caution' | 'avoid']
  >) {
    const area = areaRaw;
    const rating = tag.injury[area];

    // Hard exclude on 'avoid' rating, regardless of severity.
    if (rating === 'avoid') return false;

    if (severity === 'avoid') {
      // Hamstring: also drop high-eccentric lower-region work and
      // high-DOMS hinge / nordic-style isolation_lower entries.
      if (area === 'hamstring') {
        if (tag.eccentric === 'high' && tag.region === 'lower') return false;
        if (
          tag.doms === 'high' &&
          (tag.movement === 'hinge' || tag.movement === 'isolation_lower')
        ) {
          return false;
        }
      }

      // Adductor: drop lunges and unilateral plyos.
      if (area === 'adductor') {
        if (tag.movement === 'lunge') return false;
        if (tag.movement === 'plyo' && tag.unilateral) return false;
      }

      // Lower back: drop high-load bilateral and low-stability lower work.
      if (area === 'lowerBack') {
        if (tag.load === 'high' && !tag.unilateral) return false;
        if (tag.stability === 'low' && tag.region === 'lower') return false;
      }

      // Calf / ankle: drop plyos.
      if ((area === 'calf' || area === 'ankle') && tag.movement === 'plyo') {
        return false;
      }
    }
  }
  return true;
}

// ─── Difference scoring ───

/**
 * Compute which axes a candidate differs from the original on. Used both
 * for scoring (more axes = better candidate) and for surfacing the
 * difference to the LLM in its tool_result.
 */
function computeDiffAxes(
  original: {
    tag: ExerciseTag | null;
    loadRatio: number;
    equipment: EquipmentClass | null;
  },
  candidate: SubstituteCandidate,
): DiffAxis[] {
  const axes: DiffAxis[] = [];

  // load — meaningful gap is ≥ 0.20 of slot reference
  if (Math.abs(candidate.loadRatio - original.loadRatio) >= 0.2) {
    axes.push('load');
  }

  // structure — bilateral ↔ unilateral
  if (
    original.tag &&
    candidate.tags &&
    original.tag.unilateral !== candidate.tags.unilateral
  ) {
    axes.push('structure');
  }

  // spinal stress — different lowerBack injury rating
  if (
    original.tag &&
    candidate.tags &&
    original.tag.injury.lowerBack !== candidate.tags.injury.lowerBack
  ) {
    axes.push('spinal_stress');
  }

  // equipment — different EquipmentClass
  if (
    original.equipment &&
    candidate.equipment &&
    original.equipment !== candidate.equipment
  ) {
    axes.push('equipment');
  }

  // fatigue — different fatigue level
  if (
    original.tag &&
    candidate.tags &&
    original.tag.fatigue !== candidate.tags.fatigue
  ) {
    axes.push('fatigue');
  }

  return axes;
}

/**
 * Words stripped before comparing two exercise names for movement-family
 * overlap. These describe *variation* (single-arm, incline, dumbbell)
 * rather than the underlying movement (lat pulldown, deadlift, bench
 * press). Two candidates that share a non-stopword token after this strip
 * are variants of the same base exercise.
 */
const FAMILY_NAME_STOPWORDS: ReadonlySet<string> = new Set([
  // structure modifiers
  'single', 'double', 'one', 'two', 'arm', 'arms', 'leg', 'legs',
  'standing', 'seated', 'kneeling', 'split',
  // angle / grip
  'high', 'low', 'wide', 'narrow', 'close', 'neutral', 'grip',
  'incline', 'decline', 'flat', 'overhead',
  // equipment qualifiers
  'db', 'dumbbell', 'bb', 'barbell', 'kb', 'kettlebell',
  'cable', 'machine', 'band', 'banded', 'smith',
  'trap', 'bar', 'conventional',
  // grammar
  'and', 'the', 'with', 'for', 'of', 'pulls', 'press',
]);

function tokenizeFamilyName(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[-(),.\/]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !FAMILY_NAME_STOPWORDS.has(w)),
  );
}

function countSharedTokens(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

/**
 * Sibling-slot fallback map for the second pick.
 *
 * When the same-slot pool can't yield a valid second candidate (e.g.
 * Pull-Ups baseline: only Single-Arm Lat Pulldown survives, the rest are
 * movement-variants), draw the second pick from a coaching-safe sibling
 * slot. This is a UX upgrade — "give me 2 distinct options when possible"
 * — rather than the structural cross-pattern fallback used for shoulder
 * injuries (which routes BOTH first and second through horizontal_pull).
 *
 * Why these mappings:
 *   • vertical_pull → horizontal_pull: rows are a coaching-safe second
 *     option for athletes whose vertical-pull pool is exhausted. Both
 *     are pull patterns; upper-pull balance is preserved.
 *
 * Why hinge and squat are NOT here:
 *   • hinge has rich within-slot diversity — Hip Thrust (glute-dominant),
 *     KB Swings (low spinal load), Single-Leg RDL (unilateral). The
 *     "glute-dominant / low spinal load" fallback the user wants is
 *     already satisfied by existing pool entries; no cross-pool jump is
 *     needed because the same-slot search finds them.
 *   • squat similarly has Step Ups, Split Squat (unilateral, low spinal
 *     load) inside the squat slot.
 *   • Cross-PATTERN substitution (hinge → squat) would change which
 *     muscle group the session targets — that's a structural rebuild,
 *     not a substitution.
 */
const CROSS_PATTERN_FALLBACK_MAP: Partial<Record<PoolSlotKey, PoolSlotKey>> = {
  vertical_pull: 'horizontal_pull',
};

/**
 * True when two candidates are variants of the same base exercise. The
 * axis-diff model can't capture this: Lat Pulldown and Single-Arm Lat
 * Pulldown legitimately differ on load + structure, but they're still
 * the same machine doing the same movement and offering both as a "pair"
 * feels like padding, not choice.
 *
 * Heuristic:
 *   • Different slots → never variant.
 *   • Both have equipment AND equipment differs → not variant (different
 *     equipment usually means a meaningful exercise change, e.g. Bench
 *     Press vs Incline DB Bench, or RDL vs Single-Leg RDL).
 *   • Both have equipment AND equipment matches → ≥ 1 shared root word
 *     marks them as variants (Lat Pulldown vs Single-Arm Lat Pulldown).
 *   • Equipment missing on one or both → fall back to ≥ 1 shared root
 *     word (data is incomplete; rely on name overlap to catch obvious
 *     same-machine variants like Single-Arm Lat Pulldown vs Neutral-Grip
 *     Pulldown).
 */
function isMovementVariant(
  a: SubstituteCandidate,
  b: SubstituteCandidate,
): boolean {
  if (a.slot !== b.slot) return false;
  if (a.equipment && b.equipment && a.equipment !== b.equipment) {
    return false;
  }
  const wordsA = tokenizeFamilyName(a.name);
  const wordsB = tokenizeFamilyName(b.name);
  return countSharedTokens(wordsA, wordsB) >= 1;
}

/**
 * Numeric score for ranking. Heuristics:
 *   • Each axis of difference adds 1.0.
 *   • Lower-fatigue candidates get +0.5 (substitutions are typically
 *     downgrades).
 *   • Lower-load candidates get +0.3 × loadDelta (small bias toward
 *     "safer" rather than "different but heavier").
 *   • injury='caution' rated for any active injury subtracts 0.7 (kept
 *     but deprioritised — same convention as exerciseFilter scoring).
 */
function scoreCandidate(
  candidate: SubstituteCandidate,
  original: { tag: ExerciseTag | null; loadRatio: number },
  injuries: Partial<Record<InjuryKey, 'caution' | 'avoid'>>,
): number {
  let score = candidate.differsOn.length * 1.0;

  if (candidate.tags && original.tag) {
    const fatigueRank = { low: 0, moderate: 1, high: 2 };
    const candFatigue = fatigueRank[candidate.tags.fatigue];
    const origFatigue = fatigueRank[original.tag.fatigue];
    if (candFatigue < origFatigue) score += 0.5;
  }

  // Bias toward lower-load alternatives.
  const loadDelta = original.loadRatio - candidate.loadRatio;
  if (loadDelta > 0) score += loadDelta * 0.3;

  // Caution-rated for any active injury → deprioritise.
  if (candidate.tags) {
    for (const area of Object.keys(injuries) as InjuryKey[]) {
      if (candidate.tags.injury[area] === 'caution') {
        score -= 0.7;
        break;
      }
    }
  }

  return score;
}

// ─── Reason synthesis ───

/**
 * Pick a single dominant "reason" string for a candidate, used by the
 * LLM to ground its reply ("RDLs are lower fatigue and lighter on the
 * spine"). Order matters — strongest signal wins. Returns undefined when
 * no axis stands out as dominant; the caller still has differsOn for the
 * full picture.
 */
function computeReason(
  original: { tag: ExerciseTag | null; loadRatio: number; slot: PoolSlotKey },
  candidate: SubstituteCandidate,
  ctx: SubstituteContext,
): string | undefined {
  // Cross-pattern fallback wins everything else — name the constraint.
  if (
    original.slot === 'vertical_pull' &&
    candidate.slot === 'horizontal_pull'
  ) {
    return 'avoids overhead pull';
  }

  const fatigueRank = { low: 0, moderate: 1, high: 2 };
  const lbRank = { good: 0, caution: 1, avoid: 2 };

  // Active injury context: any meaningful spinal-load reduction earns
  // "safer for lower back" — this beats the generic spinal_load reason
  // because the constraint is named.
  if (
    ctx.activeInjuries?.lowerBack &&
    original.tag &&
    candidate.tags &&
    lbRank[candidate.tags.injury.lowerBack] < lbRank[original.tag.injury.lowerBack]
  ) {
    return 'safer for lower back';
  }

  // Spinal-load reduction along any rating step (avoid → caution → good).
  // Captures Deadlift → Trap Bar Deadlift (avoid → caution) and the
  // stronger Deadlift → Hip Thrust / RDL cases (avoid → good / caution).
  if (
    original.tag &&
    candidate.tags &&
    lbRank[candidate.tags.injury.lowerBack] < lbRank[original.tag.injury.lowerBack]
  ) {
    return 'lower spinal load';
  }

  // Lower fatigue (recovery-friendly downgrade).
  if (
    original.tag &&
    candidate.tags &&
    fatigueRank[candidate.tags.fatigue] < fatigueRank[original.tag.fatigue]
  ) {
    return 'lower fatigue';
  }

  // Lighter load (legitimate downgrade option).
  const loadDelta = original.loadRatio - candidate.loadRatio;
  if (loadDelta >= 0.2) return 'lighter load';

  // Bilateral → unilateral structural change.
  if (
    original.tag &&
    candidate.tags &&
    !original.tag.unilateral &&
    candidate.tags.unilateral
  ) {
    return 'unilateral variation';
  }

  // Heavier alternative — sometimes useful, label it honestly.
  if (loadDelta <= -0.2) return 'heavier load';

  // Equipment swap as last resort (weakest reason).
  if (
    original.tag &&
    candidate.tags &&
    candidate.equipment &&
    candidate.differsOn.includes('equipment')
  ) {
    return 'different equipment';
  }

  return undefined;
}

// ─── Candidate pool builder (multi-slot aware) ───

/**
 * Build, filter, and score-prep the candidate list across one or more
 * pool slots. Used both for the standard same-slot case and the
 * cross-pattern fallback (vertical_pull → horizontal_pull).
 */
function buildCandidates(
  slots: ReadonlyArray<PoolSlotKey>,
  canonical: string,
  original: {
    tag: ExerciseTag | null;
    loadRatio: number;
    equipment: EquipmentClass | null;
  },
  ctx: SubstituteContext,
): SubstituteCandidate[] {
  const rawEntries: Array<{
    entry: PoolEntry;
    role: 'anchor' | 'accessory';
    slot: PoolSlotKey;
  }> = [];
  for (const s of slots) {
    const pool = STRENGTH_POOLS[s];
    if (!pool) continue;
    rawEntries.push(
      ...pool.anchor.entries.map((e) => ({
        entry: e,
        role: 'anchor' as const,
        slot: s,
      })),
      ...pool.accessory.entries.map((e) => ({
        entry: e,
        role: 'accessory' as const,
        slot: s,
      })),
    );
  }

  let candidates: SubstituteCandidate[] = rawEntries
    .filter(({ entry }) => entry.name !== canonical)
    .map(({ entry, role, slot }) => {
      const cand: SubstituteCandidate = {
        name: entry.name,
        slot,
        role,
        loadRatio: entry.loadRatio,
        tags: EXERCISE_TAGS[entry.name] ?? null,
        equipment: equipmentOf(entry.name),
        differsOn: [],
      };
      cand.differsOn = computeDiffAxes(original, cand);
      return cand;
    });

  // Filter: injury
  const injuries = ctx.activeInjuries ?? {};
  if (Object.keys(injuries).length > 0) {
    candidates = candidates.filter((c) => {
      if (!c.tags) return true; // tolerate missing metadata
      return passesInjurySubFilter(c.tags, injuries);
    });
  }

  // Filter: equipment
  if (ctx.availableEquipment && ctx.availableEquipment.length > 0) {
    const allowedSet = new Set<EquipmentClass>(ctx.availableEquipment);
    allowedSet.add('bodyweight');
    candidates = candidates.filter((c) => {
      if (!c.equipment) return true;
      return allowedSet.has(c.equipment);
    });
  }

  // Filter: fatigue
  if (!ctx.allowHigherFatigue) {
    candidates = candidates.filter((c) => {
      if (!c.tags) return true;
      return c.tags.fatigue !== 'high' || original.tag?.fatigue === 'high';
    });
  }

  // Refinement: zero-diff candidates are never useful — Pull-Ups → Chin-Ups
  // is exactly the case this rejects. Applied here so neither first nor
  // second pick can ever be a near-twin of the original.
  candidates = candidates.filter((c) => c.differsOn.length > 0);

  return candidates;
}

// ─── Main entry point ───

/**
 * Get up to 2 meaningfully-different substitute candidates for an
 * exercise. When two are returned, they're guaranteed to differ from
 * each other AND from the original on at least one axis. When only one
 * meaningfully-different candidate exists, only one is returned — we
 * never pad the result to two with a near-duplicate.
 *
 * @param name  Exercise name as the athlete typed it. Resolved through
 *              `resolveExerciseName` before lookup, so aliases ("rdl",
 *              "barbell squat") work without callers having to canonicalise.
 * @param ctx   Optional injury / equipment / fatigue / overhead-pull
 *              context. When omitted, returns the same-slot meaningful
 *              alternatives with no filtering.
 */
export function getSubstituteCandidates(
  name: string,
  ctx: SubstituteContext = {},
): SubstituteCandidate[] {
  const trimmed = (name || '').trim();
  if (!trimmed) return [];

  const canonical = resolveExerciseName(trimmed);

  // ─── 1. Identify the slot ───
  const classified = classifyPoolSlot(canonical);
  let slot: PoolSlotKey | null = classified?.slot ?? null;
  if (!slot) {
    const tag = EXERCISE_TAGS[canonical];
    if (tag) slot = patternToSlot(tag.movement) ?? null;
  }
  if (!slot) return [];

  const SUBSTITUTABLE_SLOTS: ReadonlySet<PoolSlotKey> = new Set([
    'squat',
    'hinge',
    'horizontal_push',
    'vertical_push',
    'horizontal_pull',
    'vertical_pull',
  ]);
  if (!SUBSTITUTABLE_SLOTS.has(slot)) return [];

  const originalTag: ExerciseTag | null = EXERCISE_TAGS[canonical] ?? null;
  const originalEntry = findPoolEntry(canonical);
  const originalLoadRatio = originalEntry?.entry.loadRatio ?? 1.0;
  const originalEquipment = equipmentOf(canonical);
  const originalCtx = {
    tag: originalTag,
    loadRatio: originalLoadRatio,
    equipment: originalEquipment,
  };

  // ─── 2. Decide which slot pool(s) to draw from ───
  // Cross-pattern fallback for vertical_pull when overhead pulling is
  // problematic. Three signals trigger a horizontal_pull widening, in
  // order of strictness:
  //   • shoulder='avoid' OR avoidOverheadPull=true → REPLACE (rows only)
  //   • shoulder='caution'                         → WIDEN (mix vp + hp)
  //   • vertical_pull pool has no meaningful diffs → WIDEN (last resort)
  let candidateSlots: PoolSlotKey[] = [slot];
  let candidates: SubstituteCandidate[] = [];

  if (slot === 'vertical_pull') {
    const overheadHardBlock =
      ctx.avoidOverheadPull === true ||
      ctx.activeInjuries?.shoulder === 'avoid';
    const shoulderCaution = ctx.activeInjuries?.shoulder === 'caution';

    if (overheadHardBlock) {
      candidateSlots = ['horizontal_pull'];
      candidates = buildCandidates(candidateSlots, canonical, originalCtx, ctx);
    } else if (shoulderCaution) {
      candidateSlots = ['vertical_pull', 'horizontal_pull'];
      candidates = buildCandidates(candidateSlots, canonical, originalCtx, ctx);
    } else {
      candidates = buildCandidates(candidateSlots, canonical, originalCtx, ctx);
      // Last-resort widen: if the vertical_pull pool has nothing
      // meaningfully different (e.g. Pull-Ups → only Chin-Ups, which is
      // a near-twin and got rejected), pull from horizontal_pull too.
      if (candidates.length === 0) {
        candidateSlots = ['vertical_pull', 'horizontal_pull'];
        candidates = buildCandidates(candidateSlots, canonical, originalCtx, ctx);
      }
    }
  } else {
    candidates = buildCandidates(candidateSlots, canonical, originalCtx, ctx);
  }

  if (candidates.length === 0) return [];

  // ─── 3. Score & pick first ───
  const injuries = ctx.activeInjuries ?? {};
  const scored = candidates
    .map((c) => ({
      candidate: c,
      score: scoreCandidate(
        c,
        { tag: originalTag, loadRatio: originalLoadRatio },
        injuries,
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const first = scored[0].candidate;
  first.reason = computeReason(
    { tag: originalTag, loadRatio: originalLoadRatio, slot },
    first,
    ctx,
  );

  if (scored.length === 1) {
    // Only one same-slot candidate exists. Try cross-pattern fallback
    // for the second pick before giving up.
    const fallback = tryCrossPatternFallback(
      first,
      slot,
      candidateSlots,
      canonical,
      originalCtx,
      ctx,
      injuries,
    );
    if (fallback) {
      fallback.reason = computeReason(
        { tag: originalTag, loadRatio: originalLoadRatio, slot },
        fallback,
        ctx,
      );
      return [first, fallback];
    }
    return [first];
  }

  // ─── 4. Pick second — same-slot search first, cross-pattern fallback after ───
  //
  // Refined rules (2026-04-27 audit):
  //   1. (HARD) candidate.differsOn already encodes vs-original
  //      difference and is non-empty thanks to the zero-diff filter in
  //      buildCandidates.
  //   2. (HARD) pairDiff (vs first) must be non-empty — second must
  //      differ from first on at least one axis.
  //   3. (HARD) The pair must not be a movement-variant pair, i.e. same
  //      slot + same equipment + shared root word in canonical name
  //      (Lat Pulldown + Single-Arm Lat Pulldown). Axis-diff alone can't
  //      catch this — they technically differ on load/structure but
  //      they're the same machine doing the same movement; offering both
  //      as a "pair" is padding, not choice.
  //   4. (SOFT) Prefer candidates whose pairDiff includes at least one
  //      axis NOT already in first.differsOn — that's a "fresh"
  //      structural axis, not just "more of the same". Fresh-axis is a
  //      strong scoring nudge, not a hard requirement: when first is
  //      already maximally different from original on every axis (e.g.
  //      Single-Leg RDL vs Deadlift differs on all 5), no candidate can
  //      satisfy fresh-axis, but a sensible second pair still exists.
  //
  // If the same-slot pool yields no valid second, fall through to the
  // cross-pattern fallback below before giving up.
  const validSecond = pickSecond(
    first,
    scored.slice(1).map((s) => s.candidate),
  );

  if (validSecond) {
    validSecond.reason = computeReason(
      { tag: originalTag, loadRatio: originalLoadRatio, slot },
      validSecond,
      ctx,
    );
    return [first, validSecond];
  }

  // ─── 5. Cross-pattern fallback for second pick ───
  // Same-slot pool exhausted — try a coaching-safe sibling slot
  // (vertical_pull → horizontal_pull). Skipped when the candidate pool
  // was already widened to include the fallback slot.
  const fallback = tryCrossPatternFallback(
    first,
    slot,
    candidateSlots,
    canonical,
    originalCtx,
    ctx,
    injuries,
  );
  if (fallback) {
    fallback.reason = computeReason(
      { tag: originalTag, loadRatio: originalLoadRatio, slot },
      fallback,
      ctx,
    );
    return [first, fallback];
  }

  return [first];
}

/**
 * Score remaining candidates as a potential second pick (vs original AND
 * vs first), and return the highest-scoring candidate that passes the
 * hard filters: pairDiff > 0 AND not a movement-variant of first.
 * Returns null if no candidate qualifies.
 *
 * Used twice in the main flow:
 *   1. Same-slot second pick from the candidates already scored.
 *   2. Cross-pattern fallback second pick from the sibling-slot pool.
 */
function pickSecond(
  first: SubstituteCandidate,
  candidates: ReadonlyArray<SubstituteCandidate>,
): SubstituteCandidate | null {
  if (candidates.length === 0) return null;
  const firstDiffSet = new Set<DiffAxis>(first.differsOn);
  const scored = candidates
    .map((candidate) => {
      const pairDiff = computeDiffAxes(
        {
          tag: first.tags,
          loadRatio: first.loadRatio,
          equipment: first.equipment,
        },
        candidate,
      );
      const freshAxes = pairDiff.filter((a) => !firstDiffSet.has(a));
      const variant = isMovementVariant(first, candidate);
      const pairScore =
        freshAxes.length * 2.0 +
        pairDiff.length * 1.0 +
        candidate.differsOn.length * 0.5 -
        (candidate.role === first.role ? 0.3 : 0) -
        (variant ? 5.0 : 0);
      return { candidate, pairDiff, freshAxes, variant, pairScore };
    })
    .sort((a, b) => b.pairScore - a.pairScore);

  const valid = scored.find((s) => s.pairDiff.length > 0 && !s.variant);
  return valid ? valid.candidate : null;
}

/**
 * Try the sibling-slot fallback for the second pick. Returns the chosen
 * candidate (already scored against `first` and the original) or null
 * if the fallback isn't applicable or yields nothing.
 *
 * Skipped when:
 *   • The original slot has no entry in CROSS_PATTERN_FALLBACK_MAP.
 *   • The fallback slot was already part of the candidate pool (e.g.
 *     shoulder='avoid' already routed through horizontal_pull).
 */
function tryCrossPatternFallback(
  first: SubstituteCandidate,
  slot: PoolSlotKey,
  candidateSlots: ReadonlyArray<PoolSlotKey>,
  canonical: string,
  originalCtx: {
    tag: ExerciseTag | null;
    loadRatio: number;
    equipment: EquipmentClass | null;
  },
  ctx: SubstituteContext,
  injuries: Partial<Record<InjuryKey, 'caution' | 'avoid'>>,
): SubstituteCandidate | null {
  const fallbackSlot = CROSS_PATTERN_FALLBACK_MAP[slot];
  if (!fallbackSlot) return null;
  if (candidateSlots.includes(fallbackSlot)) return null;

  const fallbackCandidates = buildCandidates(
    [fallbackSlot],
    canonical,
    originalCtx,
    ctx,
  );
  if (fallbackCandidates.length === 0) return null;

  // Order by their own score (vs original) before pickSecond re-ranks
  // by pair-score. This gives pickSecond a sensible search order when
  // multiple fallback candidates qualify on hard filters.
  const ordered = fallbackCandidates
    .map((c) => ({
      candidate: c,
      score: scoreCandidate(c, originalCtx, injuries),
    }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.candidate);

  return pickSecond(first, ordered);
}

// ─── Convenience: format for LLM tool_result ───

/**
 * Convert the structured candidates into a compact string the LLM can
 * weave into its reply. Used by the edge function's `suggest_substitutes`
 * tool handler. Keeps the LLM-facing payload small.
 */
export function formatSubstitutesForLLM(
  original: string,
  candidates: ReadonlyArray<SubstituteCandidate>,
): string {
  if (candidates.length === 0) {
    return `No safe pattern-preserving substitutes found for "${original}". Pattern may need to be dropped or substitution may need a different family.`;
  }
  const lines = candidates.map((c) => {
    const reasonStr = c.reason ? ` - ${c.reason}` : '';
    const axes =
      c.differsOn.length > 0
        ? ` [differs on: ${c.differsOn.join(', ')}]`
        : '';
    return `• ${c.name}${reasonStr}${axes}`;
  });
  // When the cross-pattern fallback fires the candidates can span two
  // slots; surface that honestly so the LLM mentions the family swap.
  const slots = Array.from(new Set(candidates.map((c) => c.slot)));
  const familyLabel =
    slots.length > 1 ? slots.join(' / ') : slots[0];
  return `Substitutes for "${original}" (${familyLabel} family):\n${lines.join('\n')}`;
}

// ─── Re-exports for the edge-function mirror ───
//
// The deno edge function can't import from `src/`, but it CAN duplicate
// these tiny constants. Exporting them here keeps the duplication
// auditable — tests in src/__tests__/ assert the deno mirror stays in
// sync.
export {
  STRENGTH_POOLS as __STRENGTH_POOLS_FOR_TESTS,
  patternToSlot as __patternToSlot_FOR_TESTS,
};
