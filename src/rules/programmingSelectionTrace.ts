/**
 * Typed evidence emitted by the canonical compiler for every automatic content
 * choice. This is observation beside the decision, never a second selector.
 * Audits consume these rows instead of recreating eligibility or ranking after
 * the finished program has already discarded the alternatives.
 */

export type AutomaticProgrammingSelectionKind =
  | 'strength_exercise'
  | 'power_exercise'
  | 'conditioning_template';

export type AutomaticCandidateRejection =
  | 'wrong_route'
  | 'wrong_movement_or_quality'
  | 'equipment'
  | 'experience'
  | 'injury'
  | 'athlete_exclusion'
  | 'game_proximity'
  | 'role'
  | 'weekly_spacing'
  | 'already_on_day'
  | 'manual_or_special_use_only';

export interface AutomaticProgrammingNeedTrace {
  readonly dateISO: string;
  readonly weekStartISO: string;
  readonly dayOfWeek: number;
  readonly phase: string;
  readonly movementOrQuality: string;
  readonly role: string;
  readonly seatIndex: number;
  readonly equipment: readonly string[];
  readonly experience: string | null;
  readonly injuries: readonly string[];
  readonly daysToGame: number | null;
}

export interface AutomaticCandidateTrace {
  readonly name: string;
  readonly eligible: boolean;
  readonly rejectedBy: readonly AutomaticCandidateRejection[];
  /** One is best. Null means the candidate was ineligible and was not ranked. */
  readonly rank: number | null;
  /** Selection-policy facts, not an invented total score. */
  readonly score: {
    readonly phasePriority: number;
    readonly athletePreference: boolean;
    readonly recentUsage: number;
    readonly annualUsage: number;
    readonly weeksOrBlocksSinceUse: number | null;
    readonly weeklyUsage: number;
  };
  readonly modalities?: readonly string[];
}

export interface AutomaticProgrammingSelectionTrace {
  readonly schemaVersion: 1;
  readonly decisionId: string;
  readonly kind: AutomaticProgrammingSelectionKind;
  readonly owner:
    | 'blockExerciseSelection'
    | 'conditioningSelection'
    | 'powerExercisePool';
  readonly need: AutomaticProgrammingNeedTrace;
  readonly candidates: readonly AutomaticCandidateTrace[];
  readonly selected: string | null;
  readonly selectionReason: string;
}

export function rankSelectedFirst(
  candidates: readonly AutomaticCandidateTrace[],
  selected: string | null,
): AutomaticCandidateTrace[] {
  const eligible = candidates.filter((candidate) => candidate.eligible);
  const ranked = selected === null
    ? eligible
    : [
        ...eligible.filter((candidate) => candidate.name === selected),
        ...eligible.filter((candidate) => candidate.name !== selected),
      ];
  const rankByName = new Map(ranked.map((candidate, index) => [candidate.name, index + 1]));
  return candidates.map((candidate) => ({
    ...candidate,
    rank: candidate.eligible ? rankByName.get(candidate.name) ?? null : null,
  }));
}

