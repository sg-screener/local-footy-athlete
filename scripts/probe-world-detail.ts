/**
 * ONE WORLD, TRACED — the planner's intents, the composer's answer, the verdict.
 *
 *   npx sucrase-node scripts/probe-world-detail.ts "In-season/2d/club/Full Gym/w1"
 *
 * It calls the composer through its OWN production inputs by instrumenting the
 * seam rather than re-deriving them: `composedPlannedDaysFrom` and `composeWeek`
 * are wrapped, the real `generateProgramLocally` runs, and what the wrappers saw
 * is printed. Nothing here builds a second plan.
 */
declare global {
  // eslint-disable-next-line no-var
  var __DEV__: boolean;
}
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as composeWeekModule from '../src/rules/composeWeek';
import * as plannedDaysModule from '../src/rules/composerPlannedDays';

const seen: { plannedDays?: unknown; inputs?: any; composed?: any }[] = [];

const realPlanned = plannedDaysModule.composedPlannedDaysFrom;
(plannedDaysModule as any).composedPlannedDaysFrom = function wrapped(plan: any) {
  const out = realPlanned(plan);
  seen.push({ plannedDays: out });
  return out;
};
const realCompose = composeWeekModule.composeWeek;
(composeWeekModule as any).composeWeek = function wrapped(inputs: any) {
  const composed = realCompose(inputs);
  seen[seen.length - 1] = { ...(seen[seen.length - 1] ?? {}), inputs, composed };
  return composed;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../src/services/api/generateProgram');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolveEquipmentCapabilities } = require('../src/utils/equipmentAvailability');

const BASE = {
  trainingLocation: 'Commercial gym',
  equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average',
  gameDay: 'Saturday',
};
const DAYS: Record<number, string[]> = {
  2: ['Tuesday', 'Thursday'],
  3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const KIT_FOR: Record<string, string[]> = {
  'Full Gym': ['Full Gym'],
  'Bodyweight Only': ['Bodyweight Only'],
  Dumbbells: ['Dumbbells', 'Bands'],
};

const spec = process.argv[2] ?? 'In-season/2d/club/Full Gym/w1';
const [seasonPhase, daysRaw, clubRaw, kitName, weekRaw] = spec.split('/');
const trainingDaysPerWeek = Number(daysRaw.replace('d', ''));
const club = clubRaw === 'club';
const week = Number(weekRaw.replace('w', ''));
const preferredTrainingDays = DAYS[trainingDaysPerWeek];
const profile = {
  ...BASE,
  seasonPhase,
  trainingDaysPerWeek,
  preferredTrainingDays,
  equipment: KIT_FOR[kitName],
  teamTrainingDays: club
    ? ['Tuesday', 'Thursday'].filter((day) => preferredTrainingDays.includes(day))
    : [],
};

console.log(`\n══ ${spec} ══`);
console.log(`kit tags: ${JSON.stringify(resolveEquipmentCapabilities(profile).tags)}`);

let program: any = null;
let error: any = null;
try {
  program = generateProgramLocally(profile, {
    todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: week,
  });
} catch (err) {
  error = err;
}

const target = seen[week - 1] ?? seen[seen.length - 1];

console.log('\n── PLANNER STRENGTH DAYS HANDED TO THE COMPOSER ──');
for (const day of (target?.plannedDays as any[]) ?? []) {
  console.log(`  day ${day.dayOfWeek} team=${day.isTeamDay} tier=${day.sessionTier} `
    + `archetype=${day.strengthIntent?.archetype} `
    + `plannedPatterns=${JSON.stringify(day.strengthIntent?.plannedPatterns)}`);
  console.log(`      name="${day.name}"`);
}

console.log('\n── THE COMPOSER\'S ANSWER ──');
if (target?.composed) {
  const c = target.composed;
  console.log(`  sessionCount: requested=${c.sessionCount.requested} composed=${c.sessionCount.composed} `
    + `adjustment=${JSON.stringify(c.sessionCount.adjustment)}`);
  console.log(`  kitUnachievablePatterns=${JSON.stringify(c.kitUnachievablePatterns)}`);
  for (const day of c.days) {
    console.log(`  day ${day.dayOfWeek} kind=${day.kind} slots=${JSON.stringify(day.requiredSlots)}`);
    for (const row of day.rows) {
      console.log(`      ${row.role === 'main_strength' ? 'MAIN' : '    '} `
        + `${row.identity} [${row.slot}] pattern=${row.mainStrengthPattern ?? '-'} `
        + `${row.sets}x${row.repsMin}-${row.repsMax} @${row.load}`);
    }
  }
  if (c.gaps.length) {
    console.log(`  GAPS: ${c.gaps.length}`);
    for (const gap of c.gaps) console.log(`      ${JSON.stringify(gap)}`);
  }
} else {
  console.log('  (the composer was never reached)');
}

console.log('\n── VERDICT ──');
if (error) {
  console.log(`  REFUSED: ${error.name}: ${error.message}`);
  for (const f of (error.findings ?? [])) {
    console.log(`      [${f.clause}] ${f.severity} — ${f.detail} `
      + `(expected ${JSON.stringify(f.expected)}, actual ${JSON.stringify(f.actual)})`);
  }
} else {
  console.log('  BUILT');
  const workouts = program?.microcycles?.[week - 1]?.workouts ?? [];
  for (const w of workouts) {
    console.log(`  day ${w.dayOfWeek} "${w.name}" type=${w.workoutType} tier=${w.sessionTier} `
      + `rows=${(w.exercises ?? []).length}`);
    for (const ex of (w.exercises ?? [])) {
      const ev = ex.section18Evidence;
      console.log(`      ${ex.name} — ${ex.sets}x${ex.reps} `
        + `role=${ev?.role ?? ex.role ?? '-'} main=${ev?.mainStrengthPattern ?? '-'}`);
    }
  }
}
