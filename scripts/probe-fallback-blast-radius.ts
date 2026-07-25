/**
 * DIAGNOSTIC: how many athletes does the broken DEFAULT_PROGRAM fallback hit?
 * The seed only calls setGameDay when a concrete game day was chosen, so the
 * "Varies" answer may take a different branch.
 *
 *   npx sucrase-node scripts/probe-fallback-blast-radius.ts
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    if (process.env[k] === undefined) process.env[k] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

/* eslint-disable import/first */
import { DEFAULT_PROGRAM } from '../src/data/defaultProgram';
import { seedOnboardingProgram } from '../src/utils/onboardingCompletion';
import { DEV_E2E_STANDARD_PROFILE } from '../src/dev/e2e/devE2EStandardProfile';
import { useProfileStore } from '../src/store/profileStore';
import { useProgramStore } from '../src/store/programStore';
import { useCalendarStore } from '../src/store/calendarStore';

const TODAY = process.env.PROBE_TODAY ?? new Date().toISOString().slice(0, 10);

for (const gameDay of ['Saturday', 'Sunday', 'Varies']) {
  // Fresh-ish state per case.
  useProgramStore.setState({ currentProgram: null, currentMicrocycle: null, todayWorkout: null } as any);
  useCalendarStore.setState({ markedDays: {} } as any);
  const profile = { ...DEV_E2E_STANDARD_PROFILE, gameDay, usualGameDay: gameDay } as any;
  useProfileStore.getState().updateOnboardingData(profile);
  try {
    seedOnboardingProgram({ onboardingData: profile, program: DEFAULT_PROGRAM, todayISO: TODAY });
    console.log(`gameDay=${String(gameDay).padEnd(9)} -> FALLBACK SEED OK`);
  } catch (e: any) {
    console.log(`gameDay=${String(gameDay).padEnd(9)} -> FALLBACK SEED THREW: ${e?.message}`);
  }
}
