/**
 * DERIVING source-fact device-commit invariants (DIAGNOSIS HARNESS — currently RED).
 *
 * Pins the on-device failure surfaced by the 2026-07-23 bed-ridden device smoke:
 * a DERIVING (severe) readiness/illness source fact committed through the durable
 * path is REJECTED against a REAL acceptedCompositionBase (device-exact seed) with
 * `accepted_composition_base_changed_by_temporary_fact` — the deriving-side sibling
 * of the Part 2b finding (which fixed the INERT case via preserveExactAcceptedWorkouts).
 *
 * The whole SEVERE readiness class fails, not just illness: severe fatigue (cooked)
 * and severe illness (bed-ridden) both fail identically. That equality is the proof
 * the failure is BEFORE/independent of the §18 mode (illness_recovery lifts minimums;
 * if this were a §18 rejection, illness would pass while fatigue failed).
 *
 * Faithfulness note (the runbook epoch-0 mask): the ok:false OUTCOME is deterministic
 * and clock-independent — verifyCandidate rejects on the base-surfaces fingerprint
 * BEFORE any rollback, so the epoch-0 `capturedAt` rollback-mismatch is strictly
 * downstream and does not affect this gate. A fix that makes verifyCandidate pass
 * removes the rollback path entirely → ok:true, no epoch-0. The specific reason was
 * confirmed via temporary verifyCandidate instrumentation (see the reassessment doc).
 *
 * These assert the CORRECT (post-fix) behaviour, so they are RED today. This suite
 * is standalone and NOT in test:bible until the reassessment is approved and green.
 *
 * Run: npm run test:deriving-device-commit
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const memory = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
  },
};
process.env.TZ = 'Australia/Melbourne';

import { useProfileStore } from '../store/profileStore';
import { commitAcceptedStateTransaction } from '../store/acceptedStateTransaction';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { buildDevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';
import { seedOnboardingProgram } from '../utils/onboardingCompletion';
import { deriveStoredBlockStateFromProgram } from '../utils/programBlockState';

const WEEK = '2026-07-13';
let passes = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}
function quiet<T>(body: () => T): T {
  const warn = console.warn; const error = console.error;
  console.warn = () => undefined; console.error = () => undefined;
  try { return body(); } finally { console.warn = warn; console.error = error; }
}
async function run(name: string, body: () => Promise<void>): Promise<void> {
  memory.clear();
  try { await body(); passes += 1; console.log(`  PASS [invariant] ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL [invariant] ${name}: ${(error as Error).message}`); }
}

/** DEVICE-EXACT seed install — establishes a REAL acceptedCompositionBase the way the
 *  dev E2E reset does (seedOnboardingProgram + commitAcceptedStateTransaction,
 *  preserveExactAcceptedWorkouts). R11-style: the R1-style seed leaves the base null,
 *  which is exactly why the whole R-suite never caught this class. */
function seedDeviceExact(): string {
  const d = buildDevE2ESeed('standard-in-season-week');
  const vws = d.program.microcycles.map((m) => m.startDate.slice(0, 10));
  quiet(() => seedOnboardingProgram({
    onboardingData: d.profile, program: d.program, todayISO: d.anchorDate,
    programStore: {
      setCurrentProgram: (program) => { commitAcceptedStateTransaction({
        reason: 'deriving-device-commit-test:install',
        program: { currentProgram: program, currentMicrocycle: null, todayWorkout: null,
          blockState: deriveStoredBlockStateFromProgram(program) },
        profile: d.profile, preserveExactAcceptedWorkouts: true, validateWeekStarts: vws } as never); },
      setCurrentMicrocycle: (m) => commitAcceptedStateTransaction({
        reason: 'deriving-device-commit-test:mc', program: { currentMicrocycle: m },
        profile: d.profile, preserveExactAcceptedWorkouts: true,
        validateWeekStarts: m ? [m.startDate.slice(0, 10)] : [] } as never),
      setTodayWorkout: (w) => commitAcceptedStateTransaction({
        reason: 'deriving-device-commit-test:today', program: { todayWorkout: w },
        profile: d.profile, preserveExactAcceptedWorkouts: true, validateWeekStarts: [d.anchorDate] } as never),
    },
    calendarStore: { setGameDay: () => undefined },
  } as never));
  useProfileStore.setState({ onboardingData: d.profile, isOnboardingComplete: true });
  return d.anchorDate;
}

async function main(): Promise<void> {
  // ── D1 — a DERIVING severe illness (bed-ridden) commit must be ACCEPTED against a
  // real composition base (currently RED: accepted_composition_base_changed_by_temporary_fact).
  await run('D1 deriving-illness: a severe illness commit is accepted against a real composition base', async () => {
    const anchor = seedDeviceExact();
    const res = await executeProgramControlActionDurably({
      type: 'set_illness_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week', payload: { date: anchor, todayISO: anchor, severity: 'severe' },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    } as never, { todayISO: anchor });
    assert((res as { ok?: boolean }).ok === true,
      `severe illness rejected against a real composition base: "${(res as { message?: string }).message}"`);
  });

  // ── D2 — the same class for severe FATIGUE (cooked). Equal behaviour with D1 is the
  // proof this is a deriving-commit ownership issue, not a §18-mode or illness-specific one.
  await run('D2 deriving-fatigue: a severe (cooked) fatigue commit is accepted against a real composition base', async () => {
    const anchor = seedDeviceExact();
    const res = await executeProgramControlActionDurably({
      type: 'set_fatigue_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week', payload: { date: anchor, todayISO: anchor, level: 'cooked' },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    } as never, { todayISO: anchor });
    assert((res as { ok?: boolean }).ok === true,
      `severe fatigue rejected against a real composition base: "${(res as { message?: string }).message}"`);
  });

  console.log(`\nDeriving source-fact device-commit invariants: ${passes} passing, ${failures.length} failing`);
  if (failures.length > 0) {
    console.log('Currently RED (pins the diagnosed bug; green after the approved fix):');
    for (const name of failures) console.log(`  - ${name}`);
  }
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((error) => { console.error('SUITE THREW:', error); process.exit(1); });
