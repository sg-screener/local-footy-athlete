/**
 * WEEKLY DOSE OWNERSHIP — the boundary the Batch 0 deletion creates.
 *
 * SAM'S RULING (2026-07-28): the week-mode exposure contract is the single owner
 * of "how many strength sessions this week". `coachingEngine`'s core-session
 * counts, budget arithmetic and the three override floors become derivations or
 * deletions, never a second authority.
 *
 * Before this unit there were TWO builders and one judge, set from different
 * numbers. `coreRange` was rewritten EIGHT times inside one function before it
 * became `actualCore`; a reader could not answer "why did this athlete get three
 * strength sessions?" without simulating all eight. The contract was already the
 * nominal owner — it overwrote `coreRange.min` unconditionally — and twenty-two
 * lines later three hardcoded floors overwrote it back.
 *
 * THE PRIZE IS BLOCK [3]. Every reduction the CONTRACT makes goes through
 * `reduceAllocationTarget` and lands in `contract.reductions` with a typed
 * reason. Every reduction the ENGINE made was a bare assignment. So the
 * athlete-visible "why is my week smaller" story existed for one authority and
 * not the other. After this unit no path may reduce an athlete's week by
 * assignment: the contract cannot, and nothing else is allowed to.
 *
 * Documents: docs/BATCH0_WEEKLY_DOSE_OWNERSHIP_REASSESSMENT_2026-07-28.md §7
 *            docs/BATCH0_RULING_APPLIED_2026-07-28.md
 *
 * Run: npm run test:weekly-dose-ownership
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import type {
  ConditioningLevel,
  RecentTrainingLoad,
  SeasonPhase,
  WeekKind,
} from '../types/domain';
import type { OffseasonSubphase } from '../rules/offseasonSubphase';
import type { PreseasonSubphase } from '../rules/preseasonSubphase';
import { type CoachingInputs } from '../utils/coachingEngine';
import { coachingPlanForTests, coachingPlanOrRefusal } from './support/coachingPlanForTests';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}`);
  if (detail !== undefined) console.error(`       ${JSON.stringify(detail)}`);
}

/* ══════════════════════════════════════════════════════════════════════════
   The matrix
   ══════════════════════════════════════════════════════════════════════════ */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Capacity answers that land on each band: <=2 low, <=4 medium, else high. */
const CAPACITY: Record<'low' | 'medium' | 'high', {
  recentTrainingLoad: RecentTrainingLoad;
  conditioningLevel: ConditioningLevel;
}> = {
  low: { recentTrainingLoad: 'Hardly at all', conditioningLevel: 'Poor' },
  medium: { recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average' },
  high: { recentTrainingLoad: 'Very consistent', conditioningLevel: 'Elite' },
};

interface Combination {
  seasonPhase: SeasonPhase;
  offseasonSubphase?: OffseasonSubphase;
  preseasonSubphase?: PreseasonSubphase;
  capacity: 'low' | 'medium' | 'high';
  teamDayCount: number;
  availableDays: number;
  hasGame: boolean;
  weekKind?: WeekKind;
}

/**
 * Team days are Tue/Thu (the club's real shape); the athlete's own days fill
 * forward from Monday. A game, when present, is on Saturday.
 */
function inputsFor(c: Combination): CoachingInputs {
  const teamTrainingDays = ['Tuesday', 'Thursday', 'Wednesday'].slice(0, c.teamDayCount);
  // ⚠ **FILL ORDER IS SEPARATION-FIRST, NOT CALENDAR ORDER.**
  //
  // This filled forward from Monday, so a two-day athlete got **Monday +
  // Tuesday — back-to-back**, and the approved source says Full Body x2 go on
  // "the best-separated gym days, never back-to-back". The scheduler refused,
  // correctly, and the refusal threw and killed the whole suite before any other
  // combination could report. **The fixture was asking for an illegal week; the
  // subject of this suite is dosing, not adjacency.**
  //
  // Mon/Wed/Fri first, then the weekend, then the in-between days — so every
  // count from 2 upward is a legal day-set. The adjacency refusal itself is
  // asserted deliberately in `test:cyclic-proximity`, as its own control, rather
  // than being an unexplained red here.
  const ordered = ['Monday', 'Wednesday', 'Friday', 'Sunday', 'Saturday', 'Tuesday', 'Thursday'];
  const selected = new Set<string>(teamTrainingDays);
  if (c.hasGame) selected.add('Saturday');
  for (const day of ordered) {
    if (selected.size >= c.availableDays) break;
    selected.add(day);
  }
  const selectedDays = ordered.filter((d) => selected.has(d));
  return {
    seasonPhase: c.seasonPhase,
    availableDays: selectedDays.length,
    selectedDays,
    teamTrainingDaysPerWeek: teamTrainingDays.length,
    teamTrainingDays,
    sprintExposure: '2+ times per week',
    conditioningLevel: CAPACITY[c.capacity].conditioningLevel,
    recentTrainingLoad: CAPACITY[c.capacity].recentTrainingLoad,
    experienceLevel: '2-5 years',
    injuries: [],
    goals: [],
    hasGame: c.hasGame,
    gameDay: c.hasGame ? 'Saturday' : undefined,
    weekKind: c.weekKind,
    offseasonSubphase: c.offseasonSubphase,
    preseasonSubphase: c.preseasonSubphase,
  };
}

function label(c: Combination): string {
  const sub = c.offseasonSubphase ?? c.preseasonSubphase ?? '-';
  return `${c.seasonPhase}/${sub}/cap=${c.capacity}/team=${c.teamDayCount}`
    + `/days=${c.availableDays}/${c.hasGame ? 'game' : 'nogame'}${c.weekKind === 'deload' ? '/deload' : ''}`;
}

function buildMatrix(): Combination[] {
  const out: Combination[] = [];
  const capacities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
  const phases: Array<Pick<Combination, 'seasonPhase' | 'offseasonSubphase' | 'preseasonSubphase'>> = [
    { seasonPhase: 'In-season' },
    { seasonPhase: 'Off-season', offseasonSubphase: 'early_offseason' },
    { seasonPhase: 'Off-season', offseasonSubphase: 'mid_offseason' },
    { seasonPhase: 'Off-season', offseasonSubphase: 'late_offseason' },
    { seasonPhase: 'Pre-season', preseasonSubphase: 'early_preseason' },
    { seasonPhase: 'Pre-season', preseasonSubphase: 'mid_preseason' },
    { seasonPhase: 'Pre-season', preseasonSubphase: 'late_preseason' },
  ];
  for (const phase of phases) {
    for (const capacity of capacities) {
      for (const teamDayCount of [0, 1, 2, 3]) {
        for (const availableDays of [3, 4, 5, 6]) {
          for (const hasGame of [false, true]) {
            // Off-season has no fixture and no club schedule: the builder
            // strips both, so those combinations are not distinct weeks.
            if (phase.seasonPhase === 'Off-season' && (hasGame || teamDayCount > 0)) continue;
            if (teamDayCount > availableDays) continue;
            out.push({ ...phase, capacity, teamDayCount, availableDays, hasGame });
          }
        }
      }
    }
  }
  // The bye-recovery mode's authored entry condition (Sam, ruling 4): a
  // SCHEDULED deload, never a readiness or injury trigger.
  for (const capacity of capacities) {
    out.push({ seasonPhase: 'In-season', capacity, teamDayCount: 2, availableDays: 5, hasGame: false, weekKind: 'deload' });
  }
  return out;
}

const MATRIX = buildMatrix();
// Combinations the SCHEDULER legally refuses are set aside, counted and named —
// never silently dropped, and never allowed to empty the matrix. See
// `coachingPlanOrRefusal`: the approved source forbids some day-sets outright,
// and the subject of this suite is dosing, not the calendar.
const CANDIDATES = MATRIX.map((c) => ({
  combination: c, label: label(c), plan: coachingPlanOrRefusal(inputsFor(c)),
}));
const REFUSED = CANDIDATES.filter((p) => p.plan === null);
const PLANS = CANDIDATES.filter((p) => p.plan !== null) as
  { combination: typeof MATRIX[number]; label: string; plan: NonNullable<typeof CANDIDATES[number]['plan']> }[];
console.log(`\nMatrix: ${MATRIX.length} combinations — ${PLANS.length} scheduled, `
  + `${REFUSED.length} legally refused by the scheduler`);
for (const r of REFUSED) console.log(`  refused: ${r.label}`);
if (PLANS.length < MATRIX.length / 2) {
  console.error(`\nFAIL more than half the matrix refused — this suite would be `
    + `asserting almost nothing (${PLANS.length}/${MATRIX.length})`);
  process.exit(1);
}

/* ══════════════════════════════════════════════════════════════════════════
   [1] Single-authority lock
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n[1] The engine holds no strength-session target of its own');
{
  const enginePath = path.resolve(__dirname, '../utils/coachingEngine.ts');
  const source = fs.readFileSync(enginePath, 'utf8');
  // Comments are stripped: this unit deletes the code AND leaves prose
  // explaining what the numbers used to be, which must stay readable.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .map((line) => line.replace(/\s\/\/.*$/, ''))
    .join('\n');

  const BANNED: Array<{ pattern: RegExp; what: string }> = [
    { pattern: /\bgetCoreSessionCount\b/, what: 'a phase x readiness core-session table' },
    { pattern: /\bgetHardExposureCap\b/, what: 'a phase x readiness hard-exposure cap' },
    { pattern: /\bcountTeamHardExposures\b/, what: 'a second hard-day counter' },
    { pattern: /\bshouldTarget4Strength\b/, what: 'the H-PRE-8 override floor' },
    { pattern: /\bshouldTarget3Strength\b/, what: 'the H-IS-3 override floor' },
    { pattern: /\bshouldTarget3StrengthPreSeasonGame\b/, what: 'the B3 override floor' },
    { pattern: /\bmoderateCoreBonus\b/, what: 'the un-budgeted +1 moderate core session' },
    { pattern: /\bcoreRange\b/, what: 'the eight-rewrite core range' },
    { pattern: /\bheavyCoreCap\b/, what: 'the budget-clamped heavy core cap' },
  ];
  for (const { pattern, what } of BANNED) {
    ok(`coachingEngine declares no ${what} (${pattern.source})`, !pattern.test(code));
  }

  // The literal shape the floors used. A bare `{ min: 3, max: 3 }` anywhere in
  // this file is a weekly strength target by another name.
  const literals = [...code.matchAll(/\{\s*min:\s*\d+\s*,\s*max:\s*\d+\s*\}/g)].map((m) => m[0]);
  ok('coachingEngine contains no { min, max } session-count literal', literals.length === 0, literals);
}

/* ══════════════════════════════════════════════════════════════════════════
   [2] Derivation, not reinterpretation
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n[2] Every planned core count is a value the contract declared');
{
  const offenders: string[] = [];
  for (const { label: name, plan } of PLANS) {
    const contract = plan.weeklyExposureContract;
    const declared = contract.strength.targetCount;
    const preferred = contract.strength.preferred;
    const core = plan.coreSessions;
    const isDeclared = core === declared
      || (core >= preferred.min && core <= preferred.max);
    if (!isDeclared) {
      offenders.push(`${name}: core=${core}, target=${declared}, preferred=${preferred.min}-${preferred.max}`);
    }
  }
  ok(`all ${PLANS.length} matrix weeks plan a declared count`, offenders.length === 0,
    offenders.slice(0, 12));
}

/* ══════════════════════════════════════════════════════════════════════════
   [3] Every shrink is recorded — THE PRIZE
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n[3] No path reduces the week by assignment');
{
  // (a) The engine never plans below the contract's selected target. There is
  //     no typed reason it could attach if it did, because it does not own the
  //     number — so the only honest behaviour is not to move it.
  const shrunk: string[] = [];
  for (const { label: name, plan } of PLANS) {
    const declared = plan.weeklyExposureContract.strength.targetCount;
    if (plan.coreSessions >= declared) continue;
    const reason = plan.weeklyExposureContract.reductions.find(
      (r) => r.domain === 'main_strength' && r.to === plan.coreSessions,
    );
    if (!reason) shrunk.push(`${name}: core=${plan.coreSessions} < target=${declared}, no typed reduction explains it`);
  }
  ok('every week at or above its target, or explained by a typed reduction', shrunk.length === 0,
    shrunk.slice(0, 12));

  // (b) The assertion is not vacuous: where a constrained athlete's target IS
  //     lower than the same athlete's with a full week of days, the contract
  //     must carry the reason. This is what the engine path could never do.
  let differentials = 0;
  const unexplained: string[] = [];
  for (const { combination, label: name, plan } of PLANS) {
    if (combination.availableDays >= 6) continue;
    const roomy = coachingPlanForTests(inputsFor({ ...combination, availableDays: 7 }));
    const constrained = plan.weeklyExposureContract.strength.targetCount;
    const spacious = roomy.weeklyExposureContract.strength.targetCount;
    if (constrained >= spacious) continue;
    differentials += 1;
    const reason = plan.weeklyExposureContract.reductions.find(
      (r) => r.domain === 'main_strength' && r.metric === 'weekly_exposure_count' && r.to === constrained,
    );
    if (!reason) unexplained.push(`${name}: target=${constrained} vs ${spacious} with a full week, unexplained`);
  }
  ok('the contract records every target it lowers', unexplained.length === 0, unexplained.slice(0, 12));
  ok(`the recording assertion is exercised (${differentials} genuine shrinks in the matrix)`,
    differentials > 0);
}

/* ══════════════════════════════════════════════════════════════════════════
   [4] Behaviour conservation — the three floors' own scenarios
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n[4] The weeks the deleted floors existed to protect are unchanged');
{
  // Each floor was written because a real week came out wrong. Deleting them
  // without preserving what they knew would reintroduce the bug they fixed, so
  // the scenarios are pinned by NAME: a regression says which week broke.
  const scenarios: Array<{ name: string; combination: Combination; strength: number }> = [
    {
      name: 'H-PRE-8  pre-season, 2 team days, no game, 5 days, high capacity',
      combination: { seasonPhase: 'Pre-season', preseasonSubphase: 'mid_preseason', capacity: 'high', teamDayCount: 2, availableDays: 5, hasGame: false },
      strength: 4,
    },
    {
      name: 'H-PRE-8  the same week at medium capacity',
      combination: { seasonPhase: 'Pre-season', preseasonSubphase: 'mid_preseason', capacity: 'medium', teamDayCount: 2, availableDays: 5, hasGame: false },
      strength: 4,
    },
    {
      name: 'H-IS-3   in-season, game, 2 team days, 5 days, high capacity',
      combination: { seasonPhase: 'In-season', capacity: 'high', teamDayCount: 2, availableDays: 5, hasGame: true },
      strength: 3,
    },
    {
      // 3 -> 4 on 2026-08-16. **The approved source, Pre-season 5-6 days: "Four
      // required strength sessions: Upper x2 + Lower x2."** The 3 came from the
      // old checker's `practice_match_week` row, which a pre-season week with a
      // fixture resolves to — a number the approved contract does not contain.
      // Sam, 2026-08-16: the count comes from the approved scheduler contract,
      // "not the deleted planner/checker expectation of three".
      //
      // The scheduler and the contract now AGREE at 4; this expectation was the
      // last holder of the old number.
      name: 'B3       pre-season, game, 2 team days, 5 days, high capacity',
      combination: { seasonPhase: 'Pre-season', preseasonSubphase: 'mid_preseason', capacity: 'high', teamDayCount: 2, availableDays: 5, hasGame: true },
      strength: 4,
    },
    {
      name: 'the safety rail the floors deliberately did not raise: low capacity in-season game week',
      combination: { seasonPhase: 'In-season', capacity: 'low', teamDayCount: 2, availableDays: 5, hasGame: true },
      strength: 3,
    },
  ];
  for (const { name, combination, strength } of scenarios) {
    const plan = coachingPlanForTests(inputsFor(combination));
    ok(`${name} -> ${strength} strength`, plan.coreSessions === strength,
      { planned: plan.coreSessions, contractTarget: plan.weeklyExposureContract.strength.targetCount });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   [5] Hard-day agreement
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\n[5] The engine builds against the number Section 18 judges against');
{
  const disagreements: string[] = [];
  for (const { label: name, plan } of PLANS) {
    const legacy = plan.weeklyExposureContract.hardDays.permittedCount;
    const judged = plan.weeklyExposureContractV2.restStress.permittedHardDayMaximum;
    const built = plan.hardExposureCap;
    if (built !== legacy || legacy !== judged) {
      disagreements.push(`${name}: built=${built}, contract=${legacy}, section18=${judged}`);
    }
  }
  ok('the built, contracted and judged hard-day maxima are one number',
    disagreements.length === 0, disagreements.slice(0, 12));

  // Hard days are DAYS, not sessions (Sam, Batch 2 Q3). The anchors the athlete
  // already has ARE the committed hard days, and they live on the contract.
  //
  // The two edge cases below are what make this assertion able to fail. On a
  // tidy profile the raw onboarding fields and the contract anchors agree by
  // coincidence, so counting from either looks correct. They disagree exactly
  // where the deleted counter was wrong:
  //   - a club training day the athlete did not select is not a day they train,
  //     so it cannot be one of their hard days;
  //   - an off-season profile still carrying a stale onboarding game day has no
  //     fixture at all — the builder strips it, and the old counter charged the
  //     athlete a hard day for a game that is not in their season.
  const EDGE_CASES: Array<{ name: string; inputs: CoachingInputs }> = [
    {
      name: 'a club training day the athlete did not select',
      inputs: {
        ...inputsFor({ seasonPhase: 'In-season', capacity: 'high', teamDayCount: 0, availableDays: 4, hasGame: true }),
        teamTrainingDays: ['Tuesday', 'Sunday'],
        teamTrainingDaysPerWeek: 2,
      },
    },
    {
      name: 'an off-season profile carrying a stale onboarding game day',
      inputs: {
        ...inputsFor({ seasonPhase: 'Off-season', offseasonSubphase: 'mid_offseason', capacity: 'high', teamDayCount: 0, availableDays: 5, hasGame: false }),
        hasGame: true,
        gameDay: 'Saturday',
      },
    },
  ];
  for (const { name, inputs } of EDGE_CASES) {
    const plan = coachingPlanForTests(inputs);
    const anchors = plan.weeklyExposureContract.anchors;
    const expected = anchors.teamTrainingDays.length + anchors.gameOrPracticeMatchCredit;
    const raw = inputs.teamTrainingDaysPerWeek + (inputs.hasGame ? 1 : 0);
    ok(`${name}: counted from the contract, not the raw profile`,
      plan.existingHardExposures === expected && plan.existingHardExposures !== raw,
      { counted: plan.existingHardExposures, contract: expected, raw });
  }

  const miscounted: string[] = [];
  for (const { label: name, plan } of PLANS) {
    const anchors = plan.weeklyExposureContract.anchors;
    const expected = anchors.teamTrainingDays.length + anchors.gameOrPracticeMatchCredit;
    if (plan.existingHardExposures !== expected) {
      miscounted.push(`${name}: existing=${plan.existingHardExposures}, contract anchors=${expected}`);
    }
  }
  ok('committed hard days are counted from the contract anchors', miscounted.length === 0,
    miscounted.slice(0, 12));
}

/* ══════════════════════════════════════════════════════════════════════════
   Summary
   ══════════════════════════════════════════════════════════════════════════ */

console.log(`\n${failures.length === 0 ? 'PASS' : 'FAIL'} — ${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
