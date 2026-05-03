/**
 * _sub_examples — manual demo runner for getSubstituteCandidates.
 *
 * Not a test (the underscore prefix flags it as opt-in). Prints concrete
 * example outputs for the 8 scenarios that matter for the Coach
 * substitution rule. Run it after touching any of:
 *   - src/utils/exerciseSubstitutes.ts
 *   - src/data/exercisePoolsStrength.ts
 *   - src/data/exerciseTags.ts
 * to eyeball whether the candidate pairs still feel right.
 *
 * Run: npx sucrase-node src/__tests__/_sub_examples.ts
 *
 * Real assertions live in exerciseSubstitutesTests.ts.
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { getSubstituteCandidates, formatSubstitutesForLLM } from '../utils/exerciseSubstitutes';

function show(label: string, name: string, ctx?: any) {
  const cands = getSubstituteCandidates(name, ctx);
  console.log(`\n── ${label} ──`);
  console.log(`Input: getSubstituteCandidates(${JSON.stringify(name)}${ctx ? ', ' + JSON.stringify(ctx) : ''})`);
  if (cands.length === 0) {
    console.log('Output: []  (no safe substitutes)');
    return;
  }
  cands.forEach((c, i) => {
    console.log(`  [${i}] ${c.name}`);
    console.log(`      slot=${c.slot} role=${c.role} load=${c.loadRatio.toFixed(2)} eq=${c.equipment ?? '-'}`);
    console.log(`      differsOn=[${c.differsOn.join(', ')}]`);
  });
  console.log(`\nformatSubstitutesForLLM →`);
  console.log(`  ${formatSubstitutesForLLM(name, cands).replace(/\n/g, '\n  ')}`);
}

show('1. Deadlift (baseline, healthy)', 'Deadlift');
show('2. Deadlift with lowerBack=avoid', 'Deadlift', { activeInjuries: { lowerBack: 'avoid' } });
show('3. Back Squat (baseline)', 'Back Squat');
show('4. Bench Press with shoulder=caution', 'Bench Press', { activeInjuries: { shoulder: 'caution' } });
show('5. Bench Press, dumbbell-only equipment', 'Bench Press', { availableEquipment: ['dumbbell'] });
show('6. Alias "rdl"', 'rdl');
show('7. Pull-Ups (baseline)', 'Pull-Ups');
show('8. Pull-Ups with shoulder=avoid (cross-pattern fallback → rows)', 'Pull-Ups', { activeInjuries: { shoulder: 'avoid' } });
show('9. Pull-Ups with shoulder=caution (widened pool)', 'Pull-Ups', { activeInjuries: { shoulder: 'caution' } });
show('10. Pull-Ups with avoidOverheadPull=true (explicit)', 'Pull-Ups', { avoidOverheadPull: true });
show('11. Plyo (out of scope)', 'Box Jumps');
