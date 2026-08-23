import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadEnvFile } from 'process';
import {
  buildCoachLabBrainInstructions,
  buildRetrievedCoachLabBrainInstructions,
  type CoachLabKnowledgeFile,
} from '../src/dev/coachLab/coachLabBrainPack';
import { COACH_LAB_CASES, coachLabFixtureSnapshot } from '../src/dev/coachLab/coachLabCases';
import { runCoachLabAsync } from '../src/dev/coachLab/coachLab';
import { createOpenAICoachLabCandidate } from '../src/dev/coachLab/openAICoachLabCandidate';
import {
  retrieveCoachLabKnowledge,
  type CanonicalCoachKnowledgeSource,
} from '../src/dev/coachLab/coachLabKnowledgeRetriever';
import { SupabaseCoachLabClient } from '../src/dev/coachLab/supabaseCoachLabClient';

const DEFAULT_CASE_ID = 'rooted-but-wants-to-train';
const BIBLE_PATH = 'docs/LFA_PROGRAMMING_BIBLE.md';
const RULINGS_PATH = 'docs/RULINGS_REGISTRY.md';
const EXERCISE_SOURCE_PATHS = [
  'src/data/exercisePoolsStrength.ts',
  'src/data/exerciseTags.ts',
  'src/data/exerciseEquipmentRequirement.ts',
  'src/data/conditioningTemplates.ts',
] as const;

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function selectedCases() {
  if (process.argv.includes('--pending')) {
    return COACH_LAB_CASES.filter((entry) => entry.ownerReview.status === 'pending');
  }
  if (process.argv.includes('--all')) return COACH_LAB_CASES;
  const caseArg = process.argv.find((arg) => arg.startsWith('--case='));
  const caseId = caseArg?.slice('--case='.length) || DEFAULT_CASE_ID;
  const selected = COACH_LAB_CASES.find((entry) => entry.id === caseId);
  if (!selected) throw new Error(`Unknown Coach Lab case: ${caseId}`);
  return [selected];
}

function requestedModel(): string {
  const modelArg = process.argv.find((arg) => arg.startsWith('--model='));
  return modelArg?.slice('--model='.length) || 'gpt-5.6-terra';
}

function canonicalSources(): readonly CanonicalCoachKnowledgeSource[] {
  return [
    { path: BIBLE_PATH, authority: 'lfa_bible', content: read(BIBLE_PATH) },
    { path: RULINGS_PATH, authority: 'active_rule', content: read(RULINGS_PATH) },
    ...EXERCISE_SOURCE_PATHS.map((path): CanonicalCoachKnowledgeSource => ({
      path,
      authority: 'canonical_source',
      content: read(path),
    })),
  ];
}

async function main(): Promise<void> {
  loadEnvFile(resolve(process.cwd(), '.env'));
  const syntheticSmoke = process.argv.includes('--synthetic-smoke');
  const fullSource = process.argv.includes('--full-source');
  const cases = selectedCases();
  const snapshot = coachLabFixtureSnapshot();
  const exerciseSources: CoachLabKnowledgeFile[] = syntheticSmoke
    ? [{ path: 'synthetic-exercises', content: 'No exercise rule is required for this connection test.' }]
    : EXERCISE_SOURCE_PATHS.map((path) => ({ path, content: read(path) }));
  const fullSourceInstructions = buildCoachLabBrainInstructions(syntheticSmoke
    ? {
      bible: 'Synthetic connection test only. Give safe, read-only training advice.',
      rulings: 'Synthetic rule: do not change a program and do not diagnose.',
      exerciseSources,
    }
    : {
      bible: read(BIBLE_PATH),
      rulings: read(RULINGS_PATH),
      exerciseSources,
    });
  const sources = syntheticSmoke ? [] : canonicalSources();
  const resolveInstructions = ({ labCase }: { readonly labCase: typeof COACH_LAB_CASES[number] }) => {
    if (syntheticSmoke || fullSource) return { instructions: fullSourceInstructions };
    const retrieval = retrieveCoachLabKnowledge({
      athleteMessage: labCase.athleteMessage,
      snapshot,
      sources,
    });
    return {
      instructions: buildRetrievedCoachLabBrainInstructions(retrieval.chunks),
      retrievalReceipt: retrieval.receipt,
      retrievedChunkIds: retrieval.chunks.map((chunk) => chunk.id),
    };
  };

  if (process.argv.includes('--inspect-context')) {
    for (const labCase of cases) {
      const resolved = resolveInstructions({ labCase });
      console.log(JSON.stringify({
        caseId: labCase.id,
        fullSource: syntheticSmoke || fullSource,
        instructionCharacters: resolved.instructions.length,
        retrieval: 'retrievalReceipt' in resolved ? resolved.retrievalReceipt : null,
        chunkIds: 'retrievedChunkIds' in resolved ? resolved.retrievedChunkIds : [],
      }, null, 2));
    }
    return;
  }
  const client = new SupabaseCoachLabClient({
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  });
  const report = await runCoachLabAsync({
    cases,
    snapshot,
    candidate: createOpenAICoachLabCandidate({
      client,
      instructions: resolveInstructions,
      model: requestedModel(),
    }),
  });

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  for (const result of report.results) {
    console.log(`\n[${result.verdict.toUpperCase()}] ${result.caseId}`);
    console.log(`Athlete: ${result.athleteMessage}`);
    console.log(`Coach:   ${result.response.message}`);
    console.log(`Basis:   ${result.response.basis.join(', ') || 'none declared'}`);
    const receipt = result.response.diagnostics.tokenReceipt;
    console.log(`Words:   ${result.response.message.trim().split(/\s+/).filter(Boolean).length}`);
    console.log(`Tokens:  input ${receipt?.inputTokens ?? '?'}; cached ${receipt?.cachedInputTokens ?? '?'}; cache-write ${receipt?.cacheWriteTokens ?? '?'}; output ${receipt?.outputTokens ?? '?'}; reasoning ${receipt?.reasoningTokens ?? '?'}; total ${receipt?.totalTokens ?? '?'}`);
    if (typeof result.response.diagnostics.knowledgeSelectedCharacters === 'number') {
      console.log(`Knowledge: ${result.response.diagnostics.knowledgeSelectedCharacters} of ${result.response.diagnostics.knowledgeAvailableCharacters} characters selected`);
    }
  }
  console.log('\nNo answer is approved until Sam reviews and corrects it in Coach Lab.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
