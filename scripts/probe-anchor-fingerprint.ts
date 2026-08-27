/**
 * ONE ANCHOR FINGERPRINT, THROUGH ALL SIX BOUNDARIES.
 *
 *   npx sucrase-node scripts/probe-anchor-fingerprint.ts
 *
 * scheduler → connector → adapter → assembled week → stored week → projection.
 *
 * At every boundary: ISO date, displayed weekday, numeric `dayOfWeek`, the typed
 * day identity, and the anchor kind. **The point is to catch a day INDEX moving,
 * which a table of weekday names cannot show** — if the ISO date and the numeric
 * index ever disagree about which weekday they are, that is the off-by-one, and
 * it is printed as a mismatch rather than left for the reader to spot.
 *
 * The declared input is echoed first, because a trace whose input the reader has
 * to take on trust settles nothing.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
  'Friday', 'Saturday'];

/** The weekday an ISO date genuinely falls on — computed, never assumed. */
function weekdayOfISO(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const WEEK_START = '2026-07-13';
const INPUT = {
  trainingLocation: 'Commercial gym', equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average',
  seasonPhase: 'In-season', gameDay: 'Sunday', trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
  equipment: ['Full Gym'], teamTrainingDays: ['Wednesday', 'Friday'],
};

console.log('\n════ DECLARED INPUT ════');
console.log(`  weekStart          ${WEEK_START} (${WEEKDAY[weekdayOfISO(WEEK_START)]})`);
console.log(`  teamTrainingDays   ${JSON.stringify(INPUT.teamTrainingDays)}`);
console.log(`  gameDay            ${INPUT.gameDay}`);
console.log(`  preferred gym days ${JSON.stringify(INPUT.preferredTrainingDays)}`);

interface Row {
  boundary: string; dayOfWeek: number; iso: string;
  identity: string; anchor: string;
}
const rows: Row[] = [];

/** The ISO date this week assigns to a numeric weekday index. */
function isoFor(dayOfWeek: number): string {
  const [y, m, d] = WEEK_START.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  // Monday-based: the week starts on its `weekStart` weekday and runs forward.
  const startDow = weekdayOfISO(WEEK_START);
  const offset = ((dayOfWeek - startDow) + 7) % 7;
  return new Date(base + offset * 86400000).toISOString().slice(0, 10);
}

function record(boundary: string, dayOfWeek: number, identity: string,
  anchor: string, iso?: string): void {
  rows.push({ boundary, dayOfWeek, iso: iso ?? isoFor(dayOfWeek), identity, anchor });
}

/* eslint-disable @typescript-eslint/no-var-requires */
const scheduler = require('../src/rules/weeklyScheduler');
const connector = require('../src/rules/scheduleToCoachingPlan');
const program = require('../src/data/defaultProgram');
const assembler = require('../src/rules/assembleAuthoredWeek');

const realSchedule = scheduler.scheduleWeek;
scheduler.scheduleWeek = function wrapped(...args: unknown[]) {
  const out = realSchedule.apply(this, args);
  for (const day of out?.days ?? []) {
    record('1 scheduler', day.dayOfWeek,
      `${day.purpose ?? day.owner}`,
      day.game ? 'game' : day.clubTraining ? 'club_training' : '—',
      day.dateISO);
  }
  return out;
};

const realConnector = connector.scheduleToCoachingPlan;
connector.scheduleToCoachingPlan = function wrapped(...args: unknown[]) {
  const plan = realConnector.apply(this, args);
  for (const entry of plan?.weeklyPlan ?? []) {
    record('2 connector', WEEKDAY.indexOf(String(entry.dayOfWeek)),
      JSON.stringify(entry.authoredDay?.components ?? []),
      entry.authoredDay?.anchor ?? '—');
  }
  return plan;
};

const realAdapter = program.buildWorkoutsFromCoach;
program.buildWorkoutsFromCoach = function wrapped(...args: unknown[]) {
  const built = realAdapter.apply(this, args);
  for (const w of built ?? []) {
    record('3 adapter', w.dayOfWeek, w.workoutType, w.authoredDay?.anchor ?? '—');
  }
  return built;
};

const realAssemble = assembler.assembleAuthoredWeek;
assembler.assembleAuthoredWeek = function wrapped(...args: unknown[]) {
  const out = realAssemble.apply(this, args);
  for (const w of out.workouts) {
    record('4 assembled', w.dayOfWeek, w.workoutType, w.authoredDay?.anchor ?? '—');
  }
  return out;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../src/services/api/generateProgram');
const built = generateProgramLocally(INPUT as never,
  { todayISO: WEEK_START, blockNumber: 1, microcycleLimit: 1 } as never);
const finalWorkouts = built.microcycles[0].workouts as any[];

// Stored-output retyping is retired. Persistence contains accepted inputs;
// test:program-hydration-ownership exercises their actual reconstruction.

// ── 6: THE PRINTED PROJECTION, by date.
for (const w of finalWorkouts) {
  record('6 projection', w.dayOfWeek, `${w.workoutType} · ${w.name}`,
    w.isTeamDay ? 'club_training' : w.workoutType === 'Game' ? 'game' : '—');
}

console.log('\n════ COMPILER/PROJECTION BOUNDARIES — NOT A STORAGE TEST ════\n');
console.log('boundary      dow  ISO date    weekday(ISO)  weekday(index)  match  anchor        identity');
console.log('-'.repeat(112));
let mismatches = 0;
for (const r of rows.sort((a, b) =>
  a.boundary.localeCompare(b.boundary) || a.dayOfWeek - b.dayOfWeek)) {
  const fromISO = WEEKDAY[weekdayOfISO(r.iso)];
  const fromIndex = WEEKDAY[r.dayOfWeek];
  const ok = fromISO === fromIndex;
  if (!ok) mismatches += 1;
  console.log(`${r.boundary.padEnd(13)} ${String(r.dayOfWeek).padEnd(4)} ${r.iso}  `
    + `${fromISO.padEnd(13)} ${fromIndex.padEnd(15)} ${(ok ? 'ok' : 'SHIFT').padEnd(6)} `
    + `${(r.anchor ?? '—').padEnd(13)} ${r.identity}`);
}

console.log('\n════ ANCHOR FINGERPRINT PER BOUNDARY ════\n');
const boundaries = [...new Set(rows.map((r) => r.boundary))].sort();
for (const b of boundaries) {
  const club = rows.filter((r) => r.boundary === b && r.anchor === 'club_training')
    .map((r) => `${WEEKDAY[r.dayOfWeek]}(${r.dayOfWeek})`);
  const game = rows.filter((r) => r.boundary === b && r.anchor === 'game')
    .map((r) => `${WEEKDAY[r.dayOfWeek]}(${r.dayOfWeek})`);
  console.log(`${b.padEnd(13)} club=${JSON.stringify(club).padEnd(34)} game=${JSON.stringify(game)}`);
}

console.log(`\nindex/date disagreements: ${mismatches}`);
// DEDUPED BY WEEKDAY. Boundaries 1 and 2 are entered more than once per
// generation — the generator schedules, then schedules again for the candidate —
// so the raw rows repeat. Counting rows there would report "six club nights" and
// invent an anchor defect out of a probe artefact.
const declaredClub = INPUT.teamTrainingDays.slice().sort().join(',');
for (const b of boundaries) {
  const club = [...new Set(rows
    .filter((r) => r.boundary === b && r.anchor === 'club_training')
    .map((r) => WEEKDAY[r.dayOfWeek]))].sort().join(',');
  console.log(`${club === declaredClub ? 'ok   ' : '⚠ '}${b.padEnd(13)} `
    + `club=[${club}]${club === declaredClub ? '' : ` — input declared [${declaredClub}]`}`);
}
