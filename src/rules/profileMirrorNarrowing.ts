import type { OnboardingData } from '../types/domain';

/**
 * THE MIRROR MAY ONLY NARROW TOWARD THE ACCEPTED TRUTH, NEVER WIDEN A GAP.
 *
 * Sam's law (2026-07-30). The athlete's live answers outrank any stored
 * snapshot. This is `rules/athletePlacement.ts` applied to the profile instead
 * of the week: there, athlete-placed content outranks a derived filler that is
 * regenerated every render; here, an answer the athlete gave outranks a snapshot
 * that happens not to contain it. In both cases the rule is the same one —
 * something the athlete decided is not the sort of thing a derived or stored
 * artefact may quietly undo.
 *
 * WHAT WENT WRONG. `profileStore`'s compatibility mirror replaces
 * `onboardingData` WHOLE with the accepted snapshot. The 2026-07-24
 * reassessment scoped WHEN that fence runs — post-completion only, which fixed
 * the fresh-install revert — but never constrained WHAT it replaces or checked
 * the snapshot it replaces from. So an armed mirror carrying a stale or
 * impoverished snapshot collapses the profile on the next ordinary edit. On
 * Sam's device that was 28 answers down to 2, `seasonPhase` among them, leaving
 * generation refusing an answer he had given months earlier.
 *
 * A snapshot LESS COMPLETE than the live profile is a corrupt record. It does
 * not get to publish, and the refusal is disclosed rather than swallowed —
 * silence here is what let the original wipe run for months.
 *
 * DELIBERATELY NOT A MERGE. Merging would paper the corrupt snapshot over and
 * leave nobody looking at it; the two representations would silently diverge
 * further every edit. Refusing keeps exactly one question open — why is the
 * snapshot missing answers? — and puts it in front of someone.
 */

export interface ProfileMirrorRefusal {
  reason: 'snapshot_would_widen_gap';
  /** Field names the snapshot would have un-answered. Dev-facing, never shown. */
  droppedAnswers: string[];
  at: string;
}

/**
 * Absence, in the sense the onboarding step registry uses: `undefined`, `null`,
 * `''` and `[]` are all "not answered". Treating them as content would refuse
 * every legitimate publication for a profile with an optional field unset.
 */
function isAnswered(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * `null` when the snapshot may publish; otherwise the refusal, naming every
 * answer publishing would have cost.
 */
export function profileMirrorPublicationRefusal(args: {
  live: OnboardingData | null | undefined;
  canonical: OnboardingData | null | undefined;
}): ProfileMirrorRefusal | null {
  const live = (args.live ?? {}) as Record<string, unknown>;
  const canonical = (args.canonical ?? {}) as Record<string, unknown>;
  const droppedAnswers = Object.keys(live)
    .filter((key) => isAnswered(live[key]) && !isAnswered(canonical[key]))
    .sort();
  if (droppedAnswers.length === 0) return null;
  return {
    reason: 'snapshot_would_widen_gap',
    droppedAnswers,
    at: new Date().toISOString(),
  };
}

/* ══ Disclosure ══
 *
 * A refusal that nobody can see is the same silence this rule exists to break.
 * The record is in-memory and bounded: it is a diagnostic for the dev surface
 * and the logs, never athlete-facing copy and never a programming input.
 */

const MAX_RECORDED = 20;
const recorded: ProfileMirrorRefusal[] = [];

export function recordProfileMirrorRefusal(refusal: ProfileMirrorRefusal): void {
  recorded.push(refusal);
  if (recorded.length > MAX_RECORDED) recorded.shift();
}

export function recentProfileMirrorRefusals(): readonly ProfileMirrorRefusal[] {
  return recorded;
}

export function clearProfileMirrorRefusals(): void {
  recorded.length = 0;
}
