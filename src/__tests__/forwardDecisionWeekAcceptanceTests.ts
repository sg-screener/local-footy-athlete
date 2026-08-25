/**
 * FORWARD-DECISION WEEK ACCEPTANCE — the generation seam the athlete-fact
 * doors stand on.
 *
 * `GenerateProgramFromProfileOptions.weekAcceptance` documents its own
 * contract (§18 ownership reassessment 2026-08-05, defect D3, approved by
 * Sam): a caller carrying out a FORWARD ATHLETE DECISION states
 * `forward_decision`, "and generation then publishes the best achievable week
 * instead of throwing: it is not generation's place to veto a fact the
 * athlete stated, and the transaction downstream already owns
 * accept-and-disclose."
 *
 * MEASURED 2026-08-25, launch audit: the option was accepted, passed to
 * `buildGeneratedMicrocycles`, and READ NOWHERE — the refusal throw was
 * unconditional. Every door that regenerates under a stated athlete fact
 * (illness `moderate`, fatigue `not_right`, the bye rebuild) threw
 * `GeneratedWeekRefusedError` the moment the reduced week missed any contract
 * clause, the transaction rolled the fact back, and the athlete was told
 * "give it another go in a moment" — permanently. Device signature:
 * `main_strength_required_minimum:1|required_safe_patterns_present:squat`
 * from the "Pretty flat" door; `hard_day_permitted_maximum:6` from the bye.
 *
 * The forcing input below is a one-day remainder (governed from Sunday of a
 * game week): one authorable day can never meet the main-strength floor, so
 * the validator refuses deterministically. Cell 1 proves the input forces the
 * refusal (the liveness arm — L12a); cell 2 holds the contract.
 *
 * Run: npm run test:forward-decision-acceptance
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

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();
import type { OnboardingData } from '../types/domain';
import {
  generateProgramLocally,
  GeneratedWeekRefusedError,
} from '../services/api/generateProgram';

const WEEK = '2026-07-13';
const SUNDAY = '2026-07-19';

let passes = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passes += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}: ${(error as Error).message}`);
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn;
  const error = console.error;
  const log = console.log;
  console.warn = () => undefined;
  console.error = () => undefined;
  console.log = () => undefined;
  try {
    return body();
  } finally {
    console.warn = warn;
    console.error = error;
    console.log = log;
  }
}

function profile(): OnboardingData {
  return {
    seasonPhase: 'In-season',
    gender: 'male',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes',
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: 'Advanced',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  } as unknown as OnboardingData;
}

function generate(weekAcceptance?: 'forward_decision') {
  return quiet(() => generateProgramLocally(profile(), {
    todayISO: WEEK,
    previousProgram: null,
    activeConstraints: [],
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'In-season',
      phaseEntryWeekStartISO: WEEK,
      originProvenance: 'explicit_user_phase_change',
    },
    microcycleLimit: 1,
    remainderBoundary: { governedFromISO: SUNDAY, pinnedHistoryWorkouts: [] },
    ...(weekAcceptance ? { weekAcceptance } : {}),
  } as never));
}

// [1] The liveness arm: the forcing input actually forces a refusal under the
//     default (`restoration`) acceptance. If this cell ever goes red, cell 2
//     is asserting on an input that no longer exercises the seam.
run('default acceptance still refuses a week that cannot meet its contract', () => {
  let thrown: unknown = null;
  try {
    generate();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof GeneratedWeekRefusedError,
    `expected GeneratedWeekRefusedError, got ${String((thrown as Error)?.message ?? thrown)}`);
  const clauses = (thrown as GeneratedWeekRefusedError).findings.map((f) => f.clause);
  assert(clauses.includes('main_strength_required_minimum'),
    `refusal did not include the strength floor (clauses: ${clauses.join(', ')})`);
});

// [2] The contract: a forward athlete decision publishes the best achievable
//     week instead of throwing. This is the cell the audit's dead doors
//     (illness moderate, fatigue not_right, bye rebuild) stand behind.
run('forward_decision publishes the best achievable week instead of throwing', () => {
  const program = generate('forward_decision');
  assert(program.microcycles.length === 1,
    `expected the single requested microcycle, got ${program.microcycles.length}`);
  assert((program.microcycles[0].workouts ?? []).length > 0,
    'the published week carries no workouts at all — nothing for a door to overlay');
});

console.log(`\n${passes} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
process.exit(0);
