(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  COACH_LAB_MAX_ANSWER_WORDS,
  COACH_LAB_RESPONSE_SCHEMA_VERSION,
  evaluateCoachLabResponse,
  type CoachLabResponseV1,
} from '../dev/coachLab/coachLab';
import { COACH_LAB_CASES, coachLabFixtureSnapshot } from '../dev/coachLab/coachLabCases';
import { buildRetrievedCoachLabBrainInstructions } from '../dev/coachLab/coachLabBrainPack';
import {
  retrieveCoachLabKnowledge,
  type CanonicalCoachKnowledgeSource,
} from '../dev/coachLab/coachLabKnowledgeRetriever';

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

function read(path: string): string {
  return readFileSync(resolve(__dirname, '../..', path), 'utf8');
}

const SOURCES: readonly CanonicalCoachKnowledgeSource[] = [
  { path: 'docs/LFA_PROGRAMMING_BIBLE.md', authority: 'lfa_bible', content: read('docs/LFA_PROGRAMMING_BIBLE.md') },
  { path: 'docs/RULINGS_REGISTRY.md', authority: 'active_rule', content: read('docs/RULINGS_REGISTRY.md') },
  { path: 'src/data/exercisePoolsStrength.ts', authority: 'canonical_source', content: read('src/data/exercisePoolsStrength.ts') },
  { path: 'src/data/exerciseTags.ts', authority: 'canonical_source', content: read('src/data/exerciseTags.ts') },
  { path: 'src/data/exerciseEquipmentRequirement.ts', authority: 'canonical_source', content: read('src/data/exerciseEquipmentRequirement.ts') },
  { path: 'src/data/conditioningTemplates.ts', authority: 'canonical_source', content: read('src/data/conditioningTemplates.ts') },
];

function retrievalFor(caseId: string) {
  const labCase = COACH_LAB_CASES.find((entry) => entry.id === caseId);
  if (!labCase) throw new Error(`Missing case ${caseId}`);
  return retrieveCoachLabKnowledge({
    athleteMessage: labCase.athleteMessage,
    snapshot: coachLabFixtureSnapshot(),
    sources: SOURCES,
  });
}

console.log('\n[1] RETRIEVAL SENDS EXACT CANONICAL EXCERPTS, NOT A MINI-BIBLE');
{
  const retrieval = retrievalFor('rooted-but-wants-to-train');
  const selected = retrieval.chunks.map((chunk) => chunk.content).join('\n');
  ok('the available source is the measured full knowledge set',
    retrieval.receipt.availableCharacters > 800_000,
    retrieval.receipt.availableCharacters);
  ok('the tired/sore question retrieves all three supporting Bible rules',
    selected.includes('Tired today')
      && selected.includes('Sore')
      && selected.includes('Slight reduction'));
  ok('selected context is under one tenth of the available source',
    retrieval.receipt.selectedCharacters < retrieval.receipt.availableCharacters / 10,
    retrieval.receipt);
  ok('every excerpt is an exact line slice of its named canonical source',
    retrieval.chunks.every((chunk) => {
      const source = SOURCES.find((entry) => entry.path === chunk.path);
      if (!source) return false;
      return source.content.split('\n').slice(chunk.startLine - 1, chunk.endLine).join('\n') === chunk.content;
    }));
  ok('the receipt names character units, chunk count and every source coordinate',
    retrieval.receipt.selectedChunks === retrieval.chunks.length
      && retrieval.chunks.every((chunk) => /:L\d+-L\d+$/.test(chunk.id)));
}

console.log('\n[2] DIFFERENT ATHLETE QUESTIONS RETRIEVE DIFFERENT KNOWLEDGE');
{
  const missed = retrievalFor('missed-monday-cram-wednesday');
  const shoulder = retrievalFor('painful-shoulder-alternative');
  const equipment = retrievalFor('missing-machine');
  const deload = retrievalFor('flat-deload-question');
  ok('missed-session language reaches the missed-session law',
    missed.chunks.some((chunk) => /Missed session/i.test(chunk.content)));
  ok('painful shoulder language reaches injury and pain guidance',
    shoulder.chunks.some((chunk) => /shoulder/i.test(chunk.content) && /pain|injur/i.test(chunk.content)));
  ok('missing equipment reaches a canonical exercise/equipment source',
    equipment.chunks.some((chunk) => chunk.authority === 'canonical_source'));
  ok('flat and deload language reaches fatigue/readiness or deload guidance',
    deload.chunks.some((chunk) => /deload|fatigue|readiness/i.test(chunk.content)));
  const fingerprints = COACH_LAB_CASES.map((labCase) => retrieveCoachLabKnowledge({
    athleteMessage: labCase.athleteMessage,
    snapshot: coachLabFixtureSnapshot(),
    sources: SOURCES,
  }).chunks.map((chunk) => chunk.id).join('|'));
  ok('the ten-case bench produces at least six distinct retrieval sets',
    new Set(fingerprints).size >= 6, new Set(fingerprints).size);
}

console.log('\n[3] THE PROMPT CARRIES ONLY SELECTED RECEIPTED KNOWLEDGE');
{
  const retrieval = retrievalFor('rooted-but-wants-to-train');
  const instructions = buildRetrievedCoachLabBrainInstructions(retrieval.chunks);
  ok('every selected chunk and coordinate reaches the prompt',
    retrieval.chunks.every((chunk) => instructions.includes(chunk.id) && instructions.includes(chunk.content)));
  ok('the prompt keeps the authority order and short-answer contract',
    /CURRENT ATHLETE SNAPSHOT[\s\S]+ACTIVE LFA RULINGS[\s\S]+LFA PROGRAMMING BIBLE[\s\S]+COACHING JUDGEMENT/.test(instructions)
      && instructions.includes('60-90 words'));
  ok('the resulting instructions remain below 80,000 characters',
    instructions.length < 80_000, instructions.length);
}

console.log('\n[4] SOURCE CHANGES FLOW THROUGH WITHOUT A STALE SUMMARY');
{
  const source: CanonicalCoachKnowledgeSource = {
    path: 'docs/synthetic-bible.md',
    authority: 'lfa_bible',
    content: ['0. Core', 'Never diagnose.', '9. Readiness', 'Tired today MUTATION-WITNESS', 'Reduce volume.'].join('\n'),
  };
  const retrieval = retrieveCoachLabKnowledge({
    athleteMessage: 'tired today',
    snapshot: coachLabFixtureSnapshot(),
    sources: [source],
    maxSelectedCharacters: 20_000,
  });
  ok('a canonical-source mutation appears immediately in retrieved content',
    retrieval.chunks.some((chunk) => chunk.content.includes('MUTATION-WITNESS')));
}

console.log('\n[5] LONG ANSWERS FAIL THE LAB EVEN WHEN EVERYTHING ELSE IS SOUND');
{
  const labCase = COACH_LAB_CASES[2];
  const base: CoachLabResponseV1 = {
    schemaVersion: COACH_LAB_RESPONSE_SCHEMA_VERSION,
    message: 'Useful answer.',
    answerMode: 'answer',
    basis: ['athlete_snapshot'],
    snapshotFieldsUsed: ['visibleWeek'],
    knowledgeSources: [],
    judgementLabel: 'not_needed',
    programActions: [],
    diagnostics: { provider: 'test', model: 'test', promptVersion: 'test' },
  };
  const concise = evaluateCoachLabResponse(labCase, base);
  const long = evaluateCoachLabResponse(labCase, {
    ...base,
    message: Array.from({ length: COACH_LAB_MAX_ANSWER_WORDS + 1 }, () => 'word').join(' '),
  });
  ok('a concise answer keeps the length boundary green', concise.automaticChecks.concise);
  ok('one word over the hard ceiling turns the boundary red',
    !long.automaticChecks.concise && long.verdict === 'automatic_fail');
}

console.log('\n[6] SAM\'S COST-AND-LENGTH RULING IS BOUND TO THE LAB');
{
  const rulings = read('docs/RULINGS_REGISTRY.md');
  const client = read('src/dev/coachLab/openAIResponsesClient.ts');
  ok('R-134 records the accepted tone with a shorter cheaper everyday path',
    rulings.includes('**R-134**')
      && rulings.includes('PRESERVE THE COACHING TONE; MAKE THE EVERYDAY ANSWER SHORTER AND CHEAPER'));
  ok('the bound request uses low reasoning and low verbosity',
    /reasoning: \{ effort: 'low', context: 'current_turn' \}/.test(client)
      && /verbosity: 'low'/.test(client));
}

console.log(`\nCoach Lab retrieval totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
console.log('  NOT COVERED: no provider call runs, retrieval quality is proved only on the ten current Lab questions, and Sam has not reviewed a cheaper-model answer.');
if (failed > 0) process.exit(1);
