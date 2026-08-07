import type { OnboardingData } from '../types/domain';

/**
 * WHICH PHASES HAVE A CLUB SEASON — one Bible fact, one owner.
 *
 * `teamTrainingDays` is an ANSWER the athlete gave about their club, and it is
 * true while the club is training. The Bible's off-season is the part of the
 * year when it is not:
 *
 *   • `:107` (Off-season, "How hard can the app push") — "very. **no team
 *     training or games** means conditioning is controlled = no outside forces
 *     actign on the athlete. No risk of overdoing the gym work but then having
 *     to front up to team training the next night…"
 *   • `:108` (Off-season, "Ideal weekly structure") — "lower body + conditoning,
 *     upper body + conditoning, rest wednesday, ower body + conditoning, upper
 *     body + conditoning, saturday long slow run, sunday rest". No team training
 *     appears anywhere in it.
 *   • `:1289` — the availability gate for "no-team-training weeks only …
 *     (**late off-season**, the Christmas break)". The Bible's own name for a
 *     no-team-training week is off-season.
 *   • `:129` — "Team training … receive anchor credit" for the weekly sprint
 *     floor, which `:103` removes in early off-season. A retained team night
 *     does not merely sit there; it feeds credit into a phase whose floor the
 *     Bible has just lifted.
 *
 * SCOPED AT DERIVATION, NEVER AT THE ANSWER (Sam's ruling, 2026-08-06, by north
 * star). The stored answer is not edited, cleared or migrated: off-season
 * derivation simply does not read it, so returning to Pre-season restores the
 * club fact by itself, with no write to make and nothing to lose. This is the
 * boundary `onboardingToCoachingInputs` already reasons at — "we union at the
 * engine-input boundary, NOT in `applyPhaseShift` … the stored profile keeps the
 * user's original preferences untouched".
 *
 * `phaseStructureConformanceTests` holds all of it: no team training derived in
 * off-season, the stored answer byte-identical across the shift, and the club
 * fact returning on its own when the athlete goes back to pre-season.
 */
export function phaseHasClubTraining(
  phase: OnboardingData['seasonPhase'] | null | undefined,
): boolean {
  return phase === 'Pre-season' || phase === 'In-season';
}

/**
 * The team days DERIVATION may use for this phase. Off-season sees none; every
 * other phase sees exactly what the athlete answered.
 */
export function clubTrainingDaysForPhase(
  phase: OnboardingData['seasonPhase'] | null | undefined,
  answeredDays: readonly string[] | undefined,
): string[] {
  return phaseHasClubTraining(phase) ? [...(answeredDays ?? [])] : [];
}
