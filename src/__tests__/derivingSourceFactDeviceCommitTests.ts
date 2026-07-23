/**
 * DERIVING source-fact device-commit invariants (DIAGNOSIS HARNESS — currently RED).
 *
 * Pins the on-device failure surfaced by the 2026-07-23 bed-ridden device smoke:
 * a DERIVING (severe) readiness/illness source fact committed through the durable
 * path is REJECTED against a REAL acceptedCompositionBase (device-exact seed) with
 * `accepted_composition_base_changed_by_temporary_fact` — the deriving-side sibling
 * of the Part 2b finding (which fixed the INERT case via preserveExactAcceptedWorkouts).
 *
 * CORRECTED diagnosis (2026-07-23, superseding the base-preserving "Option B" in
 * the reassessment doc's first cut): the deriving-commit path has TWO pre-fix
 * failure modes, and the reject is only the surface one:
 *   • device-exact real base → REJECTED (accepted_composition_base_changed_by_temporary_fact);
 *   • R1-style null base → "succeeds" but is a SILENT NO-OP — the accepted week AND
 *     the visible resolver stay byte-identical game_week, because the illness_recovery
 *     mode is derived ONLY in generation and this path re-canonicalises with
 *     skipConstraintProjection (no regen, no mode).
 * So these invariants pin the CORRECT behaviour: the commit must RE-AUTHOR a reduced
 * mode week (scoped regeneration committed as authored state, per weekRebuild:block),
 * which a base-preserving no-op fix would NOT satisfy.
 *
 * Severe fatigue (cooked) shares the class — the shipped "auto-protect" delivered no
 * visible reduction either (read-resolver readiness is profile-derived, ignoring the
 * active constraint). That is recorded in the reassessment doc.
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

import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { commitAcceptedStateTransaction } from '../store/acceptedStateTransaction';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { buildDevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';
import { seedOnboardingProgram } from '../utils/onboardingCompletion';
import { deriveStoredBlockStateFromProgram } from '../utils/programBlockState';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';

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

/** The ACCEPTED effective week as the athlete would see it — mode + a stable
 *  day/tier/intensity signature. This is the pure-projection read; it is what a
 *  correct (b)-style scoped-regen commit must have re-authored. */
function acceptedWeek(anchor: string): { mode: string; signature: string } {
  const state = useProgramStore.getState();
  const rebased = rebaseAcceptedEffectiveWeek({
    surfaces: state as never, weekStart: anchor,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
  return {
    mode: rebased.contract.identity.mode,
    signature: rebased.visibleWorkouts
      .map((w) => `${w.dayOfWeek}:${w.workoutType}/${w.sessionTier ?? '-'}/${w.intensity ?? '-'}`)
      .join('  '),
  };
}

async function main(): Promise<void> {
  // ── D1 — a DERIVING severe illness (bed-ridden) commit must produce a REDUCED,
  // mode-authored week, not a silent no-op. Pins BOTH pre-fix failure modes:
  //   • device-exact real base → rejected (accepted_composition_base_changed_by_temporary_fact);
  //   • R1-style null base → "succeeds" but leaves the accepted week byte-identical
  //     game_week (the mode is generation-only and this path never regenerates).
  // A correct scoped-regen commit re-authors the week under illness_recovery.
  await run('D1 deriving-illness: a severe illness commit re-authors an illness_recovery week', async () => {
    const anchor = seedDeviceExact();
    const res = await executeProgramControlActionDurably({
      type: 'set_illness_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week', payload: { date: anchor, todayISO: anchor, severity: 'severe' },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    } as never, { todayISO: anchor });
    assert((res as { ok?: boolean }).ok === true,
      `severe illness rejected against a real composition base: "${(res as { message?: string }).message}"`);
    assert(acceptedWeek(anchor).mode === 'illness_recovery',
      `the accepted week was not re-authored under illness_recovery (silent no-op), mode=${acceptedWeek(anchor).mode}`);
  });

  // ── D2 — the same class for severe FATIGUE (cooked): the commit must actually
  // REDUCE the accepted week (not a no-op). Equal pre-fix behaviour with D1 is the
  // proof this is a deriving-commit ownership issue, not illness-specific.
  await run('D2 deriving-fatigue: a severe (cooked) fatigue commit actually reduces the accepted week', async () => {
    const anchor = seedDeviceExact();
    const before = acceptedWeek(anchor).signature;
    const res = await executeProgramControlActionDurably({
      type: 'set_fatigue_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week', payload: { date: anchor, todayISO: anchor, level: 'cooked' },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    } as never, { todayISO: anchor });
    assert((res as { ok?: boolean }).ok === true,
      `severe fatigue rejected against a real composition base: "${(res as { message?: string }).message}"`);
    assert(acceptedWeek(anchor).signature !== before,
      'the accepted week was byte-identical after a severe fatigue commit (silent no-op)');
  });

  // ── D3 — cascade: clearing the fact restores the accepted week BYTE-IDENTICAL to
  // the pre-illness authored week (via stored prior state, not a re-regeneration).
  await run('D3 cascade: clearing the severe illness fact restores the accepted week byte-identical', async () => {
    const anchor = seedDeviceExact();
    const before = acceptedWeek(anchor).signature;
    const commit = await executeProgramControlActionDurably({
      type: 'set_illness_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week', payload: { date: anchor, todayISO: anchor, severity: 'severe' },
      requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
    } as never, { todayISO: anchor });
    // Non-vacuous: the fact must actually have re-authored a reduced week first,
    // else "restore" is trivially true. RED until the commit itself works.
    assert((commit as { ok?: boolean }).ok === true &&
      acceptedWeek(anchor).signature !== before,
      'precondition: the severe illness commit must first re-author a reduced week');
    const modifierId = (commit as { createdModifierIds?: string[] }).createdModifierIds?.[0];
    await executeProgramControlActionDurably({
      type: 'clear_fatigue_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week', payload: { date: anchor, modifierId },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false,
    } as never, { todayISO: anchor });
    assert(acceptedWeek(anchor).signature === before,
      'clearing the fact did not restore the accepted week byte-identical');
  });

  console.log(`\nDeriving source-fact device-commit invariants: ${passes} passing, ${failures.length} failing`);
  if (failures.length > 0) {
    console.log('Currently RED (pins the diagnosed bug; green after the approved fix):');
    for (const name of failures) console.log(`  - ${name}`);
  }
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((error) => { console.error('SUITE THREW:', error); process.exit(1); });
