/**
 * WHERE THE ANCHOR DIES — one athlete, every stage, side by side.
 *
 *   npx sucrase-node scripts/probe-anchor-loss.ts
 *
 * I have already misdiagnosed this once by reading the code and reasoning about
 * it: I reported the connector dropping club anchors, and tracing showed the
 * connector AND the adapter were both correct. So this observes the ACTUAL
 * VALUES at each stage of one real generation instead.
 *
 * It prints, per weekday: what the scheduler authored, what the connector
 * translated, what the adapter built. **The first column where a club night or
 * the fixture stops being itself is the owner of the defect** — and nothing here
 * is inferred from a name.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

/* eslint-disable @typescript-eslint/no-var-requires */
const scheduler = require('../src/rules/weeklyScheduler');
const connector = require('../src/rules/scheduleToCoachingPlan');
const program = require('../src/data/defaultProgram');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const stages = new Map<number, Record<string, string>>();
for (let d = 0; d < 7; d += 1) stages.set(d, { day: DAYS[d] });
const note = (day: number, key: string, value: unknown): void => {
  const row = stages.get(day);
  if (row) row[key] = String(value ?? '—');
};

// ── STAGE 1: the scheduler's seven-day week ────────────────────────────────
const realSchedule = scheduler.scheduleWeek;
scheduler.scheduleWeek = function wrapped(...args: unknown[]) {
  const out = realSchedule.apply(this, args);
  for (const authored of out?.days ?? []) {
    note(authored.dayOfWeek, 'SCHEDULER',
      `${authored.purpose ?? authored.owner}`
      + `${authored.clubTraining ? ' +CLUB' : ''}${authored.game ? ' +GAME' : ''}`);
  }
  return out;
};

// ── STAGE 2: the connector's allocations ───────────────────────────────────
const realConnector = connector.scheduleToCoachingPlan;
connector.scheduleToCoachingPlan = function wrapped(...args: unknown[]) {
  const plan = realConnector.apply(this, args);
  for (const entry of plan?.weeklyPlan ?? []) {
    const day = DAYS.indexOf(String(entry.dayOfWeek).slice(0, 3));
    note(day, 'CONNECTOR',
      `${entry.focus}${entry.isTeamDay ? ' +CLUB' : ''}`);
  }
  return plan;
};

// ── STAGE 3: the adapter's workouts ────────────────────────────────────────
const realAdapter = program.buildWorkoutsFromCoach;
program.buildWorkoutsFromCoach = function wrapped(...args: unknown[]) {
  const built = realAdapter.apply(this, args);
  for (const workout of built ?? []) {
    note(workout.dayOfWeek, 'ADAPTER',
      `${workout.workoutType}${workout.isTeamDay ? ' +CLUB' : ''}`);
  }
  return built;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../src/services/api/generateProgram');

let refusal: string | null = null;
let final: any[] = [];
try {
  const built = generateProgramLocally({
    trainingLocation: 'Commercial gym', equipmentSelectionCompleteness: 'complete',
    recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average',
    seasonPhase: 'In-season', gameDay: 'Sunday', trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
    equipment: ['Full Gym'], teamTrainingDays: ['Wednesday', 'Friday'],
  } as never, { todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1 } as never);
  final = built?.microcycles?.[0]?.workouts ?? [];
} catch (error: any) {
  refusal = String(error?.message ?? error);
}
for (const workout of final) {
  note(workout.dayOfWeek, 'FINAL',
    `${workout.workoutType}${workout.isTeamDay ? ' +CLUB' : ''}`);
}

console.log('\nATHLETE: In-season, 4 gym days, CLUB Wed+Fri, GAME Sunday\n');
const COLS = ['day', 'SCHEDULER', 'CONNECTOR', 'ADAPTER', 'FINAL'];
const width = (c: string) => Math.max(c.length,
  ...[...stages.values()].map((r) => (r[c] ?? '—').length));
console.log(COLS.map((c) => c.padEnd(width(c))).join('  '));
console.log(COLS.map((c) => '-'.repeat(width(c))).join('  '));
for (let d = 1; d <= 7; d += 1) {
  const row = stages.get(d % 7)!;
  console.log(COLS.map((c) => (row[c] ?? '—').padEnd(width(c))).join('  '));
}
if (refusal) console.log(`\nREFUSED: ${refusal}`);
