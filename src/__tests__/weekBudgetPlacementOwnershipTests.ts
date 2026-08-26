/**
 * THE BUILDER OWNS THE WEEK — the four boundaries finding 3's placement unit
 * created, asserted where the goldens cannot reach.
 *
 * Step 3 of the approved build order
 * (`docs/FINDING_3_PLACEMENT_REASSESSMENT_APPROVAL_2026-08-06.md`). The unit
 * landed at `c72797e0`; its boundary report is
 * `docs/FINDING_3_STEP2_BOUNDARY_REPORT_2026-08-06.md`.
 *
 * WHY A SUITE AND NOT MORE GOLDEN. The differential matrices pin what generation
 * PRODUCES; they cannot state what it must never do. Two of these four
 * boundaries are invisible to them by construction:
 *
 *   - `visibleCounts` carries no full-rest-day count, so no golden can witness
 *     the working-day budget — the very metric the original defect breached.
 *     `C1` asserts it on the LEDGER (as cover; see the matrix below).
 *   - a golden records the day work landed on, never the ORDER in which
 *     candidates were considered. Attach-first was already implemented in the
 *     eligibility FILTER and contradicted in the comparator, and every golden
 *     passed throughout, because the ruled day was in the candidate list and
 *     merely last in it. `B1` asserts the choice, not the eligibility, and kills the
 *     mutant that reverts it.
 *
 * EVERY CELL IS GUARDED AGAINST VACUITY. Each one first asserts that its world
 * actually reaches the condition it is about — a restricted contract, a week with
 * a rest requirement, a mode that permits an offer. `a gate passing on
 * coordinates it never builds` is the shape Sam has named five times, and a
 * budget assertion on a week with no budget would be the sixth.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MUTATION MATRIX — WHICH CELLS ARE WITNESSES, measured 2026-08-06
 *
 * `X` = the cell reds, killing the mutant. `.` = the mutant survives.
 *
 *   mutant                                           | C1 C2 B1 C3 C4 B2
 *   -------------------------------------------------|------------------
 *   A  budget removed (`freeSlots` ignores the quota) | .  .  .  .  .  .
 *   B  attach-first comparator reverted               | .  .  X  .  .  .
 *   C  `:776` Math.max restored                       | .  .  .  .  .  .
 *   D  demote loop caps at the authored MAX again     | .  .  .  .  .  X
 *
 * TWO BOUNDARIES ARE WITNESSED — `B1` and `B2`. They carry boundary names because
 * they earn them: each kills the mutant that removes the mechanism it is about.
 *
 * THE `C` CELLS ARE REGRESSION COVER AND SAY SO IN THEIR OWN NAMES. Every property
 * they assert is TRUE and worth holding, but none can observe its mechanism being
 * removed, so none may be read as pinning the budget or the derivation. Renaming
 * them was the point: a cell that keeps a boundary name it does not hold is how
 * `a gate passing on coordinates it never builds` gets written in the first place.
 *
 * WHY C1 CANNOT BE WITNESSED, and it is a finding rather than a gap in effort.
 * The budget can only bind when the days a week WANTS exceed `7 - fullRest.required`.
 * Measured across the reachable off-season shapes — 6 preferred days AND 7, with
 * and without restriction — a 4-strength / 3-conditioning demand occupies FOUR days
 * against an allowance of five, with a spare rest day left over. Adding preferred
 * days does not help: it adds allowance as fast as it adds candidates. So no
 * onboarding answer reachable today produces a week where removing the budget costs
 * the athlete a rest day, which means `restBudgetSpare()` is a correct guard with no
 * reachable subject — the same shape as Sam's ruling that "a path nothing can reach
 * is a fixture with no subject". It is kept because it is cheap and right, not
 * because anything proves it fires. If a mode ever authors a rest requirement of 3,
 * or a demand that needs five distinct days, C1 becomes witnessable and should be
 * promoted then.
 *
 * WHY C4 CANNOT BE WITNESSED. It is masked by B2's mechanism: with the demote loop
 * obeying the declaration, no flush is ever stamped in mid off-season, so a restored
 * `Math.max(policyMin, countInPlan)` reads 0 anyway. After the demote fix, `:776`'s
 * `Math.max` was DEAD rather than wrong — retiring it removed dead code, which
 * corrects how step 2's boundary report describes that change.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Run: npm run test:week-budget-placement
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — week placement is an on-device law');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { OnboardingData } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { evaluateEffectiveWeekExposureContract } from '../rules/weeklyExposureContract';
import { declaredOfferCount } from '../rules/section18OfferPlacement';

const TODAY_ISO = '2026-07-13';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}`, error instanceof Error ? error.message : String(error));
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn;
  const error = console.error;
  console.warn = () => undefined;
  console.error = () => undefined;
  try {
    return body();
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

function profile(overrides: Record<string, unknown> = {}): OnboardingData {
  return {
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: 'Off-season',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: '2-5 years',
    conditioningLevel: 'Elite',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    motivation: 'Build strength and football fitness',
    ...overrides,
  } as unknown as OnboardingData;
}

/**
 * The §4 repro's restriction: a 7/10 hamstring, which prohibits squat and hinge
 * and leaves push and pull safe. The world the whole unit was measured in
 * (`docs/FINDING_3_BUILD_MEASUREMENT_2026-08-06.md` §4).
 */
function hamstringConstraint(): Record<string, unknown> {
  return {
    id: 'placement:hamstring-restriction',
    type: 'injury',
    bodyPart: 'hamstring',
    bucket: 'hamstring',
    severity: 7,
    status: 'active',
    startDate: TODAY_ISO,
    lastUpdatedAt: `${TODAY_ISO}T00:00:00.000Z`,
    adjustmentLevel: 'moderate',
    seriousSymptoms: false,
    rules: ['No high-speed running or loaded hinge work'],
    safeFocus: ['Upper body and pain-free recovery work'],
    advice: [],
  };
}

interface WeekView {
  weekStart: string;
  mode: string;
  legacy: any;
  v2: any;
  workouts: any[];
  ledger: any;
  accepted: boolean;
  unresolved: any[];
}

function weeksOf(args: { restricted: boolean; athlete?: OnboardingData }): WeekView[] {
  const program = quiet(() => generateProgramLocally(args.athlete ?? profile(), {
    todayISO: TODAY_ISO,
    previousProgram: null,
    ...(args.restricted ? { activeConstraints: [hamstringConstraint()] } : {}),
  } as never)) as any;
  return program.microcycles.map((week: any): WeekView => {
    const weekStart = String(week.startDate).slice(0, 10);
    const result = evaluateEffectiveWeekExposureContract(
      week.exposureContract, week.workouts, weekStart,
    ) as any;
    return {
      weekStart,
      mode: week.exposureContract?.identity?.mode ?? 'unknown',
      legacy: week.exposureContract,
      v2: week.exposureContractV2,
      workouts: week.workouts,
      ledger: result.ledger,
      accepted: result.accepted === true,
      unresolved: result.unresolvedShortfalls ?? [],
    };
  });
}

const restrictedWeeks = weeksOf({ restricted: true });
const healthyWeeks = weeksOf({ restricted: false });

/**
 * THE OFFER LIVES IN THE FIXTURE WEEK, and the off-season worlds above cannot
 * reach it — measured, not assumed: cell 3's vacuity guard fired on them.
 *
 * Off-season authors `optionalRecoveryAerobic`, a different offer with a different
 * role; the FLUSH is authored by the in-season game week (`:81`, and the world
 * 1b's whole unit was measured in). So the offer boundaries need an in-season
 * fixture week, healthy and restricted.
 */
function inSeasonAthlete(): OnboardingData {
  return profile({
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  });
}

const fixtureWeeks = [
  ...weeksOf({ restricted: false, athlete: inSeasonAthlete() }),
  ...weeksOf({ restricted: true, athlete: inSeasonAthlete() }),
];

/**
 * THE WORLD WHERE THE ORDERING IS LOAD-BEARING, found by measurement rather than
 * by choosing a world that looked hard.
 *
 * Off-season does not pressure the ordering: measured at 6 AND 7 preferred days,
 * a 4-strength / 3-conditioning demand occupies 4 days with 3 spare either way, so
 * attaching happens through the eligibility filter's training order and the
 * comparator changes nothing. That is why mutants A and B both survived the
 * off-season cells.
 *
 * The practice-match week does pressure it, and there is direct evidence: reverting
 * the comparator moves this world's golden and only this world's
 * (`docs/FINDING_3_MATRIX_COVERAGE_PREDICTIONS_2026-08-06.md` correction B) —
 * Wednesday goes from `Mixed/tempo` back to a standalone `Conditioning/tempo`
 * while Thursday and Friday stay strength-only.
 */
function practiceMatchAthlete(): OnboardingData {
  return profile({
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Tuesday'],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  });
}

const orderingWeeks = weeksOf({ restricted: false, athlete: practiceMatchAthlete() });

/** Core conditioning present on the day, ignoring an optional flush. */
function hasCoreConditioning(workout: any): boolean {
  const role = workout.section18Evidence?.conditioningRole ?? workout.section18ConditioningRole;
  if (role === 'optional_flush' || role === 'optional_recovery_aerobic') return false;
  return !!workout.conditioningCategory || workout.hasCombinedConditioning === true;
}

function hasMainStrength(workout: any): boolean {
  return (workout.exercises ?? []).some((row: any) =>
    row.section18Evidence?.role === 'main_strength');
}

function isAnchor(workout: any): boolean {
  return workout.workoutType === 'Team Training' || workout.workoutType === 'Game';
}

/** A day carrying BOTH a main-strength row and conditioning — an ATTACH. */
function isAttachedDay(workout: any): boolean {
  const rows = workout.exercises ?? [];
  const hasMain = rows.some((row: any) => row.section18Evidence?.role === 'main_strength');
  const hasConditioning = !!workout.conditioningBlock?.options?.length ||
    !!workout.conditioningCategory || workout.hasCombinedConditioning === true;
  return hasMain && hasConditioning;
}

function flushDays(workouts: any[]): number[] {
  return workouts
    .filter((workout) => workout.section18Evidence?.conditioningRole === 'optional_flush' ||
      workout.section18ConditioningRole === 'optional_flush')
    .map((workout) => workout.dayOfWeek);
}

console.log('\n-- Regression cover: the week\'s rest quota and held demand --');

/**
 * BOUNDARY 1 — the budget, on the ledger.
 *
 * `fullRest.required` is a CONSTRUCTION INPUT, so the week may occupy at most
 * `7 - required` days. Stated as the ledger's own `full_rest` count rather than
 * as a session count on purpose: §4's cell 10 was WEAKER than its own ruling for
 * exactly that reason — a capped day keeps a workout and merely stops carrying
 * main strength, so counting sessions missed the defect entirely.
 */
run('C1 [cover] a restricted week meets its rest quota on the ledger', () => {
  const budgeted = restrictedWeeks.filter((week) => (week.legacy?.fullRest?.required ?? 0) > 0);
  assert(budgeted.length > 0,
    'no restricted week carried a full-rest requirement, so this cell would pass vacuously');
  const restricted = restrictedWeeks.filter((week) =>
    (week.v2?.strengthPatterns?.prohibitedPatterns ?? []).length > 0);
  assert(restricted.length > 0,
    'no week reached a restricted contract — the hamstring constraint stopped prohibiting '
    + 'patterns, so the budget is not being tested under restriction at all');

  for (const week of budgeted) {
    const required = week.legacy.fullRest.required;
    const achieved = week.ledger.achieved.full_rest;
    const occupied = 7 - achieved;
    assert(achieved >= required,
      `${week.weekStart} (${week.mode}) occupied ${occupied} days against a budget of `
      + `${7 - required} (fullRest.required=${required}, ledger full_rest=${achieved}, `
      + `restDays=${JSON.stringify(week.ledger.fullRestDays)}). The builder owns the week: `
      + 'the rest quota is an INPUT to placement, not something a later gate discovers.');
  }
});

/**
 * BOUNDARY 1b — and the budget is not bought by dropping the demand.
 *
 * A week could satisfy cell 1 by simply carrying less work. The ruling is that it
 * holds its frequency AND keeps its rest, so the restricted week is compared to
 * the healthy one: same mode, same strength demand.
 */
run('C2 [cover] a restricted week holds the healthy week\'s strength demand', () => {
  const pairs = restrictedWeeks
    .map((week) => ({ week, control: healthyWeeks.find((other) => other.mode === week.mode) }))
    .filter((pair): pair is { week: WeekView; control: WeekView } =>
      !!pair.control && (pair.week.legacy?.strength?.targetCount ?? 0) > 0);
  assert(pairs.length > 0,
    'no restricted week with strength demand had a same-mode healthy control to compare against');
  for (const { week, control } of pairs) {
    assert(week.legacy.strength.targetCount === control.legacy.strength.targetCount,
      `${week.weekStart} (${week.mode}) restricted strength target `
      + `${week.legacy.strength.targetCount} != healthy ${control.legacy.strength.targetCount}. `
      + 'Bible :4755 — substitute before reducing frequency.');
    assert(week.ledger.achieved.main_strength === control.ledger.achieved.main_strength,
      `${week.weekStart} (${week.mode}) achieved ${week.ledger.achieved.main_strength} `
      + `main-strength exposures against the healthy week's ${control.ledger.achieved.main_strength}`);
  }
});

console.log('\n-- WITNESSED BOUNDARY: attach-first is an ORDERING --');

/**
 * BOUNDARY 2 — attach-first, proven by the CHOICE and not by eligibility.
 *
 * The defect this replaces: the eligibility filter admitted conditioning-carrying
 * days and the comparator sorted them LAST, so the repair reached past every
 * attachable day for an empty one. No golden caught it, because the ruled day WAS
 * in the candidate list.
 *
 * The observable that separates the two: a week that attached will have a day
 * carrying strength AND conditioning together while STILL holding a spare day the
 * repair could have spent. A week that took the free day first has the attach
 * missing and the spare day gone.
 */
run('B1 the ruled ORDER — a standalone conditioning day never coexists with a strength-only day', () => {
  const candidates = orderingWeeks.filter((week) =>
    week.legacy?.conditioning?.allowCombinedStrengthConditioning === true &&
    (week.legacy?.strength?.targetCount ?? 0) > 0);
  assert(candidates.length > 0,
    'no week in the practice-match world both demanded strength and permitted combining, so '
    + 'nothing here exercises the attach-vs-standalone choice');

  let witnessed = 0;
  for (const week of candidates) {
    const app = week.workouts.filter((workout: any) => !isAnchor(workout));
    const conditioningOnly = app.filter((workout: any) =>
      hasCoreConditioning(workout) && !hasMainStrength(workout));
    const strengthOnly = app.filter((workout: any) =>
      hasMainStrength(workout) && !hasCoreConditioning(workout));
    // The pair is what the ruled order forbids: if BOTH exist, the repair had an
    // attachable day in its candidate list and reached past it for a day of its
    // own. Asserted as the PAIR rather than as a count, so it states the choice
    // and not the shape of one particular week.
    if (conditioningOnly.length > 0 && strengthOnly.length > 0) {
      throw new Error(
        `${week.weekStart} (${week.mode}) carries standalone core conditioning on day(s) `
        + `${JSON.stringify(conditioningOnly.map((w: any) => w.dayOfWeek))} AND strength-only work on `
        + `day(s) ${JSON.stringify(strengthOnly.map((w: any) => w.dayOfWeek))} while the contract `
        + 'permits combining. Sam\'s ruled fallback order is attach FIRST, free day second, '
        + 'displace last — those two days should have been one. The eligibility filter has always '
        + 'admitted the conditioning day; the comparator is what must PREFER it.');
    }
    if (conditioningOnly.length > 0 || app.some((w: any) =>
      hasCoreConditioning(w) && hasMainStrength(w))) witnessed += 1;
  }
  assert(witnessed > 0,
    'no week carried core conditioning at all, so the invariant held vacuously');
});

console.log('\n-- Regression cover: the offer never costs required structure --');

/**
 * BOUNDARY 3 — an offer is moved or dropped, never honoured at the week's expense,
 * and never refuses the week.
 *
 * Sam's offer-survival rulings (2026-08-06): the offer is ADVISORY. Bible `:4688`
 * step 3 — "move or remove lower-priority optional work to recover space or
 * stress" — is the authored answer when it cannot fit.
 *
 * The measured defect: `activeDays` in the §18 ledger does not read the
 * conditioning ROLE, so a day whose only content was a flush counted toward
 * not-a-rest-day while counting toward nothing in `:127`'s arithmetic. An offer
 * nobody declared could therefore buy a required rest day.
 */
run('C3 [cover] no week is refused for its offer, and none holds one below its rest quota', () => {
  const all = [...restrictedWeeks, ...healthyWeeks, ...fixtureWeeks];
  const offering = all.filter((week) => declaredOfferCount(week.v2.conditioning) > 0);
  assert(offering.length > 0,
    'no week in either world declared an offer, so this cell would pass vacuously');

  for (const week of all) {
    const offerShortfalls = week.unresolved.filter((entry: any) =>
      String(entry.code ?? '').includes('flush') || String(entry.code ?? '').includes('offer'));
    assert(offerShortfalls.length === 0,
      `${week.weekStart} (${week.mode}) was refused over its offer: `
      + `${JSON.stringify(offerShortfalls)}. The offer is advisory — a missing one is a `
      + 'repairable finding, never a refusal.');

    const required = week.legacy?.fullRest?.required ?? 0;
    if (required <= 0) continue;
    const flushes = flushDays(week.workouts);
    if (flushes.length === 0) continue;
    // A flush is only honoured where the week can afford the day it sits on. If
    // removing it would be needed to meet the rest quota, it was honoured at the
    // price of required structure and should have been moved or dropped.
    const restWithOffer = week.ledger.achieved.full_rest;
    assert(restWithOffer >= required,
      `${week.weekStart} (${week.mode}) presents an offer on day(s) `
      + `${JSON.stringify(flushes)} while holding only ${restWithOffer} of ${required} required `
      + 'rest days. An offer never costs the week required structure — a flush that cannot '
      + 'fit is MOVED or DROPPED (Bible :4688 step 3), not honoured at that price.');
  }
});

console.log('\n-- WITNESSED BOUNDARY: the declaration is derived, never counted --');

/**
 * BOUNDARY 4 — `plannerSelectedCount` is independent of the plan.
 *
 * `coachingEngine` used to declare the offer as
 * `Math.max(policyMin, flushesAlreadyInThePlan)`, so the allocator stamped a
 * surplus conditioning day as a flush and the next contract build read the stamp
 * back as the declaration. The plan authored its own contract — a stored output
 * wearing a decision's clothes.
 *
 * Mid off-season authors `optionalFlush: { min: 0, max: 1 }`: it PERMITS an offer
 * and SELECTS none. That is the discriminating mode — a count-off-the-plan reads
 * 1 there, a derivation from policy reads 0, and the permitted maximum is
 * asserted alongside so the cell cannot be satisfied by a mode that simply
 * forbids offers.
 */
run('C4 [cover] a mode that permits an offer but selects none declares ZERO', () => {
  const midWeeks = [...restrictedWeeks, ...healthyWeeks]
    .filter((week) => week.mode === 'mid_offseason');
  assert(midWeeks.length > 0, 'no mid-off-season week was generated, so this cell has no subject');
  for (const week of midWeeks) {
    const offer = week.v2.conditioning.optionalFlush;
    assert(offer.permitted === true && offer.preferredRange.max > 0,
      `${week.weekStart} mid off-season stopped permitting an offer (permitted=`
      + `${offer.permitted}, max=${offer.preferredRange.max}). The cell needs a mode that ALLOWS `
      + 'one and selects none, or it proves nothing about the declaration.');
    assert(offer.plannerSelectedCount === 0,
      `${week.weekStart} mid off-season declared ${offer.plannerSelectedCount} offer(s) where the `
      + 'authored policy selects none. The declaration is DERIVED from the mode, never counted '
      + 'off the plan it governs — a count reads back whatever the allocator happened to stamp.');
  }
});

/**
 * BOUNDARY 4's COMPANION — the loop side (approval clarification, 2026-08-06).
 *
 * Cell 4 pins the contract. This pins the demote loop: it stamps at most
 * `declaredOfferCount()` flushes and clears the rest, so surplus beyond the
 * declaration never survives AS an offer. Without this, cell 4 could hold while
 * the allocator still stamped surplus the contract had not declared — the two
 * halves of the same defect.
 */
run('B2 surplus beyond the declaration never survives as a stamped flush', () => {
  const all = [...restrictedWeeks, ...healthyWeeks, ...fixtureWeeks];
  assert(all.length > 0, 'no weeks generated');
  let checked = 0;
  for (const week of all) {
    const declared = declaredOfferCount(week.v2.conditioning);
    const present = flushDays(week.workouts);
    checked += 1;
    assert(present.length <= declared,
      `${week.weekStart} (${week.mode}) carries ${present.length} stamped flush(es) on days `
      + `${JSON.stringify(present)} against a declaration of ${declared}. An undeclared flush is `
      + 'SURPLUS, not an offer: the demote loop clears what the contract never asked for.');
  }
  assert(checked > 0, 'no week was checked');
});

console.log(`\n  week budget + placement ownership totals: ${passed} passed, ${failed} failed`);
if (failures.length > 0) failures.forEach((name) => console.error(`  FAILED: ${name}`));
totalsPrinted(failed);
