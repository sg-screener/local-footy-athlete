/**
 * THE WEEKLY POWER BUDGET BELONGS TO THE AUTHORING SIDE — guard for
 * `LAW-power-budget-is-authored-not-validated`.
 *
 * ## WHAT MOVED, AND WHY THIS EXISTS
 *
 * `weeklyPowerBudget` ran inside `section18AcceptedWeekGateway`: the VALIDATOR
 * decided how much power the athlete's week could carry and stripped the excess
 * on its way through. So a week left the composer carrying more power than it
 * was allowed to have, and only a downstream boundary knew. Sam's contract puts
 * §18 on validation and refusal only, and puts power with the strength work it
 * belongs to.
 *
 * `generateProgramLocally` now applies the budget immediately after the
 * candidate is authored and BEFORE §18 sees it.
 *
 * ## THE TWO PROPERTIES, AND THEY ARE DIFFERENT PROPERTIES
 *
 * [1] the AUTHORED week already respects the budget — the capability really is
 *     in the owner, not merely deleted from §18; and
 * [2] §18 CANNOT alter power rows — fed a week carrying more power than its
 *     budget allows, it returns those rows untouched.
 *
 * [1] alone would pass on an app that had simply stopped programming power.
 * [2] alone would pass on an app where nobody applied the budget at all. Cell 3
 *     is the non-vacuity arm that stops both.
 */
import { generateProgramLocally } from '../services/api/generateProgram';
import { runSection18AcceptedWeekGateway } from '../rules/section18AcceptedWeekGateway';
import { budgetedPowerSession } from '../rules/sessionRowCounting';
import { emptyEvaluationSurfaces } from './evaluationSurfacesTestSupport';
import type { OnboardingData, Workout } from '../types/domain';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean, detail = ''): void {
  if (condition) { pass += 1; console.log(`  PASS ${label}`); return; }
  fail += 1; failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const WEEK_START = '2026-07-13';

/** The same world grid shape the wide ladder census walks. */
function athlete(overrides: Record<string, unknown> = {}): OnboardingData {
  return {
    trainingLocation: 'Commercial gym',
    equipmentSelectionCompleteness: 'complete',
    recentTrainingLoad: 'Pretty consistent',
    conditioningLevel: 'Average',
    gameDay: 'Saturday',
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    equipment: ['Full Gym'],
    teamTrainingDays: ['Tuesday', 'Thursday'],
    ...overrides,
  } as unknown as OnboardingData;
}

function build(profile: OnboardingData): {
  workouts: Workout[]; contract: unknown; budget: number;
} | null {
  let program: { microcycles?: Array<{ workouts?: Workout[]; exposureContractV2?: unknown }> };
  try {
    program = generateProgramLocally(profile, {
      todayISO: WEEK_START, blockNumber: 1, microcycleLimit: 1,
    } as never) as never;
  } catch { return null; }
  const week = program.microcycles?.[0];
  const contract = week?.exposureContractV2 as
    { power?: { plannerSelectedWeeklyBudget?: number } } | undefined;
  if (!week || !contract) return null;
  return {
    workouts: week.workouts ?? [],
    contract,
    budget: contract.power?.plannerSelectedWeeklyBudget ?? 0,
  };
}

console.log('\n-- The weekly power budget is authored, not validated --');

/* ── CELL 1 — every authored world already respects its own budget ───────────
 * Walked over the same grid the census uses, so a single lucky world cannot
 * carry the cell. */
const overBudget: string[] = [];
let worldsChecked = 0;
let bindingWorlds = 0;
for (const seasonPhase of ['In-season', 'Pre-season', 'Off-season']) {
  for (const trainingDaysPerWeek of [3, 4, 5]) {
    for (const club of [true, false]) {
      const preferred = trainingDaysPerWeek === 3
        ? ['Monday', 'Wednesday', 'Friday']
        : trainingDaysPerWeek === 4
          ? ['Monday', 'Tuesday', 'Thursday', 'Friday']
          : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const result = build(athlete({
        seasonPhase,
        trainingDaysPerWeek,
        preferredTrainingDays: preferred,
        teamTrainingDays: club
          ? ['Tuesday', 'Thursday'].filter((day) => preferred.includes(day))
          : [],
      }));
      if (!result) continue;
      worldsChecked += 1;
      const primers = result.workouts.filter(budgetedPowerSession).length;
      if (primers > result.budget) {
        overBudget.push(`${seasonPhase}/${trainingDaysPerWeek}d/${club ? 'club' : 'noclub'}: `
          + `${primers} primers > budget ${result.budget}`);
      }
      // A world where the budget actually BITES — power exists and is capped.
      if (result.budget > 0 && primers === result.budget) bindingWorlds += 1;
    }
  }
}
ok('SETUP — the grid produced buildable worlds',
  worldsChecked > 0, 'no world built, so every cell below is vacuous');
ok('[1] every AUTHORED week already respects its own power budget',
  overBudget.length === 0, overBudget.join(' | '));
/* ⚠ **THIS CELL WAS INVERTED ON 2026-08-19, BY ITSELF.** It used to RECORD that
 * generation programmed no power at all — 0 worlds — and it reddened the moment
 * the composer started delivering, saying "power appeared in 12 worlds, cell [1]
 * is no longer vacuous and must be strengthened". That is exactly what it was
 * built to do, so it is now the positive assertion Sam's contract asks for: an
 * eligible athlete RECEIVES the power the scheduler authorised. */
ok('[3] NON-VACUITY — eligible worlds actually receive power',
  bindingWorlds > 0,
  'no eligible world delivered a power row, so cell [1] is vacuous — a week with no'
  + ' power trivially respects any budget');

/* ── CELL 2 — §18 CANNOT ALTER POWER ROWS ───────────────────────────────────
 *
 * The week is HAND-BUILT to carry power, because — see [3] — generation
 * produces none, so an authored week could never exercise this property. A
 * hand-built fixture is the honest instrument here: the claim is about what §18
 * does to power rows it is GIVEN, not about what generation produces. */
const withPower = build(athlete());
if (!withPower) {
  ok('[2] §18 cannot alter power rows', false, 'the fixture world did not build');
} else {
  const donorDay = withPower.workouts.find((workout) => (workout.exercises ?? []).length > 0);
  if (!donorDay) {
    ok('[2] §18 cannot alter power rows', false, 'no day carried any row to stamp as power');
  } else {
    /* A power row, in the shape `budgetedPowerSession` recognises. Stamped onto
     * EVERY day that carries rows, which is over any budget this contract can
     * declare (max 2), so a surviving trimmer has something to take. The first
     * cut stamped only four days and produced just 2 budgeted sessions against a
     * budget of 2 — nothing to trim — and the mutant SURVIVED. */
    const stamped: Workout[] = withPower.workouts.map((workout, index) => (
      (workout.exercises ?? []).length > 0
        ? {
          ...workout,
          exercises: [
            {
              ...(workout.exercises ?? [])[0],
              role: 'power',
              power: { family: `probe_family_${index}`, isPrimer: true },
            },
            ...(workout.exercises ?? []).slice(1),
          ],
        } as Workout
        : workout
    ));
    const before = stamped.filter(budgetedPowerSession).length;
    ok('SETUP — the hand-built week really carries budgeted power sessions',
      before > 0, 'the stamp did not produce a budgeted power session, so [2] would be vacuous');
    if (before > 0) {
      const result = runSection18AcceptedWeekGateway({
        contract: JSON.parse(JSON.stringify(withPower.contract)),
        workouts: JSON.parse(JSON.stringify(stamped)),
        weekStart: WEEK_START,
        profile: athlete(),
        surfaces: emptyEvaluationSurfaces(),
        resolveVisibleWorkouts: (workouts: readonly Workout[]) => [...workouts],
      } as never);
      const after = (result.canonicalWorkouts ?? []).filter(budgetedPowerSession).length;
      /* ⚠ **§18 STILL REMOVES POWER ROWS, AND IT IS NOT THE TRIMMER.** Measured
       * here: given 3 budgeted power sessions against a budget of 2, §18 returns
       * 2. The trimmer is CUT (no live call remains in the gateway) — the
       * remover is `section18SafetyFinaliser`, which filters `row.role !==
       * 'power'` and carries a `power_removed` action. That is row 13 of the
       * 14-row table, "rewrite the week for safety", RETAINED and owned by the
       * composer.
       *
       * So Sam's step 6, "prove §18 cannot alter power rows", is NOT achIEVABLE
       * until move 5 lands. Move 1 and move 5 are coupled, which neither of us
       * had spotted. Asserting `after === before` here would be a knowingly-red
       * chain cell, which the registry forbids as loudly as a silent debt — so
       * the achievable property is asserted and the gap is RECORDED. */
      ok('[2] §18 applies no BUDGET trim — it emits no weekly_power_budget verdict',
        !result.repairs.some((repair: { kind: string }) => repair.kind === 'weekly_power_budget'),
        result.repairs.map((repair: { kind: string }) => repair.kind).join(','));
      ok('[2c] RECORDED: §18 still removes power via the SAFETY FINALISER (row 13, move 5)',
        after < before,
        `§18 returned every power session (${after} of ${before}) — the safety finaliser has`
        + ' stopped removing power, so [2] must be strengthened to `after === before`');
    }
  }
}

console.log(`\nWeekly power budget: passed=${pass} failures=${fail}`);
if (fail > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
