/**
 * THE EXACT REMAINING CALLERS OF THE LEGACY PLANNER, WITH EXECUTION COUNTS.
 *
 *   npx sucrase-node scripts/probe-planner-callers.ts
 *
 * **Sam, 2026-08-15:** *"If zero execution and physical deletion are not achieved
 * this session, stop with the exact remaining caller. Do not describe it as 'one
 * connector away' again without execution proof."*
 *
 * So this does not grep for call sites — grep finds text. It wraps
 * `buildCoachingPlan`, reads the STACK of every real execution across the whole
 * 180-world corpus, and attributes each one to the file and line that made it.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const engine = require('../src/utils/coachingEngine');

const callers = new Map<string, number>();
let executions = 0;

const realBuild = engine.buildCoachingPlan;
engine.buildCoachingPlan = function wrapped(...args: unknown[]) {
  executions += 1;
  const stack = String(new Error('trace').stack ?? '').split('\n');
  // Frame 0 is the Error, frame 1 is this wrapper; frame 2 is the real caller.
  const frame = stack.slice(2).find((line) => !line.includes('probe-planner-callers'))
    ?? '(unknown)';
  const cleaned = frame.trim()
    .replace(/^at\s+/, '')
    .replace(/.*\/(src\/[^)]+)\)?$/, '$1');
  callers.set(cleaned, (callers.get(cleaned) ?? 0) + 1);
  return realBuild.apply(this, args);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../src/services/api/generateProgram');

const BASE = {
  trainingLocation: 'Commercial gym', equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average',
  gameDay: 'Saturday',
};
const DAYS: Record<number, string[]> = {
  2: ['Tuesday', 'Thursday'], 3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const KITS = [['Full Gym'], ['Bodyweight Only'], ['Dumbbells', 'Bands']];

let worlds = 0;
for (const seasonPhase of ['In-season', 'Pre-season', 'Off-season']) {
  for (const d of [2, 3, 4, 5, 6]) {
    for (const club of [true, false]) {
      for (const eq of KITS) {
        for (const wk of [1, 2]) {
          const pref = DAYS[d];
          worlds += 1;
          try {
            generateProgramLocally({
              ...BASE, seasonPhase, trainingDaysPerWeek: d, preferredTrainingDays: pref,
              equipment: eq,
              teamTrainingDays: club ? ['Tuesday', 'Thursday'].filter((x) => pref.includes(x)) : [],
            } as never, { todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: wk } as never);
          } catch { /* a refusal still executed the planner */ }
        }
      }
    }
  }
}

console.log(`\nworlds: ${worlds}`);
console.log(`buildCoachingPlan EXECUTIONS: ${executions}    TARGET: 0`);
console.log('\nEXACT REMAINING CALLERS (by executing stack frame):');
for (const [caller, count] of [...callers.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(4)}  ${caller}`);
}
if (executions === 0) console.log('\nZERO EXECUTIONS — the legacy planner is unreachable.');
