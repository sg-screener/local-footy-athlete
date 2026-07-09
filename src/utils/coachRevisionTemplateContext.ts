/**
 * coachRevisionTemplateContext — the ONE seam through which dynamic
 * registry templates (engine-generated strength / accessory sessions)
 * reach app state.
 *
 * Why this exists: static templates (flush rides, recovery flow) are pure
 * functions of (templateId, date). Engine-generated strength sessions
 * also need the athlete context (injuries, equipment, onboarding) and
 * game dates so buildTagAwareSession can apply the SAME principles the
 * weekly programming applies. The registry builder's signature stays
 * (templateId, date) everywhere — policy, producer, and writer all call
 * it — so the context arrives via this module-level provider instead of
 * threading new parameters through every call site.
 *
 * Determinism contract: within one app session the provider returns the
 * same context for the same date, so the advertised snapshot (producer),
 * the validation signature (policy), and the written workout (writer)
 * are all derived from identical inputs. Tests may inject a fixture
 * provider; the default reads the live stores lazily and falls back to
 * safe defaults when stores are unavailable (pure node test runs).
 */

import type { AthleteContext } from './sessionBuilder';
import { DEFAULT_ATHLETE_CONTEXT } from './sessionBuilder';

export interface CoachRevisionTemplateContext {
  athlete: AthleteContext;
  /** ISO dates of known games (marked + virtual), for proximity filters. */
  gameDates: string[];
  inSeason: boolean;
}

export type CoachRevisionTemplateContextProvider =
  () => CoachRevisionTemplateContext;

const FALLBACK_CONTEXT: CoachRevisionTemplateContext = {
  athlete: DEFAULT_ATHLETE_CONTEXT,
  gameDates: [],
  inSeason: true,
};

/** Default provider: read the live stores lazily (same pattern as
 *  useSchedule) so the module works in the app without bootstrap wiring,
 *  and degrades to the fallback in store-less test environments. */
function liveStoreProvider(): CoachRevisionTemplateContext {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useProfileStore } = require('../store/profileStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useCalendarStore } = require('../store/calendarStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolveEquipmentAvailability } = require('./equipmentAvailability');

    const onboardingData = useProfileStore.getState().onboardingData;
    const markedDays = useCalendarStore.getState().markedDays ?? {};

    const trainingLocation =
      onboardingData?.trainingLocation || 'Commercial gym';
    const athlete: AthleteContext = onboardingData
      ? {
          injuries: onboardingData.injuries || [],
          equipmentTags: resolveEquipmentAvailability(onboardingData),
          trainingLocation,
          onboardingData,
        }
      : DEFAULT_ATHLETE_CONTEXT;

    const gameDates = Object.entries(markedDays)
      .filter(([, mark]) => mark === 'game')
      .map(([date]) => date)
      .sort();

    const inSeason =
      (onboardingData?.seasonPhase ?? 'In-season') === 'In-season';

    return { athlete, gameDates, inSeason };
  } catch {
    return FALLBACK_CONTEXT;
  }
}

let provider: CoachRevisionTemplateContextProvider = liveStoreProvider;

export function getCoachRevisionTemplateContext(): CoachRevisionTemplateContext {
  try {
    return provider();
  } catch {
    return FALLBACK_CONTEXT;
  }
}

/** Test / bootstrap injection point. Pass null to restore the default. */
export function setCoachRevisionTemplateContextProvider(
  next: CoachRevisionTemplateContextProvider | null,
): void {
  provider = next ?? liveStoreProvider;
}
