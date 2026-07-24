/**
 * The generation vocabulary contract — the generator does not get naming rights.
 *
 * Device run 5: three strength cards rendered with no coaching cue at all
 * ("Single Arm Half Kneeling OHP (DB)", "Incline DB Row (Chest Supported)",
 * "Hamstring Curls"). Two separate failures produced that:
 *
 *   1. The generation prompt never told the model which exercises exist, so it
 *      invented superset-token spellings of curated movements. Widening the
 *      ingress matcher is a permanent tail-chase while the generator is free to
 *      name anything — so the prompt now CARRIES the curated vocabulary and
 *      instructs selection from it only. The list is DERIVED from the curated
 *      layer (same prompt-derives-from-contract principle as G6), never
 *      hand-copied, so a cue Sam adds is offered on the very next generation.
 *   2. The acceptance-time contract shipped as a non-fatal `logger.error`, which
 *      contradicted Sam's ruling. A log nobody reads is indistinguishable from
 *      no gate: the program was accepted and the blank cards rendered. Names
 *      that still fail to resolve at acceptance are now a HARD contract
 *      violation — the acceptance path refuses with an honest, retryable error
 *      rather than rendering a cueless exercise.
 *
 * Run: npm run test:generation-vocabulary
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import fs from 'fs';
import path from 'path';
import type { OnboardingData } from '../types/domain';
import { EXERCISE_CUES } from '../data/exerciseCues';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { buildCoachingPlan, onboardingToCoachingInputs } from '../utils/coachingEngine';
import {
  buildGenerationPrompt,
  programGenErrorForCuelessCards,
  ProgramGenError,
} from '../services/api/generateProgram';
import { FULL_GYM_EQUIPMENT } from '../utils/equipmentAvailability';
import { curatedExerciseVocabulary, ExerciseVocabularyViolation } from '../utils/exerciseCanonicalisation';
import {
  isSelectable,
  selectableExerciseNames,
  selectableVocabularyGroups,
} from '../data/selectableExerciseVocabulary';

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const PROFILE: OnboardingData = {
  firstName: 'VocabularyTester',
  ageRange: '25-34',
  position: 'inside_mid',
  goals: ['Build Strength'],
  experienceLevel: 'Intermediate',
  seasonPhase: 'Pre-season',
  trainingLocation: 'Commercial gym',
  equipment: ['Barbell', 'Dumbbells', 'Squat rack'],
  daysPerWeek: 4,
  usualGameDay: 'Saturday',
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  injuries: [],
} as unknown as OnboardingData;

const plan = buildCoachingPlan(onboardingToCoachingInputs(PROFILE, {
  miniCycleNumber: 1,
  weekInBlock: 1,
  weekNumber: 1,
  weekKind: 'build',
  phaseWeekNumber: 1,
  availabilityDateISO: '2026-07-06',
}));
const prompt = buildGenerationPrompt(PROFILE, plan, FULL_GYM_EQUIPMENT);

console.log('\n[1] The generator loses naming rights — the prompt carries the vocabulary');
{
  const vocabulary = curatedExerciseVocabulary();
  const selectable = selectableExerciseNames();

  // THE VOCABULARY SWITCH (Sam's locked list, 2026-07-24). The vocabulary used
  // to derive from "has a cue", which answers the wrong question: a cue means
  // the app can DESCRIBE a movement, not that any builder can PRESCRIBE it. The
  // generator was therefore offered census-confirmed orphans, and the
  // completeness check could not notice because the offer and the check were
  // the same set. Membership of a pool a live builder selects from is now the
  // single definition, checked in both directions below.
  ok('the AI vocabulary IS selectable pool membership, exactly',
    vocabulary.length === selectable.length &&
      vocabulary.every((name, i) => name === selectable[i]),
    `vocabulary=${vocabulary.length} selectable=${selectable.length}`);

  ok('nothing the generator is offered is unprescribable',
    vocabulary.every((name) => isSelectable(name)),
    `not selectable: ${vocabulary.filter((n) => !isSelectable(n)).slice(0, 12).join(' | ')}`);

  ok('nothing prescribable is withheld from the generator',
    selectable.every((name) => vocabulary.includes(name)),
    `absent from the offer: ${selectable.filter((n) => !vocabulary.includes(n)).slice(0, 12).join(' | ')}`);

  // The derivation proof: EVERY selectable name reaches the prompt. A
  // hand-copied list would drift the moment Sam pools a movement, and this
  // fails immediately.
  const missing = vocabulary.filter((name) => !prompt.includes(name));
  ok('every selectable exercise name appears verbatim in the generation prompt',
    missing.length === 0,
    `absent from the prompt: ${missing.slice(0, 12).join(' | ')}`);

  // The prompt carries the movement-pattern GROUPING too, which is what let the
  // edge function's hand-copied MOVEMENT PATTERNS list be deleted rather than
  // kept in sync — one derived representation instead of two.
  const groups = selectableVocabularyGroups();
  ok('the prompt groups the vocabulary by the pool slot that owns each name',
    groups.length > 5 && groups.every((g) => prompt.includes(`${g.label}: `)),
    `groups=${groups.length}; missing: ${groups.filter((g) => !prompt.includes(`${g.label}: `)).map((g) => g.label).join(' | ')}`);

  ok('the second, hand-copied vocabulary is gone from the edge prompt',
    !fs.readFileSync(
      path.join(__dirname, '..', '..', 'supabase/functions/coach-chat/index.ts'), 'utf8',
    ).includes('MOVEMENT PATTERNS (every exercise belongs to exactly one):'),
    'a hand-maintained second list is exactly the drift the switch retires');

  ok('the prompt names the vocabulary as authoritative and selection-only',
    /EXERCISE VOCABULARY/i.test(prompt) && /\bONLY\b/.test(prompt) && /exact/i.test(prompt),
    'the prompt must instruct the model to select names from the list ONLY, exactly as written');
  ok('the prompt forbids the run-5 drift classes by name (invent / abbreviate / plural / qualifier)',
    /invent/i.test(prompt) && /abbreviat/i.test(prompt) &&
      /plural/i.test(prompt) && /qualifier|bracket/i.test(prompt),
    'the three device failures were an invented superset, an abbreviation and a plural — '
      + 'the instruction must rule out the class, not the three phrases');
}

console.log('\n[2] Acceptance refuses a cueless program — enforced, not observed');
{
  // The acceptance gate lives in the program builder, so ANY caller that accepts
  // generated content inherits it; it is not a render-time observation.
  const cuelessCoachWorkout = [{
    dayOfWeek: 1,
    name: 'Lower Strength',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [
      { name: 'Back Squat', sets: 3, repsMin: 5, repsMax: 5, exerciseOrder: 1 },
      { name: 'Zerg Rush Deadlift', sets: 3, repsMin: 8, repsMax: 8, exerciseOrder: 2 },
    ],
  }];
  let thrown: unknown = null;
  try {
    buildWorkoutsFromCoach(cuelessCoachWorkout as any, 'mc-vocab-test', undefined, PROFILE);
  } catch (e) { thrown = e; }
  ok('buildWorkoutsFromCoach REFUSES a workout carrying a cueless strength card',
    thrown instanceof ExerciseVocabularyViolation,
    `threw ${thrown === null ? 'nothing' : String(thrown)}`);
  ok('...and the refusal names the offending exercise',
    thrown instanceof ExerciseVocabularyViolation &&
      thrown.unresolved.includes('Zerg Rush Deadlift'),
    `unresolved=${JSON.stringify((thrown as ExerciseVocabularyViolation)?.unresolved)}`);

  // The run-5 spellings must NOT trip the gate any more — they resolve at the
  // widened ingress boundary, so acceptance passes and the cards render cued.
  const supersetCoachWorkout = [{
    dayOfWeek: 1,
    name: 'Upper Strength',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [
      { name: 'Single Arm Half Kneeling OHP (DB)', sets: 3, repsMin: 8, repsMax: 8, exerciseOrder: 1 },
      { name: 'Incline DB Row (Chest Supported)', sets: 3, repsMin: 10, repsMax: 10, exerciseOrder: 2 },
      { name: 'Hamstring Curls', sets: 3, repsMin: 10, repsMax: 12, exerciseOrder: 3 },
    ],
  }];
  let supersetThrew: unknown = null;
  try {
    buildWorkoutsFromCoach(supersetCoachWorkout as any, 'mc-vocab-superset', undefined, PROFILE);
  } catch (e) { supersetThrew = e; }
  ok('the three run-5 device names now pass acceptance (they resolve at ingress)',
    supersetThrew === null,
    `threw ${String(supersetThrew)}`);
}

console.log('\n[3] The refusal is honest and retryable, and leaks no internals');
{
  const violation = new ExerciseVocabularyViolation('unit', ['Zerg Rush Deadlift', 'Some Made Up Move']);
  const err = programGenErrorForCuelessCards(violation);

  ok('the refusal is a ProgramGenError', err instanceof ProgramGenError);
  ok('the athlete is offered a retry', err.canRetry === true);
  ok('the refusal is classified as a bad generation response', err.kind === 'bad_response');
  ok('the athlete-facing copy is honest about withholding the program',
    /\S/.test(err.userMessage) && /try again/i.test(err.userMessage),
    `userMessage=${JSON.stringify(err.userMessage)}`);
  ok('the athlete-facing copy leaks no internal identifiers or raw names',
    !/GenerationContract|canonicalis|Zerg Rush Deadlift|Some Made Up Move|_[a-z]+_/i.test(err.userMessage),
    `userMessage=${JSON.stringify(err.userMessage)}`);
  ok('the developer diagnostic DOES name every offender',
    err.diagnostic.includes('Zerg Rush Deadlift') && err.diagnostic.includes('Some Made Up Move'),
    `diagnostic=${JSON.stringify(err.diagnostic)}`);
}

console.log('\n[4] The generation path is wired to the refusal, not to the generic copy');
{
  // A vocabulary violation surfaces as its own honest refusal. Without explicit
  // wiring it would be swallowed by the normalisation catch and reported as the
  // generic "the app could not read it" — the exact mis-signalling G6 diagnosed.
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'services/api/generateProgram.ts'), 'utf8');
  ok('the acceptance catch maps ExerciseVocabularyViolation to its own refusal',
    /instanceof ExerciseVocabularyViolation/.test(source) &&
      /programGenErrorForCuelessCards/.test(source),
    'the vocabulary violation must not fall through to the generic bad_response copy');
}

console.log(`\ngeneration vocabulary contract: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
