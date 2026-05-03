import { getSubstituteCandidates } from '../src/utils/exerciseSubstitutes';

function show(label: string, opts?: any) {
  const r = getSubstituteCandidates(label.split('|')[0], opts);
  console.log(`\n${label}`);
  r.forEach((c, i) => {
    console.log(
      `  [${i}] ${c.name} | slot=${c.slot} role=${c.role} eq=${c.equipment} ` +
      `diff=[${c.differsOn.join(',')}] reason="${c.reason}"`,
    );
  });
  if (r.length === 0) console.log('  (no candidates)');
}

show('Pull-Ups (baseline — should now return 2 with fallback)');
show('Pull-Ups | shoulder=avoid', { activeInjuries: { shoulder: 'avoid' } });
show('Pull-Ups | avoidOverheadPull', { avoidOverheadPull: true });
show('Pull-Ups | shoulder=caution', { activeInjuries: { shoulder: 'caution' } });
show('Deadlift');
show('Deadlift | lowerBack=avoid', { activeInjuries: { lowerBack: 'avoid' } });
show('Lat Pulldown');
show('Bench Press');
show('Back Squat');
