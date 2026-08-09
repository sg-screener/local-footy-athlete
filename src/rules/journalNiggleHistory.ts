/**
 * NIGGLE HISTORY, AND THE NOTES THAT SIT BESIDE IT — addendum Group 2 item 9.
 *
 * L14 domain purity: no React, no navigation, no stores, no device clock.
 *
 * ZERO NEW STORED STATE. Both inputs already exist and are already INPUTS:
 * `InjuryEpisodeV1` lives in the accepted material context, and a `JournalNote`
 * is the athlete's own words from slice 2. This module joins them and stores
 * nothing.
 *
 * ── RESURFACING BY TIME, BECAUSE A NOTE CANNOT BE KNEE-TAGGED ──
 *
 * The design's example is *"a knee-tagged note resurfaces when a knee niggle is
 * flagged"*. **Measured: that is not buildable.** `JOURNAL_NOTE_TAGS` is a
 * CLOSED vocabulary of eight — recovery, mobility, injury, diet, work stress,
 * sleep, illness, travel — and no region is among them. Slice 2 closed it
 * deliberately: "a free-text tag set would be an unauthored vocabulary growing
 * on the athlete's device."
 *
 * So the join is by TIME, not by tag: a note resurfaces when it was written in a
 * week an EARLIER episode in the SAME region was active. That link is a fact —
 * same region, same weeks — where a tag-region link would have needed a
 * vocabulary Sam has not ruled on.
 *
 * ── OBSERVATION, NEVER DIAGNOSIS ──
 *
 * The load ruling's second law applies verbatim, and it is the reason this module
 * returns notes rather than conclusions. "You wrote this the last time this
 * happened" is a fact. "This is why it happened" is a claim the app must never
 * make, and nothing here composes one: the note is the athlete's own words,
 * returned unread and unparsed.
 *
 * ── THIS MODULE DOES NOT KNOW THE NOTE STORE EXISTS ──
 *
 * `journalNoteOwnershipTests` holds a line slice 2 built and this module tripped
 * on its first run: **no `rules/` module reads the note store.** Notes never
 * derive program state, and `rules/` is where the engine lives — so even a
 * type-only import is the shape that law forbids, and loosening it "because the
 * import is erased" would trade a non-negotiable for a convenience.
 *
 * So the note arrives as a NARROW STRUCTURAL VIEW, exactly as `journalWeek`
 * takes `JournalSessionOutcome` rather than the whole `SessionFeedback`: four
 * fields, named here, mapped by the surface. The engine cannot reach a note from
 * this file even by accident.
 *
 * ── THE REGION VOCABULARY HAS AN OWNER, AND IT IS ASKED ──
 *
 * `data/injuryRegions.ts` is the single owner of body-part routing, and its
 * header records that FIVE divergent copies of that mapping once existed and
 * disagreed with each other and with Sam's ruling. This module ASKS it.
 *
 * IT DOES NOT USE `episode.region`, AND THE COMPILER IS WHY. That field is typed
 * `'upper_body' | 'lower_body' | 'back_midline' | 'other'` — a COARSE constraint
 * bucket, not one of Sam's thirteen injury regions. Grouping by it would file a
 * knee and a hamstring together under "lower_body", which is both a wrong
 * grouping and an internal word on an athlete's screen. The first version of
 * this module assumed `region` was the fine-grained one; `tsc` refused the
 * fixture and that assumption with it.
 *
 * So the key is the athlete's own `bodyPart`, routed through the owner. A body
 * part the owner cannot route keeps its own word rather than being dropped — the
 * athlete said it, and a niggle the app cannot classify is still a niggle they
 * had.
 */

import { resolveInjuryRegion } from '../data/injuryRegions';
import type { InjuryEpisodeV1 } from './injuryEpisode';

// ─── Inputs ──────────────────────────────────────────────────────────────

/**
 * What this module needs of a note, and nothing more.
 *
 * DELIBERATELY NOT THE STORE'S TYPE. See the header: no `rules/` module may read
 * the note store, and a narrow structural view is how `journalWeek` already
 * takes a session outcome. `text` is carried through untouched and never parsed
 * — it is the athlete's own words.
 */
export interface NiggleNoteView {
  readonly id: string;
  /** The Monday of the week the note is about. */
  readonly weekStart: string;
  readonly text: string;
  readonly tags: readonly string[];
}

export interface BuildJournalNiggleHistoryInput {
  readonly episodes: readonly InjuryEpisodeV1[];
  readonly notes: readonly NiggleNoteView[];
}

// ─── Output ──────────────────────────────────────────────────────────────

export interface NiggleEpisode {
  readonly episodeId: string;
  /** What the athlete called it. */
  readonly bodyPart: string;
  readonly onsetISO: string;
  /** ISO date it resolved, or null while it is still going. */
  readonly resolvedISO: string | null;
  readonly active: boolean;
  /** Weeks the episode touched, as the episode itself recorded them. */
  readonly weeks: readonly string[];
}

export interface NiggleRegion {
  /** The region key the episodes already carry. Never derived here. */
  readonly region: string;
  /** Most recent first. */
  readonly episodes: readonly NiggleEpisode[];
  /** True when any episode in this region is still going. */
  readonly active: boolean;
}

export interface ResurfacedNote {
  readonly note: NiggleNoteView;
  /** The PAST episode whose weeks this note was written in. */
  readonly episodeId: string;
  readonly region: string;
}

export interface JournalNiggleHistory {
  readonly regions: readonly NiggleRegion[];
  /**
   * Notes worth showing the athlete right now: written during a PAST episode in
   * a region that is flaring again. Empty when nothing is flaring, or when they
   * wrote nothing at the time.
   */
  readonly resurfaced: readonly ResurfacedNote[];
}

// ─── Derivation ──────────────────────────────────────────────────────────

/**
 * A `superseded` episode is bookkeeping, not history.
 *
 * The status vocabulary is `active | improving | resolved | superseded`, and the
 * last one means this record was replaced by another — showing it would tell the
 * athlete they had two niggles where they had one, which is a count of records
 * rather than a count of injuries.
 */
function isHistoric(episode: InjuryEpisodeV1): boolean {
  return episode.status !== 'superseded';
}

/** Still going: the two statuses that are not an ending. */
function isActive(episode: InjuryEpisodeV1): boolean {
  return episode.status === 'active' || episode.status === 'improving';
}

/**
 * Which of Sam's regions this episode belongs to, ASKED of the owner.
 *
 * An unroutable body part keeps its own word instead of being dropped: the
 * athlete said it, and a niggle the app cannot classify is still one they had.
 * Dropping it would make the history quietly shorter than their memory.
 */
function regionKeyOf(episode: InjuryEpisodeV1): string | null {
  const bodyPart = episode.bodyPart;
  if (typeof bodyPart !== 'string' || bodyPart.length === 0) return null;
  return resolveInjuryRegion(bodyPart) ?? bodyPart;
}

function toNiggleEpisode(episode: InjuryEpisodeV1): NiggleEpisode {
  return {
    episodeId: episode.episodeId,
    bodyPart: episode.bodyPart,
    onsetISO: episode.onsetOrReportedDate,
    resolvedISO: episode.resolvedAt,
    active: isActive(episode),
    weeks: episode.affectedWeeks ?? [],
  };
}

export function buildJournalNiggleHistory(
  input: BuildJournalNiggleHistoryInput,
): JournalNiggleHistory {
  const byRegion = new Map<string, InjuryEpisodeV1[]>();
  for (const episode of input.episodes) {
    if (!isHistoric(episode)) continue;
    const key = regionKeyOf(episode);
    if (key === null) continue;
    const bucket = byRegion.get(key);
    if (bucket) bucket.push(episode);
    else byRegion.set(key, [episode]);
  }

  const regions: NiggleRegion[] = Array.from(byRegion.entries())
    .map(([region, episodes]) => {
      const ordered = episodes
        .slice()
        .sort((a, b) => b.onsetOrReportedDate.localeCompare(a.onsetOrReportedDate));
      return {
        region,
        episodes: ordered.map(toNiggleEpisode),
        active: ordered.some(isActive),
      };
    })
    // MOST RECENTLY TROUBLED FIRST, tie-broken by region so the order is stable
    // between renders — the same discipline the strength line needed.
    .sort((a, b) => (b.episodes[0]?.onsetISO ?? '').localeCompare(a.episodes[0]?.onsetISO ?? '')
      || a.region.localeCompare(b.region));

  // ── Resurfacing ──
  //
  // Only for regions flaring NOW, and only from episodes that are NOT the
  // current one: the point is what they wrote LAST time, and a note from this
  // week is not a memory.
  const resurfaced: ResurfacedNote[] = [];
  for (const region of regions) {
    if (!region.active) continue;
    for (const episode of region.episodes) {
      if (episode.active) continue;
      const weeks = new Set(episode.weeks);
      if (weeks.size === 0) continue;
      for (const note of input.notes) {
        // INJURY-TAGGED ONLY. Every note the athlete wrote during a bad month is
        // not a note about the injury, and showing their diet note back to them
        // beside a hamstring flare is noise wearing the clothes of insight.
        if (!note.tags.includes('injury')) continue;
        if (!weeks.has(note.weekStart)) continue;
        resurfaced.push({ note, episodeId: episode.episodeId, region: region.region });
      }
    }
  }

  return { regions, resurfaced };
}
