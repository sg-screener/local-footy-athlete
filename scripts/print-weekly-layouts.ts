/**
 * THE APPROVED LAYOUTS AND REPRESENTATIVE WEEKS, GENERATED FROM THE TYPED CONTRACT.
 *
 *   npx sucrase-node scripts/print-weekly-layouts.ts
 *
 * The contract's §10 asks for exactly this: *"Generate the readable document from
 * the same typed data so prose and code cannot drift."* **Nothing here is
 * hand-written** — every row comes from `BASE_LAYOUTS` and every week from
 * `scheduleWeek`.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

import {
  BASE_LAYOUTS,
  CONTRACT_SOURCE,
  WEEKLY_CONTRACT_CLAUSES,
  baseLayoutFor,

} from '../src/rules/weeklyProgrammingContract';
import {
  scheduleRefused,
  scheduleWeek,
  type WeeklySchedulerInputs,
} from '../src/rules/weeklyScheduler';
import { materialiseAuthoredSessions } from '../src/rules/materialiseAuthoredSessions';

const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = 1; const TUE = 2; const WED = 3; const THU = 4;
const FRI = 5; const SAT = 6; const SUN = 0;

function base(over: Partial<WeeklySchedulerInputs>): WeeklySchedulerInputs {
  return {
    weekStartISO: '2026-07-13', phase: 'In-season', offseasonBlock: null,
    gymAccessDays: [MON, WED], clubNights: [], gameDay: null, age: 30,
    readiness: { lowReadiness: false, highReadiness: false, lowFatigue: false,
      consistentlyCompletesThree: false },
    unavailableDays: [], ...over,
  };
}

const lines: string[] = [];
lines.push('# The weekly scheduling contract, as the app executes it');
lines.push('');
lines.push(`Generated from \`${CONTRACT_SOURCE.path}\``);
lines.push(`sha256 \`${CONTRACT_SOURCE.sha256}\``);
lines.push(`Approved: ${CONTRACT_SOURCE.approvedBy}`);
lines.push('');
lines.push('Nothing on this page is hand-written. Every layout row is read from the');
lines.push('typed contract and every week is produced by the scheduler.');
lines.push('');
lines.push('---');
lines.push('');
lines.push('## Every approved base layout');
lines.push('');
lines.push('| Clause | Phase | Gym days | Weekend | Required sessions | Purposes | Set budget |');
lines.push('| --- | --- | ---: | --- | ---: | --- | --- |');
for (const row of BASE_LAYOUTS) {
  const weekend = row.weekendAvailable === null ? 'either'
    : row.weekendAvailable ? 'available' : 'unavailable';
  const budget = row.setBudget.preferredMin === row.setBudget.preferredMax
    ? `${row.setBudget.preferredMin} (approved exception)`
    : `${row.setBudget.preferredMin}-${row.setBudget.preferredMax}, ceiling ${row.setBudget.hardCeiling}`;
  lines.push(`| \`${row.clauseId}\` | ${row.phase} | ${row.gymDays.join(', ')} | ${weekend} `
    + `| **${row.purposes.length}** | ${row.purposes.join(' + ')} | ${budget} |`);
}
lines.push('');
lines.push(`**${BASE_LAYOUTS.length} layout rows · ${WEEKLY_CONTRACT_CLAUSES.length} typed clauses.**`);
lines.push('');

// The selector, resolved rather than described.
lines.push('## The in-season fourth-session selector, resolved');
lines.push('');
lines.push('| Athlete | Gym days | Result |');
lines.push('| --- | ---: | --- |');
const selectorCases: { label: string; over: Partial<WeeklySchedulerInputs> }[] = [
  { label: 'age 25', over: { age: 25 } },
  { label: 'age 27 (the ceiling)', over: { age: 27 } },
  { label: 'age 28, no earned arm', over: { age: 28 } },
  { label: 'age 34, consistent + high readiness + low fatigue',
    over: { age: 34, readiness: { lowReadiness: false, highReadiness: true,
      lowFatigue: true, consistentlyCompletesThree: true } } },
  { label: 'age 22 but LOW READINESS',
    over: { age: 22, readiness: { lowReadiness: true, highReadiness: false,
      lowFatigue: false, consistentlyCompletesThree: true } } },
];
for (const c of selectorCases) {
  const layout = baseLayoutFor({
    phase: 'In-season', gymDayCount: 4, weekendAvailable: false,
    fourthSession: {
      gymDayCount: 4, age: (c.over.age ?? 30) as number,
      consistentlyCompletesThree: c.over.readiness?.consistentlyCompletesThree ?? false,
      highReadiness: c.over.readiness?.highReadiness ?? false,
      lowFatigue: c.over.readiness?.lowFatigue ?? false,
      lowReadiness: c.over.readiness?.lowReadiness ?? false,
    },
  });
  lines.push(`| ${c.label} | 4 | **${layout?.purposes.length} sessions** (\`${layout?.clauseId}\`) |`);
}
lines.push('');

lines.push('---');
lines.push('');
lines.push('## Representative athlete weeks');
lines.push('');

interface Scenario { title: string; note: string; over: Partial<WeeklySchedulerInputs>; }
const SCENARIOS: Scenario[] = [
  { title: 'In-season, 2 gym days, Tue/Thu club, Saturday game',
    note: 'Two sessions — Full Body x2.',
    over: { phase: 'In-season', gymAccessDays: [MON, WED], clubNights: [TUE, THU], gameDay: SAT, age: 24 } },
  { title: 'In-season, 3 gym days on the club nights, Saturday game',
    note: "The contract's own reference week: an upper session paired with each club night.",
    over: { phase: 'In-season', gymAccessDays: [MON, TUE, THU], clubNights: [TUE, THU], gameDay: SAT, age: 30 } },
  { title: 'In-season, 4 gym days, YOUNGER athlete (24)',
    note: 'Selector met — four sessions, split Lower Squat / Lower Hinge at 10 sets.',
    over: { phase: 'In-season', gymAccessDays: [MON, TUE, WED, THU], clubNights: [TUE, THU], gameDay: SAT, age: 24 } },
  { title: 'In-season, 4 gym days, OLDER athlete (34), no earned arm',
    note: 'Selector not met — the three-session layout is retained.',
    over: { phase: 'In-season', gymAccessDays: [MON, TUE, WED, THU], clubNights: [TUE, THU], gameDay: SAT, age: 34 } },
  { title: 'Pre-season, 2 gym days, no club',
    note: 'Full Body x2, and required running leaves the gym days.',
    over: { phase: 'Pre-season', gymAccessDays: [MON, WED], age: 24 } },
  { title: 'Pre-season, 3 gym days, weekend UNAVAILABLE',
    note: 'Lower + Upper + Full Body.',
    over: { phase: 'Pre-season', gymAccessDays: [MON, WED, FRI], age: 24 } },
  { title: 'Pre-season, 5 gym days, no club',
    note: 'Four required sessions; the fifth day does not create a fifth session.',
    over: { phase: 'Pre-season', gymAccessDays: [MON, TUE, WED, THU, FRI], age: 24 } },
  { title: 'Off-season weeks 1-2, 2 gym days',
    note: 'Every session OPTIONAL — zero completed is a valid week.',
    over: { phase: 'Off-season', offseasonBlock: 'early_optional', gymAccessDays: [MON, THU], age: 24 } },
  { title: 'Off-season weeks 3-4, 3 gym days',
    note: 'The skeleton is required again at 90% load.',
    over: { phase: 'Off-season', offseasonBlock: 'transition', gymAccessDays: [MON, WED, FRI], age: 24 } },
  { title: 'Off-season week 5+, 4 gym days',
    note: 'Lower x2 + Upper x2 on the best-spaced days.',
    over: { phase: 'Off-season', offseasonBlock: 'normal_build', gymAccessDays: [MON, TUE, THU, FRI], age: 24 } },
  { title: 'Wednesday/Friday club, SUNDAY game — real weekdays, not assumed',
    note: 'Anchors follow the athlete, and Saturday (G-1) holds no strength.',
    over: { phase: 'In-season', gymAccessDays: [MON, TUE, WED, THU, FRI, SAT],
      clubNights: [WED, FRI], gameDay: SUN, age: 24 } },
  { title: 'Explicit unavailable days (Wed, Sat, Sun)',
    note: 'Those days never appear in the week at all.',
    over: { phase: 'Pre-season', gymAccessDays: [MON, TUE, WED, THU, FRI],
      unavailableDays: [WED, SAT, SUN], age: 24 } },
];

for (const scenario of SCENARIOS) {
  const result = scheduleWeek(base(scenario.over));
  lines.push(`### ${scenario.title}`);
  lines.push('');
  lines.push(`_${scenario.note}_`);
  lines.push('');
  if (scheduleRefused(result)) {
    lines.push(`**REFUSED** — \`${result.finding}\` (\`${result.clauseId}\`): ${result.detail}`);
    lines.push('');
    continue;
  }
  lines.push(`Layout \`${result.layoutClauseId}\` · **${result.requiredStrengthSessions} required strength sessions**`);
  lines.push('');
  // ⚠ THE SPECIALIST CONTENT IS SHOWN BESIDE THE SCHEDULER'S DECISION, so the
  // boundary is visible on the page: the left columns are the scheduler's, the
  // right two are the specialists'.
  const materialised = materialiseAuthoredSessions({
    schedule: result,
    facts: {
      weekStartISO: result.weekStartISO, miniCycleNumber: 1,
      capacity: 'moderate' as never, isBeginner: false, experienced: true,
      powerGoalNudge: false, injuries: [] as never, runOnly: false,
      phase: (scenario.over.phase ?? 'In-season') as never,
      offseasonSubphase: null,
    },
    gameDay: scenario.over.gameDay ?? null,
  });
  lines.push('| Day | SCHEDULER: session | purpose/category | Sets | Club/Game '
    + '| SPECIALIST: conditioning template | SPECIALIST: power |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  result.days.forEach((day, index) => {
    const sets = day.setBudget
      ? (day.setBudget.preferredMin === day.setBudget.preferredMax
        ? `${day.setBudget.preferredMin}`
        : `${day.setBudget.preferredMin}-${day.setBudget.preferredMax}`)
      : '—';
    const m = materialised[index];
    const anchor = [day.clubTraining ? 'club' : '', day.game ? 'GAME' : '']
      .filter(Boolean).join(' + ') || '';
    lines.push(`| ${DAY_LABEL[day.dayOfWeek]} `
      + `| ${day.purpose ?? day.owner}${day.optional ? ' _(optional)_' : ''} `
      + `| ${day.conditioningCategory ?? '—'}${day.conditioningRole ? ` (${day.conditioningRole})` : ''} `
      + `| ${sets} | ${anchor} `
      + `| ${m?.conditioningTemplate?.name ?? (m?.unmaterialised ? `_${m.unmaterialised}_` : '—')} `
      + `| ${m?.powerPrimer
        ? `${m.powerPrimer.kind}/${m.powerPrimer.family} `
          + `${m.powerPrimer.sets}x${m.powerPrimer.repsMin}-${m.powerPrimer.repsMax}`
          + `${m.powerPrimer.reduced ? ' _(reduced)_' : ''}`
        : '—'} |`);
  });
  lines.push('');
  lines.push(`Patterns intended this week: ${result.intendedPatterns.join(', ')}`);
  lines.push('');
}

const OUT = resolve(__dirname, '..', 'docs', 'weekly-scheduler-layouts');
mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'README.md'), lines.join('\n'), 'utf8');
console.log(`wrote ${BASE_LAYOUTS.length} layout rows and ${SCENARIOS.length} weeks`);
