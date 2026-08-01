/**
 * Onboarding generation outcome — the ownership boundary that replaced the
 * silent DEFAULT_PROGRAM substitution.
 *
 * Sam's ruling (2026-07-25): onboarding NEVER silently substitutes
 * DEFAULT_PROGRAM. A generation failure is reported with its OWN reason and a
 * Try Again; a transient failure gets one cheap automatic retry first. The
 * misleading "could not be saved" copy may never be produced by a generation
 * failure.
 *
 * Background: docs/ONBOARDING_SAVE_BLOCKER_DIAGNOSIS_2026-07-25.md and the
 * ownership reassessment alongside it. Before this boundary existed,
 * CompleteScreen caught every generation failure, installed DEFAULT_PROGRAM
 * (which carries no exposureContractV2), and the resulting install throw was
 * reported to the athlete as a save failure — the wrong reason for the wrong
 * event.
 *
 * Run: npm run test:onboarding-generation-outcome
 */

import fs from 'fs';
import path from 'path';
import { ProgramGenError } from '../services/api/generateProgram';
import {
  classifyProgramGenerationFailure,
  runOnboardingProgramGeneration,
  TRANSIENT_GENERATION_KINDS,
} from '../utils/onboardingGenerationOutcome';
import { programGenErrorForCuelessCards } from '../services/api/generateProgram';
import { ExerciseVocabularyViolation } from '../utils/exerciseCanonicalisation';

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const PROGRAM = { id: 'p1', microcycles: [] } as any;

const err = (
  kind: ConstructorParameters<typeof ProgramGenError>[0],
  userMessage: string,
  canRetry: boolean,
) => new ProgramGenError(kind, userMessage, `diagnostic for ${kind}`, canRetry);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[onboarding generation] classification carries the real reason');
{
  const overloaded = classifyProgramGenerationFailure(
    err('overloaded', 'The AI service is under heavy load right now. Please try again in a minute.', true),
  );
  ok('overloaded surfaces its own copy, not a save error',
    overloaded.userMessage.includes('under heavy load'),
    `got: ${overloaded.userMessage}`);
  ok('overloaded is retryable', overloaded.canRetry === true);
  ok('overloaded is transient', overloaded.isTransient === true);

  const cueless = classifyProgramGenerationFailure(
    programGenErrorForCuelessCards(
      new ExerciseVocabularyViolation('test', ['Made Up Movement']),
    ),
  );
  ok('the cueless refusal reaches the athlete with its own copy',
    cueless.userMessage.includes('without coaching cues'),
    `got: ${cueless.userMessage}`);
  ok('the cueless refusal is retryable', cueless.canRetry === true);
  ok('the cueless refusal is NOT treated as transient (no silent auto-retry)',
    cueless.isTransient === false);
  ok('offender names never reach the athlete copy',
    !cueless.userMessage.includes('Made Up Movement'));
  ok('offender names DO stay in the developer diagnostic',
    (cueless.diagnostic ?? '').includes('Made Up Movement'));

  const unauthorized = classifyProgramGenerationFailure(
    err('unauthorized', 'Couldn’t authorise the rebuild request. Please close the app and sign in again.', false),
  );
  ok('a non-retryable failure reports canRetry false', unauthorized.canRetry === false);
  ok('a non-retryable failure is not transient', unauthorized.isTransient === false);

  const unknown = classifyProgramGenerationFailure(new Error('boom'));
  ok('an untyped throw still yields safe copy',
    typeof unknown.userMessage === 'string' && unknown.userMessage.length > 0);
  ok('an untyped throw never leaks its raw message',
    !unknown.userMessage.includes('boom'), `got: ${unknown.userMessage}`);
  ok('an untyped throw is retryable', unknown.canRetry === true);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[onboarding generation] no generation failure ever says "could not be saved"');
{
  const kinds = [
    'server_outage', 'overloaded', 'unauthorized', 'bad_response',
    'network', 'missing_required_profile', 'unknown',
  ] as const;
  let clean = true;
  for (const kind of kinds) {
    const classified = classifyProgramGenerationFailure(
      err(kind, `copy for ${kind}`, true),
    );
    if (/could not be saved/i.test(classified.userMessage)) clean = false;
  }
  ok('no typed generation failure produces the save-error copy', clean);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[onboarding generation] transient failures get exactly one automatic retry');
(async () => {
  {
    let calls = 0;
    const outcome = await runOnboardingProgramGeneration({
      generate: async () => {
        calls += 1;
        if (calls === 1) throw err('network', 'Couldn’t reach the server.', true);
        return PROGRAM;
      },
    });
    ok('a transient failure is retried once and can then succeed',
      outcome.kind === 'generated' && calls === 2, `kind=${outcome.kind} calls=${calls}`);
  }

  {
    let calls = 0;
    const outcome = await runOnboardingProgramGeneration({
      generate: async () => {
        calls += 1;
        throw err('server_outage', 'Temporary server issue.', true);
      },
    });
    ok('a persistently transient failure attempts exactly twice, never more',
      calls === 2, `calls=${calls}`);
    ok('and then surfaces honestly', outcome.kind === 'failed');
    ok('with its own reason',
      outcome.kind === 'failed' && outcome.userMessage.includes('Temporary server issue'));
  }

  {
    let calls = 0;
    const outcome = await runOnboardingProgramGeneration({
      generate: async () => {
        calls += 1;
        throw programGenErrorForCuelessCards(
          new ExerciseVocabularyViolation('test', ['Made Up Movement']),
        );
      },
    });
    ok('a NON-transient failure is surfaced immediately with no second call',
      calls === 1, `calls=${calls}`);
    ok('and still offers Try Again',
      outcome.kind === 'failed' && outcome.canRetry === true);
  }

  {
    let calls = 0;
    const outcome = await runOnboardingProgramGeneration({
      generate: async () => { calls += 1; throw err('unauthorized', 'Sign in again.', false); },
    });
    ok('a non-retryable failure is not auto-retried', calls === 1, `calls=${calls}`);
    ok('and offers no Try Again',
      outcome.kind === 'failed' && outcome.canRetry === false);
  }

  {
    let calls = 0;
    const outcome = await runOnboardingProgramGeneration({
      generate: async () => { calls += 1; return PROGRAM; },
    });
    ok('a first-attempt success calls generate exactly once', calls === 1);
    ok('and returns the generated program',
      outcome.kind === 'generated' && outcome.program === PROGRAM);
  }

  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[onboarding generation] the transient set is exactly the retryable-by-waiting kinds');
  {
    ok('network is transient', TRANSIENT_GENERATION_KINDS.has('network'));
    ok('server_outage is transient', TRANSIENT_GENERATION_KINDS.has('server_outage'));
    ok('overloaded is transient', TRANSIENT_GENERATION_KINDS.has('overloaded'));
    ok('bad_response is NOT transient (retrying cannot fix a contract violation)',
      !TRANSIENT_GENERATION_KINDS.has('bad_response' as any));
    ok('unauthorized is NOT transient', !TRANSIENT_GENERATION_KINDS.has('unauthorized' as any));
    ok('missing_required_profile is NOT transient',
      !TRANSIENT_GENERATION_KINDS.has('missing_required_profile' as any));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Source contract: the repo ships no RN renderer, so the screen's half of the
  // boundary is asserted against its source, in the style of
  // keyboardConventionContractTests / coachFailureCopyContractTests.
  console.log('\n[onboarding generation] CompleteScreen no longer substitutes a program');
  {
    const complete = fs.readFileSync(
      path.join(__dirname, '..', 'screens/onboarding/CompleteScreen.tsx'), 'utf8',
    );

    ok('CompleteScreen never assigns DEFAULT_PROGRAM as a substitute',
      !/=\s*DEFAULT_PROGRAM\s*;/.test(complete),
      'the silent fallback is retired — a generation failure is reported, not papered over');
    ok('CompleteScreen never seeds DEFAULT_PROGRAM',
      !/seedProgram\(\s*DEFAULT_PROGRAM/.test(complete),
      'installing the demo program under the athlete\'s name is the retired behaviour');
    ok('CompleteScreen no longer imports DEFAULT_PROGRAM at all',
      !/import\s*\{[^}]*DEFAULT_PROGRAM/.test(complete),
      'no import means the substitution cannot be reintroduced by accident');

    ok('the dead OverloadError name check is gone',
      !/OverloadError/.test(complete),
      'generation only ever throws ProgramGenError; that branch could never fire');

    ok('CompleteScreen routes generation through the outcome owner',
      /runOnboardingProgramGeneration\(/.test(complete),
      'one owner decides copy + retry; the screen only renders the outcome');

    ok('the Try Again affordance is gated on canRetry',
      /canRetry/.test(complete),
      'a non-retryable failure (e.g. unauthorized) must not offer a pointless retry');

    // L6 honest actions: the save-error copy may only describe an actual
    // install failure, and must be unreachable from a generation failure.
    const saveCopyMatches = complete.match(/could not be saved/g) ?? [];
    ok('the save-error copy survives only for a genuine install failure',
      saveCopyMatches.length <= 1,
      `found ${saveCopyMatches.length} occurrences; the generation-failure copy path must be gone`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[onboarding generation] one classifier, not two');
  {
    const home = fs.readFileSync(
      path.join(__dirname, '..', 'screens/home/useHomeScreen.ts'), 'utf8',
    );
    ok('useHomeScreen no longer defines its own private error classifier',
      !/const\s+classifyRebuildError\s*=/.test(home),
      'a second representation of "failure -> copy" is how onboarding and rebuild drifted apart');
    ok('useHomeScreen classifies through the shared owner',
      /classifyProgramGenerationFailure/.test(home),
      'the same error must produce the same copy on both surfaces');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Reachability lock for the unguarded TypeError found while probing the
  // device blocker: `LOCATION_CONDITIONING_MODALITIES[location] is not
  // iterable` (equipmentAvailability.ts). It was triggered by a hand-written
  // fixture carrying an out-of-type location, NOT by anything onboarding can
  // produce — `trainingLocation` is a PROFILE_DEFAULT_REQUIRED_FIELD the store
  // guarantees, and no step collects it. No runtime guard was added on that
  // basis (Sam ruling: guard only if live). This locks the reason it is not
  // live, so a fifth location can never ship without a modality entry.
  console.log('\n[onboarding generation] every valid training location resolves without throwing');
  {
    const { resolveEquipmentAvailability } = require('../utils/equipmentAvailability');
    const { useProfileStore } = require('../store/profileStore');
    const LOCATIONS = ['Commercial gym', 'Home gym', 'Club gym', 'Outdoor'] as const;

    for (const trainingLocation of LOCATIONS) {
      let threw: unknown = null;
      try {
        resolveEquipmentAvailability({ equipment: [], trainingLocation } as any, []);
      } catch (error) { threw = error; }
      ok(`trainingLocation="${trainingLocation}" resolves equipment without throwing`,
        threw === null, `threw: ${(threw as any)?.message}`);
    }

    // The store default WAS 'Commercial gym', pinned here because an unknown
    // value crashed the (now deleted) location lookup. Under the equipment
    // rulings (2026-07-31) nothing infers a kit from a location: the store's
    // initial data is honestly EMPTY, and the resolver ignores location on
    // every path — which the next assertion proves directly.
    const storeDefault = useProfileStore.getState().onboardingData?.trainingLocation;
    ok('the store no longer defaults a training location nobody chose',
      storeDefault === undefined,
      `store default is ${JSON.stringify(storeDefault)}`);
    let undefinedLocationThrew: unknown = null;
    try {
      resolveEquipmentAvailability({ equipment: [] } as any, []);
    } catch (error) { undefinedLocationThrew = error; }
    ok('an absent training location resolves equipment without throwing',
      undefinedLocationThrew === null,
      `threw: ${(undefinedLocationThrew as any)?.message}`);
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
})();
