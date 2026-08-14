/**
 * THE WEEKLY SCHEDULER + CONTRACT, GUARDED BEHAVIOURALLY.
 *
 *   npm run test:weekly-scheduler
 *
 * **THE REGISTRY IS WALKED, NOT RETYPED.** Every cell declares which contract
 * clause ids it exercises; the final block asserts that the set of guarded ids
 * EQUALS `WEEKLY_CONTRACT_CLAUSES`. **A clause added to the contract without a
 * guard reds this suite, and a guard naming an id the contract does not have reds
 * it too.** The mission forbade a hand-written duplicate row list and this is why:
 * a second list is a second authority that drifts silently.
 *
 * **EVERY CELL RUNS THE SCHEDULER.** Source-text presence checks are explicitly
 * insufficient here, and this repo has shipped 116 green cells that asserted which
 * function was called while the defect sat in an argument. Each cell below builds
 * inputs, schedules a week, and reads the dated output.
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  BASE_LAYOUTS,
  CONTRACT_SOURCE,
  DEFAULT_SET_BUDGET,
  FOURTH_SESSION_AGE_CEILING,
  GLOBAL_RULES,
  INSEASON_OVERLAY,
  OFFSEASON_OVERLAYS,
  PATTERN_PARTNER,
  PATTERN_PLANE,
  PATTERNS_FOR_PURPOSE,
  PRESEASON_OVERLAY,
  PURPOSE_IS_LOWER,
  REQUIRED_PATTERNS,
  SPLIT_LOWER_SET_BUDGET,
  WEEKLY_CONTRACT_CLAUSES,
  baseLayoutFor,
  inSeasonUsesFourSessions,
  type ContractPhase,
  type SessionPurpose,
} from '../rules/weeklyProgrammingContract';
import {
  scheduleRefused,
  scheduleWeek,
  type WeeklySchedule,
  type WeeklySchedulerInputs,
} from '../rules/weeklyScheduler';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
/** Every clause id any cell claims to exercise. Compared to the registry below. */
const guardedClauseIds = new Set<string>();

function ok(name: string, clauses: readonly string[], condition: unknown, detail?: string): void {
  for (const id of clauses) guardedClauseIds.add(id);
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const MON = 1; const TUE = 2; const WED = 3; const THU = 4;
const FRI = 5; const SAT = 6; const SUN = 0;
const WEEK_START = '2026-07-13';   // a Monday

function inputs(over: Partial<WeeklySchedulerInputs> = {}): WeeklySchedulerInputs {
  return {
    weekStartISO: WEEK_START,
    phase: 'In-season',
    offseasonBlock: null,
    gymAccessDays: [MON, WED],
    clubNights: [],
    gameDay: null,
    age: 30,
    readiness: {
      lowReadiness: false, highReadiness: false,
      lowFatigue: false, consistentlyCompletesThree: false,
    },
    unavailableDays: [],
    ...over,
  };
}

function built(over: Partial<WeeklySchedulerInputs> = {}): WeeklySchedule {
  const result = scheduleWeek(inputs(over));
  if (scheduleRefused(result)) {
    throw new Error(`expected a schedule, got refusal ${result.finding}: ${result.detail}`);
  }
  return result;
}

const strengthDays = (week: WeeklySchedule) =>
  week.days.filter((d) => d.owner === 'strength');
const purposesOf = (week: WeeklySchedule): SessionPurpose[] =>
  strengthDays(week).map((d) => d.purpose as SessionPurpose);

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[source] The contract is pinned to the document Sam approved');
// ═══════════════════════════════════════════════════════════════════════════
{
  ok('the contract names its source document and approval', [],
    CONTRACT_SOURCE.path.endsWith('WEEKLY_PROGRAMMING_SOURCE_REVIEW_2026-08-14.md')
    && CONTRACT_SOURCE.sha256.length === 64
    && CONTRACT_SOURCE.approvedBy.includes('okay i approve it'),
    JSON.stringify(CONTRACT_SOURCE));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[matrix] Every phase x gym-availability case, 2 through 6');
// ═══════════════════════════════════════════════════════════════════════════
{
  const ACCESS: Record<number, number[]> = {
    2: [MON, WED],
    3: [MON, WED, FRI],
    4: [MON, TUE, THU, FRI],
    5: [MON, TUE, WED, THU, FRI],
    6: [MON, TUE, WED, THU, FRI, SAT],
  };
  // Expected REQUIRED session counts, straight off the contract's §6 table.
  const EXPECTED: Record<ContractPhase, Record<number, number>> = {
    'In-season': { 2: 2, 3: 3, 4: 3, 5: 3, 6: 3 },     // age 30, selector not met
    'Pre-season': { 2: 2, 3: 3, 4: 4, 5: 4, 6: 4 },
    'Off-season': { 2: 2, 3: 3, 4: 4, 5: 4, 6: 4 },
  };
  for (const phase of ['In-season', 'Pre-season', 'Off-season'] as ContractPhase[]) {
    for (const dayCount of [2, 3, 4, 5, 6]) {
      const week = built({
        phase,
        offseasonBlock: phase === 'Off-season' ? 'normal_build' : null,
        gymAccessDays: ACCESS[dayCount],
      });
      const expected = EXPECTED[phase][dayCount];
      ok(`[${phase}/${dayCount}d] requires ${expected} strength session(s)`,
        ['WC-142', week.layoutClauseId],
        week.requiredStrengthSessions === expected
        && strengthDays(week).length === expected,
        `got ${week.requiredStrengthSessions} (${week.layoutClauseId}), `
        + `days=${JSON.stringify(purposesOf(week))}`);
    }
  }
  // ⚠ THE QUOTA RULE, ASSERTED AS ITS OWN PROPERTY. §6: "Six available days never
  // means six required strength sessions."
  for (const phase of ['In-season', 'Pre-season', 'Off-season'] as ContractPhase[]) {
    const four = built({ phase, offseasonBlock: 'normal_build', gymAccessDays: ACCESS[4] });
    const six = built({ phase, offseasonBlock: 'normal_build', gymAccessDays: ACCESS[6] });
    ok(`[${phase}] 5-6 gym days never create a fifth required session`,
      ['WC-063'],
      six.requiredStrengthSessions === four.requiredStrengthSessions
      && six.requiredStrengthSessions <= 4,
      `4d=${four.requiredStrengthSessions} 6d=${six.requiredStrengthSessions}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[layouts] The approved purposes, per layout row');
// ═══════════════════════════════════════════════════════════════════════════
{
  const inSeason3 = built({ phase: 'In-season', gymAccessDays: [MON, WED, FRI] });
  ok('[WC-101] In-season 3 = Lower + Upper Pull + Upper Push',
    ['WC-101'],
    new Set(purposesOf(inSeason3)).size === 3
    && purposesOf(inSeason3).includes('lower')
    && purposesOf(inSeason3).includes('upper_pull')
    && purposesOf(inSeason3).includes('upper_push'),
    JSON.stringify(purposesOf(inSeason3)));

  const inSeason2 = built({ phase: 'In-season', gymAccessDays: [MON, WED] });
  ok('[WC-100] In-season 2 = Full Body x2', ['WC-100'],
    purposesOf(inSeason2).every((p) => p === 'full_body')
    && purposesOf(inSeason2).length === 2, JSON.stringify(purposesOf(inSeason2)));

  const pre3NoWeekend = built({ phase: 'Pre-season', gymAccessDays: [MON, WED, FRI] });
  ok('[WC-111] Pre-season 3, weekend UNAVAILABLE = Lower + Upper + Full Body',
    ['WC-111'],
    new Set(purposesOf(pre3NoWeekend)).size === 3
    && purposesOf(pre3NoWeekend).includes('lower')
    && purposesOf(pre3NoWeekend).includes('upper')
    && purposesOf(pre3NoWeekend).includes('full_body'),
    JSON.stringify(purposesOf(pre3NoWeekend)));

  const pre3Weekend = built({ phase: 'Pre-season', gymAccessDays: [MON, WED, SAT] });
  ok('[WC-112] Pre-season 3, weekend AVAILABLE = Full Body x3', ['WC-112'],
    purposesOf(pre3Weekend).length === 3
    && purposesOf(pre3Weekend).every((p) => p === 'full_body'),
    JSON.stringify(purposesOf(pre3Weekend)));

  const pre4 = built({ phase: 'Pre-season', gymAccessDays: [MON, TUE, THU, FRI] });
  ok('[WC-113] Pre-season 4 = Upper x2 + Lower x2', ['WC-113'],
    purposesOf(pre4).filter((p) => PURPOSE_IS_LOWER[p]).length === 2
    && purposesOf(pre4).filter((p) => !PURPOSE_IS_LOWER[p]).length === 2,
    JSON.stringify(purposesOf(pre4)));

  const off3 = built({ phase: 'Off-season', offseasonBlock: 'normal_build',
    gymAccessDays: [MON, WED, FRI] });
  ok('[WC-121] Off-season 3 = Lower + Upper + Full Body', ['WC-121', 'WC-120', 'WC-122'],
    new Set(purposesOf(off3)).size === 3 && purposesOf(off3).includes('full_body'),
    JSON.stringify(purposesOf(off3)));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[selector] The in-season fourth session');
// ═══════════════════════════════════════════════════════════════════════════
{
  const FOUR = [MON, TUE, THU, FRI];
  const young = built({ gymAccessDays: FOUR, age: 25 });
  ok('[WC-141] age 25 with four gym days gets FOUR sessions', ['WC-141', 'WC-103'],
    young.requiredStrengthSessions === 4, JSON.stringify(purposesOf(young)));

  const ceiling = built({ gymAccessDays: FOUR, age: FOURTH_SESSION_AGE_CEILING });
  ok('[WC-140] the age ceiling 27 is INCLUSIVE', ['WC-140'],
    ceiling.requiredStrengthSessions === 4, `age 27 -> ${ceiling.requiredStrengthSessions}`);

  const older = built({ gymAccessDays: FOUR, age: 28 });
  ok('[WC-102] age 28 without the earned arm stays on THREE', ['WC-102'],
    older.requiredStrengthSessions === 3, JSON.stringify(purposesOf(older)));

  const earned = built({ gymAccessDays: FOUR, age: 34,
    readiness: { lowReadiness: false, highReadiness: true, lowFatigue: true,
      consistentlyCompletesThree: true } });
  ok('[WC-141] age 34 EARNS four on consistency + high readiness + low fatigue',
    ['WC-141'], earned.requiredStrengthSessions === 4,
    `${earned.requiredStrengthSessions}`);

  // ⚠ THE SECOND ARM IS A CONJUNCTION. Reading it as an OR would hand a fourth
  // session to a fatigued 34-year-old.
  const partial = built({ gymAccessDays: FOUR, age: 34,
    readiness: { lowReadiness: false, highReadiness: true, lowFatigue: false,
      consistentlyCompletesThree: true } });
  ok('[WC-141] ...and NOT on two of the three — high readiness but fatigued',
    ['WC-141'], partial.requiredStrengthSessions === 3,
    `${partial.requiredStrengthSessions}`);

  // ⚠ LOW READINESS IS AN ABSOLUTE VETO — it overrides the AGE arm too.
  const youngButFlat = built({ gymAccessDays: FOUR, age: 22,
    readiness: { lowReadiness: true, highReadiness: false, lowFatigue: false,
      consistentlyCompletesThree: true } });
  ok('[WC-141] LOW READINESS NEVER ADDS WORK — a 22-year-old stays on three',
    ['WC-141'], youngButFlat.requiredStrengthSessions === 3,
    `${youngButFlat.requiredStrengthSessions}`);

  ok('[WC-141] the selector is false below four gym days regardless of age',
    ['WC-141'],
    !inSeasonUsesFourSessions({ gymDayCount: 3, age: 20, consistentlyCompletesThree: true,
      highReadiness: true, lowFatigue: true, lowReadiness: false }));

  // The four-session layout uses the approved 10-set budget.
  ok('[WC-031] the split Lower Squat/Hinge sessions use the 10-set budget',
    ['WC-031'],
    strengthDays(young).filter((d) => PURPOSE_IS_LOWER[d.purpose as SessionPurpose])
      .every((d) => d.setBudget?.hardCeiling === SPLIT_LOWER_SET_BUDGET.hardCeiling
        && d.setBudget?.preferredMin === 10),
    JSON.stringify(strengthDays(young).map((d) => [d.purpose, d.setBudget])));

  ok('[WC-030] every other session prefers 12-15 with a hard ceiling of 16',
    ['WC-030'],
    DEFAULT_SET_BUDGET.preferredMin === 12 && DEFAULT_SET_BUDGET.preferredMax === 15
    && DEFAULT_SET_BUDGET.hardCeiling === 16
    && strengthDays(older).every((d) => d.setBudget?.hardCeiling === 16),
    JSON.stringify(strengthDays(older).map((d) => d.setBudget)));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[spacing] Lower spacing, planes, hard days and rest');
// ═══════════════════════════════════════════════════════════════════════════
{
  const lowerConsecutive = (week: WeeklySchedule): boolean => {
    const order = [MON, TUE, WED, THU, FRI, SAT, SUN];
    const lower = strengthDays(week)
      .filter((d) => PURPOSE_IS_LOWER[d.purpose as SessionPurpose])
      .map((d) => order.indexOf(d.dayOfWeek)).sort((a, b) => a - b);
    return lower.some((v, i) => i > 0 && v - lower[i - 1] === 1);
  };
  const planeRepeat = (week: WeeklySchedule): boolean => {
    const order = [MON, TUE, WED, THU, FRI, SAT, SUN];
    const days = strengthDays(week)
      .map((d) => ({ i: order.indexOf(d.dayOfWeek), p: d.purpose as SessionPurpose }))
      .sort((a, b) => a.i - b.i);
    for (let k = 1; k < days.length; k += 1) {
      if (days[k].i - days[k - 1].i !== 1) continue;
      const prev = new Set(PATTERNS_FOR_PURPOSE[days[k - 1].p].map((x) => PATTERN_PLANE[x]));
      if (PATTERNS_FOR_PURPOSE[days[k].p].some((x) => prev.has(PATTERN_PLANE[x]))) return true;
    }
    return false;
  };

  // Swept across every world the matrix builds — one violation anywhere reds.
  const worlds: WeeklySchedulerInputs[] = [];
  for (const phase of ['In-season', 'Pre-season', 'Off-season'] as ContractPhase[]) {
    for (const access of [[MON, WED], [MON, WED, FRI], [MON, TUE, THU, FRI],
      [MON, TUE, WED, THU, FRI], [MON, TUE, WED, THU, FRI, SAT]]) {
      for (const club of [[], [TUE, THU], [WED, FRI]]) {
        for (const game of [null, SAT, SUN]) {
          worlds.push(inputs({
            phase, offseasonBlock: phase === 'Off-season' ? 'normal_build' : null,
            gymAccessDays: access, clubNights: club, gameDay: game, age: 24,
          }));
        }
      }
    }
  }
  const schedules = worlds.map((w) => scheduleWeek(w))
    .filter((r): r is WeeklySchedule => !scheduleRefused(r));
  ok('[non-vacuity] the spacing sweep actually built weeks', [],
    schedules.length >= 100, `${schedules.length} of ${worlds.length} built`);
  ok('[WC-043] lower sessions are NEVER on consecutive days, in any swept world',
    ['WC-043', 'WC-024'],
    schedules.every((w) => !lowerConsecutive(w)),
    `${schedules.filter(lowerConsecutive).length} violating weeks`);
  ok('[WC-022] the same movement plane never repeats on consecutive days',
    ['WC-022', 'WC-023'],
    schedules.every((w) => !planeRepeat(w)),
    `${schedules.filter(planeRepeat).length} violating weeks`);

  // WC-041 — five consecutive hard days only when followed by two full rest days.
  const order = [MON, TUE, WED, THU, FRI, SAT, SUN];
  const worstRun = (week: WeeklySchedule, world: WeeklySchedulerInputs): number => {
    const hard = new Set<number>([...strengthDays(week).map((d) => d.dayOfWeek),
      ...world.clubNights, ...(world.gameDay !== null ? [world.gameDay] : [])]);
    let run = 0; let longest = 0;
    for (const d of order) { run = hard.has(d) ? run + 1 : 0; longest = Math.max(longest, run); }
    return longest;
  };
  const fiveRunsAreLegal = worlds.every((world) => {
    const result = scheduleWeek(world);
    if (scheduleRefused(result)) return true;
    const run = worstRun(result, world);
    if (run < 5) return true;
    const hard = new Set<number>([...strengthDays(result).map((d) => d.dayOfWeek),
      ...world.clubNights, ...(world.gameDay !== null ? [world.gameDay] : [])]);
    return order.filter((d) => !hard.has(d)).length >= 2;
  });
  ok('[WC-041] a five-day hard run only ever appears with two full rest days left',
    ['WC-041', 'WC-040'], fiveRunsAreLegal);
  ok('[WC-042] the contract never programs six hard days', ['WC-042'],
    worlds.every((world) => {
      const r = scheduleWeek(world);
      if (scheduleRefused(r)) return true;
      return worstRun(r, world) <= GLOBAL_RULES.hardDays.permittedMaximum;
    }));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[anchors] Real club nights and real game days — never assumed');
// ═══════════════════════════════════════════════════════════════════════════
{
  // ⚠ NOT Tuesday/Thursday/Saturday. The mission required real weekdays.
  // ⚠ SATURDAY IS IN THE GYM SET ON PURPOSE. It is G-1 for the Sunday game, so
  // if the proximity rule stopped excluding it the scheduler COULD place strength
  // there. Without Saturday in the set the cell is unfalsifiable — the mutation
  // harness proved it by removing the rule and reddening nothing.
  const week = built({ phase: 'In-season', gymAccessDays: [MON, TUE, WED, THU, FRI, SAT],
    clubNights: [WED, FRI], gameDay: SUN, age: 24 });
  // ⚠ READ THE FLAG, NOT THE OWNER. A club night that is also a gym day is BOTH,
  // and the contract's own reference week pairs an upper session with each club
  // night. This cell found the bug: `owner` was exclusive, so a Wed/Fri club
  // athlete whose gym days included Wed and Fri reported ZERO club days.
  const clubDays = week.days.filter((d) => d.clubTraining).map((d) => d.dayOfWeek);
  ok('[WC-062] a Wednesday/Friday club athlete gets club days there, not Tue/Thu',
    ['WC-062'],
    clubDays.includes(WED) && clubDays.includes(FRI)
    && !clubDays.includes(TUE) && !clubDays.includes(THU),
    JSON.stringify(clubDays));
  ok('[WC-062] a club night that is also a gym day carries BOTH', ['WC-062'],
    week.days.some((d) => d.clubTraining && d.owner === 'strength'),
    JSON.stringify(week.days.map((d) => [d.dayOfWeek, d.owner, d.clubTraining])));
  const gameDays = week.days.filter((d) => d.owner === 'game').map((d) => d.dayOfWeek);
  ok('[WC-050] a SUNDAY game is anchored on Sunday', ['WC-050'],
    gameDays.length === 1 && gameDays[0] === SUN, JSON.stringify(gameDays));
  // ⚠ G-1 IS SATURDAY, AND G+1 IS OUTSIDE THIS WEEK. In a Monday-first week a
  // Sunday game is the LAST day, so Monday is G-6, not G+1. An earlier draft of
  // this cell asserted Monday was excluded and was wrong about the calendar, not
  // about the rule.
  ok('[WC-050] no strength on G-1 (Saturday) for a Sunday game', ['WC-050'],
    !strengthDays(week).some((d) => d.dayOfWeek === SAT),
    JSON.stringify(strengthDays(week).map((d) => d.dayOfWeek)));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[unavailable] Explicit unavailable days are never used, for anything');
// ═══════════════════════════════════════════════════════════════════════════
{
  const week = built({ phase: 'Pre-season',
    gymAccessDays: [MON, TUE, WED, THU, FRI], unavailableDays: [SAT, SUN, WED] });
  ok('[WC-061] no day the athlete marked unavailable appears in the week at all',
    ['WC-061'],
    !week.days.some((d) => [SAT, SUN, WED].includes(d.dayOfWeek)),
    JSON.stringify(week.days.map((d) => d.dayOfWeek)));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[running] Required equipment-free running may leave the gym days');
// ═══════════════════════════════════════════════════════════════════════════
{
  // Two gym days, no club, no game: the running minimum cannot be met on gym
  // days alone, so the contract permits other legal days.
  const week = built({ phase: 'Pre-season', gymAccessDays: [MON, WED], clubNights: [] });
  const runningDays = week.days.filter((d) => d.conditioning === 'running');
  const offGym = runningDays.filter((d) => ![MON, WED].includes(d.dayOfWeek));
  ok('[WC-060] required running is placed on non-gym days when needed',
    ['WC-060', 'WC-046'],
    runningDays.length >= GLOBAL_RULES.running.min && offGym.length > 0,
    `running on ${JSON.stringify(runningDays.map((d) => d.dayOfWeek))}`);
  ok('[WC-044] and never more than three running days consecutively',
    ['WC-044'],
    (() => {
      const order = [MON, TUE, WED, THU, FRI, SAT, SUN];
      const set = new Set(runningDays.map((d) => d.dayOfWeek));
      let run = 0; let longest = 0;
      for (const d of order) { run = set.has(d) ? run + 1 : 0; longest = Math.max(longest, run); }
      return longest <= GLOBAL_RULES.runningStreakMaximum;
    })());
  // And it still respects explicit unavailability.
  const fenced = built({ phase: 'Pre-season', gymAccessDays: [MON, WED],
    unavailableDays: [TUE, THU, FRI, SAT, SUN] });
  ok('[WC-061] off-gym running still never lands on an unavailable day',
    ['WC-061'],
    !fenced.days.some((d) => [TUE, THU, FRI, SAT, SUN].includes(d.dayOfWeek)),
    JSON.stringify(fenced.days.map((d) => [d.dayOfWeek, d.owner])));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[overlays] Off-season blocks, pre-season and in-season');
// ═══════════════════════════════════════════════════════════════════════════
{
  const early = built({ phase: 'Off-season', offseasonBlock: 'early_optional',
    gymAccessDays: [MON, WED, FRI] });
  ok('[WC-130] early off-season: every strength session is OPTIONAL',
    ['WC-130'],
    strengthDays(early).length > 0 && strengthDays(early).every((d) => d.optional),
    JSON.stringify(strengthDays(early).map((d) => d.optional)));
  ok('[WC-130] early off-season requires no running', ['WC-130'],
    !OFFSEASON_OVERLAYS.early_optional.runningRequired
    && OFFSEASON_OVERLAYS.early_optional.loadAdjustment === 0.75
    && OFFSEASON_OVERLAYS.early_optional.maxRestDays === 3);

  const transition = built({ phase: 'Off-season', offseasonBlock: 'transition',
    gymAccessDays: [MON, WED, FRI] });
  ok('[WC-131] transition off-season: the skeleton is REQUIRED again, at 90%',
    ['WC-131'],
    strengthDays(transition).every((d) => !d.optional)
    && OFFSEASON_OVERLAYS.transition.loadAdjustment === 0.90
    && OFFSEASON_OVERLAYS.transition.sessionsRequired);

  ok('[WC-132] normal build: normal load, and a sprint exposure is required',
    ['WC-132'],
    OFFSEASON_OVERLAYS.normal_build.loadAdjustment === null
    && OFFSEASON_OVERLAYS.normal_build.sprintExposureRequired
    && OFFSEASON_OVERLAYS.normal_build.conditioningTarget.max === 5);

  ok('[WC-133] pre-season targets four conditioning exposures', ['WC-133'],
    PRESEASON_OVERLAY.conditioningTarget.min === 4
    && PRESEASON_OVERLAY.sessionsRequired);
  ok('[WC-134] in-season has NO scheduled calendar deload', ['WC-134'],
    INSEASON_OVERLAY.loadAdjustment === null
    && INSEASON_OVERLAY.statement.includes('No scheduled calendar deload'));

  // WC-135 — the in-season sprint is only added when there is NO club training.
  // The contract's OWN in-season reference week: club nights ARE gym days, which
  // is what "Gym may share a club-training day" means in practice.
  const withClub = built({ phase: 'In-season', gymAccessDays: [MON, TUE, THU],
    clubNights: [TUE, THU], gameDay: SAT });
  ok('[WC-135] in-season, no app sprint is added when club training exists',
    ['WC-135'],
    !withClub.days.some((d) => d.conditioning === 'sprint_high_speed'),
    JSON.stringify(withClub.days.map((d) => d.conditioning)));
  // ⚠ THE POSITIVE CASE, AND IT IS THE ONE THAT WAS MISSING. Without it the cell
  // above was GREEN AND EMPTY: the scheduler emitted no sprint under any
  // conditions, so "no sprint when club training exists" could not fail. The
  // mutation harness found it — flipping the rule reddened nothing.
  const noClub = built({ phase: 'In-season', gymAccessDays: [MON, TUE, THU],
    clubNights: [], gameDay: SAT });
  const sprintDays = noClub.days.filter((d) => d.conditioning === 'sprint_high_speed');
  ok('[WC-135] ...and a sprint IS added when there is no club training',
    ['WC-135'], sprintDays.length === 1,
    JSON.stringify(noClub.days.map((d) => [d.dayOfWeek, d.conditioning])));
  const order = [MON, TUE, WED, THU, FRI, SAT, SUN];
  ok('[WC-135] ...placed G-3 or earlier', ['WC-135'],
    sprintDays.every((d) => order.indexOf(d.dayOfWeek) <= order.indexOf(SAT) - 3),
    JSON.stringify(sprintDays.map((d) => d.dayOfWeek)));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[patterns] Weekly movement coverage and paired balance');
// ═══════════════════════════════════════════════════════════════════════════
{
  const week = built({ phase: 'Pre-season', gymAccessDays: [MON, TUE, THU, FRI] });
  ok('[WC-020] the eight named patterns are the contract\'s required set',
    ['WC-020'], REQUIRED_PATTERNS.length === 8);
  ok('[WC-021] every pattern\'s partner is its own inverse', ['WC-021'],
    REQUIRED_PATTERNS.every((p) => PATTERN_PARTNER[PATTERN_PARTNER[p]] === p));
  ok('[WC-023] a four-session pre-season week intends both lower pairs',
    ['WC-023'],
    week.intendedPatterns.includes('squat') && week.intendedPatterns.includes('hinge')
    && week.intendedPatterns.includes('single_leg_knee')
    && week.intendedPatterns.includes('single_leg_hip'),
    JSON.stringify(week.intendedPatterns));
  // ⚠ AND A WEEK THAT ACTUALLY CONTAINS A FULL-BODY SESSION. The cell above uses
  // Upper x2 + Lower x2, so gutting `full_body`'s pattern list changed nothing in
  // it — the harness found the blind spot.
  const withFullBody = built({ phase: 'Off-season', offseasonBlock: 'normal_build',
    gymAccessDays: [MON, WED, FRI] });
  ok('[WC-023] a full-body session intends the lower patterns too', ['WC-023'],
    withFullBody.days.filter((d) => d.purpose === 'full_body')
      .every((d) => d.movementIntention.includes('squat')
        && d.movementIntention.includes('hinge')),
    JSON.stringify(withFullBody.days.map((d) => [d.purpose, d.movementIntention])));
  ok('[WC-047] and 2-3 upper exposures', ['WC-047'],
    strengthDays(week).filter((d) => !PURPOSE_IS_LOWER[d.purpose as SessionPurpose])
      .length >= GLOBAL_RULES.upperExposures.min);
  ok('[WC-048] the daily movement ceiling is 7, and it is a ceiling', ['WC-048'],
    GLOBAL_RULES.dailyMovementCeiling === 7);
  ok('[WC-045] conditioning targets 3-5 with a fifth off-leg', ['WC-045'],
    GLOBAL_RULES.conditioning.min === 3 && GLOBAL_RULES.conditioning.max === 5
    && GLOBAL_RULES.conditioning.fifthIsOffLeg);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[refusal] A schedule that cannot be built stays a TYPED refusal');
// ═══════════════════════════════════════════════════════════════════════════
{
  // Four required pre-season sessions, but a Saturday game and only three legal
  // days once G-1/G+1 come off.
  const impossible = scheduleWeek(inputs({
    phase: 'Pre-season', gymAccessDays: [MON, FRI, SAT, SUN], gameDay: SAT, age: 24,
  }));
  // ⚠ THE FINDING IS NAMED, NOT JUST ITS EXISTENCE. Asserting only "it refused"
  // passed even when the not-enough-days branch was skipped entirely and a
  // DIFFERENT refusal answered — the harness caught that by removing the branch
  // and reddening nothing.
  ok('[WC-142] an unbuildable week REFUSES with the RIGHT typed finding',
    ['WC-142'],
    scheduleRefused(impossible)
    && (impossible as any).finding === 'not_enough_legal_gym_days'
    && typeof (impossible as any).clauseId === 'string',
    JSON.stringify(impossible));
  ok('[WC-142] ...and it is never silently repaired into a smaller week',
    ['WC-142'],
    scheduleRefused(impossible) && !('days' in impossible));

  const noLayout = scheduleWeek(inputs({ gymAccessDays: [MON] }));
  ok('[WC-142] one gym day has no approved layout and refuses', ['WC-142'],
    scheduleRefused(noLayout)
    && (noLayout as any).finding === 'no_layout_for_phase_and_availability',
    JSON.stringify(noLayout));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[registry] EVERY typed clause is represented and guarded');
// ═══════════════════════════════════════════════════════════════════════════
{
  const registryIds = new Set(WEEKLY_CONTRACT_CLAUSES.map((c) => c.id));
  ok('[registry non-vacuity] the contract has clauses and cells claimed some', [],
    registryIds.size >= 25 && guardedClauseIds.size >= 20,
    `${registryIds.size} clauses, ${guardedClauseIds.size} guarded`);

  const unguarded = [...registryIds].filter((id) => !guardedClauseIds.has(id)).sort();
  ok('every contract clause is exercised by at least one behavioural cell', [],
    unguarded.length === 0,
    `UNGUARDED: ${JSON.stringify(unguarded)}\n      `
    + 'Add a cell that RUNS the scheduler for this clause — a source-text check '
    + 'is not a guard.');

  const phantom = [...guardedClauseIds].filter((id) => !registryIds.has(id)).sort();
  ok('no cell claims a clause id the contract does not have', [],
    phantom.length === 0, `PHANTOM: ${JSON.stringify(phantom)}`);

  // Every clause carries provenance back to the approved document.
  const noProvenance = WEEKLY_CONTRACT_CLAUSES
    .filter((c) => !c.provenance.startsWith('§')).map((c) => c.id);
  ok('every clause names the document section it comes from', [],
    noProvenance.length === 0, JSON.stringify(noProvenance));

  // Every base layout row is reachable through the ONE entry point.
  const unreachable = BASE_LAYOUTS.filter((row) => !row.gymDays.some((n) =>
    [2, 3, 4, 5, 6].includes(n)));
  ok('every base layout row answers for a real availability count', [],
    unreachable.length === 0, JSON.stringify(unreachable.map((r) => r.clauseId)));
  ok('baseLayoutFor is total over phase x 2-6 gym days', ['WC-142'],
    (['In-season', 'Pre-season', 'Off-season'] as ContractPhase[]).every((phase) =>
      [2, 3, 4, 5, 6].every((n) =>
        baseLayoutFor({ phase, gymDayCount: n, weekendAvailable: false }) !== null
        && baseLayoutFor({ phase, gymDayCount: n, weekendAvailable: true }) !== null)));

  console.log(`\n  CONTRACT REGISTRY: ${registryIds.size} clauses, `
    + `${guardedClauseIds.size} guarded, ${unguarded.length} unguarded`);
}

const total = passed + failures.length;
console.log(`\nWeekly scheduler: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
