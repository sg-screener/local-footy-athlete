(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  },
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import type { OnboardingData, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  requireSection18AcceptedWeek,
  resolveFinalVisibleSection18Week,
  runSection18AcceptedWeekGateway,
  Section18WeekAcceptanceError,
} from '../rules/section18AcceptedWeekGateway';
import {
  assessWeekCraft,
  withCraftSafeTopUps,
} from '../rules/section18CraftTier';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import { athletePlacementForDateOverride } from '../rules/athletePlacement';
import type { WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';
import { emptyEvaluationSurfaces } from './evaluationSurfacesTestSupport';

/**
 * THE CRAFT TIER'S OWN PROOF.
 *
 * `weekStructureValidator` shipped wired to `log`, and a rule that ships wired
 * to a logger is not shipped. The cells below exist to make the opposite state
 * impossible to fake: each one names a week the SECTION 18 CONTRACT accepts and
 * asks whether the SHAPE of that week still gets through.
 *
 * The MEASUREMENT that sets the stakes, taken before the wiring landed: across
 * all 17 `test:qa` scenarios the Section 17 kernel emits **zero `strong`
 * findings**, so turning the tier on changes no generated week today. That is
 * exactly why cell C2 exists — a gate that only ever sees clean weeks is a
 * green empty bind, and the only honest way to know it bites is to hand it a
 * week that violates the craft and watch what the gateway does.
 */

const WEEK_START = '2026-07-13'; // Monday
const NOW = '2026-07-13T00:00:00.000Z';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.error(`  FAIL ${name}`, detail ?? '');
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function dateForDay(dayOfWeek: number): string {
  const date = new Date(`${WEEK_START}T12:00:00`);
  date.setDate(date.getDate() + (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return date.toISOString().slice(0, 10);
}

function inSeasonSaturdayGameProfile(): OnboardingData {
  return {
    gender: 'male',
    seasonPhase: 'In-season',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    // ONE team night, on Tuesday, and the day matters to these cells: Thursday
    // is this week's G-2, and a Thursday team night would make it an ANCHOR —
    // a club commitment the app is not allowed to move. The craft repair would
    // then correctly produce no candidate, and the cells below would be asking
    // about the wrong week.
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Tuesday'],
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: '2-5 years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Elite',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    usualGameDay: 'Saturday',
    injuries: [],
  } as OnboardingData;
}

const athlete = inSeasonSaturdayGameProfile();
const generated = generateProgramLocally(athlete, {
  todayISO: WEEK_START,
  seasonPhaseClock: {
    protocolVersion: 1,
    selectedPhase: 'In-season',
    phaseEntryWeekStartISO: WEEK_START,
    originProvenance: 'explicit_user_phase_change',
    // PRE-EXISTING RED, CLEARED IN PASSING (2026-08-12). This required field
    // was missing from the day this file landed (`2db1b8ce`) and the file was
    // never added to the typecheck baseline, so `test:compile` — which
    // `scripts/sweep.sh` deliberately does not measure — has been failing ever
    // since. It is a fixture field, not a behaviour: sucrase-node runs this
    // suite untyped, so the suite's own result was never affected.
    persistenceProvenance: 'preserved_persisted_state',
  },
  previousProgram: null,
});
const week = generated.microcycles[0];
const contract = week.exposureContractV2 as WeeklyExposureContractV2;

function visible(workouts: readonly Workout[], against = contract): Workout[] {
  return resolveFinalVisibleSection18Week({
    contract: against,
    workouts,
    weekStart: WEEK_START,
    profile: athlete,
    surfaces: emptyEvaluationSurfaces(),
  });
}

/** Every day of the week is still the app's to change unless a cell says otherwise. */
const ALL_DAYS_GOVERNABLE: ReadonlySet<string> = new Set([1, 2, 3, 4, 5, 6, 0].map(dateForDay));

function craftOf(
  workouts: readonly Workout[],
  governableDates: ReadonlySet<string> = ALL_DAYS_GOVERNABLE,
) {
  return assessWeekCraft({
    contract,
    workouts,
    weekStart: WEEK_START,
    profile: athlete,
    governableDates,
  });
}

/**
 * THE PROJECTION IS PINNED FOR THE GATEWAY CELLS, and the reason is a finding.
 *
 * `resolveVisibleWorkouts` is a declared gateway input — "the caller may supply
 * the exact live projection". These cells supply the identity projection
 * because the canonical resolver RE-DERIVES its derived sessions from their own
 * dates, so moving one to another day is silently undone before the tier ever
 * sees it. That self-healing is real and welcome; it also means a mutated
 * candidate cannot be used to ask what the GATEWAY does with a craft violation.
 * Cells A and B keep the real projection, so both questions are answered.
 */
function gateway(workouts: readonly Workout[], opts: {
  contract?: WeeklyExposureContractV2;
  pinProjection?: boolean;
} = {}) {
  return runSection18AcceptedWeekGateway({
    contract: opts.contract ?? contract,
    workouts: clone([...workouts]),
    weekStart: WEEK_START,
    profile: athlete,
    surfaces: emptyEvaluationSurfaces(),
    activeFixtureDates: new Set([dateForDay(6)]),
    ...(opts.pinProjection ? { resolveVisibleWorkouts: (w: readonly Workout[]) => [...w] } : {}),
  });
}

console.log('\n── A. The generated week, measured ──');

const baselineCraft = craftOf(visible(week.workouts));
check('A1 the generated in-season game week has no blocking craft violation',
  baselineCraft.blocking.length === 0,
  baselineCraft.blocking.map((finding) => finding.ruleId));
check('A2 the tier ran on a real week rather than on nothing',
  week.workouts.length > 0 && visible(week.workouts).length > 0,
  { canonical: week.workouts.length, visible: visible(week.workouts).length });

const baselineResult = gateway(week.workouts);
check('A3 the gateway still accepts the week the generator built',
  baselineResult.status !== 'impossible' && baselineResult.craft.blocking.length === 0,
  { status: baselineResult.status, craft: baselineResult.craft.blocking.map((f) => f.ruleId) });

console.log('\n── B. A week the CONTRACT accepts and the CRAFT does not ──');

// Move the lower-strength session onto Thursday — G-2 for a Saturday game.
// Nothing about the week's COUNTS changes: the same session, the same rows,
// one different day. That is the whole point of the cell.
const lowerSource = week.workouts.find((workout) =>
  classifyVisibleSession(workout, athlete).units.some((unit) =>
    unit.category === 'lower_strength'));
check('B0 the generated week contains a lower-strength session to move',
  lowerSource !== undefined,
  week.workouts.map((workout) => `${workout.dayOfWeek}:${workout.name}`));

const G_MINUS_2 = 4; // Thursday, two days before the Saturday game
const craftBreakingWeek: Workout[] = lowerSource
  ? week.workouts
      .filter((workout) => workout.dayOfWeek !== G_MINUS_2)
      .map((workout) => workout.id === lowerSource.id
        ? { ...clone(workout), dayOfWeek: G_MINUS_2 }
        : workout)
  : [];

const brokenCraft = craftOf(craftBreakingWeek);
check('B1 the craft tier names the G-2 hard lower',
  brokenCraft.blocking.some((finding) => finding.ruleId === 'g2_hard_lower'),
  brokenCraft.findings.map((finding) => `${finding.severity}:${finding.ruleId}`));
check('B2 it is a SHAPE finding, not a COUNT one — the day is named',
  brokenCraft.blocking.every((finding) => finding.dates.length > 0),
  brokenCraft.blocking.map((finding) => `${finding.ruleId}@${finding.dates.join(',')}`));

// THE SAME VIOLATION AS A SWAP: the lower session and the Thursday session
// exchange days. Nothing is created, nothing is destroyed, no count moves —
// only the shape. This is the candidate the gateway cells below are asked
// about, and a contract-conformance gate has no reason on earth to reject it.
const swapPartner = week.workouts.find((workout) => workout.dayOfWeek === G_MINUS_2);
const craftBreakingSwap: Workout[] = lowerSource && swapPartner
  ? week.workouts.map((workout) => {
      if (workout.id === lowerSource.id) return { ...clone(workout), dayOfWeek: G_MINUS_2 };
      if (workout.id === swapPartner.id) {
        return { ...clone(workout), dayOfWeek: lowerSource.dayOfWeek };
      }
      return workout;
    })
  : [];
check('B3 the swap fixture exists and violates the craft on G-2',
  craftBreakingSwap.length > 0 &&
    craftOf(craftBreakingSwap).blocking.some((finding) => finding.ruleId === 'g2_hard_lower'),
  craftOf(craftBreakingSwap).blocking.map((finding) => finding.ruleId));

console.log('\n── C. What the gateway does with it ──');

const brokenResult = gateway(craftBreakingSwap, { pinProjection: true });
// NO RESULT MAY CARRY AN UNNAMED CRAFT VIOLATION. Written over the result
// rather than over the status because status alone is vacuous here: an
// unrelated repair (the power budget) already moves this week off `accepted`,
// so a status assertion would pass with the tier switched off.
check('C1 the gateway never publishes a craft violation it has not named',
  brokenResult.craft.blocking.length === 0 ||
    brokenResult.repairs.some((repair) => repair.kind === 'craft_violation_disclosed'),
  { status: brokenResult.status, craft: brokenResult.craft.blocking.map((f) => f.ruleId) });
check('C2 the contract had no objection — this is the craft tier acting alone',
  brokenResult.evaluation.blockingViolations.length === 0,
  brokenResult.evaluation.blockingViolations.map((finding) => finding.code));
/* ⚠ C3 AND C4 WERE DELETED WITH THEIR SUBJECT (2026-08-19, seat `demolition`).
 * They asserted that the gateway MOVES a badly placed session — "not 'the week
 * was flagged' — the week was FIXED". That relocation was §18 authoring, and
 * §18 no longer authors. The behaviour those cells protected is now the
 * scheduler's to get right; C6/C7 below, which were the exhaustion branch, are
 * the main behaviour: a craft violation is DISCLOSED and the week publishes. */
check('C5 the craft verdict describes the SELECTED visible week',
  craftOf(brokenResult.visibleWorkouts).blocking.map((finding) => finding.ruleId).join(',') ===
    brokenResult.craft.blocking.map((finding) => finding.ruleId).join(','),
  {
    result: brokenResult.craft.blocking.map((finding) => finding.ruleId),
    recomputed: craftOf(brokenResult.visibleWorkouts).blocking.map((finding) => finding.ruleId),
  });

// THERE IS NO SEARCH TO EXHAUST. One candidate is evaluated — the authored
// week — and a craft violation it carries is disclosed rather than repaired.
const unrepairable = gateway(craftBreakingSwap, { pinProjection: true });
check('C6 an unrepaired craft violation is DISCLOSED, never silent',
  unrepairable.craft.blocking.length > 0 &&
    unrepairable.repairs.some((repair) => repair.kind === 'craft_violation_disclosed'),
  { status: unrepairable.status, repairs: unrepairable.repairs.map((repair) => repair.kind) });
check('C7 an unrepaired craft violation is not reported as impossible',
  unrepairable.status !== 'impossible' && unrepairable.failureSignature === null,
  { status: unrepairable.status, failureSignature: unrepairable.failureSignature });

// A CANDIDATE MAY FAIL; A FACT MAY NOT BE VETOED. Hydration replays stored
// weeks under `restoration`, and every week on a device today was built before
// this tier existed. If a craft violation could throw here, the app would stop
// opening on its own history.
let restorationThrew = false;
try {
  requireSection18AcceptedWeek({
    contract,
    workouts: clone(craftBreakingSwap),
    weekStart: WEEK_START,
    profile: athlete,
    surfaces: emptyEvaluationSurfaces(),
    activeFixtureDates: new Set([dateForDay(6)]),
    resolveVisibleWorkouts: (workouts: readonly Workout[]) => [...workouts],
  });
} catch (error) {
  restorationThrew = error instanceof Section18WeekAcceptanceError ||
    (error as { code?: string })?.code === 'section18_week_rejected';
}
check('C8 a craft-only shortfall never throws a restoration', !restorationThrew);

console.log('\n── D. What the tier refuses to block on ──');

// FACT DAYS. Work the athlete already did cannot be repaired, so blocking on it
// would make a week unrepairable for a reason no repair can reach. The set is
// stated outright because that is exactly how the tier receives it: candidate
// assembly owns the governance boundary and TELLS the tier — this module may
// not read `governedFromISO`, and `test:gateway-authority-census` holds it.
const fridayOnwards: ReadonlySet<string> = new Set([5, 6, 0].map(dateForDay));
const factCraft = craftOf(craftBreakingWeek, fridayOnwards);
check('D1 a violation on a fact day is still FOUND',
  factCraft.findings.some((finding) => finding.ruleId === 'g2_hard_lower'),
  factCraft.findings.map((finding) => finding.ruleId));
check('D2 a violation on a fact day does not BLOCK',
  !factCraft.blocking.some((finding) => finding.ruleId === 'g2_hard_lower'),
  factCraft.blocking.map((finding) => `${finding.ruleId}@${finding.dates.join(',')}`));

// COUNTS BELONG TO THE CONTRACT. A dateless cap finding names no day to repair
// and is already the §18 evaluator's own question in its own vocabulary.
function hardConditioningDay(dayOfWeek: number): Workout {
  const id = `craft-hard-${dayOfWeek}`;
  return {
    id,
    microcycleId: 'craft-tier-test',
    dayOfWeek,
    name: 'Hard Core Intervals',
    description: '',
    durationMinutes: 35,
    intensity: 'High',
    workoutType: 'Conditioning',
    sessionTier: 'core',
    conditioningCategory: 'vo2',
    conditioningFlavour: 'high-intensity',
    section18ConditioningRole: 'planner_selected_core',
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'planner_selected_core',
      conditioningStress: 'hard',
      provenance: 'explicit_mutation',
    },
    exercises: [],
    createdAt: NOW,
    updatedAt: NOW,
  } as unknown as Workout;
}
const sixHardDays = [1, 2, 3, 4, 5, 6].map(hardConditioningDay);
const capCraft = craftOf(sixHardDays);
const capFinding = capCraft.findings.find((finding) =>
  finding.ruleId === 'cap_maxHardDays_over' && finding.severity === 'strong');
check('D3 a six-hard-day week produces the strong weekly cap finding',
  capFinding !== undefined,
  capCraft.findings.map((finding) => `${finding.severity}:${finding.ruleId}`));
check('D4 a dateless cap finding is disclosed, never blocking',
  !capCraft.blocking.some((finding) => finding.ruleId === 'cap_maxHardDays_over'),
  capCraft.blocking.map((finding) => finding.ruleId));

console.log('\n── E. The top-up seam ──');

const cleanWeek = visible(week.workouts);
const topUpThatBreaksCraft: Workout = lowerSource
  ? { ...clone(lowerSource), id: 'craft-topup-bad', dayOfWeek: G_MINUS_2 }
  : ({ id: 'craft-topup-bad', dayOfWeek: G_MINUS_2 } as Workout);
const innocuousTopUp: Workout = {
  id: 'craft-topup-good',
  microcycleId: 'craft-tier-test',
  dayOfWeek: 3, // Wednesday — no fixture proximity, no pairing
  name: 'Mobility',
  description: '',
  durationMinutes: 20,
  intensity: 'Light',
  workoutType: 'Recovery',
  sessionTier: 'optional',
  exercises: [],
  createdAt: NOW,
  updatedAt: NOW,
} as unknown as Workout;
const restStub = (dayOfWeek: number, id: string): Workout => ({
  ...innocuousTopUp,
  id,
  dayOfWeek,
  name: 'Rest',
  workoutType: 'Rest',
  sessionTier: 'recovery',
  exercises: [],
});

const withheldBatch = withCraftSafeTopUps({
  contract,
  weekStart: WEEK_START,
  profile: athlete,
  governableDates: ALL_DAYS_GOVERNABLE,
  base: [
    ...cleanWeek.filter((workout) => workout.dayOfWeek !== G_MINUS_2),
    restStub(G_MINUS_2, 'rest-g2'),
  ],
  placed: [topUpThatBreaksCraft],
});
check('E1 a top-up that introduces a craft violation is withheld',
  withheldBatch.withheld.some((workout) => workout.id === 'craft-topup-bad') &&
    !withheldBatch.workouts.some((workout) => workout.id === 'craft-topup-bad') &&
    withheldBatch.workouts.some((workout) => workout.id === 'rest-g2'),
  withheldBatch.withheld.map((workout) => workout.id));

const keptBatch = withCraftSafeTopUps({
  contract,
  weekStart: WEEK_START,
  profile: athlete,
  governableDates: ALL_DAYS_GOVERNABLE,
  base: [
    ...cleanWeek.filter((workout) => workout.dayOfWeek !== innocuousTopUp.dayOfWeek),
    restStub(innocuousTopUp.dayOfWeek, 'rest-good-day'),
  ],
  placed: [innocuousTopUp],
});
check('E2 an innocuous top-up is kept',
  keptBatch.withheld.length === 0 &&
    keptBatch.workouts.some((workout) => workout.id === 'craft-topup-good') &&
    !keptBatch.workouts.some((workout) => workout.id === 'rest-good-day') &&
    keptBatch.workouts.filter((workout) =>
      workout.dayOfWeek === innocuousTopUp.dayOfWeek).length === 1,
  keptBatch.withheld.map((workout) => workout.id));

// A finding the week ALREADY had is not the top-up's fault. Without this the
// seam would quietly delete optional work every time a week arrived imperfect.
const preExistingBatch = withCraftSafeTopUps({
  contract,
  weekStart: WEEK_START,
  profile: athlete,
  governableDates: ALL_DAYS_GOVERNABLE,
  base: visible(craftBreakingWeek),
  placed: [innocuousTopUp],
});
check('E3 a pre-existing violation never withholds an unrelated top-up',
  preExistingBatch.withheld.length === 0 &&
    preExistingBatch.workouts.some((workout) => workout.id === 'craft-topup-good'),
  {
    withheld: preExistingBatch.withheld.map((workout) => workout.id),
    baseBlocking: craftOf(visible(craftBreakingWeek)).blocking.map((finding) => finding.ruleId),
  });


console.log('\n── G. A session the ATHLETE placed ──');

// THE ONE PREDICATE. `resolverMayDisplace` is what every deriver in this app
// asks before it replaces a day's content, and the craft tier is a deriver. The
// first version of it did not ask, and five athlete-door suites reddened:
// placement-ownership, displacement-sweep, g1-landing-ask-flow,
// athlete-session-move, athlete-door-matrix. An athlete who deliberately puts a
// hard lower two days before their game has made a decision; the app's job is
// to have warned them, not to quietly undo it.
const stampAthlete = (workout: Workout): Workout => ({
  ...clone(workout),
  athletePlacement: athletePlacementForDateOverride({
    placedDate: dateForDay(workout.dayOfWeek),
    origin: 'session_edit',
  }),
});

const athletePlacedViolation: Workout[] = craftBreakingSwap.map((workout) =>
  workout.dayOfWeek === G_MINUS_2 ? stampAthlete(workout) : workout);
const athleteCraft = craftOf(athletePlacedViolation);
check('G1 an athlete-placed violation is still FOUND',
  athleteCraft.findings.some((finding) => finding.ruleId === 'g2_hard_lower'),
  athleteCraft.findings.map((finding) => finding.ruleId));
check('G2 an athlete-placed violation never BLOCKS',
  !athleteCraft.blocking.some((finding) => finding.ruleId === 'g2_hard_lower'),
  athleteCraft.blocking.map((finding) => finding.ruleId));

const athleteResult = gateway(athletePlacedViolation, { pinProjection: true });
const athleteSessionStillOnItsDay = athleteResult.visibleWorkouts.some((workout) =>
  workout.dayOfWeek === G_MINUS_2 &&
  workout.name === (lowerSource ? lowerSource.name : ''));
check('G3 the gateway leaves the athlete\'s own session where they put it',
  athleteSessionStillOnItsDay,
  {
    repairs: athleteResult.repairs.map((repair) => repair.kind),
    days: athleteResult.visibleWorkouts.map((workout) => `${workout.dayOfWeek}:${workout.name}`),
  });

// THE OTHER HALF OF A SWAP. The violating session is the app's, so it still
// blocks. §18 no longer has a relocation to withhold — it has nothing to offer
// but the disclosure, which is now the whole of the correct behaviour.
const athleteOwnsEveryTargetDay: Workout[] = craftBreakingSwap.map((workout) =>
  workout.dayOfWeek === G_MINUS_2 ? workout : stampAthlete(workout));
const blockedResult = gateway(athleteOwnsEveryTargetDay, { pinProjection: true });
check('G4 an athlete-owned day is never displaced — the violation is disclosed',
  blockedResult.repairs.some((repair) => repair.kind === 'craft_violation_disclosed'),
  { repairs: blockedResult.repairs.map((repair) => repair.kind) });

console.log('\n── F. Mutation witnesses — what each cell kills ──');

const mutations: Array<[string, boolean]> = [
  ['M1 reverting the tier to findings-only is killed',
    brokenCraft.blocking.length > 0 &&
      !(brokenResult.status === 'accepted' && brokenResult.craft.blocking.length > 0)],
  ['M2 blocking on days the week cannot change is killed',
    !factCraft.blocking.some((finding) => finding.ruleId === 'g2_hard_lower')],
  ['M3 letting a craft violation throw a restoration is killed', !restorationThrew],
  ['M4 shipping a craft violation silently is killed',
    unrepairable.repairs.some((repair) => repair.kind === 'craft_violation_disclosed')],
  ['M5 letting the top-up pass escape the tier is killed',
    withheldBatch.withheld.length > 0 && keptBatch.withheld.length === 0],
  /* M6 and M10 were deleted with their subject: both asserted that §18
   * RELOCATES a badly placed session. It no longer relocates anything. M7 and
   * M9 below carry the properties that survive — §18 must not delete a session
   * and must not move the athlete's own. */
  ['M7 §18 never deletes the offending session is killed',
    brokenResult.visibleWorkouts.filter((workout) => (workout.exercises ?? []).length > 0).length ===
      craftBreakingSwap.filter((workout) => (workout.exercises ?? []).length > 0).length],
  ['M8 blocking a week on the athlete\'s own placement is killed',
    !athleteCraft.blocking.some((finding) => finding.ruleId === 'g2_hard_lower') &&
      athleteCraft.findings.some((finding) => finding.ruleId === 'g2_hard_lower')],
  ['M9 moving the athlete\'s own session is killed', athleteSessionStillOnItsDay],
];
for (const [name, condition] of mutations) check(name, condition);

console.log(`\nsection18CraftTierTests: ${pass} passed, ${fail} failed`);
console.log(`SECTION18_CRAFT_TIER_TOTALS scenarios=6 properties=${pass + fail - mutations.length} mutations=${mutations.length}`);
totalsPrinted(fail);
if (fail > 0) {
  console.log(`Failures:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`);
  process.exit(1);
}
