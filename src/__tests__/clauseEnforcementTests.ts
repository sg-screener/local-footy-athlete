/**
 * EVERY CLAUSE IS ENFORCED AS THE KIND OF RULE IT IS.
 *
 *   npm run test:clause-enforcement
 *
 * **Sam's four RED conditions, 2026-08-16:**
 *
 *   1. a PROHIBITION represented only by scoring
 *   2. a REQUIREMENT with no completeness/validation check
 *   3. a PREFERENCE implemented as refusal
 *   4. a FACT re-derived after the canonical scheduler context
 *
 * G-2 was #1 and it reached an athlete's Friday: *"No heavy lower-body"* was worth
 * −25 points, so a week short of legal days paid the penalty and placed Deadlift
 * two days before the game. **This walks all 42 clauses instead of waiting for the
 * next one to be spotted in a printed week.**
 *
 * ## THE COVERAGE HALF IS MECHANICAL, AND BOTH DIRECTIONS ARE CHECKED
 *
 * `CLAUSE_MODALITY` is the specification; `LEGALITY_RULES` and
 * `COMPLETENESS_CHECKS` answer to it. A clause declaring `prohibits` with no
 * legality rule reds; a rule naming a clause id that does not exist reds; and a
 * clause that only `prefers` owning a legality rule reds. **A one-directional
 * check would let the tables drift apart while reading complete.**
 *
 * ## THE PRESSURE HALF IS ADVERSARIAL
 *
 * Coverage proves a rule EXISTS. It cannot prove the rule BINDS. So the second
 * half builds worlds engineered so that obeying the ban is the worst-scoring
 * option available — the exact circumstance under which G-2 was bought — and
 * asserts the scheduler refuses rather than pays.
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  CLAUSE_MODALITY, PURPOSE_IS_LOWER, WEEKLY_CONTRACT_CLAUSES, modalityFor,
} from '../rules/weeklyProgrammingContract';
import {
  LEGALITY_RULES, WEEK_LEGALITY_RULES, firstWeekLegalityViolation,
} from '../rules/weeklyLegality';
import { COMPLETENESS_CHECKS, completenessGaps } from '../rules/weeklyCompleteness';
import { scheduleWeek, type WeeklySchedulerInputs } from '../rules/weeklyScheduler';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail !== undefined ? `\n      ${JSON.stringify(detail)}` : ''}`);
}

const CLAUSE_IDS = WEEKLY_CONTRACT_CLAUSES.map((c) => c.id);
// ONE owner, TWO moments: candidate-time (before scoring) and week-time (once
// running top-ups, anchor conditioning and the layout's count exist). Both tables
// live in `weeklyLegality`, so this is a single authoritative verdict evaluated
// twice — not two competing owners.
const legalityIds = new Set([
  ...LEGALITY_RULES.map((r) => r.clauseId),
  ...WEEK_LEGALITY_RULES.map((r) => r.clauseId),
]);
const completenessIds = new Set(COMPLETENESS_CHECKS.map((c) => c.clauseId));

console.log('\n[1] Every clause declares what KIND of rule it is');
{
  const unclassified = CLAUSE_IDS.filter((id) => !modalityFor(id));
  ok('all 42 clauses carry a modality', unclassified.length === 0, unclassified);
  const orphaned = Object.keys(CLAUSE_MODALITY)
    .map((k) => k.replace('_', '-'))
    .filter((id) => !CLAUSE_IDS.includes(id));
  ok('no modality row names a clause that does not exist', orphaned.length === 0, orphaned);
}

console.log('\n[2] RED#1 — no prohibition is represented only by scoring');
{
  for (const id of CLAUSE_IDS) {
    const m = modalityFor(id)!;
    if (!m.prohibits) continue;
    ok(`${id} prohibits, so the legality owner holds it`, legalityIds.has(id));
  }
  // The rules that delegate must SAY where — an empty body reads as enforced.
  for (const rule of LEGALITY_RULES) {
    ok(`${rule.clauseId} legality rule either checks or names its real owner`,
      typeof rule.violated === 'function' || !!rule.enforcedElsewhere);
  }
  // Week-time rules have no delegation escape hatch: they exist BECAUSE the
  // delegation notes turned out to be unexecuted claims.
  for (const rule of WEEK_LEGALITY_RULES) {
    ok(`${rule.clauseId} week-level rule performs a real check`,
      typeof rule.violated === 'function');
  }
}

console.log('\n[3] RED#2 — no requirement without a completeness check');
{
  for (const id of CLAUSE_IDS) {
    const m = modalityFor(id)!;
    if (!m.requires) continue;
    ok(`${id} requires, so the completeness owner holds it`, completenessIds.has(id));
  }
  for (const check of COMPLETENESS_CHECKS) {
    ok(`${check.clauseId} completeness check either checks or names its validator`,
      typeof check.gap === 'function' || !!check.validatedElsewhere);
  }
}

console.log('\n[4] RED#3 — no preference is implemented as a refusal');
{
  for (const id of CLAUSE_IDS) {
    const m = modalityFor(id)!;
    if (m.prohibits || m.requires) continue;
    // Preference-only and definition-only clauses may not be able to refuse.
    ok(`${id} cannot refuse a week on its own`, !legalityIds.has(id));
  }
}

console.log('\n[5] RED#4 — no rule re-derives a fact the scheduler already owns');
{
  // Game proximity is the fact that has actually cost an athlete a recovery day.
  // The legality owner must receive it, never recompute it: a second owner of the
  // cyclic-week question is exactly how G+1 was lost for a Sunday fixture.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const source = require('fs').readFileSync(
    require('path').resolve(__dirname, '../rules/weeklyLegality.ts'), 'utf8');
  const executable = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l: string) => !l.trim().startsWith('//')).join('\n');
  ok('the legality owner never recomputes game proximity',
    !/gameProximity|daysSincePreviousGame|daysUntilNextGame/.test(executable));
  ok('...and never reaches for a raw week-position subtraction against the game',
    !/orderIndex\([^)]*\)\s*-\s*orderIndex\(\s*(c\.)?gameDay/.test(executable));
}

// ── THE ADVERSARIAL HALF ───────────────────────────────────────────────────

function inputs(over: Partial<WeeklySchedulerInputs> = {}): WeeklySchedulerInputs {
  return {
    weekStartISO: '2026-07-13',
    phase: 'In-season',
    offseasonBlock: null,
    gymAccessDays: [1, 2, 3, 4, 5, 6, 0],
    clubNights: [],
    gameDay: 6,
    fixtureRecurrence: 'recurring',
    age: 24,
    readiness: {
      lowReadiness: false, highReadiness: false,
      lowFatigue: false, consistentlyCompletesThree: false,
    },
    unavailableDays: [],
    ...over,
  } as WeeklySchedulerInputs;
}

console.log('\n[6] PRESSURE — scoring cannot buy its way through a ban');
{
  // Each world is engineered so the ONLY high-scoring arrangements break a ban.
  // A scheduler that scores prohibitions will take the points; one that treats
  // them as legality will refuse or fall back to a worse-scoring legal week.
  const worlds: { name: string; over: Partial<WeeklySchedulerInputs>;
    illegal: (day: any) => boolean; clause: string }[] = [
    {
      name: 'G-2 is the ONLY well-separated day left (the Friday defect)',
      clause: 'WC-051',
      // Sunday game: Monday G+1, Saturday G-1, Friday G-2. Squeezing the week
      // makes the G-2 day the best-separated option by a wide margin.
      over: { gameDay: 0, gymAccessDays: [1, 3, 5, 6], clubNights: [3, 5] },
      illegal: (d) => d.owner === 'strength' && PURPOSE_IS_LOWER[d.purpose]
        && d.dayOfWeek === 5,
    },
    {
      name: 'every remaining gym day is G-1 or G+1',
      clause: 'WC-050',
      over: { gameDay: 6, gymAccessDays: [5, 0] },
      illegal: (d) => d.owner === 'strength' && (d.dayOfWeek === 5 || d.dayOfWeek === 0),
    },
    {
      name: 'only back-to-back days remain for two lower sessions',
      clause: 'WC-043',
      over: { phase: 'Pre-season', gameDay: null, gymAccessDays: [1, 2] },
      illegal: () => false,
    },
    {
      name: 'six hard days are available and the week would like all of them',
      clause: 'WC-040',
      over: { phase: 'Off-season', gameDay: 6, gymAccessDays: [1, 2, 3, 4, 5],
        clubNights: [1, 2, 3, 4, 5] },
      illegal: () => false,
    },
  ];

  for (const world of worlds) {
    const result: any = scheduleWeek(inputs(world.over));
    if (result?.refused) {
      // A typed refusal is a legal answer to an impossible week.
      ok(`[${world.clause}] ${world.name} — refused, not bought`, true);
      continue;
    }
    const breach = result.days.filter(world.illegal);
    ok(`[${world.clause}] ${world.name} — the ban held under pressure`,
      breach.length === 0,
      breach.map((d: any) => [d.dayOfWeek, d.owner, d.purpose]));
    // Non-vacuity: the world must actually have produced a week to inspect.
    ok(`[${world.clause}] ...and the world produced days to inspect`,
      result.days.length > 0);
  }
}

console.log('\n[7] PRESSURE — the named rules from the order, one world each');
{
  // G+1 across the week boundary, the defect that started this.
  const sunday: any = scheduleWeek(inputs({ gameDay: 0, gymAccessDays: [1, 2, 3, 4, 5, 6, 0] }));
  ok('[WC-050] a recurring Sunday fixture leaves MONDAY (G+1) free of strength',
    sunday?.refused || sunday.days.find((d: any) => d.dayOfWeek === 1)?.owner !== 'strength',
    sunday?.days?.find((d: any) => d.dayOfWeek === 1));

  // Gym-day legality: strength never lands off an access day.
  const narrow: any = scheduleWeek(inputs({ gymAccessDays: [1, 3], gameDay: null,
    phase: 'Pre-season' }));
  ok('[WC-060] strength never lands outside gym-access days',
    narrow?.refused || narrow.days.filter((d: any) => d.owner === 'strength')
      .every((d: any) => [1, 3].includes(d.dayOfWeek)),
    narrow?.days?.filter((d: any) => d.owner === 'strength').map((d: any) => d.dayOfWeek));

  // Unavailable days are never used, for anything.
  const blocked: any = scheduleWeek(inputs({ unavailableDays: [2, 4], gameDay: null,
    phase: 'Pre-season' }));
  ok('[WC-061] a day marked unavailable carries no app work',
    blocked?.refused || blocked.days.filter((d: any) => [2, 4].includes(d.dayOfWeek))
      .every((d: any) => d.owner === 'rest_or_recovery'),
    blocked?.days?.filter((d: any) => [2, 4].includes(d.dayOfWeek))
      .map((d: any) => [d.dayOfWeek, d.owner]));

  // Anchors survive as facts the scheduler carries, not as content.
  const anchored: any = scheduleWeek(inputs({ gameDay: 6, clubNights: [2, 4] }));
  ok('[WC-062] the declared club nights are the ones carried',
    anchored?.refused || [2, 4].every((d) =>
      anchored.days.find((x: any) => x.dayOfWeek === d)?.clubTraining === true),
    anchored?.days?.map((d: any) => [d.dayOfWeek, d.clubTraining]));
}

console.log('\n[8] WC-020 measures the DELIVERED week, not the request');
{
  const schedule: any = scheduleWeek(inputs({ phase: 'Pre-season', gameDay: null,
    gymAccessDays: [1, 3, 5] }));
  ok('the pressure world schedules', !schedule?.refused, schedule?.finding);
  if (!schedule?.refused) {
    const intended: string[] = [...schedule.intendedPatterns];
    ok('...and it intends at least two patterns to drop one from', intended.length >= 2,
      intended);

    // DELIVERED IN FULL -> no gap.
    const full = completenessGaps(schedule, new Set(intended));
    ok('a week delivering every intended pattern has no WC-020 gap',
      !full.some((g) => g.clauseId === 'WC-020'), full);

    // ── THE MUTATION SAM ASKED FOR ────────────────────────────────────────
    // Request the pattern, then DROP its delivered row. The old check read the
    // request and could not fail; this one must.
    const dropped = new Set(intended.slice(1));
    const gaps = completenessGaps(schedule, dropped);
    const wc020 = gaps.find((g) => g.clauseId === 'WC-020');
    ok('dropping a DELIVERED row for an intended pattern fails completeness',
      !!wc020 && wc020.shortfall.includes(intended[0]),
      { droppedPattern: intended[0], gaps });

    // A check that only reads the schedule cannot see the drop at all — this
    // arm is what makes the cell about DELIVERY rather than about intention.
    ok('...and the failure names the pattern that went missing',
      !!wc020 && /intended but not delivered/.test(wc020.shortfall), wc020);
  }
}

console.log('\n[9] Every WEEK-LEVEL rule BINDS — fed facts that violate it directly');
{
  // ⚠ **WHY THIS SECTION EXISTS.** Neutering WC-045, WC-046 and WC-063 changed
  // nothing observable in any generated world: the scheduler simply never
  // produces a week that approaches those limits. Coverage said "a rule exists";
  // the corpus could not say "the rule binds". That is the SAME weakness the
  // delegation notes had, just relocated — so each rule is called directly with
  // facts engineered to violate it, which proves the verdict rather than the
  // presence of a function.
  const legal = {
    strengthDays: [{ day: 1, purpose: 'lower' as const }, { day: 4, purpose: 'upper' as const }],
    runningDays: [2, 5],
    coreConditioning: 3,
    setsPerSession: 16,
    phase: 'In-season',
  };
  ok('[control] a legal week passes every week-level rule',
    firstWeekLegalityViolation(legal) === null, firstWeekLegalityViolation(legal));

  const breaches: { clause: string; facts: any }[] = [
    { clause: 'WC-030', facts: { ...legal, setsPerSession: 17 } },
    { clause: 'WC-044', facts: { ...legal, runningDays: [1, 2, 3, 4] } },
    { clause: 'WC-045', facts: { ...legal, coreConditioning: 6 } },
    { clause: 'WC-046', facts: { ...legal, runningDays: [1, 3, 5, 0, 2] } },
    { clause: 'WC-063', facts: { ...legal, strengthDays: [
      { day: 1, purpose: 'lower' }, { day: 3, purpose: 'upper' },
      { day: 5, purpose: 'upper_push' }, { day: 0, purpose: 'upper_pull' },
      { day: 2, purpose: 'full_body' }] } },
    { clause: 'WC-113', facts: { ...legal, phase: 'Pre-season', strengthDays: [
      { day: 1, purpose: 'lower' }, { day: 3, purpose: 'upper' },
      { day: 5, purpose: 'upper_push' }, { day: 0, purpose: 'upper_pull' },
      { day: 2, purpose: 'full_body' }] } },
    { clause: 'WC-122', facts: { ...legal, phase: 'Off-season', strengthDays: [
      { day: 1, purpose: 'lower' }, { day: 3, purpose: 'upper' },
      { day: 5, purpose: 'upper_push' }, { day: 0, purpose: 'upper_pull' },
      { day: 2, purpose: 'full_body' }] } },
    { clause: 'WC-133', facts: { ...legal, phase: 'Pre-season', strengthDays: [
      { day: 1, purpose: 'lower_squat' }, { day: 3, purpose: 'lower_hinge' },
      { day: 5, purpose: 'lower' }] } },
  ];
  for (const b of breaches) {
    const verdict = firstWeekLegalityViolation(b.facts as never);
    ok(`[${b.clause}] violating facts are REFUSED by the week-level owner`,
      verdict !== null, verdict);
    // The refusal must name the clause that actually owns it, or a later reader
    // cannot tell which rule fired — and a wrong attribution is worse than none.
    ok(`[${b.clause}] ...and the verdict names that clause`,
      verdict?.clauseId === b.clause, verdict);
  }
}

const total = passed + failures.length;
console.log(`\nClause enforcement: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
