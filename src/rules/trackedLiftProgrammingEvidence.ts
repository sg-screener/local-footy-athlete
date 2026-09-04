import type { AutomaticProgrammingSelectionTrace } from './programmingSelectionTrace';
import {
  selectedTrackedLiftProgrammingSeat,
  selectedTrackedLifts,
  trackedLiftId,
  type TrackedLiftChoices,
  type TrackedLiftId,
  type TrackedLiftSlot,
} from './estimatedOneRepMax';

export interface TrackedLiftWithholding {
  readonly date: string;
  readonly decisionId: string;
  readonly slot: TrackedLiftSlot;
  readonly expected: TrackedLiftId;
  readonly selected: string;
  readonly reasons: readonly string[];
}

export interface TrackedLiftProgrammingEvidence {
  readonly liftId: TrackedLiftId;
  readonly eligibleDates: readonly string[];
  readonly deliveredDates: readonly string[];
  readonly withheld: readonly TrackedLiftWithholding[];
}

/**
 * ⚠ **A SUBSTRING MATCH IS NOT A SEAT MAP, AND IT WAS SILENTLY MANUFACTURING
 * WITHHOLDINGS (found 2026-09-04).**
 *
 * This tested `seat.includes('pull')`, so `horizontal_pull` was attributed to
 * the `pull_up` tracked slot — and every horizontal-pull decision then recorded
 * `Pull-Ups` as WITHHELD with `selected_anchor_not_in_candidate_pool`, because
 * a pull-up is not a candidate for a row and never could be. Tens of thousands
 * of them across a 52-week corpus.
 *
 * **It was invisible because nothing read those entries.** The acceptance check
 * compared eligible dates against delivered dates, and `eligibleDates` correctly
 * excluded them, so the noise sat in the receipt unexamined. R-374 narrowed that
 * check onto the withheld REASONS and the noise became 470 failure keys — a real
 * defect surfacing, not a new one.
 *
 * The seat a tracked lift occupies is the ATHLETE'S CHOICE, so it cannot be a
 * static table: choosing Overhead Press moves the push anchor from
 * `horizontal_push` to `vertical_push`. `selectedTrackedLiftProgrammingSeat` is
 * the owner of that answer and this now asks it, once per pattern, and inverts.
 */
export function trackedLiftSlotForProgrammingSeat(
  seat: string,
  choices: TrackedLiftChoices = {},
): TrackedLiftSlot | null {
  const patterns: readonly { pattern: 'push' | 'pull' | 'squat' | 'hinge'; slot: TrackedLiftSlot }[] = [
    { pattern: 'push', slot: 'bench_press' },
    { pattern: 'pull', slot: 'pull_up' },
    { pattern: 'squat', slot: 'back_squat' },
    { pattern: 'hinge', slot: 'rdl' },
  ];
  for (const { pattern, slot } of patterns) {
    if (selectedTrackedLiftProgrammingSeat(choices, pattern) === seat) return slot;
  }
  return null;
}

/**
 * Project final decision evidence, deduplicated by compiler decision identity.
 * Restarts re-emit the same decision; the last trace is the reconstructed
 * answer and one athlete-date remains one observation opportunity.
 */
export function trackedLiftProgrammingEvidence(
  traces: readonly AutomaticProgrammingSelectionTrace[],
  choices: TrackedLiftChoices = {},
): TrackedLiftProgrammingEvidence[] {
  const finalByDecision = new Map<string, AutomaticProgrammingSelectionTrace>();
  for (const trace of traces) finalByDecision.set(trace.decisionId, trace);
  const selected = selectedTrackedLifts(choices);
  const eligible = new Map<TrackedLiftId, Set<string>>(
    selected.map((id) => [id, new Set<string>()]),
  );
  const delivered = new Map<TrackedLiftId, Set<string>>(
    selected.map((id) => [id, new Set<string>()]),
  );
  const withheld = new Map<TrackedLiftId, TrackedLiftWithholding[]>(
    selected.map((id) => [id, []]),
  );

  for (const trace of finalByDecision.values()) {
    if (trace.kind !== 'strength_exercise' || trace.need.role !== 'main_strength') continue;
    const slot = trackedLiftSlotForProgrammingSeat(trace.need.movementOrQuality, choices);
    if (!slot) continue;
    const expected = choices[slot] && selected.includes(choices[slot]!)
      ? choices[slot]! : slot;
    const candidate = trace.candidates.find((item) => trackedLiftId(item.name) === expected);
    const selectedAnchorWasDelivered = trackedLiftId(trace.selected) === expected;
    // A selected final decision is necessarily an eligible opportunity. Some
    // composer fallbacks deliberately admit an experience-gated movement when
    // every preferred movement is already used on that day; the trace retains
    // the discarded preference reason for audit, but it must not turn the row
    // that actually shipped into an impossible delivery (0 eligible / 50
    // delivered in the founding novice-home year).
    const candidateIsEligible = selectedAnchorWasDelivered
      || (!!candidate && candidate.rejectedBy.length === 0);
    if (candidateIsEligible) eligible.get(expected)?.add(trace.need.dateISO);
    if (selectedAnchorWasDelivered) {
      delivered.get(expected)?.add(trace.need.dateISO);
      continue;
    }
    withheld.get(expected)?.push({
      date: trace.need.dateISO,
      decisionId: trace.decisionId,
      slot,
      expected,
      selected: trace.selected,
      reasons: candidate
        ? candidate.rejectedBy.length > 0 ? candidate.rejectedBy : ['eligible_anchor_not_selected']
        : ['selected_anchor_not_in_candidate_pool'],
    });
  }

  return selected.map((liftId) => ({
    liftId,
    eligibleDates: [...(eligible.get(liftId) ?? [])].sort(),
    deliveredDates: [...(delivered.get(liftId) ?? [])].sort(),
    withheld: withheld.get(liftId) ?? [],
  }));
}
