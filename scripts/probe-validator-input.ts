/**
 * WHAT THE VALIDATOR ACTUALLY SEES — the assembled week at the moment of
 * judgement, and the ledger it produced.
 *
 * A composed row can declare `role: main_strength, mainStrengthPattern: 'push'`
 * and the week still be refused "trains no push". This prints the gap between
 * the declaration and `ledger.mainLiftsByPattern` instead of inferring it.
 */
declare global {
  // eslint-disable-next-line no-var
  var __DEV__: boolean;
}
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as validatorModule from '../src/rules/validateGeneratedWeek';

const seen: any[] = [];
const real = validatorModule.validateGeneratedWeek;
(validatorModule as any).validateGeneratedWeek = function wrapped(input: any) {
  const out = real(input);
  seen.push({ input, out });
  return out;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../src/services/api/generateProgram');

const BASE = {
  trainingLocation: 'Commercial gym',
  equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average',
  gameDay: 'Saturday',
};
const DAYS: Record<number, string[]> = {
  2: ['Tuesday', 'Thursday'], 3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const KIT_FOR: Record<string, string[]> = {
  'Full Gym': ['Full Gym'], 'Bodyweight Only': ['Bodyweight Only'],
  Dumbbells: ['Dumbbells', 'Bands'],
};

const spec = process.argv[2] ?? 'Pre-season/5d/noclub/Bodyweight Only/w2';
const [seasonPhase, daysRaw, clubRaw, kitName, weekRaw] = spec.split('/');
const trainingDaysPerWeek = Number(daysRaw.replace('d', ''));
const week = Number(weekRaw.replace('w', ''));
const preferredTrainingDays = DAYS[trainingDaysPerWeek];
const profile = {
  ...BASE, seasonPhase, trainingDaysPerWeek, preferredTrainingDays,
  equipment: KIT_FOR[kitName],
  teamTrainingDays: clubRaw === 'club'
    ? ['Tuesday', 'Thursday'].filter((d) => preferredTrainingDays.includes(d)) : [],
};

try {
  generateProgramLocally(profile as never, {
    todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: week,
  } as never);
} catch { /* the refusal is the subject */ }

console.log(`\n══ ${spec} — ${seen.length} validator call(s) ══`);
const last = seen[seen.length - 1];
if (!last) { console.log('the validator was never reached'); process.exit(0); }

console.log('\n── THE WEEK AS JUDGED ──');
for (const w of last.input.workouts) {
  console.log(`  day ${w.dayOfWeek} "${w.name}" type=${w.workoutType} tier=${w.sessionTier} `
    + `shape=${w.composedDayShape ?? '-'} rows=${(w.exercises ?? []).length}`);
  for (const row of (w.exercises ?? [])) {
    const ev = row.section18Evidence;
    console.log(`      ${String(row.exercise?.name ?? row.name ?? '?').padEnd(26)} `
      + `role=${ev?.role ?? '-'} main=${ev?.mainStrengthPattern ?? '-'} `
      + `strengthPattern=${ev?.strengthPattern ?? '-'} prov=${ev?.provenance ?? '-'}`);
  }
}
console.log('\n── CONTRACT TARGETS ──');
console.log(`  requiredSafePatterns=${JSON.stringify(last.input.contract?.requiredSafePatterns)}`);
console.log(`  mainStrengthSessionTarget=${JSON.stringify(last.input.contract?.mainStrengthSessionTarget)}`);
console.log(`  kitUnachievablePatterns=${JSON.stringify(last.input.contract?.kitUnachievablePatterns)}`);
console.log(`  declaredKitGaps(input)=${JSON.stringify(last.input.declaredKitGaps)}`);
console.log('\n── LEDGER ──');
console.log(`  mainStrengthSessions=${last.out.ledger.mainStrengthSessions}`);
console.log(`  mainLiftsByPattern=${JSON.stringify(last.out.ledger.mainLiftsByPattern)}`);
console.log(`  undeclaredStrengthRows=${last.out.ledger.undeclaredStrengthRows}`);
console.log(`\n  VERDICT=${last.out.verdict}`);
for (const f of last.out.findings) {
  console.log(`    [${f.clause}] ${f.detail} (expected ${JSON.stringify(f.expected)}, actual ${JSON.stringify(f.actual)})`);
}
for (const f of last.out.disclosedGaps) console.log(`    DISCLOSED [${f.clause}] ${f.detail}`);
