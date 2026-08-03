(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

/**
 * WHAT THE STRENGTH ANSWERS ARE ALLOWED TO DECIDE — Sam's ruling, 2026-07-30.
 *
 *   > "unlikely someone is super strong upper and super weak lower"
 *   > "we shouldn't bias lower over upper"
 *   > The squat/bench gap comparison and its leans are DELETED, not tuned.
 *   > "I don't squat" / "I don't bench" = UNTESTED, never "weak".
 *   > The sprint-exposure lean STAYS.
 *
 * WHY THIS GATE IS SHAPED THE WAY IT IS (L12 — verification strategy is reviewed like
 * code). A regression test for the deleted code would assert that `squatBand` is gone,
 * and would pass forever while somebody added `strengthAsymmetryHint` next door. The
 * defect class is not "this function exists" — it is **"the strength answers reached a
 * decision that is not a starting load"**. So the gate is a SWEEP over the whole answer
 * space, asserting at the visible-plan boundary:
 *
 *   every (squat × bench) pair  →  byte-identical week
 *   at least one pair           →  a DIFFERENT starting load
 *
 * The second half is what stops the gate passing vacuously. A sweep that only asserts
 * "nothing changed" also passes if the answers stop mattering ANYWHERE — including in the
 * load chain Sam ruled and gated in 2026-07-28. Both directions or neither.
 *
 * 36 pairs × 3 phases, because the deleted mechanism was phase-scaled: a lean that
 * survives only in off-season would slip past a single-phase sweep, and off-season is
 * where the old gap-lean was strongest (phase scale 1.0).
 */


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type {
  BenchStrength,
  OnboardingData,
  RecoveryAddonBlock,
  SquatStrength,
  Workout,
} from '../types/domain';
import { computeTestingBias } from '../rules/testingBias';
import { buildCoachingPlan, onboardingToCoachingInputs, type CoachingPlan } from '../utils/coachingEngine';
import { attachRecoveryAddonsToWeek } from '../utils/recoveryAddonBuilder';
import { estimateAnchors } from '../utils/loadEstimation';
import { readFileSync } from 'fs';
import { join } from 'path';

const TODAY = '2026-07-06';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

const SQUAT_ANSWERS: readonly SquatStrength[] = [
  "I don't squat",
  'Less than bodyweight',
  'Around bodyweight',
  '1.5x bodyweight',
  '2x bodyweight+',
  'Not sure',
];

const BENCH_ANSWERS: readonly BenchStrength[] = [
  "I don't bench",
  'Less than bodyweight',
  'Around bodyweight',
  '1.25x bodyweight',
  '1.5x bodyweight+',
  'Not sure',
];

const BASE_PROFILE: OnboardingData = {
  seasonPhase: 'Off-season',
  position: 'inside_mid',
  trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  trainingLocation: 'Commercial gym',
  equipment: ['Full Gym'],
  experienceLevel: '2-5 years',
  conditioningLevel: 'Good',
  sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  motivation: 'Stay consistent',
  heightCm: 183,
  weightKg: 85,
} as OnboardingData;

function planFor(data: OnboardingData): CoachingPlan {
  return buildCoachingPlan(onboardingToCoachingInputs(data, { availabilityDateISO: TODAY }));
}

function stubWorkout(dayOfWeek: number, name: string, workoutType: Workout['workoutType']): Workout {
  return {
    id: `strength-authority-${dayOfWeek}`,
    microcycleId: 'strength-authority-week',
    dayOfWeek,
    name,
    description: name,
    durationMinutes: 55,
    intensity: workoutType === 'Recovery' ? 'Light' : 'Moderate',
    workoutType,
    sessionTier: workoutType === 'Recovery' ? 'recovery' : 'core',
    exercises: [],
    createdAt: `${TODAY}T00:00:00.000Z`,
    updatedAt: `${TODAY}T00:00:00.000Z`,
  } as Workout;
}

const ADDON_WEEK: readonly Workout[] = [
  stubWorkout(1, 'Lower Strength', 'Strength'),
  stubWorkout(2, 'Upper Strength', 'Strength'),
  stubWorkout(3, 'Recovery', 'Recovery'),
  stubWorkout(4, 'Full Body Strength', 'Strength'),
  stubWorkout(5, 'Easy Aerobic', 'Conditioning'),
];

/**
 * THE SIGNATURE COVERS TWO SURFACES, AND THE SECOND ONE IS NOT OPTIONAL.
 *
 * The first draft of this gate signed only the weekly skeleton, and MUTATION TESTING
 * KILLED IT: a reintroduced squat-keyed lean that wrote `recoveryAddonFocusPreference`
 * passed all 22 assertions. The reason is worth keeping in the file, because it is the
 * whole lesson — the deleted mechanism's PRIMARY expression was recovery add-on focus
 * (`addFocuses(['trunk_core', 'adductors_groin', 'calves_tib_ankles',
 * 'hamstring_light_prehab'], …)`), and a gate against a deleted mechanism that does not
 * watch the surface that mechanism used is watching the wrong thing.
 *
 * So the signature is skeleton + attached recovery add-ons. Anything the strength answers
 * could move, in either place, diverges it.
 */
function weekSignature(data: OnboardingData): string {
  const plan = planFor(data);
  const withAddons = attachRecoveryAddonsToWeek({
    workouts: [...ADDON_WEEK],
    profile: data,
    weekKind: 'build',
  });
  return JSON.stringify({
    coreSessions: plan.coreSessions,
    week: plan.weeklyPlan.map((session) => ({
      day: session.dayOfWeek,
      tier: session.tier,
      focus: session.focus,
      strengthPattern: session.strengthPattern,
      conditioningCategory: session.conditioningCategory,
      speedWorkKind: session.speedWorkKind,
      stressLevel: session.stressLevel,
    })),
    addons: withAddons.map((item) => ({
      name: item.name,
      focus: (item.recoveryAddons ?? []).map((addon: RecoveryAddonBlock) => addon.focusArea),
    })),
  });
}

console.log('\nStrength-answer authority — Sam 2026-07-30');

console.log('\n[1] THE SWEEP — no (squat × bench) pair changes the week, in any phase');
{
  for (const phase of ['Off-season', 'Pre-season', 'In-season'] as const) {
    const reference = weekSignature({
      ...BASE_PROFILE,
      seasonPhase: phase,
      usualGameDay: phase === 'In-season' ? 'Saturday' : undefined,
      squatStrength: 'Around bodyweight',
      benchStrength: 'Around bodyweight',
    } as OnboardingData);

    const divergent: string[] = [];
    for (const squatStrength of SQUAT_ANSWERS) {
      for (const benchStrength of BENCH_ANSWERS) {
        const signature = weekSignature({
          ...BASE_PROFILE,
          seasonPhase: phase,
          usualGameDay: phase === 'In-season' ? 'Saturday' : undefined,
          squatStrength,
          benchStrength,
        } as OnboardingData);
        if (signature !== reference) divergent.push(`${squatStrength} / ${benchStrength}`);
      }
    }
    ok(`${phase}: all ${SQUAT_ANSWERS.length * BENCH_ANSWERS.length} answer pairs produce the identical week`,
      divergent.length === 0,
      { phase, divergent: divergent.slice(0, 6), divergentCount: divergent.length });
  }

  // The mechanism's own extreme: maximum gap in each direction. Named separately so a
  // failure says WHICH shape came back rather than only "some pair diverged".
  const weakLower = weekSignature({
    ...BASE_PROFILE, squatStrength: "I don't squat", benchStrength: '1.5x bodyweight+',
  } as OnboardingData);
  const weakUpper = weekSignature({
    ...BASE_PROFILE, squatStrength: '2x bodyweight+', benchStrength: "I don't bench",
  } as OnboardingData);
  ok('the maximum gap in each direction produces the same week as the other',
    weakLower === weakUpper,
    { weakLower: weakLower.slice(0, 300), weakUpper: weakUpper.slice(0, 300) });
}

console.log('\n[2] UNTESTED IS NEVER WEAK');
{
  // Sam: "I don't squat" / "I don't bench" = UNTESTED, never "weak". After the deletion
  // this holds structurally — there is no band to read as low — and that is the point:
  // the property is now unrepresentable rather than merely absent.
  const untested = weekSignature({
    ...BASE_PROFILE, squatStrength: "I don't squat", benchStrength: "I don't bench",
  } as OnboardingData);
  const strongest = weekSignature({
    ...BASE_PROFILE, squatStrength: '2x bodyweight+', benchStrength: '1.5x bodyweight+',
  } as OnboardingData);
  const weakest = weekSignature({
    ...BASE_PROFILE,
    squatStrength: 'Less than bodyweight',
    benchStrength: 'Less than bodyweight',
  } as OnboardingData);
  ok('"I don\'t squat/bench" plans the same week as the strongest athlete',
    untested === strongest, { untested: untested.slice(0, 300) });
  ok('"I don\'t squat/bench" plans the same week as the weakest answered athlete',
    untested === weakest);

  const biasFields = Object.keys(computeTestingBias({ phase: 'Off-season' }));
  ok('the testing bias exposes no lower/upper strength direction to be read as weakness',
    !biasFields.includes('lowerStrengthBias') && !biasFields.includes('upperStrengthBias'),
    biasFields);
}

console.log('\n[3] THE ANSWERS STILL DO THEIR ONE JOB — starting load');
{
  // Without this the sweep above is vacuous: it would also pass if the strength answers
  // stopped mattering everywhere, silently un-gating Sam's ruled anchor ladders.
  const heavy = estimateAnchors({
    ...BASE_PROFILE, squatStrength: '2x bodyweight+', benchStrength: '1.5x bodyweight+',
  } as OnboardingData);
  const light = estimateAnchors({
    ...BASE_PROFILE, squatStrength: "I don't squat", benchStrength: "I don't bench",
  } as OnboardingData);
  ok('both profiles produce anchors at all', heavy !== null && light !== null);
  ok('a stronger squat answer still raises the estimated squat anchor',
    (heavy?.squat1RM ?? 0) > (light?.squat1RM ?? 0),
    { heavy: heavy?.squat1RM, light: light?.squat1RM });
  ok('a stronger bench answer still raises the estimated bench anchor',
    (heavy?.bench1RM ?? 0) > (light?.bench1RM ?? 0),
    { heavy: heavy?.bench1RM, light: light?.bench1RM });
}

console.log('\n[4] THE SPRINT-EXPOSURE LEAN STAYS — Sam kept this one');
{
  const noSprint = computeTestingBias({
    phase: 'Off-season', sprintExposure: 'No sprint training',
  });
  const sprinting = computeTestingBias({
    phase: 'Off-season', sprintExposure: '2+ times per week',
  });
  ok('"No sprint training" still produces a positive speed lean',
    noSprint.speedBias > 0, noSprint);
  ok('the sprint lean stays inside the 10% testing cap',
    noSprint.speedBias <= 0.1, noSprint);
  ok('an athlete who already sprints gets no speed lean',
    sprinting.speedBias === 0, sprinting);
  ok('the sprint lean is reasoned in explicit debug data',
    noSprint.debug.reasons.some((reason) => /sprint exposure/i.test(reason)),
    noSprint.debug.reasons);
}

console.log('\n[5] THE ONE LEGITIMATE ASYMMETRY IS THE BIBLE\'S, AND IT IS GAME PROXIMITY');
{
  // Sam: "The ONLY legitimate upper/lower asymmetry is IN-SEASON, when legs need more
  // recovery — verify the Bible's game-proximity rules (upper work near games) cover this
  // and cite them; if no line exists, return it as a question, do not build a mechanism."
  //
  // The lines exist, so no mechanism was built. They are pinned BY CONTENT here, because
  // a citation nothing checks is a citation that rots — and because this is the evidence
  // for a decision NOT to build, which is the kind of claim that otherwise leaves no
  // trace in the code at all.
  const bible = readFileSync(join(__dirname, '../../docs/LFA_PROGRAMMING_BIBLE.md'), 'utf8');

  const CITED: readonly { readonly line: string; readonly text: string }[] = [
    {
      line: ':78',
      text: 'What is acceptable 1-2 days before a game: upper body training, gunshow, accessories',
    },
    {
      line: ':378',
      text: 'In-season version: Upper strength can stay in year-round. It can often be placed '
        + 'before team training or closer to game day than lower strength.',
    },
    {
      line: ':337',
      text: 'Upper strength is usually easier to place around game day than lower strength',
    },
    {
      line: ':803',
      text: 'If lower strength is unsafe close to game day, preserve upper strength where possible.',
    },
    {
      line: ':145',
      text: 'Hard running and top-end work pair with UPPER days. LOWER days pair with off-leg conditioning.',
    },
  ];

  for (const { line, text } of CITED) {
    ok(`the Bible still carries the game-proximity line cited as \`${line}\``,
      bible.includes(text), text);
  }

  ok('the cited asymmetry is keyed on GAME PROXIMITY, not on an athlete property',
    CITED.every(({ text }) => /game|running|team training/i.test(text)),
    'if a cited line stops mentioning the calendar, the justification for having no '
    + 'athlete-property lean has changed and this unit must be re-read');
}

console.log('\n[6] THE FINDING THE DELETION EXPOSED — `:105`\'s accessory lean has no consumer');
{
  // Deleting the gap-lean revealed that `WEAK_POINT_LEAN[...].accessory` was consumed
  // ONLY inside the two gap-gated blocks: a stated `strength_and_size` weakness expressed
  // its accessory direction when the gap ALSO fired, and expressed nothing otherwise.
  //
  // Pinned rather than repaired. Sam's instruction on this unit was to return an unruled
  // asymmetry as a QUESTION, not to build a mechanism — so this assertion exists to make
  // the gap legible and to FAIL THE DAY SOMEBODY GIVES IT A CONSUMER without a ruling.
  // If Sam rules that a stated strength/size weakness should lean accessories, this
  // assertion is the one that flips, deliberately, in that commit.
  const strengthWeakness = computeTestingBias({
    phase: 'Off-season', biggestLimitation: 'Strength',
  });
  const sizeWeakness = computeTestingBias({ phase: 'Off-season', biggestLimitation: 'Size' });
  const none = computeTestingBias({ phase: 'Off-season' });

  ok('a stated STRENGTH weakness currently leans no recovery/accessory focus — UNRULED, reported',
    Object.keys(strengthWeakness.recoveryAddonFocusPreference).length ===
      Object.keys(none.recoveryAddonFocusPreference).length,
    strengthWeakness.recoveryAddonFocusPreference);
  ok('a stated SIZE weakness behaves identically to it',
    JSON.stringify(sizeWeakness.recoveryAddonFocusPreference) ===
      JSON.stringify(strengthWeakness.recoveryAddonFocusPreference),
    sizeWeakness.recoveryAddonFocusPreference);
}

console.log(`\nstrengthAnswerAuthorityTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
process.exit(fail > 0 ? 1 : 0);
