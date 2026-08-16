/**
 * WHAT THE LEGACY WEEKLY PLANNER ACTUALLY CONTRIBUTES, MEASURED BY EXECUTION.
 *
 *   npx sucrase-node scripts/probe-planner-surface.ts
 *
 * **THE COMPLETION CONDITION IS ZERO PRODUCTION EXECUTIONS OF `buildCoachingPlan`**,
 * so the first question is not "how big is coachingEngine" but "which of its
 * outputs does generation still READ". A field nobody reads is a deletion; a field
 * something reads is an extraction with a named destination.
 *
 * This wraps `buildCoachingPlan` and records, per generated world:
 *   - how many times it executed;
 *   - which `CoachingPlan` fields were read afterwards (via a read-tracking proxy).
 *
 * Reading the 9,074-line module would have produced an opinion. This produces a
 * count.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const engine = require('../src/utils/coachingEngine');

let executions = 0;
const fieldReads = new Map<string, number>();

const realBuild = engine.buildCoachingPlan;
engine.buildCoachingPlan = function wrapped(...args: unknown[]) {
  executions += 1;
  const plan = realBuild.apply(this, args);
  return new Proxy(plan as object, {
    get(target, prop, receiver) {
      if (typeof prop === 'string') {
        fieldReads.set(prop, (fieldReads.get(prop) ?? 0) + 1);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
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
          } catch { /* a refusal still executed the planner, which is the point */ }
        }
      }
    }
  }
}

console.log(`\nworlds generated: ${worlds}`);
console.log(`buildCoachingPlan EXECUTIONS: ${executions}`);
console.log(`  = ${(executions / worlds).toFixed(2)} per world`);
console.log('\nCoachingPlan FIELDS READ after construction (read count):');
for (const [field, count] of [...fieldReads.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(6)}  ${field}`);
}
if (executions === 0) {
  console.log('\nZERO EXECUTIONS — the legacy weekly planner is unreachable from generation.');
}
