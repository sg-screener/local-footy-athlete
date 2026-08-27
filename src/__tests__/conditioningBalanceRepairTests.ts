/**
 * Strength/conditioning balance is authored by the canonical compiler, not a
 * post-generation repair. Real onboarding witnesses replace the retired
 * enforceInSeasonPushPullBalance hand-built-plan tests.
 * NOT COVERED: native controls; accumulated injury/edit cases live in the year gate.
 */
Object.assign(globalThis, { __DEV__: true });
const storage = new Map<string, string>();
Object.assign(globalThis, { window: { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
} } });
import { coldStartThroughOnboarding, quietAsync } from './support/athleteJourney';
import { ARCHETYPES, athleteAnswers, YEAR_START } from './compilerYear/catalog';
import { evaluateMicrocycleForTests } from './support/evaluateMicrocycle';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();
let passed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log('PASS ' + label); }
  else { failures.push(label + ': ' + detail); console.error('FAIL ' + label + ': ' + detail); }
}
async function main() {
  let mutationCaught = false;
  for (const archetype of ARCHETYPES) {
    const profile = athleteAnswers({ ...archetype, initialPhase: 'In-season',
      gameDay: archetype.gameDay ?? 'Saturday' });
    const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: YEAR_START }));
    check(archetype.id + ' completes real onboarding', !installed.onboardingRefusal, installed.onboardingRefusal ?? '');
    for (const week of installed.program.microcycles) {
      const evaluation = evaluateMicrocycleForTests(week);
      check(archetype.id + ':' + week.startDate + ' balanced canonical week',
        !!evaluation && evaluation.blockingViolations.length === 0,
        JSON.stringify(evaluation?.blockingViolations));
      const mutant = week.workouts.map(workout => ({ ...workout,
        speedBlock: undefined, conditioningBlock: undefined, conditioningCategory: undefined,
        conditioningFlavour: undefined, hasCombinedConditioning: false,
        attachedConditioningKind: undefined,
        exercises: workout.exercises.filter(row => row.section18Evidence?.role !== 'conditioning'),
        section18Evidence: workout.section18Evidence && { ...workout.section18Evidence,
          conditioningRole: 'none' as const, conditioningStress: 'unknown' as const },
      }));
      mutationCaught ||= !!evaluateMicrocycleForTests(week, mutant)?.blockingViolations.some(violation =>
        violation.domain === 'conditioning');
    }
  }
  check('removing real compiled conditioning fails the evaluator', mutationCaught);
  check('retired imperative balance author cannot be called',
    !('enforceInSeasonPushPullBalance' in require('../utils/coachingEngine')));
}
main().catch(error => { failures.push(String(error)); }).finally(() => {
  console.log('Conditioning balance: ' + passed + ' passed; ' + failures.length + ' failures');
  for (const failure of failures) console.error(failure);
  totalsPrinted(failures.length);
});
