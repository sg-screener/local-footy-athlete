/**
 * readinessFactAttribution — the SINGLE owner of the athlete-facing name for a
 * readiness source fact.
 *
 * Ownership boundary (A4, L10 device finding 2026-07-24). Every health source
 * fact projects onto ONE compatibility constraint of `type: 'fatigue'` —
 * illness included, since it shares that constraint type until the post-v1
 * split (see `globalConstraint` in rules/temporarySourceFact). Two surfaces
 * then had to name it, and both re-derived the name instead of reading the
 * fact:
 *
 *   • the Program card row branched on `scope`/`isRecovery` and printed
 *     "Not 100% this week" for every non-recovery fact, discarding the title
 *     its own owner had already computed;
 *   • the coach note branched on the CONSTRAINT TYPE and printed "Recovery mode
 *     active" for everything, so a severe illness read as
 *     "Recovery mode active — 7/10" — a domain the athlete never mentioned, at
 *     a severity they never gave.
 *
 * The fix is one vocabulary, read by both. Attribution comes from the fact
 * kind — illness says illness, poor sleep says poor sleep, cooked says cooked —
 * via the typed `readinessKind` discriminator the projection already carries
 * (the note BODY has read it for a while: see `readinessBodyLead`). Nothing
 * here infers a kind from wording.
 */

export type ReadinessFactKind = 'fatigue' | 'soreness' | 'poor_sleep' | 'illness';

export type ReadinessFactScope = 'today' | 'week';

/** Severity at or above which a fatigue fact is the athlete's "cooked" tier. */
const COOKED_SEVERITY = 7;

interface ReadinessConstraintLike {
  type?: string;
  /** Typed discriminator minted by the fact → constraint projection. */
  readinessKind?: 'poor_sleep' | 'illness';
  severity?: number;
  modifierAffects?: readonly string[];
  appliesToDate?: string;
}

/**
 * The fact kind behind a projected constraint. Returns null for constraints
 * that are not readiness facts at all (schedule, equipment, injury), so callers
 * keep their own copy for those.
 */
export function readinessFactKindOfConstraint(
  constraint: ReadinessConstraintLike,
): ReadinessFactKind | null {
  if (constraint.type === 'soreness') return 'soreness';
  if (constraint.type !== 'fatigue') return null;
  if (constraint.readinessKind === 'illness') return 'illness';
  if (constraint.readinessKind === 'poor_sleep') return 'poor_sleep';
  return 'fatigue';
}

/** Whether a projected constraint applies to a single day or the whole week. */
export function readinessScopeOfConstraint(
  constraint: ReadinessConstraintLike,
): ReadinessFactScope {
  if (constraint.modifierAffects?.includes('current_day')) return 'today';
  if (constraint.modifierAffects?.includes('current_week')) return 'week';
  return constraint.appliesToDate ? 'today' : 'week';
}

/**
 * The athlete-facing name for a readiness fact.
 *
 * `severity` is optional and only refines the fatigue tier: the coach note has
 * it and can say "Cooked", the card row does not and says "Not 100%". That is a
 * refinement of one vocabulary, not a second one — every other kind reads
 * identically on both surfaces.
 */
export function readinessFactTitle(args: {
  kind: ReadinessFactKind;
  scope: ReadinessFactScope;
  severity?: number;
  /** Body part for a localized soreness fact, when the surface knows it. */
  bodyPart?: string;
}): string {
  const { kind, scope, severity, bodyPart } = args;
  const when = scope === 'today' ? 'today' : 'this week';

  if (kind === 'illness') return `Under the weather ${when}`;
  if (kind === 'poor_sleep') return `Poor sleep ${when}`;
  if (kind === 'soreness') {
    const part = bodyPart?.trim();
    if (part) {
      return `${part.charAt(0).toUpperCase()}${part.slice(1)} soreness ${when}`;
    }
    return scope === 'today' ? 'Sore today' : 'Sore this week';
  }
  if (typeof severity === 'number' && severity >= COOKED_SEVERITY) {
    return `Cooked ${when}`;
  }
  return scope === 'today' ? 'Not 100% today' : `Not 100% ${when}`;
}
