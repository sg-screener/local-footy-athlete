/**
 * The accept boundary refuses a program it cannot install — loudly, and by name.
 *
 * Device blocker 2026-07-25: a program with no `exposureContractV2` was ACCEPTED
 * by `setCurrentProgram` and only exploded later, at an unrelated call site
 * (`setGameDay` -> `rebaseAcceptedEffectiveWeek` -> "Contract v2 is missing").
 * The failure was reported far from its cause, so the athlete was told a save
 * had failed when the real fault was an uninstallable week accepted several
 * steps earlier.
 *
 * Sam ruling (2026-07-26), option (b): fail fast at the accept boundary with a
 * typed error naming the cause. NO silent rebuilds on the accept path — a
 * legacy-shaped program arriving there is a loud, named failure. (Option (a),
 * minting + rebuilding here, was rejected: minting is not separable from
 * week-rebuild for legacy-shaped programs, because hydration only survives by
 * handing the §18 gateway a profile-built regenerate/safeFallback candidate.)
 *
 * See docs/ONBOARDING_SAVE_BLOCKER_DIAGNOSIS_2026-07-25.md and the L2 report.
 *
 * Run: npm run test:accept-boundary-contract
 */

import {
  AcceptedProgramContractMissingError,
  useProgramStore,
} from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { seedOnboardingProgram } from '../utils/onboardingCompletion';
import { DEV_E2E_STANDARD_PROFILE } from '../dev/e2e/devE2EStandardProfile';
import { todayISOLocal } from '../utils/appDate';
import type { Microcycle, TrainingProgram } from '../types/domain';

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const TODAY = todayISOLocal();

function contractlessProgram(): TrainingProgram {
  const microcycle = {
    id: 'mc:contractless', programId: 'p:contractless', weekNumber: 1,
    startDate: '2026-07-20', endDate: '2026-07-26',
    miniCycleNumber: 1, intensityMultiplier: 1,
    workouts: [], createdAt: TODAY, updatedAt: TODAY,
  } as unknown as Microcycle;
  return {
    id: 'p:contractless', userId: 'u', name: 'Contractless', description: '',
    programPhase: 'In-Season', startDate: '2026-07-20', endDate: '2026-08-16',
    microcycles: [microcycle], primaryFocus: 'Strength', isActive: true,
    createdAt: TODAY, updatedAt: TODAY,
  } as unknown as TrainingProgram;
}

useProfileStore.getState().updateOnboardingData(DEV_E2E_STANDARD_PROFILE);

console.log('\n[accept boundary] a program with no exposure contract is refused AT the boundary');
{
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
  } as any);

  let thrown: any = null;
  try {
    seedOnboardingProgram({
      onboardingData: DEV_E2E_STANDARD_PROFILE,
      program: contractlessProgram(),
      todayISO: TODAY,
    });
  } catch (error) { thrown = error; }

  ok('the onboarding install throws rather than accepting an uninstallable program',
    thrown !== null,
    'silent acceptance is what relocated the failure to setGameDay');
  ok('the error is the typed accept-boundary error',
    thrown?.name === 'AcceptedProgramContractMissingError',
    `got name=${thrown?.name}`);
  ok('the error is an AcceptedProgramContractMissingError instance',
    thrown instanceof AcceptedProgramContractMissingError);
  ok('it names the cause, not a generic failure',
    /exposure contract/i.test(String(thrown?.message)),
    `got: ${thrown?.message}`);
  ok('it names the offending week so the fault is locatable',
    String(thrown?.message).includes('2026-07-20'),
    `got: ${thrown?.message}`);
  ok('it carries a typed code for pipeline-stage classification',
    thrown?.code === 'accepted_program_contract_missing',
    `got code=${thrown?.code}`);

  ok('the refused program was NOT installed',
    useProgramStore.getState().currentProgram === null,
    'a refused program must leave no trace in accepted state');

  ok('the refusal happens BEFORE any game day is marked',
    Object.keys(useCalendarStore.getState().markedDays ?? {}).length === 0,
    'the whole point is failing at the cause, not part-way through the install');
}

console.log('\n[accept boundary] the refusal does not fire for an installable program');
{
  // A program whose microcycles carry a contract is untouched by this gate.
  // Guarded structurally: if the gate ever widened to healthy programs, every
  // generated program would stop installing.
  const program: any = contractlessProgram();
  program.microcycles[0].exposureContractV2 = {
    identity: { seasonPhase: 'In-season', expectedSubphase: null, anchorState: 'game' },
  };

  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
  } as any);
  let thrown: any = null;
  try {
    seedOnboardingProgram({
      onboardingData: DEV_E2E_STANDARD_PROFILE, program, todayISO: TODAY,
    });
  } catch (error) { thrown = error; }

  ok('a program carrying a contract is not refused by THIS gate',
    !(thrown instanceof AcceptedProgramContractMissingError),
    `threw: ${thrown?.name}: ${thrown?.message}`);
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
