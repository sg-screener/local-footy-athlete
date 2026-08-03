/**
 * TOTALS-OR-RED — Sam's law, 2026-08-03 (parked §9 answer).
 *
 * > "TOTALS-OR-RED IS LAW for every suite in test:bible — exit code armed red
 * > at module top, cleared only by the printed totals line."
 *
 * WHY. `onboardingReliabilityTests` exited **0 half-run** for three days
 * (2026-08-01 → 2026-08-03) while sitting inside `test:bible`. Its awaited
 * commit never settled, the event loop drained, and **node exits 0 on a
 * drained loop unless someone says otherwise**. The chain read that as green.
 * Blocks B2–G — including a registry-completeness pin — ran on no branch at
 * all, and the silence hid a real defect: every armoured store's guarded
 * storage was raising an unhandled rejection on failing device writes.
 *
 * A suite that reports nothing is worse than no suite (L-E3). This makes the
 * whole class loud: the process is born failing, and only the act of REPORTING
 * clears it. Crash, hang-then-drain, early `return`, a swallowed rejection —
 * every one of them now exits non-zero, because none of them reaches the
 * report.
 *
 * TWO LINES PER SUITE, and the suite's own output text is unchanged:
 *
 *   import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
 *   armTotalsOrRed();                       // module top, before any import work
 *   ...
 *   console.log(`... totals: ${passed} passed, ${failed} failed`);
 *   totalsPrinted(failed);                  // immediately after the line
 *
 * `totalsPrinted` takes the FAILURE COUNT rather than clearing unconditionally:
 * a suite that reports failures must stay red whether or not it also calls
 * `process.exit(1)` itself. Suites that already `process.exit(1)` keep doing
 * so — this is the floor beneath them, not a replacement.
 *
 * NOT `process.on('exit')`. A handler that clears on the way out would defeat
 * the purpose: a truncated run also reaches `exit`. The clear has to be an act
 * the suite performs at the point it has something true to say.
 */

/**
 * Arm the process RED. Call once at module top — before the imports that do
 * work, so a crash while loading a store still fails the run.
 */
export function armTotalsOrRed(): void {
  process.exitCode = 1;
}

/**
 * The suite printed its totals. Clears the arm iff it has nothing to report.
 *
 * Idempotent and last-writer-wins by design: a suite that reports more than
 * once (blocks with their own totals) ends on the verdict of its final call,
 * which is the one that saw the whole run.
 */
export function totalsPrinted(failureCount: number): void {
  process.exitCode = failureCount > 0 ? 1 : 0;
}
