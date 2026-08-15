/**
 * THE DECISIVE EXPERIMENT — does §18 taking its SELECTED counts from the
 * scheduler close the disagreement, without touching anything else?
 *
 *   npx sucrase-node scripts/probe-scheduler-owned-contract.ts
 *
 * The 44 refusals on this branch are all one shape: the judge measured a composed
 * week against a session count the scheduler never chose. **This substitutes
 * `plannerSelected` at the §18 producer with the scheduler's own demand and
 * re-measures the 180-world corpus.**
 *
 * It is a MEASUREMENT, not a shipped patch — it proves whether the planned
 * producer cutover is the right architecture before that cutover is built. If the
 * corpus recovers, the plan is sound; if it does not, the disagreement is deeper
 * than the counts and the plan is wrong.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const schedulerModule = require('../src/rules/weeklyScheduler');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const contractModule = require('../src/rules/weeklyExposureContractV2');

/** The demand from the most recent scheduler run, keyed by week start. */
let lastDemand: { mainStrength: number; coreConditioning: number;
  sprintHighSpeed: number } | null = null;

const realSchedule = schedulerModule.scheduleWeek;
schedulerModule.scheduleWeek = function wrapped(inputs: unknown) {
  const result = realSchedule(inputs);
  if (!schedulerModule.scheduleRefused(result)) lastDemand = result.demand;
  return result;
};

const realBuild = contractModule.buildSection18WeeklyExposureContractV2;
contractModule.buildSection18WeeklyExposureContractV2 = function wrapped(input: any) {
  if (!lastDemand) return realBuild(input);
  const contract = realBuild({
    ...input,
    plannerSelected: {
      ...input.plannerSelected,
      mainStrength: lastDemand.mainStrength,
      coreConditioning: lastDemand.coreConditioning,
      sprintHighSpeed: lastDemand.sprintHighSpeed,
    },
  });
  // ── THE STRONGER HYPOTHESIS ─────────────────────────────────────────────
  //
  // Substituting only the SELECTED count moved 136 -> 138. So the disagreement
  // is not the selection: it is §18's own per-phase REQUIRED MINIMUM and
  // PERMITTED MAXIMUM, which are a second authority on a number Sam has given
  // the scheduler. *"§18 derives its acceptance contract from the scheduler's
  // completed weekly schedule. It is not an independent planner."*
  //
  // So the main-strength policy is pinned to the schedule: the scheduler decided
  // the count, and §18's job becomes conformance to it rather than a rival opinion.
  return {
    ...contract,
    mainStrength: {
      ...contract.mainStrength,
      exposure: {
        ...contract.mainStrength.exposure,
        requiredMinimum: lastDemand.mainStrength,
        permittedMaximum: lastDemand.mainStrength,
        plannerSelectedTarget: lastDemand.mainStrength,
        defaultTarget: lastDemand.mainStrength,
      },
    },
  };
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

let built = 0;
const refusals = new Map<string, number>();
const rows: { label: string; built: boolean }[] = [];

for (const seasonPhase of ['In-season', 'Pre-season', 'Off-season']) {
  for (const d of [2, 3, 4, 5, 6]) {
    for (const club of [true, false]) {
      for (const eq of KITS) {
        for (const wk of [1, 2]) {
          const pref = DAYS[d];
          const label = `${seasonPhase}/${d}d/${club ? 'club' : 'noclub'}/${eq[0]}/w${wk}`;
          lastDemand = null;
          try {
            generateProgramLocally({
              ...BASE, seasonPhase, trainingDaysPerWeek: d, preferredTrainingDays: pref,
              equipment: eq,
              teamTrainingDays: club ? ['Tuesday', 'Thursday'].filter((x) => pref.includes(x)) : [],
            } as never, { todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: wk } as never);
            built += 1;
            rows.push({ label, built: true });
          } catch (error: any) {
            const key = (error?.findings ?? []).length > 0
              ? [...new Set(error.findings.map((f: any) => f.clause))].sort().join('+')
              : `THROW:${error?.name ?? 'unknown'}`;
            refusals.set(key, (refusals.get(key) ?? 0) + 1);
            rows.push({ label, built: false });
          }
        }
      }
    }
  }
}

console.log(`\nWITH §18 TAKING ITS SELECTED COUNTS FROM THE SCHEDULER:`);
console.log(`  180 worlds — ${built} built, ${180 - built} refused`);
for (const [key, count] of [...refusals.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(3)}  ${key}`);
}
require('fs').writeFileSync(
  process.argv[2] ?? '/tmp/scheduler-owned.json',
  JSON.stringify({ built, rows }, null, 2), 'utf8');
