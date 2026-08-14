/**
 * DIAGNOSTIC PROBE (not a gate): does the onboarding DEFAULT_PROGRAM fallback
 * actually install?
 *
 * CompleteScreen catches every generation failure and seeds DEFAULT_PROGRAM.
 * The athlete-facing "Your program was created, but it could not be saved"
 * copy is only reachable when THAT seed throws. This probe drives the exact
 * production seeding function with the exact fallback program.
 *
 *   npx sucrase-node scripts/probe-default-program-seed.ts
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
import { DEFAULT_PROGRAM } from '../src/data/defaultProgram';
import { seedOnboardingProgram, toOnboardingPipelineError } from '../src/utils/onboardingCompletion';
import { DEV_E2E_STANDARD_PROFILE } from '../src/dev/e2e/devE2EStandardProfile';
import { cuelessStrengthCards } from '../src/rules/curatedCueContract';

import { useProfileStore } from '../src/store/profileStore';

const TODAY = process.env.PROBE_TODAY ?? new Date().toISOString().slice(0, 10);

// The real Complete screen runs with onboarding's profile already written.
useProfileStore.getState().updateOnboardingData(DEV_E2E_STANDARD_PROFILE);

// 1) Static: does DEFAULT_PROGRAM itself carry any cueless strength card?
const offenders = new Set<string>();
for (const mc of DEFAULT_PROGRAM.microcycles ?? []) {
  for (const w of mc.workouts ?? []) for (const n of cuelessStrengthCards(w as any)) offenders.add(n);
}
console.log('DEFAULT_PROGRAM cueless strength cards:', offenders.size ? [...offenders] : 'none');
console.log('DEFAULT_PROGRAM startDate/endDate:', DEFAULT_PROGRAM.startDate, DEFAULT_PROGRAM.endDate);
console.log('microcycles:', DEFAULT_PROGRAM.microcycles?.length, 'todayISO:', TODAY);

// 1b) Does the fallback program carry an exposure contract at all?
const mc0: any = DEFAULT_PROGRAM.microcycles?.[0];
console.log('DEFAULT_PROGRAM microcycle[0]:', {
  startDate: mc0?.startDate,
  endDate: mc0?.endDate,
  hasExposureContractV2: !!mc0?.exposureContractV2,
  hasLegacyExposureContract: !!mc0?.exposureContract,
});

// 2) Live: does the production seeding path accept it?
try {
  seedOnboardingProgram({
    onboardingData: DEV_E2E_STANDARD_PROFILE,
    program: DEFAULT_PROGRAM,
    todayISO: TODAY,
  });
  console.log('\nSEED RESULT: OK — DEFAULT_PROGRAM installed cleanly');
} catch (error) {
  const pipelineError = toOnboardingPipelineError(
    error,
    'accepted_state_transaction',
    'store_generated_program',
  );
  console.log('\nSEED RESULT: THREW');
  console.log('  stage:', pipelineError.stage);
  console.log('  step :', pipelineError.step);
  console.log('  msg  :', pipelineError.message);
  console.log('  code :', (error as any)?.code ?? '(none)');
}

// 2b) RETIRED 2026-08-14 — THE QUESTION NO LONGER HAS A SUBJECT.
//
// This branch asked whether a contractless `DEFAULT_PROGRAM` could be salvaged
// by running it through the hydration canonicaliser, which used to mint a
// contract for a contractless microcycle
// (`canonicaliseHydratedMicrocycle` → `deriveContractlessLegacyContract`).
// **That whole structural-migration pipeline is deleted**: it ran only under
// `structuralMigrationRequired: true`, exactly one function set that flag, and
// that function had no production caller — `partialize` persists inputs only,
// so no launch ever reads a stored program back.
//
// The probe would have thrown through `require()`, invisibly to the compiler.
// It is removed rather than repointed because there is no live door that mints
// a contract for a contractless week: the accepted boundary REFUSES one by name
// (`AcceptedProgramContractMissingError`), which is a different ruling with its
// own cells.

// 3) What did §18 acceptance actually install?
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useProgramStore } = require('../src/store/programStore');
const accepted: any = useProgramStore.getState().currentProgram;
console.log('\nAfter setCurrentProgram, accepted microcycles:',
  (accepted?.microcycles ?? []).map((m: any) => ({
    startDate: m.startDate?.slice(0, 10),
    hasExposureContractV2: !!m.exposureContractV2,
  })));
