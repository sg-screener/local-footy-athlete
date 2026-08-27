/**
 * Current Section 18 acceptance boundary, driven from real onboarding.
 *
 * Retired expectations: validator fallback/regeneration, direct overlay deletion,
 * alias-only injury migration, and snapshot restoration. Those were removed
 * authors, not product requirements. Fixture/edit/injury/Undo/restart composition
 * is exercised by canonicalWeeklyCompilerSliceTests and compilerYear; this suite
 * checks acceptance, immutable inputs and rejection of a genuinely broken week.
 */
Object.assign(globalThis, { __DEV__: true });
process.env.TZ = 'Australia/Melbourne';
const memory = new Map<string, string>();
Object.assign(globalThis, { window: { localStorage: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
  clear: () => { memory.clear(); },
} } });
const { armTotalsOrRed, totalsPrinted } = require('./support/totalsOrRed') as typeof import('./support/totalsOrRed');
armTotalsOrRed();
const { coldStartThroughOnboarding, quiet } = require('./support/athleteJourney') as typeof import('./support/athleteJourney');
const { ARCHETYPES, athleteAnswers, YEAR_START } = require('./compilerYear/catalog') as typeof import('./compilerYear/catalog');
const { useProgramStore } = require('../store/programStore') as typeof import('../store/programStore');
const { storedWorldSurfaces } = require('../utils/liveEvaluationSurfaces') as typeof import('../utils/liveEvaluationSurfaces');
const { requireSection18AcceptedWeek, Section18WeekAcceptanceError } =
  require('../rules/section18AcceptedWeekGateway') as typeof import('../rules/section18AcceptedWeekGateway');
const { semanticFingerprint } = require('../utils/programSemanticSnapshot') as typeof import('../utils/programSemanticSnapshot');
const boundary = require('../utils/postGenerationConstraintValidation') as typeof import('../utils/postGenerationConstraintValidation');
let passed = 0;
let mutated = 0;
const failures: string[] = [];
function check(name: string, ok: unknown, detail?: unknown) {
  if (ok) { passed++; console.log('PASS', name); }
  else { failures.push(name); console.error('FAIL', name, detail ?? ''); }
}
async function main() {
  for (const archetype of ARCHETYPES) {
    memory.clear();
    const profile = athleteAnswers(archetype);
    const installed = await coldStartThroughOnboarding({ profile, installDayISO: YEAR_START });
    if (installed.onboardingRefusal) throw new Error(installed.onboardingRefusal);
    const state = useProgramStore.getState();
    check(archetype.id + ' has a real accepted block', !!state.currentProgram?.microcycles.length);
    for (const week of state.currentProgram!.microcycles) {
      const label = archetype.id + '/' + week.startDate.slice(0, 10);
      const contract = week.exposureContractV2;
      check(label + ' carries the compiler contract', !!contract);
      if (!contract) continue;
      const input = { contract, workouts: week.workouts, weekStart: week.startDate.slice(0, 10),
        profile, surfaces: storedWorldSurfaces(state) };
      const before = semanticFingerprint(input);
      const accepted = quiet(() => requireSection18AcceptedWeek(input));
      check(label + ' accepts the compiler week without blockers', accepted.evaluation.blockingViolations.length === 0);
      check(label + ' never rewrites its input', semanticFingerprint(input) === before);
      const targets = (value: typeof contract) => [value.mainStrength.exposure, value.conditioning.core,
        value.sprintHighSpeed.exposure].map(demand => [demand.requiredMinimum, demand.plannerSelectedTarget]);
      check(label + ' keeps the declared targets', semanticFingerprint(targets(accepted.contract)) === semanticFingerprint(targets(contract)));
      if (contract.mainStrength.exposure.requiredMinimum > 0) {
        const missingStrength = week.workouts.filter(workout =>
          !workout.exercises.some(row => row.section18Evidence?.role === 'main_strength'));
        check(label + ' mutation actually removes main-strength sessions', missingStrength.length < week.workouts.length);
        const invalid = { ...input, workouts: missingStrength };
        const invalidBefore = semanticFingerprint(invalid);
        let rejected = false;
        try { quiet(() => requireSection18AcceptedWeek(invalid)); }
        catch (error) { rejected = error instanceof Section18WeekAcceptanceError; }
        check(label + ' rejects missing required strength instead of rebuilding it', rejected);
        check(label + ' rejected candidate remains byte-equivalent', semanticFingerprint(invalid) === invalidBefore);
        if (rejected && missingStrength.length < week.workouts.length) mutated++;
      }
    }
  }
  for (const retired of ['validateMicrocycleAgainstActiveConstraints',
    'validateProgramAgainstActiveConstraints', 'validateWeekOverlayAgainstActiveConstraints',
    'validateWorkoutAgainstActiveConstraints']) {
    check('retired procedural validator writer stays absent: ' + retired, !(retired in boundary));
  }
  check('the rejection gate was observed failing against nonempty real weeks', mutated > 0, mutated);
}
main().catch(error => { failures.push(String(error)); console.error(error); }).finally(() => {
  console.log(`Section 18 acceptance: ${passed} passed, ${failures.length} failed; ${mutated} real-week mutations rejected`);
  totalsPrinted(failures.length);
  if (failures.length) process.exitCode = 1;
});
