/**
 * phaseShiftAtomicityTests — a phase shift moves both values or neither, the
 * game anchor is an owned fact, and a refusal says what actually happened.
 *
 * Three defects, one shape. `executePhaseShift` wrote `profile.seasonPhase`
 * and THEN awaited the rebuild, so a failed rebuild left the profile in the
 * new phase over a program still built for the old one. `applyPhaseShift`
 * cleared the game anchor whenever `gameDay` was falsy, so "the athlete did
 * not answer" and "the athlete has no usual game day" were the same input.
 * And every refusal reached the athlete as "Something went wrong. Please try
 * again." — including a phase mismatch, where trying again cannot help.
 *
 * Run: npm run test:phase-shift-atomicity
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
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — the phase shift must commit locally');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import * as fs from 'fs';
import * as path from 'path';
import type { OnboardingData, TrainingProgram } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { applyPhaseShift, PhaseShiftRefusal } from '../utils/profileMutations';
import { ownSeasonPhase } from '../rules/seasonPhaseOwner';
import { classifyProgramMutationRefusal } from '../rules/programMutationRefusal';

// ─── Harness ─────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`); }
}
function section(label: string) { console.log(`\n${label}`); }

const SRC = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

const WEEK_START = '2026-07-13';
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.includes('[ProgramGen]') || first.includes('[WorkoutCanonicalisation]')) return;
  originalWarn(...args);
};

function profile(
  phase: NonNullable<OnboardingData['seasonPhase']>,
  overrides: Partial<OnboardingData> = {},
): OnboardingData {
  return {
    gender: 'male', // R-130 required; fixture predates the rule
    seasonPhase: phase,
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: '2-5 years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Elite',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    ...overrides,
  } as OnboardingData;
}

function resetStores(): void {
  useProgramStore.setState({
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    blockState: null,
    acceptedMaterialContext: {
      markedDays: {},
      readinessSignalsByDate: {},
      activeConstraints: [],
      activeInjury: null,
      revision: 0,
      lastTransaction: null,
    },
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  } as never);
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
}

function seed(value: OnboardingData): TrainingProgram {
  resetStores();
  useProfileStore.setState({ onboardingData: value } as never);
  const program = generateProgramLocally(value, {
    todayISO: WEEK_START,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: value.seasonPhase!,
      phaseEntryWeekStartISO: WEEK_START,
      originProvenance: 'explicit_user_phase_change',
    },
  } as never);
  useProgramStore.getState().setCurrentProgram(program);
  return useProgramStore.getState().currentProgram!;
}

function storedPhase(): string | null | undefined {
  return useProfileStore.getState().onboardingData?.seasonPhase;
}

function clockPhase(): string | null {
  return ownSeasonPhase({
    program: useProgramStore.getState().currentProgram,
    profile: useProfileStore.getState().onboardingData,
  }).phase;
}

async function main(): Promise<void> {
  // ═══════════════════════════════════════════════════════════════════
  // 1. The game anchor is an owned fact
  // ═══════════════════════════════════════════════════════════════════
  section('[1] The game anchor is an owned fact, not an absent value');
  {
    const stored = profile('Pre-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
    let refusal: PhaseShiftRefusal | null = null;
    try {
      applyPhaseShift(stored, {
        targetPhase: 'In-season',
        preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
        teamTrainingDays: ['Tuesday'],
        // gameAnchor deliberately absent — the question was never asked.
      });
    } catch (error) {
      refusal = error instanceof PhaseShiftRefusal ? error : null;
    }
    ok('an unanswered game anchor refuses the shift', refusal !== null);
    ok('the refusal is typed', refusal?.kind === 'game_anchor_unanswered');
    ok('the refusal cannot be retried into success', refusal?.canRetry === false);
    ok('the refusal copy names what is missing',
      /game day/i.test(refusal?.userMessage ?? ''),
      refusal?.userMessage);
    ok('nothing was wiped on the way out', stored.usualGameDay === 'Saturday');
  }
  {
    const stored = profile('Pre-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
    const next = applyPhaseShift(stored, {
      targetPhase: 'In-season',
      preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
      teamTrainingDays: ['Tuesday'],
      gameAnchor: { kind: 'no_usual_day' },
    });
    ok('"no usual game day" is an answer the athlete can give',
      next.usualGameDay === undefined && next.gameDay === undefined);
    ok('answering clears the anchor and keeps the phase', next.seasonPhase === 'In-season');
  }
  {
    const stored = profile('Pre-season');
    const next = applyPhaseShift(stored, {
      targetPhase: 'In-season',
      preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
      teamTrainingDays: ['Tuesday'],
      gameAnchor: { kind: 'usual_day', day: 'Saturday' },
    });
    ok('an answered game day is set', next.usualGameDay === 'Saturday');
    ok('the legacy field is kept in step', next.gameDay === 'Saturday');
  }
  {
    // Leaving In-season clears the anchor, but only as a consequence of an
    // explicit phase answer — and it must not demand a game-day answer for a
    // phase that has no games.
    const stored = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
    const offSeason = applyPhaseShift(stored, {
      targetPhase: 'Off-season',
      preferredTrainingDays: ['Monday', 'Wednesday'],
    });
    ok('Off-season needs no game answer', offSeason.seasonPhase === 'Off-season');
    ok('Off-season clears the anchor', offSeason.usualGameDay === undefined);
    const preSeason = applyPhaseShift(stored, {
      targetPhase: 'Pre-season',
      preferredTrainingDays: ['Monday', 'Wednesday'],
      teamTrainingDays: ['Tuesday'],
    });
    ok('Pre-season needs no game answer', preSeason.seasonPhase === 'Pre-season');
    ok('Pre-season clears the anchor', preSeason.usualGameDay === undefined);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2. Atomic phase shift
  // ═══════════════════════════════════════════════════════════════════
  section('[2] Profile and rebuild commit together or neither');
  {
    seed(profile('Pre-season'));
    ok('seeded phase agrees before the shift',
      storedPhase() === 'Pre-season' && clockPhase() === 'Pre-season');

    const result = await commitProfileProgramTransaction({
      change: { kind: 'profile_setup', patch: { seasonPhase: 'In-season', usualGameDay: 'Saturday', gameDay: 'Saturday' } },
      todayISO: WEEK_START,
      sourceSurface: 'phase_shift',
      // The rebuild produced a candidate the durable read-back could not
      // confirm. Before atomicity, the profile write had already landed.
      testHooks: { verifyAfterPersistence: () => false },
    });
    ok('a failed shift refuses', result.ok === false);
    ok('a failed shift left the profile alone', storedPhase() === 'Pre-season',
      `stored=${storedPhase()}`);
    ok('a failed shift left the clock alone', clockPhase() === 'Pre-season',
      `clock=${clockPhase()}`);
    ok('a failed shift produced no skew in either direction',
      ownSeasonPhase({
        program: useProgramStore.getState().currentProgram,
        profile: useProfileStore.getState().onboardingData,
      }).skew === null);
  }
  {
    seed(profile('Pre-season'));
    const result = await commitProfileProgramTransaction({
      change: { kind: 'profile_setup', patch: { seasonPhase: 'In-season', usualGameDay: 'Saturday', gameDay: 'Saturday' } },
      todayISO: WEEK_START,
      sourceSurface: 'phase_shift',
    });
    ok('a clean shift applies', result.ok === true, result.reason ?? result.message);
    ok('the profile moved', storedPhase() === 'In-season');
    ok('the clock moved with it', clockPhase() === 'In-season',
      `clock=${clockPhase()}`);
    ok('no skew after a clean shift',
      ownSeasonPhase({
        program: useProgramStore.getState().currentProgram,
        profile: useProfileStore.getState().onboardingData,
      }).skew === null);
  }
  {
    // Leaving In-season clears explicit fixture marks — inside the same
    // transaction, so a rolled-back shift cannot take the athlete's calendar
    // with it. This used to be a `clearAllGames()` side effect fired BEFORE
    // the rebuild was even attempted.
    seed(profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' }));
    useProgramStore.setState({
      acceptedMaterialContext: {
        ...useProgramStore.getState().acceptedMaterialContext,
        markedDays: { '2026-07-18': 'game', '2026-07-15': 'rest' },
      },
    } as never);
    const result = await commitProfileProgramTransaction({
      change: { kind: 'profile_setup', patch: { seasonPhase: 'Off-season', usualGameDay: undefined, gameDay: undefined } },
      todayISO: WEEK_START,
      sourceSurface: 'phase_shift',
      testHooks: { verifyAfterPersistence: () => false },
    });
    const marks = useProgramStore.getState().acceptedMaterialContext.markedDays;
    ok('a rolled-back shift keeps the fixture mark', result.ok === false && marks['2026-07-18'] === 'game',
      JSON.stringify(marks));
    ok('a rolled-back shift keeps unrelated marks too', marks['2026-07-15'] === 'rest');

    const applied = await commitProfileProgramTransaction({
      change: { kind: 'profile_setup', patch: { seasonPhase: 'Off-season', usualGameDay: undefined, gameDay: undefined } },
      todayISO: WEEK_START,
      sourceSurface: 'phase_shift',
    });
    const after = useProgramStore.getState().acceptedMaterialContext.markedDays;
    ok('leaving In-season clears the fixture mark once the shift applies',
      applied.ok === true && after['2026-07-18'] === undefined,
      `${applied.reason ?? ''} ${JSON.stringify(after)}`);
    ok('a rest commitment is not a fixture and survives', after['2026-07-15'] === 'rest');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3. Refusal honesty
  // ═══════════════════════════════════════════════════════════════════
  section('[3] A refusal says what happened, and canRetry follows the kind');
  {
    const mismatch = classifyProgramMutationRefusal({ reason: 'fixture_kind_phase_mismatch' });
    ok('a phase mismatch is typed', mismatch.kind === 'season_phase_mismatch');
    ok('a phase mismatch never offers Try again', mismatch.canRetry === false);
    ok('a phase mismatch does not say "something went wrong"',
      !/something went wrong/i.test(mismatch.userMessage), mismatch.userMessage);

    const stale = classifyProgramMutationRefusal({ reason: 'accepted_revision_changed' });
    ok('a stale revision is typed', stale.kind === 'accepted_revision_changed');
    ok('a stale revision IS retryable', stale.canRetry === true);
    ok('a stale revision explains that something else changed',
      /chang/i.test(stale.userMessage), stale.userMessage);

    const rolledBack = classifyProgramMutationRefusal({
      reason: 'accepted_profile_durable_readback_mismatch',
    });
    ok('a verification rollback is typed', rolledBack.kind === 'verification_rolled_back');
    ok('a verification rollback is retryable', rolledBack.canRetry === true);
    ok('a verification rollback says nothing changed',
      /nothing changed|no changes|unchanged/i.test(rolledBack.userMessage),
      rolledBack.userMessage);

    const anchor = classifyProgramMutationRefusal({
      error: new PhaseShiftRefusal('game_anchor_unanswered'),
    });
    ok('an unanswered anchor keeps its own copy through the classifier',
      anchor.kind === 'game_anchor_unanswered' && anchor.canRetry === false);

    const unknown = classifyProgramMutationRefusal({ reason: null });
    ok('an unclassified refusal stays retryable', unknown.canRetry === true);
    ok('an unclassified refusal is named as such', unknown.kind === 'unknown');
  }
  {
    // Every refusal kind must answer canRetry from the KIND, never from a
    // default. A kind that is not in the table is the bug this pins.
    const kinds = [
      'fixture_kind_phase_mismatch',
      'accepted_revision_changed',
      'accepted_profile_candidate_mismatch',
      'accepted_composition_base_candidate_mismatch',
      'profile_program_changed_temporary_facts',
      'temporary_profile_constraints_require_source_facts',
      'permanent_session_time_cap_invalid',
    ];
    const classified = kinds.map((reason) => classifyProgramMutationRefusal({ reason }));
    ok('no refusal kind falls through to the unknown bucket',
      classified.every((entry) => entry.kind !== 'unknown'),
      classified.filter((e) => e.kind === 'unknown').map((e) => e.diagnostic).join(', '));
    ok('every refusal carries athlete-safe copy',
      classified.every((entry) => entry.userMessage.length > 0
        && !/_/.test(entry.userMessage)),
      classified.map((e) => e.userMessage).join(' | '));
  }
  {
    // no_change is an OUTCOME. Reporting it as plain success is how a dead
    // Save button looked like a working one.
    seed(profile('Pre-season'));
    const result = await commitProfileProgramTransaction({
      change: { kind: 'profile_setup', patch: { seasonPhase: 'Pre-season' } },
      todayISO: WEEK_START,
      sourceSurface: 'phase_shift',
    });
    ok('an unchanged shift is not a program change',
      result.ok === true && result.changedProgram === false);
    ok('an unchanged shift carries a reason', Boolean(result.reason), result.reason);
    ok('the no-change reason is typed', result.reason === 'no_change');
    const classified = classifyProgramMutationRefusal({ reason: result.reason });
    ok('no_change classifies as a visible outcome, not a failure',
      classified.kind === 'no_change' && classified.canRetry === false);
    ok('the no-change copy tells the athlete nothing needed doing',
      /already/i.test(classified.userMessage), classified.userMessage);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4. The surfaces commit through the owner
  // ═══════════════════════════════════════════════════════════════════
  section('[4] The phase-shift surfaces commit through the one transaction');
  {
    const home = read('screens/home/useHomeScreen.ts');
    ok('executePhaseShift commits through the atomic transaction',
      /commitProfileProgramTransaction\(\{[\s\S]{0,400}kind: 'profile_setup'/.test(home));
    ok('executePhaseShift no longer writes the profile before the rebuild',
      !/updateOnboardingData\(updates\)[\s\S]{0,600}await runRebuild\(/.test(home));
    ok('executePhaseShift no longer fires clearAllGames outside the transaction',
      !/clearAllGames\(\)/.test(home));
    ok('the phase-shift failure path classifies the typed refusal',
      /classifyProgramMutationRefusal/.test(home));
  }
  {
    const profileScreen = read('screens/profile/ProfileScreen.tsx');
    ok('ProfileScreen classifies the typed refusal rather than a generic string',
      /classifyProgramMutationRefusal/.test(profileScreen));
    ok('ProfileScreen no longer throws away result.reason',
      !/throw new Error\(result\.reason/.test(profileScreen));
    ok('ProfileScreen surfaces a no-change outcome instead of closing silently',
      /changedProgram/.test(profileScreen));
  }
  {
    const sheet = read('screens/home/HomeScreenV2.tsx');
    ok('the game-day step offers an explicit "no usual game day" answer',
      /no usual game day|don’t have a usual game day|don't have a usual game day/i.test(sheet));
  }

  console.log(`\n— Summary —`);
  console.log(`  Pass: ${pass}`);
  console.log(`  Fail: ${fail}`);
  totalsPrinted(fail);
  if (fail > 0) {
    console.log(`\n— Failures —`);
    for (const f of failures) console.log(`  • ${f}`);
    process.exit(1);
  }
// TOTALS-OR-RED (Sam, 2026-08-03): the explicit exit is GONE, not moved.
// `process.exit(0)` hard-overrides `process.exitCode`, so it silently
// un-arms this suite — proven by a surviving mutation during the rollout.
// `totalsPrinted(...)` above already set the correct code from the report.
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
