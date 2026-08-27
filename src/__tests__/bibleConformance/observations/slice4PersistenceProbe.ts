/**
 * RETIRED: this probe loaded stored generated workouts and retyped them using a
 * hydration author that production no longer called. Continuing to execute it
 * would test a fictional persistence path.
 *
 * Current replacement: test:program-hydration-ownership, in the canonical
 * compiler release witness, exercises real persisted inputs and cold restart.
 * Historical implementation is recoverable from git before this retirement.
 */
if (require.main === module) {
  console.error('RETIRED stored-output hydration probe: run npm run test:program-hydration-ownership');
  process.exitCode = 1;
}
export {};
