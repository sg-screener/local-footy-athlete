/**
 * THE ANCHOR WEEK, AS THE ATHLETE RECEIVES IT.
 *
 *   npx sucrase-node scripts/print-anchor-week.ts
 *
 * The in-season world Sam asked to see: club training on two nights, a fixture,
 * and gym access that OVERLAPS both club nights. Printed from the real
 * generator's final output — not from the scheduler's intention, which is the
 * thing that used to look fine while the athlete's week did not.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../src/services/api/generateProgram');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const program = generateProgramLocally({
  trainingLocation: 'Commercial gym', equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average',
  seasonPhase: 'In-season', gameDay: 'Sunday', trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
  equipment: ['Full Gym'], teamTrainingDays: ['Wednesday', 'Friday'],
} as never, { todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1 } as never);

const workouts = program.microcycles[0].workouts as any[];
console.log('\nIN-SEASON · 4 gym days · CLUB Wed+Fri · GAME Sunday\n');
console.log('| Day | Type | Team? | Session | Rows |');
console.log('| --- | --- | --- | --- | ---: |');
for (let d = 1; d <= 7; d += 1) {
  const w = workouts.find((x) => x.dayOfWeek === d % 7);
  if (!w) { console.log(`| ${DAYS[d % 7]} | (absent) | | | |`); continue; }
  console.log(`| ${DAYS[d % 7]} | ${w.workoutType} | ${w.isTeamDay ? 'club' : ''} `
    + `| ${w.name} | ${(w.exercises ?? []).length} |`);
}
for (let d = 1; d <= 7; d += 1) {
  const w = workouts.find((x) => x.dayOfWeek === d % 7);
  const rows = (w?.exercises ?? []) as any[];
  if (rows.length === 0) continue;
  console.log(`\n${DAYS[d % 7]} — ${w.workoutType}`);
  for (const row of rows) {
    const role = row.section18Evidence?.role ?? row.role ?? '';
    console.log(`   ${(row.exercise?.name ?? row.name ?? '?')}`
      + `${role ? `  [${role}]` : ''}  ${row.sets ?? ''}x${row.repsMin ?? ''}-${row.repsMax ?? ''}`);
  }
}
