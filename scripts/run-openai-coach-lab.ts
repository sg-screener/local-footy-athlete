import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadEnvFile } from 'process';
import {
  buildCoachLabBrainInstructions,
  buildRetrievedCoachLabBrainInstructions,
  type CoachLabKnowledgeFile,
} from '../src/dev/coachLab/coachLabBrainPack';
import { COACH_LAB_CASES, coachLabFixtureSnapshot } from '../src/dev/coachLab/coachLabCases';
import {
  runCoachLabAsync,
  type AsyncCoachLabCandidate,
  type CoachLabCase,
  type CoachLabReport,
} from '../src/dev/coachLab/coachLab';
import type { CoachSnapshot } from '../src/rules/liveAthleteSnapshot';
import { createOpenAICoachLabCandidate } from '../src/dev/coachLab/openAICoachLabCandidate';
import {
  retrieveCoachLabKnowledge,
  type CanonicalCoachKnowledgeSource,
  citableCoachKnowledgeIds,
} from '../src/dev/coachLab/coachLabKnowledgeRetriever';
import { SupabaseCoachLabClient } from '../src/dev/coachLab/supabaseCoachLabClient';
import { COACH_KNOWLEDGE_SOURCE_SPECS } from '../src/rules/coachKnowledgeManifest';

const DEFAULT_CASE_ID = 'rooted-but-wants-to-train';
const BIBLE_PATH = COACH_KNOWLEDGE_SOURCE_SPECS.find(
  (source) => source.authority === 'lfa_bible',
)!.path;
const RULINGS_PATH = COACH_KNOWLEDGE_SOURCE_SPECS.find(
  (source) => source.authority === 'active_rule',
)!.path;
const EXERCISE_SOURCE_PATHS = COACH_KNOWLEDGE_SOURCE_SPECS
  .filter((source) => source.authority === 'canonical_source')
  .map((source) => source.path);

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
  return COACH_KNOWLEDGE_SOURCE_SPECS.map((source): CanonicalCoachKnowledgeSource => ({
    ...source,
    content: read(source.path),
  }));
}

async function runCasesWithPaidCheckpoints(args: {
  readonly cases: readonly CoachLabCase[];
  readonly snapshot: CoachSnapshot;
  readonly candidate: AsyncCoachLabCandidate;
}): Promise<CoachLabReport> {
  const results: CoachLabReport['results'][number][] = [];
  for (const labCase of args.cases) {
    const single = await runCoachLabAsync({
      cases: [labCase],
      snapshot: args.snapshot,
      candidate: args.candidate,
    });
    const result = single.results[0];
    results.push(result);
    console.error(`COACH LAB PAID CHECKPOINT ${JSON.stringify(result)}`);
  }
  return {
    candidateId: args.candidate.id,
    results,
    summary: {
      cases: results.length,
      automaticFail: results.filter((entry) => entry.verdict === 'automatic_fail').length,
      needsOwnerReview: results.filter((entry) => entry.verdict === 'needs_owner_review').length,
      approved: results.filter((entry) => entry.verdict === 'approved').length,
    },
  };
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
      retrievedChunkIds: citableCoachKnowledgeIds(retrieval.chunks),
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
    labSecret: process.env.COACH_LAB_SECRET ?? '',
  });
  const report = await runCasesWithPaidCheckpoints({
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
