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

/**
 * MAY AN ACCEPTED PROFILE SNAPSHOT BE MINTED AT ALL?
 *
 * The other end of the same law. Narrowing stops a corrupt snapshot from
 * eating answers; this stops the corrupt snapshot existing.
 *
 * An accepted profile records an acceptance THE ATHLETE MADE. Before onboarding
 * closes there is no such acceptance, so a snapshot captured then is not a
 * stale record — it is a fabricated one, and because ordinary transactions only
 * refresh the snapshot when the profile they carry differs, a fabricated one
 * freezes and is republished forever.
 *
 * Sam's device, third onboarding lost (export 4, 2026-07-29): hydration minted
 * `sourceRevision: 1` from a profile byte-identical to the store's in-memory
 * default, with `isOnboardingComplete: false`, while a four-microcycle program
 * built from those two answers sat beside it. The guard that existed skipped
 * acceptance only when there was NO program; his device had one.
 *
 * Completion — not answer count — is the condition, deliberately. "Enough
 * answers to look complete" is a heuristic about identity, and this file is
 * where that class of mistake gets made. `isOnboardingComplete` is the
 * athlete's own act.
 */
export interface AcceptedProfileSnapshotMintRefusal {
  reason: 'onboarding_not_complete';
  at: string;
}

export function acceptedProfileSnapshotMintRefusal(args: {
  isOnboardingComplete: boolean;
  onboardingData: OnboardingData | null | undefined;
}): AcceptedProfileSnapshotMintRefusal | null {
  if (args.isOnboardingComplete) return null;
  return { reason: 'onboarding_not_complete', at: new Date().toISOString() };
}

/**
 * IS THE STORED SNAPSHOT POORER THAN THE LIVE PROFILE?
 *
 * The third face of the same law, and the one that repairs rather than
 * refuses. Refusing a corrupt record's publication stops the damage; it leaves
 * the wrong record on disk, still trying on every transaction.
 *
 * Sam's export 6: four `profile_write` attempts by `accepted_transaction` in
 * one second, every one refused, with the snapshot still reading 2 answers at
 * revision 13. It was frozen because the refresh in
 * `stageAcceptedStateTransaction` asks `proposal.profile !== undefined`, and no
 * ordinary transaction — a move, a generation, a set_today_workout — carries a
 * profile. So it could never correct itself while being republished forever.
 *
 * When the live profile and the record disagree in THIS direction, the record
 * is what is wrong. Same asymmetry as everywhere else in this file: the
 * athlete's answers are the truth, the snapshot is a note about them.
 */
export interface StaleAcceptedSnapshotRepair {
  reason: 'snapshot_poorer_than_live_profile';
  /** Answers the record is missing. Dev-facing, never shown. */
  missingAnswers: string[];
}

export function staleAcceptedSnapshotRepair(args: {
  live: OnboardingData | null | undefined;
  snapshot: OnboardingData | null | undefined;
}): StaleAcceptedSnapshotRepair | null {
  const refusal = profileMirrorPublicationRefusal({
    live: args.live,
    canonical: args.snapshot,
  });
  if (!refusal) return null;
  return {
    reason: 'snapshot_poorer_than_live_profile',
    missingAnswers: refusal.droppedAnswers,
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
