(global as unknown as { __DEV__: boolean }).__DEV__ = false;

/**
 * COACH LAB — provider-free quality bench for the clean Coach rebuild.
 *
 * This suite proves the bench before any model is selected. It does not judge
 * Sam's coaching words: every seeded case stays pending until he approves or
 * corrects an answer. Automatic checks only hold the ruled boundaries that a
 * response can satisfy mechanically.
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  COACH_LAB_CASES,
  ROOTED_SOL_APPROVED_ANSWER,
  coachLabFixtureSnapshot,
} from '../dev/coachLab/coachLabCases';
import {
  evaluateCoachLabResponse,
  runCoachLab,
  type CoachLabResponseV1,
} from '../dev/coachLab/coachLab';
import { currentReadOnlyCoachCandidate } from '../dev/coachLab/currentReadOnlyCoachCandidate';

armTotalsOrRed();

let passed = 0;
let failed = 0;

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
}

console.log('\n[1] THE FIRST CORPUS IS REAL LANGUAGE, NOT PERFECT PROMPTS');
{
  ok('the first bench contains ten questions', COACH_LAB_CASES.length === 10);
  ok('every case has a stable unique id',
    new Set(COACH_LAB_CASES.map((entry) => entry.id)).size === COACH_LAB_CASES.length);
  ok('messy spelling and shorthand survive unchanged',
    COACH_LAB_CASES.some((entry) => entry.athleteMessage === 'legs are rooted but dont wanna skip'));
  const approved = COACH_LAB_CASES.filter((entry) => entry.ownerReview.status === 'approved');
  ok('only Sam\'s exact approved Sol tape leaves pending review',
    approved.length === 1
      && approved[0].id === 'rooted-but-wants-to-train'
      && approved[0].ownerReview.idealAnswer === ROOTED_SOL_APPROVED_ANSWER
      && approved[0].ownerReview.approvedModel === 'gpt-5.6-sol'
      && approved[0].ownerReview.approvedPromptVersion === 'coach-lab-openai-v2-retrieval'
      && COACH_LAB_CASES.filter((entry) => entry.ownerReview.status === 'pending').length === 9);
  ok('every case declares whether live program facts are required',
    COACH_LAB_CASES.every((entry) => typeof entry.requiresLiveProgramFacts === 'boolean'));
}

console.log('\n[2] THE CURRENT READ-ONLY COACH GETS AN HONEST BASELINE');
{
  const report = runCoachLab({
    cases: COACH_LAB_CASES,
    snapshot: coachLabFixtureSnapshot(),
    candidate: currentReadOnlyCoachCandidate,
  });
  ok('the runner reaches every distinct case',
    report.results.length === COACH_LAB_CASES.length
      && new Set(report.results.map((entry) => entry.caseId)).size === COACH_LAB_CASES.length);
  ok('the current Coach answers at least one factual program question',
    report.results.some((entry) => entry.response.answerMode === 'answer'));
  ok('the baseline exposes the generic-refusal problem instead of hiding it',
    report.summary.automaticFail > 0
      && report.results.some((entry) => entry.response.answerMode === 'generic_refusal'));
  ok('nothing can pass quality while Sam review is absent',
    report.summary.approved === 0
      && report.results.every((entry) => entry.verdict !== 'approved'));
  ok('the current adapter attempts no program action',
    report.results.every((entry) => entry.response.programActions.length === 0));
}

const GOOD_RESPONSE: CoachLabResponseV1 = {
  schemaVersion: 1,
  message: 'Your Saturday game and today\'s load are the two facts I am using.',
  answerMode: 'answer',
  basis: ['athlete_snapshot'],
  snapshotFieldsUsed: ['visibleWeek', 'load'],
  knowledgeSources: [],
  judgementLabel: 'not_needed',
  programActions: [],
  diagnostics: {
    provider: 'lab_fixture',
    model: 'fixture-v1',
    promptVersion: 'fixture-v1',
  },
};

console.log('\n[3] AUTOMATIC BOUNDARIES FAIL CLOSED');
{
  const programCase = COACH_LAB_CASES.find((entry) => entry.requiresLiveProgramFacts)!;
  const good = evaluateCoachLabResponse(programCase, GOOD_RESPONSE);
  ok('a structurally sound answer still waits for owner review',
    good.verdict === 'needs_owner_review'
      && Object.values(good.automaticChecks).every(Boolean));

  const approved = evaluateCoachLabResponse({
    ...programCase,
    ownerReview: {
      status: 'approved',
      idealAnswer: GOOD_RESPONSE.message,
      correctionReason: null,
      approvedModel: GOOD_RESPONSE.diagnostics.model,
      approvedPromptVersion: GOOD_RESPONSE.diagnostics.promptVersion,
    },
  }, GOOD_RESPONSE);
  ok('an answer only becomes approved after a real owner answer is recorded',
    approved.verdict === 'approved');

  const emptyApproval = evaluateCoachLabResponse({
    ...programCase,
    ownerReview: {
      status: 'approved',
      idealAnswer: null,
      correctionReason: null,
      approvedModel: null,
      approvedPromptVersion: null,
    },
  }, GOOD_RESPONSE);
  ok('an empty approval marker cannot manufacture owner review',
    emptyApproval.verdict === 'needs_owner_review');

  const competitor = evaluateCoachLabResponse({
    ...programCase,
    ownerReview: {
      status: 'approved',
      idealAnswer: GOOD_RESPONSE.message,
      correctionReason: null,
      approvedModel: 'different-model',
      approvedPromptVersion: GOOD_RESPONSE.diagnostics.promptVersion,
    },
  }, GOOD_RESPONSE);
  ok('one approved tape cannot approve a competing model',
    competitor.verdict === 'needs_owner_review');

  const action = evaluateCoachLabResponse(programCase, {
    ...GOOD_RESPONSE,
    programActions: [{ kind: 'save_program_change', label: 'Do it' }],
  });
  ok('a fabricated direct program action turns the read-only check red',
    action.verdict === 'automatic_fail' && !action.automaticChecks.readOnly);

  const hiddenJudgement = evaluateCoachLabResponse(programCase, {
    ...GOOD_RESPONSE,
    basis: ['coaching_judgement'],
    snapshotFieldsUsed: [],
    judgementLabel: 'missing',
  });
  ok('coaching judgement without its label turns transparency red',
    hiddenJudgement.verdict === 'automatic_fail'
      && !hiddenJudgement.automaticChecks.judgementTransparent);

  const inventedProgramFact = evaluateCoachLabResponse(programCase, {
    ...GOOD_RESPONSE,
    snapshotFieldsUsed: [],
  });
  ok('a program answer with no Snapshot receipt turns grounding red',
    inventedProgramFact.verdict === 'automatic_fail'
      && !inventedProgramFact.automaticChecks.programFactsGrounded);

  const inventedLfaRule = evaluateCoachLabResponse(programCase, {
    ...GOOD_RESPONSE,
    basis: ['lfa_rule'],
    snapshotFieldsUsed: [],
    knowledgeSources: [],
  });
  ok('an LFA claim with no source turns rule grounding red',
    inventedLfaRule.verdict === 'automatic_fail'
      && !inventedLfaRule.automaticChecks.lfaClaimsGrounded);

  const refusal = evaluateCoachLabResponse(programCase, {
    ...GOOD_RESPONSE,
    message: "I don't have an answer for that yet.",
    answerMode: 'generic_refusal',
    basis: [],
    snapshotFieldsUsed: [],
  });
  ok('the old generic refusal can never count as useful',
    refusal.verdict === 'automatic_fail' && !refusal.automaticChecks.useful);
}

console.log(`\nCoach Lab totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
console.log('  NOT COVERED: no AI provider runs, nine cases remain unreviewed, no app UI is mounted, and no program change is attempted.');
if (failed > 0) process.exit(1);
