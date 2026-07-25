/**
 * DIAGNOSTIC PROBE (not a gate): replay the onboarding Complete screen's whole
 * save path end to end against the LIVE edge function.
 *
 *   generate -> (on failure: DEFAULT_PROGRAM fallback) -> seedOnboardingProgram
 *
 * Reports which branch the athlete would land on, including the exact copy.
 *
 *   npx sucrase-node scripts/probe-onboarding-save-path.ts [--force-fallback]
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

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
import { DEFAULT_PROGRAM } from '../src/data/defaultProgram';
import { seedOnboardingProgram, toOnboardingPipelineError } from '../src/utils/onboardingCompletion';
import { DEV_E2E_STANDARD_PROFILE } from '../src/dev/e2e/devE2EStandardProfile';

import { useProfileStore } from '../src/store/profileStore';

const TODAY = process.env.PROBE_TODAY ?? new Date().toISOString().slice(0, 10);
const FORCE_FALLBACK = process.argv.includes('--force-fallback');

// The real Complete screen runs with the profile already written by onboarding.
// Without this the calendar's season-phase read fails for a harness reason and
// masks the real branch.
useProfileStore.getState().updateOnboardingData(DEV_E2E_STANDARD_PROFILE);

async function main() {
  let program = DEFAULT_PROGRAM;
  let usedFallback = false;

  if (FORCE_FALLBACK) {
    // Simulate the transient generation failure the device hit.
    console.log('SIMULATED generation failure -> DEFAULT_PROGRAM fallback (CompleteScreen line 330)');
    usedFallback = true;
  } else {
    try {
      program = await generateProgramFromProfile(DEV_E2E_STANDARD_PROFILE, { todayISO: TODAY }) as any;
      console.log('\nGENERATION: ok');
    } catch (err: any) {
      const pge = err instanceof ProgramGenError ? err : null;
      console.log('\nGENERATION: failed —', pge?.kind ?? err?.name, '|', pge?.diagnostic ?? err?.message);
      // This is the CompleteScreen branch: name is 'ProgramGenError', never 'OverloadError'.
      console.log('  err.name ===  "OverloadError"?', err?.name === 'OverloadError');
      program = DEFAULT_PROGRAM;
      usedFallback = true;
    }
  }

  try {
    seedOnboardingProgram({
      onboardingData: DEV_E2E_STANDARD_PROFILE,
      program,
      todayISO: TODAY,
    });
    console.log(`\nSEED (${usedFallback ? 'DEFAULT_PROGRAM' : 'generated'}): OK — athlete reaches "ready"`);
  } catch (error) {
    const pipelineError = toOnboardingPipelineError(
      error, 'accepted_state_transaction', 'store_generated_program',
    );
    const wouldRetryWithDefault =
      pipelineError.stage === 'section18_acceptance' && program !== DEFAULT_PROGRAM;
    console.log(`\nSEED (${usedFallback ? 'DEFAULT_PROGRAM' : 'generated'}): THREW`);
    console.log('  stage:', pipelineError.stage, '| step:', pipelineError.step);
    console.log('  msg  :', pipelineError.message);
    console.log('  CompleteScreen would retry with DEFAULT_PROGRAM?', wouldRetryWithDefault);
    if (!wouldRetryWithDefault) {
      console.log('  ATHLETE SEES: "Your program was created, but it could not be saved. Please try again."');
    }
  }
}

main().catch((e) => { console.error('probe crashed', e); process.exit(1); });
