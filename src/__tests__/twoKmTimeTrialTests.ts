/**
 * 2km TIME TRIAL + MAS — one owner for the athlete's pace.
 *
 * THE GAP THIS CLOSES. Every %MAS prescription in the app was a STRING. Fifteen
 * conditioning template rows carry an intensity like '90-100% MAS', and
 * sessionBuilder renders a standing apology — "Don't know MAS? Send your 2km or
 * 3km time trial." Nothing stored the athlete's pace, so nothing could turn
 * those percentages into a number anybody could run to. masCopy.ts already held
 * a calculator with ZERO consumers, written against a MAS that never arrived.
 *
 * SAM'S RULINGS (docs/STAGE_C_TIME_TRIAL_RULINGS_2026-07-29.md):
 *   1. accepted range 5:00-15:00, re-asked when refused, NEVER CLAMPED
 *   2. MAS = 2km average speed x 1.00, no correction
 *   3. skip defaults by experience: 6:30 / 7:15 / 8:00 / 8:45
 *   4. name it timeTrial / time_trial, never "TT"
 *
 * THE ARCHITECTURE THESE TESTS PIN. Store the time, derive MAS, never store
 * MAS. A stored MAS can drift from the time it came from; a derived one cannot.
 * That is what "no second representation of the athlete's pace" means here, and
 * it is a structural guarantee rather than a discipline anyone has to keep.
 *
 * Run: npm run test:time-trial
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import {
  TWO_KM_TIME_TRIAL_DEFAULTS,
  MAS_FROM_TIME_TRIAL_MULTIPLIER,
  deriveMas,
  recordTwoKmTime,
  formatTwoKmTime,
} from '../data/twoKmTimeTrial';
import {
  ONBOARDING_NUMERIC_BOUNDS,
  validateOnboardingMeasurement,
} from '../data/onboardingNumericBounds';
import {
  ONBOARDING_STEPS,
  missingRequiredProfileFields,
  resolveOnboardingResumeStep,
} from '../utils/onboardingSteps';
import {
  TIME_TRIAL_EXERCISE_NAME,
  buildTimeTrialSession,
  recordTimeTrialResult,
  timeTrialWorkout,
} from '../data/timeTrialSession';
import { EXERCISE_CUES } from '../data/exerciseCues';
import { isSelectable } from '../data/selectableExerciseVocabulary';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import {
  auditWeekAgainstCaps,
  countWeeklyExposures,
  type WeekDayInput,
} from '../rules/weeklyExposureCounts';
import { statesWholeNumber, stripComments } from './support/sourceText';
import type {
  ExperienceLevel,
  OnboardingData,
  TwoKmTimeTrialAnswer,
} from '../types/domain';

const repoRoot = path.resolve(__dirname, '../..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/** Sam's range, in the units the code stores. 5:00 = 300 s, 15:00 = 900 s. */
const FLOOR_SECONDS = 300;
const CEILING_SECONDS = 900;

console.log('\n[1] The ruled range, exactly — and it lives in the ONE bounds registry');
{
  const bound = ONBOARDING_NUMERIC_BOUNDS.twoKmSeconds;
  ok('the bound exists in the onboarding bounds registry', Boolean(bound),
    'a second bounds registry would be a second representation of the same law');
  if (bound) {
    ok('the 2km range is 300-900 seconds (5:00-15:00)',
      bound.min === FLOOR_SECONDS && bound.max === CEILING_SECONDS,
      `${bound.min}-${bound.max}`);
  }
}

console.log('\n[2] REFUSAL in both directions');
{
  const cases: Array<[number, string]> = [
    [299, 'one second below the floor'],
    [240, 'a 4:00 2km — faster than the world record pace for the distance'],
    [0, 'the value a bare `> 0` check used to be the only guard against'],
    [901, 'one second above the ceiling'],
    [1200, 'a 20:00 2km — a walk, or a mistyped 12:00'],
    [45, 'a mistyped minutes-only entry'],
  ];
  for (const [seconds, why] of cases) {
    ok(`${seconds}s is refused (${why})`,
      !validateOnboardingMeasurement('twoKmSeconds', seconds).ok);
  }
}

console.log('\n[3] Valid answers, including the exact endpoints');
{
  // Sam ruled "accept 5:00-15:00", which is inclusive. An off-by-one here
  // refuses an athlete standing exactly on the bound.
  for (const seconds of [FLOOR_SECONDS, 390, 435, 480, 525, CEILING_SECONDS]) {
    ok(`${seconds}s (${formatTwoKmTime(seconds)}) is accepted`,
      validateOnboardingMeasurement('twoKmSeconds', seconds).ok);
  }
}

console.log('\n[4] Non-numeric is refused, not coerced');
{
  for (const value of [NaN, Infinity, -Infinity]) {
    ok(`twoKmSeconds=${value} is refused`,
      !validateOnboardingMeasurement('twoKmSeconds', value).ok);
  }
}

console.log('\n[5] The refusal speaks MIN:SEC — the athlete never sees raw seconds');
{
  const result = validateOnboardingMeasurement('twoKmSeconds', 1200);
  ok('a refusal carries a message', !result.ok && typeof result.message === 'string'
    && result.message.length > 0);

  if (!result.ok) {
    // The athlete typed 20:00. Telling them "between 300 and 900" asks them to
    // do arithmetic to understand a refusal. The bound is stored in seconds
    // because that is what arithmetic wants; it is SPOKEN in min:sec because
    // that is what the athlete typed.
    ok('the message names the accepted range in min:sec',
      result.message.includes('5:00') && result.message.includes('15:00'),
      `got: ${result.message}`);
    ok('the message never leaks raw seconds at the athlete',
      !/\b(300|900)\b/.test(result.message),
      `got: ${result.message}`);
    ok('the message is plain — no field names, no jargon',
      !/twoKmSeconds|MAS|NaN|parse|valid(ate|ation)/i.test(result.message),
      `got: ${result.message}`);
  }
}

console.log('\n[6] MAS derivation — Sam\'s one authored constant');
{
  ok('the multiplier is the ruled 1.00', MAS_FROM_TIME_TRIAL_MULTIPLIER === 1.0,
    String(MAS_FROM_TIME_TRIAL_MULTIPLIER));

  // MAS km/h = 2 / (seconds / 3600) = 7200 / seconds, times the ruled 1.00.
  const table: Array<[number, number, string]> = [
    [300, 24.0, 'fastest accepted'],
    [390, 18.46, '5+ years default'],
    [435, 16.55, '2-5 years default'],
    [480, 15.0, '1-2 years default'],
    [525, 13.71, 'Complete beginner default'],
    [900, 8.0, 'slowest accepted'],
  ];
  for (const [seconds, expected, why] of table) {
    const answer: TwoKmTimeTrialAnswer = {
      seconds, recordedOn: '2026-07-29', source: 'onboarding',
    };
    const got = deriveMas(answer, '5+ years').masKmh;
    ok(`${formatTwoKmTime(seconds)} derives ${expected} km/h (${why})`,
      Math.abs(got - expected) < 0.01, `got ${got}`);
  }
}

console.log('\n[7] The four skip defaults, 1:1 with ExperienceLevel');
{
  const expected: Record<ExperienceLevel, number> = {
    '5+ years': 390,          // 6:30
    '2-5 years': 435,         // 7:15
    '1-2 years': 480,         // 8:00
    'Complete beginner': 525, // 8:45
  };
  for (const [level, seconds] of Object.entries(expected)) {
    ok(`${level} defaults to ${formatTwoKmTime(seconds)}`,
      TWO_KM_TIME_TRIAL_DEFAULTS[level as ExperienceLevel] === seconds,
      String(TWO_KM_TIME_TRIAL_DEFAULTS[level as ExperienceLevel]));
  }

  // Sam's four values cover the enum exactly. If the enum grows, this must fail
  // rather than quietly pick somebody else's default for the new level.
  ok('every experience level has a ruled default, and no extras',
    Object.keys(TWO_KM_TIME_TRIAL_DEFAULTS).sort().join('|')
      === Object.keys(expected).sort().join('|'),
    Object.keys(TWO_KM_TIME_TRIAL_DEFAULTS).join('|'));

  // Descending experience = ascending time. A transposed pair would still pass
  // every value assertion above.
  const ladder: ExperienceLevel[] = [
    '5+ years', '2-5 years', '1-2 years', 'Complete beginner',
  ];
  const times = ladder.map((l) => TWO_KM_TIME_TRIAL_DEFAULTS[l]);
  ok('the defaults get slower as experience drops',
    times.every((t, i) => i === 0 || t > times[i - 1]), times.join(' -> '));

  // A default outside the range the same ruling accepts would be incoherent.
  for (const [level, seconds] of Object.entries(TWO_KM_TIME_TRIAL_DEFAULTS)) {
    ok(`the ${level} default is inside the accepted range`,
      validateOnboardingMeasurement('twoKmSeconds', seconds).ok, String(seconds));
  }
}

console.log('\n[8] Defaults are applied AT DERIVATION, never written into storage');
{
  // The whole point. If skipping wrote 525 into the stored answer, the app could
  // never again tell the athlete's number from its own guess, and a later
  // experience-level change would not move the estimate.
  const skipped: TwoKmTimeTrialAnswer = {
    seconds: null, recordedOn: '2026-07-29', source: 'onboarding',
  };

  const beginner = deriveMas(skipped, 'Complete beginner');
  ok('a skipped answer still derives a MAS', beginner.masKmh > 0);
  ok('a skipped answer is tagged as an estimate',
    beginner.source === 'experience_default', beginner.source);
  ok('the estimate uses the ruled default for that level',
    beginner.seconds === 525, String(beginner.seconds));

  // Same stored answer, different experience level -> different estimate. This
  // is only possible because the default was NOT frozen into storage.
  const advanced = deriveMas(skipped, '5+ years');
  ok('the same skipped answer tracks a later experience-level change',
    advanced.seconds === 390 && advanced.masKmh !== beginner.masKmh,
    `${advanced.seconds}s / ${advanced.masKmh} vs ${beginner.seconds}s / ${beginner.masKmh}`);

  const measured: TwoKmTimeTrialAnswer = {
    seconds: 402, recordedOn: '2026-07-29', source: 'onboarding',
  };
  const real = deriveMas(measured, 'Complete beginner');
  ok('a real time is tagged as measured', real.source === 'measured', real.source);
  ok('a real time beats the experience default',
    real.seconds === 402, String(real.seconds));

  // No answer at all is not the same as "haven't tested", but both must render.
  const none = deriveMas(undefined, '2-5 years');
  ok('a missing answer still derives from the experience default',
    none.source === 'experience_default' && none.seconds === 435,
    `${none.source} / ${none.seconds}`);
}

console.log('\n[9] MAS is DERIVED, never stored — the structural guarantee');
{
  const owner = fs.readFileSync(
    path.join(repoRoot, 'src/types/domain.ts'), 'utf8');

  // The stored shape carries seconds. If a masKmh field ever appears on the
  // stored answer, the second representation is back and it can drift.
  //
  // Scoped to the interface BODY. An unbounded `[\s\S]*?` between the interface
  // name and `masKmh` runs straight past the closing brace and matches the
  // legitimate `masKmh` on `DerivedMas` further down the file — a gate that
  // fails on the very code it exists to permit. It did, first run.
  const body = /interface TwoKmTimeTrialAnswer\s*\{([\s\S]*?)\n\}/.exec(owner);
  ok('the stored answer interface was found to inspect', Boolean(body),
    'the assertion below is vacuous if the interface was renamed');
  ok('the stored answer has no MAS field',
    body !== null && !/masKmh/.test(body[1]),
    'storing MAS reintroduces a value that can disagree with the time it came from');
}

console.log('\n[10] ONE INGRESS — every producer routes through the same refusal');
{
  const accepted = recordTwoKmTime(435, 'onboarding', '2026-07-29');
  ok('a valid time is accepted', accepted.ok);
  ok('the accepted answer records the seconds', accepted.answer?.seconds === 435);
  ok('the accepted answer records when', accepted.answer?.recordedOn === '2026-07-29');
  ok('the accepted answer records who produced it',
    accepted.answer?.source === 'onboarding');

  const refused = recordTwoKmTime(1200, 'session_log', '2026-07-29');
  ok('the ingress refuses an out-of-range time', !refused.ok);
  ok('the ingress writes nothing when it refuses', !refused.answer,
    'a refusal that still commits is a clamp with extra steps');
  ok('the ingress refusal carries the same message the screen shows',
    refused.message === validateOnboardingMeasurement('twoKmSeconds', 1200).message,
    `${refused.message}`);

  // "Haven't tested" is an ANSWER, and the bound does not apply to it.
  const skipped = recordTwoKmTime(null, 'onboarding', '2026-07-29');
  ok('null — "haven\'t tested" — is accepted as an answer', skipped.ok);
  ok('the skipped answer stores null, not a default',
    skipped.answer?.seconds === null, String(skipped.answer?.seconds));

  // Every producer named in the design reaches the same law.
  for (const source of ['onboarding', 'profile_edit', 'session_log'] as const) {
    ok(`${source} is refused by the same bound`,
      !recordTwoKmTime(1200, source, '2026-07-29').ok);
  }
}

console.log('\n[11] NEVER CLAMPED — the ingress refuses rather than substituting');
{
  const owner = fs.readFileSync(
    path.join(repoRoot, 'src/data/twoKmTimeTrial.ts'), 'utf8');
  ok('the owner never clamps a time',
    !/Math\.(min|max)\s*\([^)]*seconds/.test(owner),
    'clamping substitutes the app\'s number for the athlete\'s');

  // A refusal must not suggest a value — that is a clamp wearing a question mark.
  const refused = recordTwoKmTime(240, 'onboarding', '2026-07-29');
  ok('a refusal does not hand back a corrected value',
    !refused.answer, 'offering a value invites the athlete to accept ours as theirs');
}

console.log('\n[12] PROVENANCE — every number traces to Sam\'s ruling');
{
  const bound = ONBOARDING_NUMERIC_BOUNDS.twoKmSeconds;

  ok('the ruling is dated', /^\d{4}-\d{2}-\d{2}$/.test(bound.attribution.ruledOn),
    bound.attribution.ruledOn);

  const wherePath = path.join(repoRoot, bound.attribution.where);
  ok('the attributed document exists', fs.existsSync(wherePath), bound.attribution.where);

  if (fs.existsSync(wherePath)) {
    const doc = fs.readFileSync(wherePath, 'utf8');
    ok('the range anchor appears verbatim in the ruling document',
      doc.includes(bound.anchor), `anchor not found: ${bound.anchor}`);
    // THE BINDING: not "an anchor exists" but "the anchor states THESE numbers".
    ok('the range anchor states the shipped floor',
      statesWholeNumber(bound.anchor, bound.min), bound.anchor);
    ok('the range anchor states the shipped ceiling',
      statesWholeNumber(bound.anchor, bound.max), bound.anchor);
  }
}

console.log('\n[13] The onboarding step is in the ONE registry, in the ruled position');
{
  const names = ONBOARDING_STEPS.map((s) => s.name);
  ok('TwoKmTimeTrial is a registered step', names.includes('TwoKmTimeTrial'),
    'the navigator, progress bar, resume point and generation refusal all derive from this list');

  // D14: "sits with the squat/bench strength questions".
  ok('it sits directly after BenchStrength',
    names[names.indexOf('BenchStrength') + 1] === 'TwoKmTimeTrial',
    names.join(' -> '));
  ok('it sits directly before ConditioningLevel',
    names[names.indexOf('ConditioningLevel') - 1] === 'TwoKmTimeTrial',
    names.join(' -> '));

  const step = ONBOARDING_STEPS.find((s) => s.name === 'TwoKmTimeTrial');
  ok('it collects the time-trial answer',
    step?.collects.includes('twoKmTimeTrial' as never), step?.collects.join(','));

  // Squat and bench are hidden from complete beginners. The time trial is not:
  // a beginner is exactly who most needs the ruled default, and they may well
  // have run a 2km at a club testing day without ever having touched a barbell.
  ok('it is shown to complete beginners too',
    step?.visible({ experienceLevel: 'Complete beginner' } as OnboardingData) === true);
}

console.log('\n[14] SKIPPING IS ANSWERING — an interrupted flow resumes correctly');
{
  const step = ONBOARDING_STEPS.find((s) => s.name === 'TwoKmTimeTrial');

  ok('an unanswered step is not satisfied',
    step?.satisfied({} as OnboardingData) === false);

  const withTime = {
    twoKmTimeTrial: { seconds: 435, recordedOn: '2026-07-29', source: 'onboarding' },
  } as unknown as OnboardingData;
  ok('a recorded time satisfies the step', step?.satisfied(withTime) === true);

  // THE POINT of `seconds: null` being a real answer rather than an absence.
  const skipped = {
    twoKmTimeTrial: { seconds: null, recordedOn: '2026-07-29', source: 'onboarding' },
  } as unknown as OnboardingData;
  ok('a SKIPPED step is satisfied — "haven\'t tested" is an answer',
    step?.satisfied(skipped) === true,
    'otherwise an interrupted flow resumes onto a screen the athlete already dismissed');

  // The end-to-end claim, through the real resume resolver.
  const base = {
    firstName: 'Sam', heightCm: 184, weightKg: 84, position: 'Midfielder',
    motivation: 'Get fitter', seasonPhase: 'Pre-season',
    teamTrainingDays: ['Monday'], teamTrainingDuration: '60-90 min',
    teamTrainingIntensity: 'Moderate', trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    experienceLevel: '2-5 years', squatStrength: 'Around bodyweight',
    benchStrength: 'Around bodyweight',
  } as unknown as OnboardingData;

  ok('an athlete who has not reached the step resumes onto it',
    resolveOnboardingResumeStep(base) === 'TwoKmTimeTrial',
    resolveOnboardingResumeStep(base));

  ok('an athlete who SKIPPED it resumes past it, not back onto it',
    resolveOnboardingResumeStep({ ...base, ...skipped } as OnboardingData)
      === 'ConditioningLevel',
    resolveOnboardingResumeStep({ ...base, ...skipped } as OnboardingData));

  // A step nobody answered must be named in the generation refusal, so the app
  // refuses honestly instead of defaulting around a gap.
  ok('an unanswered time trial is reported as missing',
    missingRequiredProfileFields(base).includes('twoKmTimeTrial'),
    missingRequiredProfileFields(base).join(','));
  ok('a skipped time trial is NOT reported as missing',
    !missingRequiredProfileFields({ ...base, ...skipped } as OnboardingData)
      .includes('twoKmTimeTrial'));
}

console.log('\n[15] The screen refuses through the owner — it does not carry the numbers');
{
  const screen = stripComments(fs.readFileSync(
    path.join(repoRoot, 'src/screens/onboarding/TwoKmTimeTrialScreen.tsx'), 'utf8'));

  ok('the screen validates through the authored bound',
    /validateOnboardingMeasurement|validateTwoKmTime/.test(screen),
    'the screen must not carry its own copy of the ruled numbers');

  ok('the screen commits through the one ingress',
    /recordTwoKmTime/.test(screen),
    'a screen that writes the field directly is a second producer with its own rules');

  ok('the screen never clamps a time',
    !/Math\.(min|max)\s*\(/.test(screen),
    'clamping substitutes the app\'s number for the athlete\'s');

  // The ruled numbers appear in exactly one place. A screen that restates them
  // keeps working after the ruling changes, which is the failure to prevent.
  const boundLines = screen.split('\n')
    .filter((l) => /min|max|bound|range|300|900|5:00|15:00/i.test(l)).join('\n');
  ok('the ruled numbers are not duplicated into the screen',
    !/\b(300|900)\b/.test(boundLines), boundLines.trim());

  ok('the screen offers the skip as an ANSWER, not an escape',
    /haven't tested|Haven't tested/i.test(screen),
    'the skip tile wording is part of what makes null a real answer');
}

console.log('\n[16] The screen is reachable — both routes into it, and out');
{
  const nav = stripComments(fs.readFileSync(
    path.join(repoRoot, 'src/navigation/OnboardingNavigator.tsx'), 'utf8'));
  ok('the navigator registers the screen',
    /name="TwoKmTimeTrial"/.test(nav));

  const bench = stripComments(fs.readFileSync(
    path.join(repoRoot, 'src/screens/onboarding/BenchStrengthScreen.tsx'), 'utf8'));
  ok('BenchStrength routes into it', /navigate\('TwoKmTimeTrial'\)/.test(bench));

  // Squat and bench are skipped for complete beginners, so GymExperience is the
  // OTHER way in. Missing this leaves beginners routed straight past the screen
  // their default pace is chosen for.
  const gym = stripComments(fs.readFileSync(
    path.join(repoRoot, 'src/screens/onboarding/GymExperienceScreen.tsx'), 'utf8'));
  ok('the complete-beginner path routes into it too',
    /navigate\('TwoKmTimeTrial'\)/.test(gym),
    'beginners skip squat/bench, so GymExperience is their way in');

  const screen = stripComments(fs.readFileSync(
    path.join(repoRoot, 'src/screens/onboarding/TwoKmTimeTrialScreen.tsx'), 'utf8'));
  ok('it routes on to ConditioningLevel',
    /navigate\('ConditioningLevel'\)/.test(screen));
}

console.log('\n[17] masCopy holds NO second derivation of the athlete\'s pace');
{
  // stripComments, because masCopy now NAMES what it retired and quotes the
  // contradictory sentence verbatim so the next reader knows why it went. A
  // bare scan reads that explanation as the offence and fails on the module's
  // own documentation — the exact trap `support/sourceText` was written for.
  const copy = stripComments(
    fs.readFileSync(path.join(repoRoot, 'src/utils/masCopy.ts'), 'utf8'));

  // masCopy carried `estimateMasFromTimeTrial` — the same arithmetic, unauthored,
  // with zero consumers. Two functions that both claim to know what MAS is are
  // two representations, and the dead one is the one that drifts unnoticed.
  ok('the duplicate derivation is gone from masCopy',
    !/function estimateMasFromTimeTrial/.test(copy),
    'one owner derives MAS: data/twoKmTimeTrial');
  ok('the duplicate km/h conversion is gone',
    !/function masKmhToMs/.test(copy));

  // The comment that argued for a discount, called it conservative, and applied
  // neither. It must not survive the ruling that replaced it.
  ok('the self-contradictory justification is gone',
    !/typically 1-3% higher/.test(copy),
    'the ruling replaced the reasoning, not just the number');

  // masCopy keeps the INTENSITY rule (what % of MAS a work interval asks for).
  // That is a different fact from what the athlete's MAS is, and templates cite
  // it by name — retiring it would be a scope change, not a de-duplication.
  ok('masCopy keeps the intensity rule it owns',
    /function masIntensityForWorkSeconds/.test(copy));
}

console.log('\n[18] NAMING — the time trial never shares a token with Team Training');
{
  // Sam, 2026-07-29. "TT" means Team Training in twelve rule files. A time
  // trial abbreviated the same way would be indistinguishable at every call
  // site, in every log line, and in every future grep.
  const files = [
    'src/data/twoKmTimeTrial.ts',
    'src/screens/onboarding/TwoKmTimeTrialScreen.tsx',
  ];
  for (const file of files) {
    const source = stripComments(fs.readFileSync(path.join(repoRoot, file), 'utf8'));
    // A bare TT token in code — not "TTimeTrial", not inside a longer word.
    ok(`${file} uses no bare "TT" token`,
      !/\bTT\b/.test(source), source.split('\n').filter((l) => /\bTT\b/.test(l)).join(' | '));
  }
}

console.log('\n[19] CHANGE IT LATER — the same ingress, without re-onboarding');
{
  const profile = stripComments(fs.readFileSync(
    path.join(repoRoot, 'src/screens/profile/ProfileScreen.tsx'), 'utf8'));

  ok('the profile editor has a time-trial step',
    /playerTimeTrial/.test(profile),
    'the athlete must be able to update their time without re-onboarding');

  // The whole point of one ingress: the update path and the onboarding path
  // cannot come to disagree about what is acceptable, because they are the
  // same call.
  ok('the profile editor commits through the one ingress',
    /recordTwoKmTime/.test(profile),
    'a second writer is a second set of rules');
  ok('the profile editor validates through the authored bound',
    /validateTwoKmTime/.test(profile));
  ok('the profile editor records itself as the producer',
    /'profile_edit'/.test(profile),
    'provenance survives the edit — the app knows where the number came from');

  const boundLines = profile.split('\n')
    .filter((l) => /twoKm|timeTrial|TimeTrial/i.test(l)).join('\n');
  ok('the ruled numbers are not duplicated into the profile editor',
    !/\b(300|900)\b/.test(boundLines), boundLines.trim().slice(0, 400));
}

console.log('\n[20] THE SESSION — a test, not a dose');
{
  // Sam, 2026-07-29: "it is a TEST, not a dose — lives outside the 55
  // conditioning rows, no conditioning-sheet entry; D14's 'run 2km, time it'
  // is its complete specification."
  ok('the exercise exists in the vocabulary',
    isSelectable(TIME_TRIAL_EXERCISE_NAME),
    'membership of a selectable pool is the only definition of "this exercise exists"');

  ok('it carries Sam\'s authored cue',
    EXERCISE_CUES[TIME_TRIAL_EXERCISE_NAME]?.primaryCue
      === 'Try to run this at the same pace for the entire 2km',
    EXERCISE_CUES[TIME_TRIAL_EXERCISE_NAME]?.primaryCue);

  // The ruling's negative half, gated: it must NOT acquire a dose.
  ok('it has NO conditioning-templates row',
    !CONDITIONING_TEMPLATES.some((t) => /time trial/i.test(t.name)),
    'a dose here would be inventing on a sheet Sam signed at 55 rows');

  const session = buildTimeTrialSession('tt-1');
  ok('the session prescribes the named exercise',
    session.some((ex) => ex.exercise?.name === TIME_TRIAL_EXERCISE_NAME),
    session.map((ex) => ex.exercise?.name).join(', '));
}

console.log('\n[21] It counts as a RUN — the existing gates need no change');
{
  // The claim, through the REAL counter rather than a restated rule. A
  // hard_conditioning unit on feet is already a running exposure, so the 4-run
  // cap sees the time trial without the cap owner being touched.
  const week: WeekDayInput[] = [
    { date: '2026-08-03', workouts: [timeTrialWorkout('2026-08-03')] },
  ];
  const counts = countWeeklyExposures(week, {});
  ok('a time-trial day counts as one running exposure',
    counts.runningExposures === 1, `got ${counts.runningExposures}`);
  ok('it counts as conditioning, not strength',
    counts.conditioningExposures === 1 && counts.mainStrengthExposures === 0,
    `cond=${counts.conditioningExposures} strength=${counts.mainStrengthExposures}`);

  // A 2km time trial is a MAXIMAL effort. If it classifies as easy aerobic
  // work, hard-day spacing and G-1 protection never see it and it can be
  // stacked beside a game.
  //
  // This assertion exists because mutation testing found the gap: reverting
  // `conditioningCategory` from 'vo2' to the wrong flavour string still passed
  // every count above, because 'aerobic_base' and 'hard_conditioning' are both
  // conditioning categories and both count as a run. Only the STRESS differs —
  // 'high-intensity' fell through to an intensity fallback and produced
  // aerobic_base/medium, i.e. a max-effort run rated easy.
  ok('a time trial is a HARD exposure, not easy aerobic work',
    counts.hardExposures === 1, `hardExposures=${counts.hardExposures}`);
  ok('and the day is marked hard',
    counts.hardDays === 1, `hardDays=${counts.hardDays}`);
  ok('it classifies as hard conditioning specifically',
    counts.byCategory.hard_conditioning === 1,
    JSON.stringify(counts.byCategory));

  // Four time trials in a week is over the Bible's hard max. If the classifier
  // ever stopped seeing this as a run, the cap would silently stop applying.
  const five = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07']
    .map((date) => ({ date, workouts: [timeTrialWorkout(date)] }));
  const overCounts = countWeeklyExposures(five, {});
  ok('five of them breach the 4-run cap',
    overCounts.runningExposures === 5
      && auditWeekAgainstCaps(overCounts)
        .some((f) => f.cap === 'maxRunningExposures' && f.kind === 'over'),
    `running=${overCounts.runningExposures}`);
}

console.log('\n[22] LOGGING A RESULT — the athlete\'s real run beats their answer');
{
  const logged = recordTimeTrialResult(402, '2026-08-03');
  ok('a logged result is accepted', logged.ok);
  ok('it is attributed to the session, not to onboarding',
    logged.answer?.source === 'session_log', logged.answer?.source);
  ok('it records the date it was run', logged.answer?.recordedOn === '2026-08-03');

  // Same law as weights: real data beats the onboarding estimate. Proven by
  // derivation, which is the only place the precedence can actually bite.
  const onboarded: TwoKmTimeTrialAnswer = {
    seconds: 480, recordedOn: '2026-07-29', source: 'onboarding',
  };
  const beforeLog = deriveMas(onboarded, '1-2 years');
  const afterLog = deriveMas(logged.answer, '1-2 years');
  ok('logging a faster run moves the derived MAS',
    afterLog.masKmh > beforeLog.masKmh,
    `${beforeLog.masKmh} -> ${afterLog.masKmh}`);
  ok('and it is still tagged measured, not an estimate',
    afterLog.source === 'measured', afterLog.source);

  // The bound applies here exactly as it does on the screen. A mis-tapped
  // stopwatch must not silently reprice every %MAS session in the app.
  const absurd = recordTimeTrialResult(95, '2026-08-03');
  ok('an impossible logged time is refused, not stored',
    !absurd.ok && !absurd.answer, String(absurd.answer?.seconds));
}

const total = passed + failures.length;
console.log(`\n2km time trial + MAS: passed=${passed}/${total} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
