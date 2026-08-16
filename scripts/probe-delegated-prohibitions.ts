/**
 * THE 12 DELEGATED PROHIBITIONS — one EXECUTED pressure world each.
 *
 *   npx sucrase-node scripts/probe-delegated-prohibitions.ts
 *
 * **Sam, 2026-08-16:** *"prove it behaviorally with one executed pressure-world
 * receipt. If any prohibition can still reach scoring or depends on an unverified
 * downstream check, move that prohibition into the canonical legality owner."*
 *
 * Each rule in `LEGALITY_RULES` that only NAMES another owner is a claim. This
 * runs a world engineered to break it and reports what actually happened, so the
 * claim becomes a receipt or a defect. **Nothing here is inferred from reading the
 * named owner** — the previous audit script did exactly that and was wrong about
 * most of what it reported.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

/* eslint-disable @typescript-eslint/no-var-requires */
const { scheduleWeek } = require('../src/rules/weeklyScheduler');
const { GLOBAL_RULES, PURPOSE_IS_LOWER, baseLayoutFor } = require('../src/rules/weeklyProgrammingContract');

const BASE = {
  weekStartISO: '2026-07-13', phase: 'In-season', offseasonBlock: null,
  gymAccessDays: [1, 2, 3, 4, 5, 6, 0], clubNights: [], gameDay: null,
  fixtureRecurrence: 'recurring', age: 24,
  readiness: { lowReadiness: false, highReadiness: false, lowFatigue: false,
    consistentlyCompletesThree: false },
  unavailableDays: [],
};
const sched = (over: Record<string, unknown>) => scheduleWeek({ ...BASE, ...over });

interface Receipt { clause: string; world: string; observed: string; held: boolean }
const receipts: Receipt[] = [];
const add = (clause: string, world: string, observed: string, held: boolean) =>
  receipts.push({ clause, world, observed, held });

const strengthDays = (r: any) =>
  r?.refused ? [] : r.days.filter((d: any) => d.owner === 'strength');
const runningDays = (r: any) =>
  r?.refused ? [] : r.days.filter((d: any) => d.conditioning === 'running'
    || d.conditioning === 'sprint_high_speed');

/** Longest consecutive run, Monday-first. */
function longestRun(days: number[]): number {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const set = new Set(days);
  let run = 0; let longest = 0;
  for (const d of order) { run = set.has(d) ? run + 1 : 0; longest = Math.max(longest, run); }
  return longest;
}

// ── WC-030 — 16 main/secondary sets is a HARD CEILING ─────────────────────
{
  let worst = 0; let worstAt = '';
  for (const phase of ['In-season', 'Pre-season', 'Off-season']) {
    for (let days = 2; days <= 6; days += 1) {
      const layout = baseLayoutFor({ phase, availableGymDays: days, offseasonBlock: null,
        weekendAvailable: true, useFourInSeason: true });
      const budget = layout?.setBudget;
      const total = (budget?.main ?? 0) + (budget?.secondary ?? 0);
      if (total > worst) { worst = total; worstAt = `${phase}/${days}d`; }
    }
  }
  add('WC-030', 'every phase x availability layout, worst set budget',
    `max main+secondary = ${worst} at ${worstAt}; ceiling 16`, worst <= 16);
}

// ── WC-044 — no more than 3 consecutive running days ──────────────────────
{
  const r = sched({ phase: 'Pre-season', gymAccessDays: [1, 3, 5], gameDay: null });
  const days = runningDays(r).map((d: any) => d.dayOfWeek);
  add('WC-044', 'pre-season, wide availability, app supplies all running',
    `running days ${JSON.stringify(days)}, longest run ${longestRun(days)}, max ${GLOBAL_RULES.runningStreakMaximum}`,
    longestRun(days) <= GLOBAL_RULES.runningStreakMaximum);
}

// ── WC-045 — conditioning exposures capped at 5, anchors counting ─────────
{
  const r = sched({ clubNights: [2, 3, 4], gameDay: 6, gymAccessDays: [1, 2, 3, 4, 5] });
  const total = r?.refused ? null : r.demand.coreConditioning;
  add('WC-045', '3 club nights + a game + app conditioning (max anchor pressure)',
    r?.refused ? `refused: ${r.finding}` : `coreConditioning=${total}, cap ${GLOBAL_RULES.conditioning.max}`,
    r?.refused || total <= GLOBAL_RULES.conditioning.max);
}

// ── WC-046 — running maximum 4 ────────────────────────────────────────────
{
  const r = sched({ phase: 'Off-season', offseasonBlock: 'late_offseason',
    gymAccessDays: [1, 3, 5], gameDay: null });
  const count = r?.refused ? null : r.demand.running;
  add('WC-046', 'off-season, no anchors, app supplies every running day',
    r?.refused ? `refused: ${r.finding}` : `running=${count}, max ${GLOBAL_RULES.running.max}`,
    r?.refused || count <= GLOBAL_RULES.running.max);
}

// ── WC-048 — 7 app-authored strength movements is a DAILY ceiling ─────────
// End-to-end: the composer owns this, so it is measured on the built week.
{
  const { generateProgramLocally } = require('../src/services/api/generateProgram');
  let worst = 0; let worstDay = '';
  try {
    const p = generateProgramLocally({
      trainingLocation: 'Commercial gym', equipmentSelectionCompleteness: 'complete',
      recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average',
      seasonPhase: 'Off-season', gameDay: undefined, trainingDaysPerWeek: 2,
      preferredTrainingDays: ['Monday', 'Thursday'], equipment: ['Full Gym'],
      teamTrainingDays: [],
    } as never, { todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1 } as never);
    for (const w of p.microcycles[0].workouts as any[]) {
      const rows = (w.exercises ?? []).filter((x: any) =>
        x.section18Evidence?.role === 'main_strength'
        || x.section18Evidence?.role === 'strength_accessory').length;
      if (rows > worst) { worst = rows; worstDay = String(w.dayOfWeek); }
    }
    add('WC-048', 'off-season Full Body x2 — the densest strength day the app builds',
      `max strength rows on one day = ${worst} (day ${worstDay}); ceiling ${GLOBAL_RULES.dailyMovementCeiling}`,
      worst <= GLOBAL_RULES.dailyMovementCeiling);
  } catch (e: any) {
    add('WC-048', 'off-season Full Body x2', `world refused: ${e.message}`, false);
  }
}

// ── WC-062 — the athlete's REAL club nights, never assumed ────────────────
{
  const r = sched({ clubNights: [], gameDay: 6, gymAccessDays: [1, 3, 5] });
  const club = r?.refused ? [] : r.days.filter((d: any) => d.clubTraining);
  add('WC-062', 'athlete declares NO club nights (Tue/Thu would be the old default)',
    `club days in the week: ${JSON.stringify(club.map((d: any) => d.dayOfWeek))}`,
    club.length === 0);
}

// ── WC-063 — availability is permission, not a quota ──────────────────────
{
  const r = sched({ gymAccessDays: [1, 2, 3, 4, 5, 6], gameDay: 0, clubNights: [] });
  const n = strengthDays(r).length;
  add('WC-063', 'SIX gym days available, in-season',
    r?.refused ? `refused: ${r.finding}` : `required strength sessions = ${n}`,
    r?.refused || n <= 4);
}

// ── WC-110 — pre-season Full Body x2, never back-to-back ──────────────────
{
  const r = sched({ phase: 'Pre-season', gymAccessDays: [1, 2], gameDay: null });
  const days = strengthDays(r).map((d: any) => d.dayOfWeek).sort();
  add('WC-110', 'pre-season, the ONLY two gym days are adjacent (Mon+Tue)',
    r?.refused ? `refused: ${r.finding}` : `strength on ${JSON.stringify(days)}`,
    r?.refused || longestRun(days) < 2);
}

// ── WC-113 / WC-122 — extra availability never creates a fifth session ────
for (const [clause, phase] of [['WC-113', 'Pre-season'], ['WC-122', 'Off-season']] as const) {
  const r = sched({ phase, gymAccessDays: [1, 2, 3, 4, 5, 6], gameDay: null,
    offseasonBlock: phase === 'Off-season' ? 'late_offseason' : null });
  const n = strengthDays(r).length;
  add(clause, `${phase}, SIX gym days available`,
    r?.refused ? `refused: ${r.finding}` : `required strength sessions = ${n}`,
    r?.refused || n <= 4);
}

// ── WC-133 — pre-season, no more than two lower sessions ──────────────────
{
  const r = sched({ phase: 'Pre-season', gymAccessDays: [1, 2, 3, 4, 5, 6], gameDay: null });
  const lower = strengthDays(r).filter((d: any) => PURPOSE_IS_LOWER[d.purpose]);
  add('WC-133', 'pre-season, six gym days — maximum room for lower sessions',
    r?.refused ? `refused: ${r.finding}` : `lower sessions = ${lower.length}`,
    r?.refused || lower.length <= 2);
}

// ── WC-135 — in-season sprint only with NO club training, G-3 or earlier ──
{
  const withClub = sched({ clubNights: [2, 4], gameDay: 6, gymAccessDays: [1, 3, 5] });
  const sprintWithClub = withClub?.refused ? []
    : withClub.days.filter((d: any) => d.conditioning === 'sprint_high_speed');
  const noClub = sched({ clubNights: [], gameDay: 6, gymAccessDays: [1, 3] });
  const sprintNoClub = noClub?.refused ? []
    : noClub.days.filter((d: any) => d.conditioning === 'sprint_high_speed');
  const order = [1, 2, 3, 4, 5, 6, 0];
  const tooLate = sprintNoClub.filter((d: any) =>
    order.indexOf(6) - order.indexOf(d.dayOfWeek) < 3);
  add('WC-135', 'in-season WITH club nights — sprint must not be added',
    `sprint days = ${JSON.stringify(sprintWithClub.map((d: any) => d.dayOfWeek))}`,
    sprintWithClub.length === 0);
  add('WC-135', 'in-season WITHOUT club — any sprint must sit G-3 or earlier',
    `sprint days = ${JSON.stringify(sprintNoClub.map((d: any) => d.dayOfWeek))}, `
    + `later than G-3: ${JSON.stringify(tooLate.map((d: any) => d.dayOfWeek))}`,
    tooLate.length === 0);
}

console.log('\nDELEGATED PROHIBITION RECEIPTS\n');
for (const r of receipts) {
  console.log(`${r.held ? 'HELD  ' : 'BROKE '} ${r.clause.padEnd(7)} ${r.world}`);
  console.log(`         ${r.observed}`);
}
const broke = receipts.filter((r) => !r.held);
console.log(`\n${receipts.length} receipts · ${broke.length} BROKE`);
for (const r of broke) console.log(`  MUST MOVE INTO THE LEGALITY OWNER: ${r.clause}`);
