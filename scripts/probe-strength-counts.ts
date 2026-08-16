/**
 * ACCEPTED STRENGTH-SESSION COUNTS ACROSS EVERY BUILT WORLD.
 *
 *   npx sucrase-node scripts/probe-strength-counts.ts
 *
 * **Sam, 2026-08-16:** *"A non-early-off-season week with only one strength session
 * is NOT currently authorised. If any exist, stop and report them rather than
 * silently treating 'one fits' as sufficient."*
 *
 * The reduction ladder descends to a single session. That is correct as a LAST
 * rung only where the contract authorises it — early off-season, where every
 * session is optional and "zero completed is valid". Anywhere else a one-session
 * week is an unauthorised shape wearing the word "reduced", so this counts the
 * DELIVERED main-strength days in every built world and names every offender.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../src/services/api/generateProgram');

const DAYS: Record<number, string[]> = {
  2: ['Tuesday', 'Thursday'], 3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const KITS = [['Full Gym'], ['Bodyweight Only'], ['Dumbbells', 'Bands']];

const histogram = new Map<number, number>();
const offenders: string[] = [];
const reduced: string[] = [];
let built = 0;
let refused = 0;

for (const seasonPhase of ['In-season', 'Pre-season', 'Off-season']) {
  for (const d of [2, 3, 4, 5, 6]) {
    for (const club of [true, false]) {
      for (const eq of KITS) {
        for (const wk of [1, 2]) {
          const pref = DAYS[d];
          const label = `${seasonPhase}/${d}d/${club ? 'club' : 'noclub'}/${eq[0]}/w${wk}`;
          try {
            const program = generateProgramLocally({
              trainingLocation: 'Commercial gym', equipmentSelectionCompleteness: 'complete',
              recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average',
              gameDay: 'Saturday', seasonPhase, trainingDaysPerWeek: d,
              preferredTrainingDays: pref, equipment: eq,
              teamTrainingDays: club
                ? ['Tuesday', 'Thursday'].filter((x) => pref.includes(x)) : [],
            } as never, { todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: wk } as never);
            built += 1;
            const mc = program.microcycles[0];
            // A day is a STRENGTH day when it actually delivered a main lift —
            // the declared role, not the workout's name.
            const strengthDays = (mc.workouts as any[]).filter((w) =>
              (w.exercises ?? []).some((row: any) =>
                row.section18Evidence?.role === 'main_strength')).length;
            histogram.set(strengthDays, (histogram.get(strengthDays) ?? 0) + 1);
            const earlyOffseason = seasonPhase === 'Off-season'
              && String((mc as any).weekKind ?? '').length >= 0
              && (program as any).blockState?.phaseResolution?.offseasonSubphase === 'early_offseason';
            if (strengthDays <= 1 && !earlyOffseason) {
              offenders.push(`${label}: ${strengthDays} strength session(s)`);
            }
            for (const entry of (mc.exposureContract as any)?.reductions ?? []) {
              if (entry.domain === 'main_strength') {
                reduced.push(`${label}: ${entry.from}->${entry.to} ${entry.detail}`);
              }
            }
          } catch { refused += 1; }
        }
      }
    }
  }
}

console.log(`\nBUILT ${built} · REFUSED ${refused}\n`);
console.log('DELIVERED STRENGTH SESSIONS PER BUILT WEEK');
for (const count of [...histogram.keys()].sort((a, b) => a - b)) {
  console.log(`  ${count} session(s): ${histogram.get(count)} world(s)`);
}
console.log(`\nUNAUTHORISED ONE-SESSION WEEKS (non-early-off-season): ${offenders.length}`);
for (const o of offenders.slice(0, 20)) console.log(`  ${o}`);
console.log(`\nWORLDS CARRYING A MAIN-STRENGTH REDUCTION RECORD: ${reduced.length}`);
for (const r of reduced.slice(0, 6)) console.log(`  ${r}`);
