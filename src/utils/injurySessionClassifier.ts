/**
 * injurySessionClassifier.ts — session-level risk classification +
 * targeted exercise replacement for the injury-aware pipeline.
 *
 * Why this layer exists
 *   Per-exercise filtering is too granular: removing a single risky
 *   movement from a session that's "mostly risky" still leaves a
 *   session that targets the injured area. The athlete sees almost no
 *   change. Session-level reasoning lets the engine + resolver decide
 *   whether to leave a session alone (LOW), surgically modify
 *   (MODERATE), or rebuild it entirely with safe alternatives (HIGH).
 *
 * Three concerns:
 *   1. classifySessionRisk(workout, bucket) — HIGH / MODERATE / LOW
 *   2. getReplacementForBucket(name, bucket) — safe substitution
 *      (returns null when no curated replacement exists)
 *   3. summariseRebuild(workout, bucket) — short note for the rebuild
 *      coachNote (e.g. "quad-dominant focus")
 *
 * Pure functions. Tested in isolation. Used by both the engine
 * (programAdjustmentEngine) and the resolver filter
 * (the deleted resolver-level filter) so current-week and future-week behaviour
 * agree.
 */

import type { Workout } from '../types/domain';
import { getConditioningMeta, type InjuryKey } from '../data/exerciseTags';
import {
  buildInjuryFallbackLadder,
  type InjuryFallbackRungId,
} from '../rules/injuryFallbackLadder';
import type { InjuryBucket } from './programAdjustmentEngine';

import {
  classifyExerciseRiskForBucket,
  injuryPermitsExerciseAtSeverity,
} from '../rules/injuryExerciseRisk';
import type { SafeTrainingFallbackTier } from '../rules/conflictResolutionHierarchy';

// ─── Risk class ─────────────────────────────────────────────────────

export type SessionRisk = 'HIGH' | 'MODERATE' | 'LOW';

const LOWER_BUCKETS = new Set<InjuryBucket>([
  'hamstring', 'knee', 'calf', 'ankle/foot', 'groin', 'groin',
]);

function isRecovery(workout: Workout): boolean {
  const wt = (workout as any).workoutType;
  if (wt === 'Recovery') return true;
  const tier = (workout as any).sessionTier;
  if (tier === 'recovery') return true;
  return /\brecovery\b/i.test(workout.name || '');
}

function isTeamTraining(workout: Workout): boolean {
  const n = (workout.name || '').trim().toLowerCase();
  return (
    n === 'team training' ||
    /^team training\s*\+/.test(n) ||
    /\+\s*team training$/.test(n)
  );
}

function isRunningCond(workout: Workout): boolean {
  const wt = (workout as any).workoutType;
  if (wt !== 'Conditioning') return false;
  const exercises = workout.exercises ?? [];
  for (const ex of exercises) {
    const meta = getConditioningMeta(ex.exercise?.name || '');
    if (meta && (meta.modality === 'run' || meta.impact === 'high')) return true;
  }
  return /sprint|run|interval|mas\b|km/i.test(workout.name || '');
}

/**
 * Classify how risky a session is for a given injury bucket.
 *
 *   LOW       — recovery, empty, or no risky exercises / not region-relevant
 *   MODERATE  — some risky work but mixed (no single dominant pattern)
 *   HIGH      — session is dominated by risk:
 *                 - sprint/team-training day for a lower-limb injury, OR
 *                 - ≥1 'avoid'-rated exercise AND ≥50% of exercises risky
 *
 * The HIGH threshold deliberately requires an 'avoid'-rated exercise
 * (not just multiple cautions). A 100%-caution session is still
 * MODERATE — the engine can fix it with surgical removals + replacements
 * rather than a wholesale rebuild.
 */
export function classifySessionRisk(workout: Workout, bucket: InjuryBucket): SessionRisk {
  if (isRecovery(workout)) return 'LOW';

  const exercises = workout.exercises ?? [];

  // Sprint conditioning + team training sessions are always HIGH for
  // lower-limb buckets — the exposure (running/sprinting) doesn't live
  // in the exercise list, but it dominates the session's training load.
  if (LOWER_BUCKETS.has(bucket) && (isRunningCond(workout) || isTeamTraining(workout))) {
    return 'HIGH';
  }

  if (exercises.length === 0) return 'LOW';

  let avoidCount = 0;
  let cautionCount = 0;
  for (const ex of exercises) {
    const r = classifyExerciseRiskForBucket(ex.exercise?.name || '', bucket);
    if (r === 'avoid') avoidCount++;
    else if (r === 'caution') cautionCount++;
  }

  const riskCount = avoidCount + cautionCount;
  if (riskCount === 0) return 'LOW';
  const riskShare = riskCount / exercises.length;

  // HIGH: ≥1 avoid and ≥50% risky.
  if (avoidCount >= 1 && riskShare >= 0.5) return 'HIGH';
  return 'MODERATE';
}

// ─── Replacement hierarchy ───────────────────────────────────────────
//
// Bible order:
//   1. same movement pattern if safe
//   2. similar muscle group
//   3. unaffected body area
//   4. recovery / easy conditioning
//   5. removal/rest only when no safe useful work remains
//
// The candidates below are ordered in that hierarchy. We still validate
// every candidate against the injury tags before returning it, so a
// nominally-similar swap that is still risky gets skipped.

export type SubstitutionHierarchyTier = Exclude<SafeTrainingFallbackTier, 'rest'>;

export interface InjuryReplacementChoice {
  name: string;
  /** Sam's coarse Bible tier — a PROJECTION of `rung`, never a second opinion. */
  hierarchyTier: SubstitutionHierarchyTier;
  /** The finer authored rung this option came from. */
  rung: InjuryFallbackRungId;
  /**
   * R-103: accessory and adjacent-pattern fallbacks are PARTIAL coverage and
   * must be disclosed as such. `false` means the athlete is no longer training
   * what the original row trained, and the caller must say so.
   */
  coversOriginalPattern: boolean;
  /** Plain words for the athlete, from the ladder's one wording table. */
  explanation: string;
}

/**
 * ── THE ONE INJURY REPLACEMENT DOOR, NOW DERIVED ────────────────────────────
 *
 * **WHAT WAS HERE, AND WHERE IT WENT.** `REPLACEMENT_BY_BUCKET` and
 * `GENERIC_SAFE_BY_BUCKET` — a table hand-keyed on ~40 EXERCISE NAMES across 9
 * of Sam's 13 regions, plus the four helpers that walked it — are **deleted**,
 * and the behaviour is in
 * `rules/injuryFallbackLadder.buildInjuryFallbackLadder`, which derives the same
 * ladder from typed pattern/plane/role/equipment metadata, as R-103 requires:
 * *"Typed pattern/plane/role/equipment metadata, never name regexes."*
 *
 * **WHY, MEASURED (`npm run census:injury-fallback` on `main` `9f081efa`, with
 * its controls printed):** across 86 pooled strength exercises x 13 regions x 4
 * authored severity bands, **1569 occurrences needed a fallback and 6 kept the
 * movement pattern; 38 of the 52 (region x band) athlete worlds kept nothing in
 * pattern at all.** Any name the table did not list fell straight through to
 * the generic map, which is the ladder's THIRD tier — so for almost every row in
 * the app, rungs 1 and 2 were not tried, they were unreachable. The table also
 * could not grow with the pools: it named `RDLs` but not `Incline Bench`,
 * `Back Squat` but not `Box Squat`, and had nothing at all for `hip`, `quad`,
 * `ribs` or `neck`.
 *
 * **THE SEVERITY GATE MOVED WITH IT, IT WAS NOT DROPPED.**
 * `candidateIsAllowedBySeverity` restricted the 8-10 band to the
 * `unaffected_body_area` and `recovery` TIERS. That was a proxy for Sam's
 * *"rest/recovery or clearly unaffected work only"*, and the RATING states it
 * directly — so `replacementLegalForBand` below reads
 * `classifyExerciseRiskForBucket`, which also carries the Bible's hamstring
 * heavy-hinge refinement that a tier proxy could never see.
 *
 * **AND `isSafeCandidate` (rating must be `good`) MOVED THE SAME WAY.** It was
 * the 8-10 answer applied at EVERY band, which is the second half of why a 4/10
 * shoulder could not be given a shoulder-friendly press.
 */

/**
 * ── WHICH ROWS MAY BE A REPLACEMENT, PER AUTHORED BAND ──────────────────────
 *
 * ⚠ **THE 6-7 BAND IS NOT "NO `caution` WORK" — IT IS SAM'S SENTENCE, READ
 * WHOLE.** He writes four bullets for that band, and only one of them is about
 * removal: *"Avoid movements that directly trigger it"* (the `avoid` rating) and
 * *"**Reduce or remove high-speed, heavy, high-impact or high-volume work
 * through that area**"*, against *"Moderately reduce affected work"* and *"Keep
 * unaffected work in where possible"* (Bible :1913-1919).
 *
 * **READING IT AS "ALL `caution` WORK GOES" CONTRADICTED HIS OWN GOOD-SWAP
 * LISTS**, and `test:tap-swap-hierarchy` has been red on `main` because of it:
 * *"knee-blocked squat selects the curated posterior-chain option"* expects
 * `Hip Thrusts`, which is his verbatim knee swap — *"Heavy knee-dominant work ->
 * hip thrust or upper body/midline"* (:2131) — and his matrix rates it
 * `knee: 'caution'`. Heavy-or-high-fatigue is the line his sentence actually
 * draws, and it separates them: `Back Squat` is `load: high, fatigue: high` and
 * goes; `Hip Thrusts` is `moderate/moderate` and stays.
 *
 * It is the same shape `classifyExerciseRiskForBucket` already uses for the
 * hamstring — *"high-load hinges are risky work even when their base tag is
 * `caution`"* — generalised off the band text instead of one region.
 *
 * `injurySeverityRemovesRiskyWork` is the **6-7** edge, and it is Sam's:
 * *"6-7/10 — Remove risky work through the area; keep unaffected work"*, against
 * *"4-5/10 — Reduce load, volume, range, speed... Swap obvious aggravators.
 * **Keep safe work in.**"* Below 6 a `caution` row is still usable — that is what
 * "keep safe work in" means, and it is the only reason a 4/10 shoulder can be
 * answered with a shoulder-friendly press instead of a squat.
 *
 * `unknown` is refused: a row Sam's matrix does not rate cannot be SHOWN safe,
 * and an injury replacement is the last place in this app to guess. That agrees
 * with `assessTapSwapCandidateSafety`, which refuses an untagged replacement
 * while an injury is active, so the two owners cannot disagree about a name.
 */
const replacementLegalForBand = injuryPermitsExerciseAtSeverity;

/**
 * The ladder's best legal answer, or null when it has NOTHING at any rung.
 *
 * **`null` IS AN ANSWER, AND IT IS THE HONEST OMISSION.** The caller takes the
 * row off and names it — never leaves it standing under a sentence saying the
 * session was made safe, and never substitutes something unsafe to avoid an
 * empty result.
 */
export function getReplacementForBucket(
  exerciseName: string,
  bucket: InjuryBucket,
  severity: number = 6,
  avoidNames: readonly string[] = [],
  isLegal?: (name: string) => boolean,
): string | null {
  return getReplacementChoiceForBucket(
    exerciseName, bucket, severity, avoidNames, isLegal,
  )?.name ?? null;
}

/**
 * Every safe choice, in Sam's Bible hierarchy order.
 *
 * `isLegal` is how a caller with MORE context narrows the search — the tap
 * surfaces pass `assessTapSwapCandidateSafety`, so equipment and readiness are
 * decided by their one owner and the ladder ranks only what survives it.
 * **It narrows the SEARCH, not the RESULT.** Filtering afterwards is R-103's
 * founding defect: the single rung offered turned out illegal on the athlete's
 * kit, the write door refused it, and the refusal was flattened into *"That
 * change didn't go through."*
 */
export function getReplacementChoicesForBucket(
  exerciseName: string,
  bucket: InjuryBucket,
  severity: number = 6,
  avoidNames: readonly string[] = [],
  isLegal?: (name: string) => boolean,
): InjuryReplacementChoice[] {
  return buildInjuryFallbackLadder({
    exercise: exerciseName,
    region: bucket as InjuryKey,
    avoidNames,
    isLegal: (name) => replacementLegalForBand(name, bucket as InjuryKey, severity)
      && (isLegal ? isLegal(name) : true),
  }).map((option) => ({
    name: option.name,
    hierarchyTier: option.tier as SubstitutionHierarchyTier,
    rung: option.rung,
    coversOriginalPattern: option.coversOriginalPattern,
    explanation: option.explanation,
  }));
}

export function getReplacementChoiceForBucket(
  exerciseName: string,
  bucket: InjuryBucket,
  severity: number = 6,
  avoidNames: readonly string[] = [],
  isLegal?: (name: string) => boolean,
): InjuryReplacementChoice | null {
  return getReplacementChoicesForBucket(
    exerciseName, bucket, severity, avoidNames, isLegal,
  )[0] ?? null;
}


/**
 * Short prose for the "Rebuilt for ..." coachNote attached to HIGH-risk
 * sessions. Per-bucket so the athlete sees the rebuild rationale on the
 * Program tab.
 */
const REBUILD_HINT: Partial<Record<InjuryBucket, string>> = {
  hamstring: 'quad-dominant focus, no hinge or sprint exposure',
  knee: 'hinge-dominant focus, no plyo or heavy knee load',
  calf: 'low-impact: no sprinting or plyos',
  'ankle/foot': 'controlled bilateral work, no cutting',
  'groin': 'no cutting / no sprinting / no kicking',
  shoulder: 'lighter pressing, machine / iso alternatives',
  elbow: 'machine / iso upper alternatives',
  'wrist/hand': 'reduced grip load',
  lowerBack: 'no axial load, machine / supported work',
};

export function summariseRebuild(bucket: InjuryBucket): string {
  return REBUILD_HINT[bucket] ?? 'safe alternatives substituted';
}
