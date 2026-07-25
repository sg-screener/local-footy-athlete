/**
 * DIAGNOSTIC PROBE (not a gate): measure the real rate at which a LIVE
 * generation against the deployed coach-chat edge function trips the
 * acceptance-time curated-cue contract, and name the offenders.
 *
 * Run:
 *   npx sucrase-node scripts/probe-generation-vocabulary-rate.ts [N]
 *
 * It drives the exact production entry point the onboarding Complete screen
 * calls (`generateProgramFromProfile`) with the standard dev profile, so any
 * refusal it reports is the refusal the athlete would hit.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// .env into process.env BEFORE anything reads src/config/env.
const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    if (process.env[key] === undefined) {
      process.env[key] = trimmed.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

/* eslint-disable import/first */
import { generateProgramFromProfile, ProgramGenError } from '../src/services/api/generateProgram';
import { DEV_E2E_STANDARD_PROFILE } from '../src/dev/e2e/devE2EStandardProfile';
import {
  canonicalExerciseName,
  curatedExerciseVocabulary,
  hasCuratedCue,
} from '../src/utils/exerciseCanonicalisation';

const N = Number(process.argv[2] ?? 10);
const TODAY = process.env.PROBE_TODAY ?? new Date().toISOString().slice(0, 10);

/**
 * Vocabulary risk is profile-dependent: a minimal-equipment or off-season
 * profile pushes the generator toward movements the curated pools may not
 * carry. Measuring only the standard profile would understate the rate.
 */
const PROFILES: { label: string; profile: any }[] = [
  { label: 'standard-inseason-commercial', profile: DEV_E2E_STANDARD_PROFILE },
  {
    label: 'home-minimal-preseason',
    profile: {
      ...DEV_E2E_STANDARD_PROFILE,
      seasonPhase: 'Pre-season',
      trainingLocation: 'Home gym',
      equipment: ['dumbbells', 'bands'],
      experienceLevel: '1-2 years',
      squatStrength: 'Bodyweight',
      benchStrength: 'Bodyweight',
      conditioningLevel: 'Average',
    },
  },
  {
    label: 'bodyweight-only-offseason',
    profile: {
      ...DEV_E2E_STANDARD_PROFILE,
      seasonPhase: 'Off-season',
      trainingLocation: 'Outdoor',
      equipment: [],
      teamTrainingDaysPerWeek: 0,
      teamTrainingDays: [],
      conditioningLevel: 'Below average',
      biggestLimitation: 'Strength',
    },
  },
];
const PROFILE_MODE = process.argv.includes('--profiles');

const VOCAB = new Set(curatedExerciseVocabulary());

// ── Capture the RAW names the generator emitted, before any canonicalisation.
// This is what separates "the LLM ignored the offered vocabulary" from "the
// matcher could not resolve a legal spelling".
let rawNamesThisRun: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (...args: any[]) => {
  const res = await (realFetch as any)(...args);
  try {
    const clone = res.clone();
    const body = await clone.json();
    for (const w of body?.programUpdate?.workouts ?? []) {
      for (const ex of w?.exercises ?? []) if (ex?.name) rawNamesThisRun.push(String(ex.name));
    }
  } catch {
    /* non-JSON body — the typed classifier downstream reports it */
  }
  return res;
}) as any;

type Outcome = {
  run: number;
  ok: boolean;
  kind?: string;
  offenders?: string[];
  diagnostic?: string;
  rawNames?: string[];
  exactVocab?: string[];
  matchedByMatcher?: { raw: string; canonical: string }[];
  unresolved?: string[];
};

function classifyRawNames(names: string[]) {
  const exactVocab: string[] = [];
  const matchedByMatcher: { raw: string; canonical: string }[] = [];
  const unresolved: string[] = [];
  for (const name of [...new Set(names)]) {
    if (VOCAB.has(name)) { exactVocab.push(name); continue; }
    if (hasCuratedCue(name)) { matchedByMatcher.push({ raw: name, canonical: canonicalExerciseName(name) }); continue; }
    unresolved.push(name);
  }
  return { exactVocab, matchedByMatcher, unresolved };
}

async function main() {
  const outcomes: Outcome[] = [];
  for (let run = 1; run <= N; run += 1) {
    const pinned = process.env.PROBE_PROFILE ? Number(process.env.PROBE_PROFILE) : null;
    const variant = pinned !== null
      ? PROFILES[pinned]
      : PROFILE_MODE ? PROFILES[(run - 1) % PROFILES.length] : PROFILES[0];
    process.stdout.write(`\n=== run ${run}/${N} [${variant.label}] ===\n`);
    rawNamesThisRun = [];
    try {
      await generateProgramFromProfile(variant.profile, { todayISO: TODAY });
      const cls = classifyRawNames(rawNamesThisRun);
      outcomes.push({ run, ok: true, rawNames: [...new Set(rawNamesThisRun)], ...cls });
      process.stdout.write(
        `PASS — raw=${new Set(rawNamesThisRun).size} exactVocab=${cls.exactVocab.length} `
          + `viaMatcher=${cls.matchedByMatcher.length} unresolved=${cls.unresolved.length}\n`,
      );
      if (cls.matchedByMatcher.length) {
        for (const m of cls.matchedByMatcher) process.stdout.write(`    matcher: "${m.raw}" -> "${m.canonical}"\n`);
      }
    } catch (err: any) {
      const pge = err instanceof ProgramGenError ? err : null;
      const offenders = (pge?.details as any)?.unresolvedExerciseNames as string[] | undefined;
      const cls = classifyRawNames(rawNamesThisRun);
      outcomes.push({
        run,
        ok: false,
        kind: pge?.kind ?? err?.name ?? 'unknown',
        offenders,
        diagnostic: pge?.diagnostic ?? err?.message ?? String(err),
        rawNames: [...new Set(rawNamesThisRun)],
        ...cls,
      });
      process.stdout.write(
        `FAIL — kind=${pge?.kind ?? err?.name}\n  diagnostic: ${pge?.diagnostic ?? err?.message}\n`
          + (offenders ? `  offenders: ${offenders.join(' | ')}\n` : '')
          + `  raw=${new Set(rawNamesThisRun).size} exactVocab=${cls.exactVocab.length} `
          + `viaMatcher=${cls.matchedByMatcher.length} unresolved=${cls.unresolved.length}\n`
          + (cls.unresolved.length ? `  raw-unresolved: ${cls.unresolved.join(' | ')}\n` : ''),
      );
    }
  }

  const failures = outcomes.filter((o) => !o.ok);
  const vocab = failures.filter((o) => (o.offenders?.length ?? 0) > 0);
  const offenderCounts = new Map<string, number>();
  for (const f of vocab) for (const n of f.offenders ?? []) offenderCounts.set(n, (offenderCounts.get(n) ?? 0) + 1);

  process.stdout.write('\n\n════════ SUMMARY ════════\n');
  process.stdout.write(`runs=${N}  pass=${outcomes.length - failures.length}  fail=${failures.length}  `
    + `vocabulary-refusals=${vocab.length}\n`);
  for (const f of failures) {
    process.stdout.write(`  run ${f.run}: ${f.kind} — ${(f.offenders ?? []).join(', ') || f.diagnostic?.slice(0, 160)}\n`);
  }
  if (offenderCounts.size) {
    process.stdout.write('\nOffender names (times seen):\n');
    for (const [name, count] of [...offenderCounts.entries()].sort((a, b) => b[1] - a[1])) {
      process.stdout.write(`  ${count}×  ${name}\n`);
    }
  }
  process.stdout.write(JSON.stringify({ N, outcomes }, null, 2) + '\n');
}

main().catch((e) => {
  console.error('probe crashed', e);
  process.exit(1);
});
