/**
 * SAM'S 2026-08-05 DEVICE PASS — his answers as ACT inputs, never a seed.
 *
 * Transcribed from `device-export-2026-08-05.txt` (captured
 * 2026-08-05T00:15:52Z, acceptedRevision 20). Same law as
 * `samDeviceExport8Fixture`: the export is a CONFORMANCE TARGET. These are
 * the ANSWERS he gave and the marks he made, replayed through real doors from
 * a fresh install — not his stored state.
 *
 * What the export additionally records, for the worn-state question:
 * - `lastTransaction: temporary_source_fact:hydrate` — his launch re-migrates
 *   a LEGACY schedule constraint into an active `busy_week` fact for
 *   2026-07-27, a week already over on his pass. Current code never writes
 *   that legacy shape (L15), so that coordinate is reachable only through the
 *   hydration ingress, not by fresh acting. Cells that stay green here and
 *   red on his phone name that coordinate first.
 * - His profile has NO `usualGameDay`/`gameDay` answer (22 keys, no game
 *   anchor) — same fact as his 2026-07-29 export, kept absent on purpose.
 */

import type { OnboardingData } from '../../types/domain';

/** The capture instant. His "today" was a Wednesday. */
export const SAM_PASS_20260805_CAPTURED_AT = '2026-08-05T00:15:52.310Z';
export const SAM_PASS_20260805_TODAY_ISO = '2026-08-05';

/** His program's first week (weekScopedOverlayWeeks starts here). */
export const SAM_PASS_20260805_ENTRY_WEEK = '2026-07-27';
/** The Monday of the week he was looking at on the pass. */
export const SAM_PASS_20260805_CURRENT_WEEK = '2026-08-03';
/** Generation day — his accepted profile snapshot is captured this day. */
export const SAM_PASS_20260805_GENERATION_DAY = '2026-08-01';

/** His one calendar mark. */
export const SAM_PASS_20260805_MARKED_DAYS: Record<string, 'game'> = {
  '2026-08-01': 'game',
};

/** All 22 answers, exactly as exported. No game anchor — that is a fact. */
export function samDevicePass20260805Profile(): OnboardingData {
  return {
    firstName: 'Sam',
    heightCm: 184,
    weightKg: 90,
    position: 'inside_mid',
    goals: ['dominate_level', 'fresh_on_game_day'],
    seasonPhase: 'Pre-season',
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Monday', 'Wednesday'],
    teamTrainingIntensity: 'Hard',
    trainingDaysPerWeek: 6,
    trainingDaysUnsure: false,
    preferredTrainingDays: [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ],
    equipmentAnswer: {
      tags: {
        dumbbells: 'have',
        barbell: 'have',
        cables: 'have',
        bands: 'have',
        bench: 'have',
        machine: 'have',
        pullup_bar: 'have',
        foam_roller: 'have',
        kettlebell: 'have',
        plyo_box: 'have',
      },
      modalities: {
        bike_erg: 'have',
        row: 'have',
        air_bike: 'have',
        treadmill: 'have',
      },
      answeredOn: '2026-08-01',
    },
    trainingLocation: 'Commercial gym',
    experienceLevel: '5+ years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.5x bodyweight+',
    twoKmTimeTrial: {
      seconds: 420,
      recordedOn: '2026-08-01',
      source: 'onboarding',
    },
    conditioningLevel: 'Elite',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
  } as OnboardingData;
}
