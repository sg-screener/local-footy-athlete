import type { AutomaticProgrammingSelectionTrace } from './programmingSelectionTrace';
import {
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

export function trackedLiftSlotForProgrammingSeat(
  seat: string,
): TrackedLiftSlot | null {
  if (seat.includes('push')) return 'bench_press';
  if (seat.includes('pull')) return 'pull_up';
  if (seat === 'squat') return 'back_squat';
  if (seat === 'hinge') return 'rdl';
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
    const slot = trackedLiftSlotForProgrammingSeat(trace.need.movementOrQuality);
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
