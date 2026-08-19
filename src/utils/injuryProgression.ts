/**
 * injuryProgression.ts — TYPES ONLY.
 *
 * ⚠ ITS BEHAVIOUR IS DELETED (2026-08-19, demolition). The follow-up
 * classifier, the restriction-tier ladder and the physio-nudge helpers all
 * had ZERO production callers once the single-slot `activeInjury` alias and
 * the resolver-level injury filter went. What survives is the VOCABULARY the
 * canonical injury facts are declared in: `InjuryStatus`, the `InjuryState`
 * shape whose `bucket` union `injuryEpisode` and `temporarySourceFact` index
 * into, and its history entry.
 */

import type { InjuryBucket } from './programAdjustmentEngine';

/** Status surfaced on the Coach Update card and stored in InjuryState. */
export type InjuryStatus = 'active' | 'improving' | 'resolved';

/**
 * The injury shape. Its `bucket` union is the canonical body-part
 * vocabulary that `rules/injuryEpisode` and `rules/temporarySourceFact`
 * index into; the canonical injury FACT is `InjuryEpisodeV1`, not this.
 *
 *   - `bodyPart` and `bucket` are set together (or both null / 'unknown').
 *   - `severity` ranges 0..10.
 */
export interface InjuryState {
  bodyPart: string;
  bucket: InjuryBucket | null;
  /** Current pain level (post-update). 0 means resolved (transient). */
  severity: number;
  /** Severity at first report — keeps the trend interpretable. */
  initialSeverity: number;
  /**
   * The immediately-previous severity, recorded when the athlete improves.
   * Drives staged reintroduction: a downgrade relaxes at most one band from
   * this value rather than snapping to the new (lower) severity. Absent on a
   * fresh report or when severity is stable/worsening.
   */
  priorSeverity?: number;
  status: InjuryStatus;
  /** Snapshot of `buildInjuryPolicy(...).globalRules`. */
  rules: string[];
  /** Canonical episode policy fields. */
  seriousSymptoms?: boolean;
  seriousSymptom?: string;
  adjustmentLevel?: 'minimal' | 'slight' | 'moderate' | 'avoid_affected' | 'training_paused';
  safeFocus?: string[];
  advice?: string[];
  /** ISO timestamp when the injury was first reported (alias of createdAt). */
  startDate: string;
  /** ISO timestamp when this state was last touched. */
  lastUpdatedAt: string;
  /** ISO timestamp of the very first report. */
  createdAt: string;
  /** Append-only audit trail of severity transitions. */
  history: InjuryHistoryEntry[];
}

export interface InjuryHistoryEntry {
  timestamp: string;
  /** Status BEFORE this entry was applied. */
  fromStatus: InjuryStatus | 'new';
  /** Status AFTER this entry. */
  toStatus: InjuryStatus;
  /** Severity AFTER this entry. */
  severity: number;
  /** Free-text note (the user's message, trimmed). */
  note: string;
}

