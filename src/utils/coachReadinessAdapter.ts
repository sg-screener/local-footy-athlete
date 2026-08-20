/**
 * The pending-readiness clarifier TYPE — the one thing production still reads
 * from this module.
 *
 * WHAT THIS FILE USED TO BE. `routeCoachReadinessMessage` was a second coach
 * router: ~130 lines of phrase regexes (PAIN_OR_INJURY_RE, BODY_SORENESS_RE,
 * FATIGUE_RE, TIME_RE, four program-duration patterns) that decided, from the
 * raw message text, whether a coach turn was a readiness report, a soreness
 * clarification or a program edit.
 *
 * IT HAD ZERO PRODUCTION EXECUTION. Both production importers
 * (`utils/coachTurnController.ts`, `screens/coach/CoachScreen.tsx`) took only
 * `PendingReadinessClarifier`, and both took it as a TYPE — this module was
 * erased at compile time and the router never ran on any athlete's device.
 * Neutering it to always-return-`pass` reddened NOT ONE of the 152 cells in
 * `test:coach-live-readiness-priority`, which is the suite that looked like it
 * held it: that suite calls it from a route() helper of its own and asserts
 * nothing about the answer.
 *
 * WHO OWNS THE BEHAVIOUR NOW.
 *   - deciding what a coach turn is   `utils/coachCommandRouter.ts`, then
 *                                     `utils/coachTurnController.ts`
 *   - the readiness state itself      `store/readinessStore.ts` +
 *                                     `commitReadinessStateTransaction`
 *   - "short on time" (Sam, 2026-07-28, ONE owner)
 *                                     `rules/timeAvailabilityPolicy.isShortOnTime`,
 *                                     read live by `utils/readiness.ts` and
 *                                     `utils/readinessConstraints.ts`
 */

export interface PendingReadinessClarifier {
  kind: 'soreness_body_part';
  originalMessage: string;
  createdAt: number;
}
