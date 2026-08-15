/**
 * WHICH §18 WEEK THIS IS — mode, declared subphase and anchor state.
 *
 * **EXTRACTED VERBATIM from `coachingEngine.ts:679` on 2026-08-15.** It was a
 * private function inside the legacy weekly planner, but it is not planning: it is
 * a pure read of the athlete's phase, fixture and the V1 contract's own identity.
 * The scheduler needs the same answer to derive §18's acceptance contract, and the
 * planner is being deleted, so it moves rather than being copied.
 *
 * ⚠ **NOT ONE LINE OF LOGIC CHANGED IN THE MOVE.** The body is the original; only
 * the `export` and this header are new. A behavioural edit smuggled into an
 * extraction is the shape that makes a refactor unreviewable.
 */
import type { CoachingInputs } from '../utils/coachingEngine';
import type { WeeklyExposureContract } from './weeklyExposureContract';
import type { Section18Subphase, Section18WeekMode } from './weeklyExposureContractV2';
import { canonicalFixtureKindForResolvedPhase } from './fixtureConditionedAvailability';

/**
 * EXTRACTED WITH ITS ONLY CALLER, from `coachingEngine.ts:671`. Verbatim.
 * Leaving it behind would have made this module import the planner it exists to
 * outlive.
 */
function underlyingModeFor(
  legacy: WeeklyExposureContract,
): WeeklyExposureContract['identity']['mode'] {
  const subphase = legacy.identity.subphase;
  if (subphase === 'game_week') return 'in_season_game_week';
  if (subphase === 'bye_recovery') return 'in_season_bye_recovery';
  if (subphase === 'bye_build') return 'in_season_bye_build';
  return subphase as WeeklyExposureContract['identity']['mode'];
}

export interface Section18WeekIdentity {
  readonly mode: Section18WeekMode;
  readonly declaredSubphase: Section18Subphase;
  readonly anchorState: 'game' | 'bye' | 'practice_match' | 'none';
}

export function section18ModeAndSubphase(
  inputs: CoachingInputs,
  legacy: WeeklyExposureContract,
): Section18WeekIdentity {
  // An optional week overrides ONLY the mode. It used to also declare itself as
  // a subphase and re-type its anchors as a bye, on the reasoning that "the
  // athlete is recovering, not participating in anchors" — but that overwrote
  // WHERE the week sits in the season with something that is not a season
  // position, which is why an optional off-season week could not exist at all.
  //
  // The week keeps its real subphase and its real anchors; being optional is a
  // statement about what is REQUIRED, not about where the athlete is in the
  // year or what is on their calendar.
  if (legacy.identity.mode === 'optional_week') {
    const underlying = section18ModeAndSubphase(
      inputs,
      { ...legacy, identity: { ...legacy.identity, mode: underlyingModeFor(legacy) } },
    );
    return { ...underlying, mode: 'optional_week' };
  }
  // ONE PREDICATE with the athlete-facing fixture word: `canonicalFixtureKind`
  // (the app's one phase→fixture-identity expression) is what the resolver's
  // game stub stamps, so the week mode and the label the athlete reads cannot
  // come to disagree about what a pre-season fixture is.
  if (canonicalFixtureKindForResolvedPhase(inputs.seasonPhase) === 'practice_match' && inputs.hasGame) {
    return {
      mode: 'practice_match_week',
      declaredSubphase: 'practice_match_week',
      anchorState: 'practice_match',
    };
  }
  if (inputs.seasonPhase === 'In-season') {
    if (inputs.hasGame) {
      return {
        mode: 'in_season_game_week',
        declaredSubphase: legacy.identity.subphase,
        anchorState: 'game',
      };
    }
    return {
      // The legacy compatibility contract has already resolved readiness,
      // injury and week-kind ownership. Reusing that canonical decision keeps
      // Contract v2 and allocation on one bye mode instead of reinterpreting
      // the same constraint state a second time.
      mode: legacy.identity.mode === 'in_season_bye_recovery'
        ? 'in_season_bye_recovery'
        : 'in_season_bye_build',
      declaredSubphase: legacy.identity.subphase,
      anchorState: 'bye',
    };
  }
  const phaseWeek = inputs.phaseWeekNumber;
  const mode: Section18WeekMode = phaseWeek === null || phaseWeek === undefined
    ? legacy.identity.mode
    : inputs.seasonPhase === 'Off-season'
      ? phaseWeek <= 2
        ? 'early_offseason'
        : phaseWeek <= 4
          ? 'mid_offseason'
          : 'late_offseason'
      : phaseWeek === 1
        ? 'early_preseason'
        : phaseWeek <= 3
          ? 'mid_preseason'
          : 'late_preseason';
  return {
    mode,
    declaredSubphase: legacy.identity.subphase,
    anchorState: legacy.anchors.gameDay !== null ? 'game' : 'none',
  };
}

