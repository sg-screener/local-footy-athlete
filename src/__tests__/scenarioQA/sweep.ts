/**
 * Combinatorial sweep — generates a wide cartesian product of athlete
 * profiles and applies SANITY-only invariants. The goal is to catch
 * unexpected combinations that crash the engine, produce duplicate days,
 * or emit empty focus strings — NOT to assert policy.
 *
 * Policy invariants live in PERSONA_SCENARIOS where the intent is clear.
 *
 * Each generated scenario runs a single `onboard` action — the sweep is
 * intentionally NOT exercising the mutation handlers (personas cover
 * those). It's a load-bearing safety net for "any combination compiles
 * to a sane week."
 */

import type { OnboardingData, DayOfWeek, SeasonPhase } from '../../types/domain';
import type { Scenario } from './types';
import { SANITY_INVARIANTS } from './invariants';

const PHASES: SeasonPhase[] = ['Off-season', 'Pre-season', 'In-season'];
const TRAINING_DAY_COUNTS = [3, 4, 5, 6];
const TEAM_DAY_COUNTS = [0, 1, 2, 3];
const READINESS_PROFILES = [
  { label: 'high', conditioningLevel: 'Excellent', sprintExposure: 'A lot', recentTrainingLoad: 'Heavy' },
  { label: 'med', conditioningLevel: 'Good', sprintExposure: 'Some', recentTrainingLoad: 'Consistent' },
  { label: 'low', conditioningLevel: 'Poor', sprintExposure: 'None', recentTrainingLoad: 'Minimal' },
] as const;
const GAME_DAY_OPTIONS: (DayOfWeek | null)[] = ['Friday', 'Saturday', 'Sunday', null];

const ALL_DAYS: DayOfWeek[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

/** Pick the first N days from ALL_DAYS as the preferred training days. */
function pickPreferredDays(n: number, gameDay: DayOfWeek | null): DayOfWeek[] {
  // Always include the game day if there is one (the user usually trains on game day).
  const base = ALL_DAYS.slice(0, Math.max(n, gameDay ? 1 : 0));
  if (gameDay && !base.includes(gameDay)) {
    // Replace the last weekday with the game day so count stays at n.
    return [...base.slice(0, n - 1), gameDay];
  }
  return base.slice(0, n);
}

/** Pick the first K team days from the preferred training days. */
function pickTeamDays(preferred: DayOfWeek[], k: number, gameDay: DayOfWeek | null): DayOfWeek[] {
  const candidates = preferred.filter((d) => d !== gameDay);
  return candidates.slice(0, Math.min(k, candidates.length));
}

export function generateSweepScenarios(): Scenario[] {
  const scenarios: Scenario[] = [];
  for (const phase of PHASES) {
    for (const trainingDays of TRAINING_DAY_COUNTS) {
      for (const teamDays of TEAM_DAY_COUNTS) {
        if (teamDays > trainingDays) continue; // can't have more team days than training days
        for (const readiness of READINESS_PROFILES) {
          for (const gameDay of GAME_DAY_OPTIONS) {
            // Skip combos that don't make sense:
            // - Off-season never has a game
            // - Pre-season never has a game (per H-IS rules — pre-season has no formal games)
            if (phase !== 'In-season' && gameDay !== null) continue;
            // - Off-season never has team training (most clubs)
            if (phase === 'Off-season' && teamDays > 0) continue;

            const preferred = pickPreferredDays(trainingDays, gameDay);
            const tDays = pickTeamDays(preferred, teamDays, gameDay);

            const profile: OnboardingData = {
              firstName: 'Sweep',
              ageRange: '25-34',
              position: 'Midfielder' as any,
              motivation: 'Get stronger',
              experienceLevel: 'Intermediate' as any,
              squatStrength: '1.5x BW' as any,
              benchStrength: '1x BW' as any,
              conditioningLevel: readiness.conditioningLevel as any,
              sprintExposure: readiness.sprintExposure as any,
              recentTrainingLoad: readiness.recentTrainingLoad as any,
              injuries: [],
              sessionDurationMinutes: 60 as any,
              trainingLocation: 'Gym' as any,
              teamTrainingDuration: '90 min' as any,
              teamTrainingIntensity: 'High' as any,
              seasonPhase: phase,
              trainingDaysPerWeek: trainingDays,
              preferredTrainingDays: preferred,
              teamTrainingDaysPerWeek: tDays.length,
              teamTrainingDays: tDays,
              usualGameDay: gameDay ?? undefined,
              gameDay:
                gameDay === 'Friday' || gameDay === 'Saturday' || gameDay === 'Sunday'
                  ? gameDay
                  : undefined,
            };

            scenarios.push({
              name: `sweep[${phase}/${trainingDays}d/${teamDays}t/${readiness.label}/${gameDay ?? 'noGame'}]`,
              profile,
              actions: [{ type: 'onboard' }],
              invariants: SANITY_INVARIANTS,
            });
          }
        }
      }
    }
  }
  return scenarios;
}
