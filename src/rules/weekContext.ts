import type { SeasonPhase, WeekKind } from '../types/domain';

export type WeekContextKind =
  | 'in_season_game_week'
  | 'in_season_bye_week'
  | 'pre_season_practice_match_week'
  | 'pre_season_no_fixture_week'
  | 'off_season_week'
  | 'general_training_week';

export interface WeekContextInput {
  seasonPhase?: SeasonPhase | null;
  /**
   * Authoritative fixture presence for the specific week. Prefer this when
   * calendar/resolver data is available because a profile-level gameDay can
   * still be suppressed by an explicit no-game week.
   */
  hasFixture?: boolean | null;
  /** Fallback profile-level fixture signal when week-level data is unavailable. */
  gameDay?: string | null;
  gameDates?: readonly string[];
  practiceMatchDates?: readonly string[];
  weekKind?: WeekKind | null;
}

export interface WeekContext {
  kind: WeekContextKind;
  seasonPhase: SeasonPhase | null;
  hasFixture: boolean;
  isByeWeek: boolean;
  isDeloadWeek: boolean;
  fixtureLabel: 'game' | 'practice match' | null;
  displayLabel: string;
}

function hasUsableGameDay(gameDay: string | null | undefined): boolean {
  return !!gameDay && gameDay !== 'none' && gameDay !== 'Varies';
}

function resolveHasFixture(input: WeekContextInput): boolean {
  if (typeof input.hasFixture === 'boolean') return input.hasFixture;
  if ((input.gameDates?.length ?? 0) > 0) return true;
  if ((input.practiceMatchDates?.length ?? 0) > 0) return true;
  return hasUsableGameDay(input.gameDay);
}

export function resolveWeekContext(input: WeekContextInput): WeekContext {
  const seasonPhase = input.seasonPhase ?? null;
  const hasFixture = resolveHasFixture(input);
  const isDeloadWeek = input.weekKind === 'deload';

  if (seasonPhase === 'In-season') {
    return hasFixture
      ? {
        kind: 'in_season_game_week',
        seasonPhase,
        hasFixture,
        isByeWeek: false,
        isDeloadWeek,
        fixtureLabel: 'game',
        displayLabel: 'In-season game week',
      }
      : {
        kind: 'in_season_bye_week',
        seasonPhase,
        hasFixture,
        isByeWeek: true,
        isDeloadWeek,
        fixtureLabel: null,
        displayLabel: 'In-season bye week',
      };
  }

  if (seasonPhase === 'Pre-season') {
    return hasFixture
      ? {
        kind: 'pre_season_practice_match_week',
        seasonPhase,
        hasFixture,
        isByeWeek: false,
        isDeloadWeek,
        fixtureLabel: 'practice match',
        displayLabel: 'Pre-season practice match week',
      }
      : {
        kind: 'pre_season_no_fixture_week',
        seasonPhase,
        hasFixture,
        isByeWeek: false,
        isDeloadWeek,
        fixtureLabel: null,
        displayLabel: 'Pre-season no-fixture week',
      };
  }

  if (seasonPhase === 'Off-season') {
    return {
      kind: 'off_season_week',
      seasonPhase,
      hasFixture,
      isByeWeek: false,
      isDeloadWeek,
      fixtureLabel: null,
      displayLabel: 'Off-season week',
    };
  }

  return {
    kind: 'general_training_week',
    seasonPhase,
    hasFixture,
    isByeWeek: false,
    isDeloadWeek,
    fixtureLabel: null,
    displayLabel: 'General training week',
  };
}

export function isByeWeek(input: WeekContextInput): boolean {
  return resolveWeekContext(input).isByeWeek;
}
