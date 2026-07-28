/**
 * THE SEASON PHASE OWNER — one answer to "what phase is it?".
 *
 * The app used to carry two. `profile.seasonPhase` is what the athlete
 * selected; `program.seasonPhaseClock.selectedPhase` is what the visible week
 * is actually built from. The home chrome read one, `useSchedule` read the
 * other, and a phase shift wrote the profile BEFORE the rebuild — so a failed
 * rebuild left the two disagreeing with nothing to say so. Downstream, six
 * separate copies of `seasonPhase === 'Pre-season' ? 'practice_match' : 'game'`
 * each picked whichever value happened to be in scope.
 *
 * The ownership rule:
 *
 *   The CLOCK owns the phase. The profile selection is the INPUT the clock is
 *   minted from. The only writer of both is the atomic profile/program
 *   transaction, which commits them together or not at all.
 *
 * So this module is not a tie-breaker between two answers. It is the single
 * place that says which value IS the answer, and it names its source so a
 * caller can never mistake a migration or a pre-generation input for a clock.
 *
 * `OwnedSeasonPhase` is branded: it can only be produced here. Everything that
 * decides something from the phase — fixture kind above all — takes the brand
 * rather than a raw profile, so reading the wrong value is a type error rather
 * than a bug that shows up on someone's device six weeks later.
 */

import type { OnboardingData, SeasonPhase, TrainingProgram } from '../types/domain';
import { isValidSeasonPhaseClock, seasonPhaseFromProgram } from './seasonPhaseClock';

/** Which value answered, and in what capacity. */
export type OwnedSeasonPhaseSource =
  /** A valid persisted clock. The normal, authoritative answer. */
  | 'program_clock'
  /** No clock yet; the program's own phase string answered under migration. */
  | 'program_phase_migration'
  /** No program yet. The athlete's stored selection is the generation input. */
  | 'profile_selection'
  /** Nothing has answered — onboarding is incomplete. */
  | 'absent';

/**
 * A disagreement between the owner and the athlete's stored selection.
 *
 * This is a REPORT, never a repair. Detection does not touch either value:
 * choosing for the athlete is how a phase shift silently loses their answer,
 * and Sam's device already carries one of these.
 */
export interface SeasonPhaseSkew {
  /** What the owner says, and therefore what the visible week is built from. */
  readonly ownedPhase: SeasonPhase;
  /** What the athlete last selected, which disagrees. */
  readonly profileSelection: SeasonPhase;
  /** The week the owned phase started — the disclosure needs it. */
  readonly phaseEntryWeekStartISO: string | null;
}

declare const OWNED_SEASON_PHASE: unique symbol;

export interface OwnedSeasonPhase {
  /** Brand. Only the producers below can mint this. */
  readonly [OWNED_SEASON_PHASE]: true;
  /** The one answer. `null` only when nothing has answered yet. */
  readonly phase: SeasonPhase | null;
  readonly source: OwnedSeasonPhaseSource;
  /** The athlete's stored selection, kept as an input for disclosure. */
  readonly profileSelection: SeasonPhase | null;
  /** Set when the selection disagrees with the owner. */
  readonly skew: SeasonPhaseSkew | null;
}

export interface SeasonPhaseInputs {
  program?: TrainingProgram | null;
  profile?: Pick<OnboardingData, 'seasonPhase'> | null;
}

function mint(value: Omit<OwnedSeasonPhase, typeof OWNED_SEASON_PHASE>): OwnedSeasonPhase {
  return value as OwnedSeasonPhase;
}

function selectionOf(profile: SeasonPhaseInputs['profile']): SeasonPhase | null {
  return (profile?.seasonPhase as SeasonPhase | undefined) ?? null;
}

function clockEntryWeek(program: TrainingProgram | null | undefined): string | null {
  return isValidSeasonPhaseClock(program?.seasonPhaseClock)
    ? program.seasonPhaseClock.phaseEntryWeekStartISO
    : null;
}

/**
 * The disagreement detector, on its own so a disclosure surface can ask for
 * the fact without also having to hold the answer.
 *
 * Returns null when there is nothing to disagree with — no program means the
 * selection is an input, not a competing answer.
 */
export function seasonPhaseSkew(inputs: SeasonPhaseInputs): SeasonPhaseSkew | null {
  const owned = seasonPhaseFromProgram(inputs.program);
  const selection = selectionOf(inputs.profile);
  if (!owned || !selection || owned === selection) return null;
  return {
    ownedPhase: owned,
    profileSelection: selection,
    phaseEntryWeekStartISO: clockEntryWeek(inputs.program),
  };
}

/**
 * THE read path. Every surface that renders, resolves or validates against the
 * season phase asks this — the home chrome, `useSchedule`, the Profile setup
 * sheet, and every accepted-state fixture decision.
 */
export function ownSeasonPhase(inputs: SeasonPhaseInputs): OwnedSeasonPhase {
  const selection = selectionOf(inputs.profile);
  const fromProgram = seasonPhaseFromProgram(inputs.program);
  if (fromProgram) {
    return mint({
      phase: fromProgram,
      source: isValidSeasonPhaseClock(inputs.program?.seasonPhaseClock)
        ? 'program_clock'
        : 'program_phase_migration',
      profileSelection: selection,
      skew: seasonPhaseSkew(inputs),
    });
  }
  return mint({
    phase: selection,
    source: selection ? 'profile_selection' : 'absent',
    profileSelection: selection,
    skew: null,
  });
}

/**
 * The generation path: there is no program yet, so the athlete's selection IS
 * the input the clock is about to be minted from.
 *
 * This exists as a separate, named producer rather than an optional argument
 * so a generation-time read can never be mistaken for an authoritative one at
 * a call site — `ownSeasonPhaseForGeneration` says what it is doing.
 */
export function ownSeasonPhaseForGeneration(
  profile: Pick<OnboardingData, 'seasonPhase'> | null | undefined,
): OwnedSeasonPhase {
  const selection = selectionOf(profile);
  return mint({
    phase: selection,
    source: selection ? 'profile_selection' : 'absent',
    profileSelection: selection,
    skew: null,
  });
}

/**
 * Adapter for engine internals that already hold a resolved phase and are
 * downstream of an owned read (deload policy, week-kind resolution).
 *
 * Deliberately narrow and deliberately named: reaching for this when a program
 * is in scope re-opens the second answer this module exists to close.
 */
export function ownSeasonPhaseFromResolvedValue(
  phase: SeasonPhase | null | undefined,
): OwnedSeasonPhase {
  return mint({
    phase: phase ?? null,
    source: phase ? 'profile_selection' : 'absent',
    profileSelection: phase ?? null,
    skew: null,
  });
}
