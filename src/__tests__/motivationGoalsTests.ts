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
 * TYPED GOALS — Sam's ruling, 2026-07-30.
 *
 *   > motivation becomes typed goals: `MotivationGoal[]`, display string derived at
 *   > render; read-ingress lift for stored strings (L15); both `.split(', ')` sites
 *   > deleted; the goal OPTION list pinned as an authored set, gated both directions.
 *
 * "GATED BOTH DIRECTIONS" is the clause that needs the most care, because there are three
 * separate pairs that must agree and only one of them is obvious:
 *
 *   1. the TYPE and the OPTION LIST — every `MotivationGoal` is offered, every offered id
 *      is a `MotivationGoal`;
 *   2. the OPTION LIST and the SCREEN — the door offers the authored set and nothing else,
 *      which is enforced by the screen importing it and by banning local option literals
 *      (the `exercise-name-literal-lock` precedent);
 *   3. the OPTION LIST and the BIAS — a goal the athlete can pick is a goal the bias can
 *      read. This is the direction the old string quietly broke: the screen wrote
 *      'Get stronger & fitter' while `programmingBias` matched substrings, and nothing
 *      checked that the two met.
 *
 * Plus L15's own direction: NOTHING WRITES `motivation` ANY MORE.
 */

import type { MotivationGoal, OnboardingData } from '../types/domain';
import {
  MAX_MOTIVATION_GOALS,
  MOTIVATION_GOAL_OPTIONS,
  isMotivationGoal,
  liftStoredMotivation,
  motivationBiasTokens,
  motivationDisplay,
  motivationGoalLabel,
  resolveMotivation,
} from '../rules/motivationGoals';
import { computeProgrammingBias } from '../rules/programmingBias';
import { ONBOARDING_STEPS, resolveOnboardingResumeStep } from '../utils/onboardingSteps';
import { readFileSync } from 'fs';
import { join } from 'path';

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

const src = (relative: string): string =>
  readFileSync(join(__dirname, '..', relative), 'utf8');

/**
 * The file with its comments removed.
 *
 * Section [6] bans a CODE SHAPE, and this repo documents deleted code by quoting it — the
 * `motivationGoals` header quotes both `.split(', ')` lines verbatim so a reader can see
 * what was removed. Scanning raw text made those quotations indistinguishable from live
 * callers, which would have forced a choice between a gate that lies and a comment that
 * cannot explain itself. Stripping comments keeps both.
 *
 * Deliberately conservative: block comments and line comments only. It is not a parser,
 * so it can only ever HIDE text from the scan — and every hidden region is a comment,
 * which cannot execute.
 */
const codeOnly = (relative: string): string =>
  src(relative)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** Every goal in the union, written out so the type cannot silently grow past the gate. */
const ALL_GOALS: readonly MotivationGoal[] = [
  'make_senior_team',
  'dominate_level',
  'fresh_on_game_day',
  'stay_injury_free',
  'stronger_and_fitter',
  'build_muscle',
  'stay_consistent',
];

console.log('\nMotivation goals — typed storage, Sam 2026-07-30');

console.log('\n[1] THE OPTION LIST IS THE AUTHORED SET, BOTH DIRECTIONS');
{
  const optionIds = MOTIVATION_GOAL_OPTIONS.map((option) => option.id);

  ok('every declared MotivationGoal is offered to the athlete',
    ALL_GOALS.every((goal) => optionIds.includes(goal)),
    ALL_GOALS.filter((goal) => !optionIds.includes(goal)));
  ok('every offered option is a declared MotivationGoal',
    optionIds.every((id) => ALL_GOALS.includes(id)),
    optionIds.filter((id) => !ALL_GOALS.includes(id)));
  ok('the two lists are the same length — no duplicates hiding a missing one',
    optionIds.length === ALL_GOALS.length && new Set(optionIds).size === optionIds.length,
    optionIds);
  ok('every option carries a non-empty athlete-facing label',
    MOTIVATION_GOAL_OPTIONS.every((option) => option.label.trim().length > 0));
  ok('labels are unique — two goals cannot render as the same sentence',
    new Set(MOTIVATION_GOAL_OPTIONS.map((o) => o.label)).size === MOTIVATION_GOAL_OPTIONS.length);
  ok('`isMotivationGoal` accepts every goal and rejects the old screen ids',
    ALL_GOALS.every(isMotivationGoal) &&
      !isMotivationGoal('senior-team') && !isMotivationGoal('stronger-fitter') &&
      !isMotivationGoal('Stay injury-free') && !isMotivationGoal('other'),
    'the pre-ruling screen used ids like `senior-team`; none may resolve');
}

console.log('\n[2] THE DOOR OFFERS THE AUTHORED SET AND NOTHING ELSE');
{
  const screen = src('screens/onboarding/MotivationScreen.tsx');
  ok('the Motivation screen imports the authored option list',
    /from '\.\.\/\.\.\/rules\/motivationGoals'/.test(screen));
  ok('the screen declares no option list of its own',
    !/const\s+MOTIVATION_OPTIONS\s*=/.test(screen),
    'a local option array is how the screen and the bias drifted apart the first time');

  // The screen's ONLY literal option is the free-text escape hatch. Anything else means a
  // goal exists that the authored set has never heard of.
  const literalLabels = [...screen.matchAll(/\blabel:\s*'([^']+)'/g)].map((m) => m[1]);
  ok('the only option label written literally in the screen is "Other"',
    literalLabels.every((label) => label === 'Other'),
    literalLabels);

  ok('the screen uses the authored selection cap rather than its own number',
    /MAX_MOTIVATION_GOALS/.test(screen) && !/const\s+MAX_SELECTIONS\s*=/.test(screen));
  ok('the authored cap is Sam\'s screen copy — "Pick up to 3 goals"',
    MAX_MOTIVATION_GOALS === 3);
}

console.log('\n[3] EVERY PICKABLE GOAL IS A GOAL THE BIAS CAN READ');
{
  // The direction the old string broke. `programmingBias` matches substrings over goal
  // text; this asserts each authored label lands somewhere deliberate — either a real
  // lean, or the neutral branch NAMED here so "leans nothing" is a decision on the record
  // rather than a label that happened to match no rule.
  const DECLARED_NEUTRAL: readonly MotivationGoal[] = ['stay_consistent'];

  for (const option of MOTIVATION_GOAL_OPTIONS) {
    const bias = computeProgrammingBias({
      role: undefined,
      goals: [option.label],
      phase: 'Off-season',
    });
    const leans = bias.strengthBias !== 0 || bias.speedBias !== 0 ||
      Object.keys(bias.conditioningCategoryPreference).length > 0 ||
      Object.keys(bias.recoveryAddonFocusPreference).length > 0;
    const expected = !DECLARED_NEUTRAL.includes(option.id);
    ok(`"${option.label}" ${expected ? 'reaches a lean' : 'is declared neutral'}`,
      leans === expected, { id: option.id, leans, expected, bias });
  }
}

console.log('\n[4] THE READ-INGRESS LIFT (L15) LOSES NOTHING');
{
  // Round-trip over every subset the athlete could have picked: display then lift must
  // return exactly what went in. This is what makes the lift trustworthy for the profiles
  // that predate the typed shape — the ONLY profiles it will ever see.
  const subsets: MotivationGoal[][] = [];
  for (const a of ALL_GOALS) {
    subsets.push([a]);
    for (const b of ALL_GOALS) {
      if (a === b) continue;
      subsets.push([a, b]);
    }
  }
  const broken = subsets.filter((goals) => {
    const sentence = motivationDisplay({ goals, other: null });
    const lifted = liftStoredMotivation(sentence);
    return JSON.stringify(lifted.goals) !== JSON.stringify(goals) || lifted.other !== null;
  });
  ok(`all ${subsets.length} goal combinations round-trip through display → lift`,
    broken.length === 0, broken.slice(0, 5));

  ok('a legacy sentence of authored labels lifts to typed goals',
    JSON.stringify(liftStoredMotivation('Stay injury-free, Build muscle').goals) ===
      JSON.stringify(['stay_injury_free', 'build_muscle']));
  ok('the legacy "&" spelling still lifts',
    liftStoredMotivation('Get stronger & fitter').goals[0] === 'stronger_and_fitter');
  ok('free text that is not an authored label becomes `other`, not a goal',
    liftStoredMotivation('Stay consistent, jump higher for marks').other === 'jump higher for marks' &&
      liftStoredMotivation('Stay consistent, jump higher for marks').goals.length === 1);
  ok('an empty or missing sentence lifts to nothing',
    liftStoredMotivation('').goals.length === 0 &&
      liftStoredMotivation(undefined).goals.length === 0 &&
      liftStoredMotivation(null).other === null);

  // THE ORIGINAL DEFECT, pinned. An athlete who typed a comma into "Other" used to produce
  // two goals from one answer. The lift now rejoins the fragments instead of inventing a
  // goal from each — it cannot recover the original grouping (that was destroyed at write
  // time, which IS the defect), but it never manufactures a lean.
  const commaInOther = liftStoredMotivation('Stay consistent, get fit, feel good');
  ok('a comma inside free text no longer manufactures extra GOALS',
    commaInOther.goals.length === 1 && commaInOther.goals[0] === 'stay_consistent',
    commaInOther);
  ok('and the athlete\'s own words are preserved rather than dropped',
    commaInOther.other === 'get fit, feel good', commaInOther);
}

console.log('\n[5] TYPED GOALS WIN; THE SENTENCE IS ONLY EVER A FALLBACK');
{
  const typed: OnboardingData = {
    goals: ['build_muscle'],
    motivation: 'Stay injury-free',
  } as OnboardingData;
  ok('a profile with both shapes reads the TYPED decision, not the stale sentence',
    JSON.stringify(resolveMotivation(typed).goals) === JSON.stringify(['build_muscle']),
    resolveMotivation(typed));

  const legacyOnly: OnboardingData = { motivation: 'Stay injury-free' } as OnboardingData;
  ok('a profile with only the sentence is lifted',
    JSON.stringify(resolveMotivation(legacyOnly).goals) === JSON.stringify(['stay_injury_free']));

  const otherOnly: OnboardingData = {
    goals: [], motivationOther: 'win a flag',
  } as OnboardingData;
  ok('an athlete who chose only "Other" is not treated as having no answer',
    resolveMotivation(otherOnly).other === 'win a flag');

  ok('an unknown value in stored `goals` is discarded rather than trusted',
    resolveMotivation({ goals: ['nonsense'] } as unknown as OnboardingData).goals.length === 0);

  ok('the display string is derived from the decision',
    motivationDisplay(resolveMotivation({
      goals: ['stay_injury_free', 'build_muscle'], motivationOther: 'win a flag',
    } as OnboardingData)) === 'Stay injury-free, Build muscle, win a flag');
  ok('the bias tokens are the authored labels, so no athlete\'s program moves',
    JSON.stringify(motivationBiasTokens(resolveMotivation(legacyOnly))) ===
      JSON.stringify(['Stay injury-free']));
  ok('`motivationGoalLabel` agrees with the option list',
    ALL_GOALS.every((goal) =>
      motivationGoalLabel(goal) === MOTIVATION_GOAL_OPTIONS.find((o) => o.id === goal)!.label));

  // SAM'S RULING, SIGNED 2026-07-31: goals "Other" = COACH-CONTEXT ONLY. Free text
  // never generates a programming lean — the program leans only on the authored goal
  // list. Same law as injury Other: never store-and-pretend. This closes the question
  // the typed-goals migration deliberately left open (its boundary report named it).
  ok('free text NEVER reaches the programming bias — the ruling, both shapes',
    JSON.stringify(motivationBiasTokens({
      goals: ['stay_injury_free'], other: 'win a flag',
    })) === JSON.stringify(['Stay injury-free']) &&
    JSON.stringify(motivationBiasTokens({ goals: [], other: 'get fit, feel good' })) ===
      JSON.stringify([]));
  ok('an "Other"-only athlete leans on NOTHING, not on their prose',
    motivationBiasTokens(resolveMotivation({
      goals: [], motivationOther: 'jump higher for marks',
    } as OnboardingData)).length === 0);
  ok('the free text still reaches the COACH as flavour (display keeps it)',
    motivationDisplay(resolveMotivation({
      goals: ['build_muscle'], motivationOther: 'win a flag',
    } as OnboardingData)) === 'Build muscle, win a flag');
}

console.log('\n[6] L15 — NOTHING WRITES THE RETIRED SHAPE, AND NOBODY SPLITS IT');
{
  const PRODUCT_FILES = [
    'screens/onboarding/MotivationScreen.tsx',
    'screens/onboarding/reviewRows.ts',
    'screens/profile/ProfileScreen.tsx',
    'screens/coach/CoachScreen.tsx',
    'utils/coachingEngine.ts',
    'utils/recoveryAddonBuilder.ts',
    'rules/motivationGoals.ts',
  ];

  // The two `.split(', ')` sites Sam named. Deleted, and banned from coming back.
  const splitters = PRODUCT_FILES.filter((file) => /motivation[^\n]*\.split\(/i.test(codeOnly(file)));
  ok('no product file splits the motivation sentence any more', splitters.length === 0, splitters);

  // A writer of the retired shape is "a red-gate defect, not a compatibility feature".
  // `rules/motivationGoals.ts` is exempt as the read-ingress owner; it only ever READS.
  const writers = PRODUCT_FILES
    .filter((file) => file !== 'rules/motivationGoals.ts')
    .filter((file) => /\bmotivation:\s*(?!undefined)/.test(codeOnly(file)))
    .filter((file) => {
      // `motivation:` appearing as a DERIVED value handed to a consumer is fine; a
      // commit/patch object is not. Flag only the latter.
      const text = codeOnly(file);
      return /commitAndAdvance\(\s*\{[^}]*\bmotivation:/s.test(text) ||
        /updateOnboardingData\(\s*\{[^}]*\bmotivation:/s.test(text);
    });
  ok('no door writes the retired `motivation` sentence back to the profile',
    writers.length === 0, writers);

  ok('the Motivation door commits the typed decision',
    /commitAndAdvance\(\s*\{\s*goals,\s*motivationOther/.test(codeOnly('screens/onboarding/MotivationScreen.tsx')));

  // Ruling 2026-07-31 pins BOTH channels at the coach boundary: the prompt keeps the
  // flavour (display string, which includes `other`), while its `goals` field is the
  // bias tokens — which no longer carry prose. Losing the first silently would cut
  // the coach off from the athlete's own words; that is not what the ruling says.
  ok('the coach prompt still carries the athlete\'s words via the display string',
    /motivation:\s*motivationDisplay\(resolveMotivation\(/.test(codeOnly('screens/coach/CoachScreen.tsx')));
}

console.log('\n[7] THE STEP REGISTRY AGREES WITH THE DOOR — the near-miss this unit had');
{
  // THE DEFECT THIS ALMOST SHIPPED. `ONBOARDING_STEPS`'s Motivation entry still declared
  // `collects: ['motivation']` and `satisfied: filled(data.motivation)` after the door
  // stopped writing that field. The step could then NEVER be satisfied, so
  // `resolveOnboardingResumeStep` would have returned the athlete to the Motivation screen
  // forever — a permanent onboarding lock, on the happy path, with every test still green
  // because nothing tied "what the door writes" to "what the step checks".
  //
  // That is the `harness-enters-below-the-door` shape again, so it gets a real assertion
  // and not a comment: the check is BEHAVIOURAL — answer through the door's own output
  // shape and require the step to be satisfied.
  const step = ONBOARDING_STEPS.find((candidate) => candidate.name === 'Motivation')!;

  ok('an unanswered profile leaves the Motivation step unsatisfied',
    !step.satisfied({} as OnboardingData));
  ok('the typed decision the door writes SATISFIES the step',
    step.satisfied({ goals: ['stay_injury_free'] } as OnboardingData),
    'if this fails, onboarding cannot be completed at all');
  ok('an "Other"-only answer satisfies it too',
    step.satisfied({ goals: [], motivationOther: 'win a flag' } as OnboardingData));
  ok('a legacy profile carrying only the sentence still counts as answered',
    step.satisfied({ motivation: 'Stay injury-free' } as OnboardingData),
    'existing athletes must not be sent back through onboarding by this migration');
  ok('an empty goal list with no free text does not count as answered',
    !step.satisfied({ goals: [] } as OnboardingData));

  ok('the step declares the field the door actually writes',
    step.collects.includes('goals') && !step.collects.includes('motivation'),
    step.collects);

  // And the resume path end-to-end, because that is where the lock would have appeared.
  const answered = {
    firstName: 'A', heightCm: 180, weightKg: 80, position: 'inside_mid',
    goals: ['stay_consistent'],
  } as OnboardingData;
  ok('a profile that answered Motivation does not resume onto Motivation',
    resolveOnboardingResumeStep(answered) !== 'Motivation',
    resolveOnboardingResumeStep(answered));
}

console.log(`\nmotivationGoalsTests: ${pass} passed, ${fail} failed`);
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
process.exit(fail > 0 ? 1 : 0);
