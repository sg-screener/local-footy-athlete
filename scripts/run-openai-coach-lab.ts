import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadEnvFile } from 'process';
import {
  buildCoachLabBrainInstructions,
  type CoachLabKnowledgeFile,
} from '../src/dev/coachLab/coachLabBrainPack';
import { COACH_LAB_CASES, coachLabFixtureSnapshot } from '../src/dev/coachLab/coachLabCases';
import { runCoachLabAsync } from '../src/dev/coachLab/coachLab';
import { createOpenAICoachLabCandidate } from '../src/dev/coachLab/openAICoachLabCandidate';
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
  if (process.argv.includes('--all')) return COACH_LAB_CASES;
  const caseArg = process.argv.find((arg) => arg.startsWith('--case='));
  const caseId = caseArg?.slice('--case='.length) || DEFAULT_CASE_ID;
  const selected = COACH_LAB_CASES.find((entry) => entry.id === caseId);
  if (!selected) throw new Error(`Unknown Coach Lab case: ${caseId}`);
  return [selected];
}

async function main(): Promise<void> {
  loadEnvFile(resolve(process.cwd(), '.env'));
  const syntheticSmoke = process.argv.includes('--synthetic-smoke');
  const exerciseSources: CoachLabKnowledgeFile[] = syntheticSmoke
    ? [{ path: 'synthetic-exercises', content: 'No exercise rule is required for this connection test.' }]
    : EXERCISE_SOURCE_PATHS.map((path) => ({ path, content: read(path) }));
  const instructions = buildCoachLabBrainInstructions(syntheticSmoke
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
  const client = new SupabaseCoachLabClient({
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  });
  const report = await runCoachLabAsync({
    cases: selectedCases(),
    snapshot: coachLabFixtureSnapshot(),
    candidate: createOpenAICoachLabCandidate({ client, instructions }),
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
    console.log(`Tokens:  ${result.response.diagnostics.tokenUse ?? 'not returned'}`);
  }
  console.log('\nNo answer is approved until Sam reviews and corrects it in Coach Lab.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
