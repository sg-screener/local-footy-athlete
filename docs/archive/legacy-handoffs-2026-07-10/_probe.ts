import { getSubstituteCandidates } from './src/utils/exerciseSubstitutes';

function show(label: string, name: string, opts?: any) {
  const r = getSubstituteCandidates(name, opts);
  console.log(`\n${label}`);
  r.forEach((c, i) => {
    console.log(
      `  [${i}] ${c.name} | slot=${c.slot} role=${c.role} eq=${c.equipment} ` +
      `diff=[${c.differsOn.join(',')}] reason="${c.reason}"`,
    );
  });
  if (r.length === 0) console.log('  (no candidates)');
}

show('Pull-Ups (baseline)', 'Pull-Ups');
show('Pull-Ups | shoulder=avoid', 'Pull-Ups', { activeInjuries: { shoulder: 'avoid' } });
show('Pull-Ups | avoidOverheadPull', 'Pull-Ups', { avoidOverheadPull: true });
show('Pull-Ups | shoulder=caution', 'Pull-Ups', { activeInjuries: { shoulder: 'caution' } });
show('Deadlift', 'Deadlift');
show('Deadlift | lowerBack=avoid', 'Deadlift', { activeInjuries: { lowerBack: 'avoid' } });
show('Lat Pulldown', 'Lat Pulldown');
show('Bench Press', 'Bench Press');
show('Back Squat', 'Back Squat');
