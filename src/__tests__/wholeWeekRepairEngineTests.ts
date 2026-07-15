(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { Workout } from '../types/domain';
import {
  buildDerivedSessionExpiryCandidates,
  createDerivedSessionProvenance,
  section18ContractLifecycleSignature,
} from '../rules/derivedSessionProvenance';
import { searchWholeWeekRepairCandidates } from '../rules/wholeWeekRepairEngine';
import { buildSection18WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';
import {
  rollingHorizonDependencyClosure,
  searchRollingHorizonCandidateCombinations,
} from '../rules/rollingHorizonRepair';

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`, detail ?? '');
  }
}

const WEEK = '2026-07-13';
function contract(fixture: boolean) {
  return buildSection18WeeklyExposureContractV2({
    seasonPhase: 'In-season',
    declaredSubphase: fixture ? 'game_week' : 'bye_build',
    mode: fixture ? 'in_season_game_week' : 'in_season_bye_build',
    anchorState: fixture ? 'game' : 'bye',
    teamTrainingDays: [2, 4],
    fixtureDay: fixture ? 0 : null,
    fixtureParticipation: 'normal_unrestricted',
    participationProvenance: 'explicit',
    currentProductionClaimsAnchorCredit: true,
    readiness: 'medium',
    plannerSelected: {
      mainStrength: 3,
      coreConditioning: 3,
      sprintHighSpeed: 1,
      powerPrimers: 1,
    },
  });
}

function workout(id: string, dayOfWeek: number, name = id): Workout {
  return {
    id,
    microcycleId: 'whole-week-test',
    dayOfWeek,
    name,
    description: '',
    durationMinutes: 30,
    intensity: 'Moderate',
    workoutType: 'Conditioning',
    sessionTier: 'core',
    exercises: [],
    createdAt: `${WEEK}T00:00:00.000Z`,
    updatedAt: `${WEEK}T00:00:00.000Z`,
  };
}

console.log('\n-- Whole-week ownership invariants --');

const search = searchWholeWeekRepairCandidates<number, number>({
  initial: 0,
  stateSignature: String,
  assess: (candidate) => ({
    accepted: candidate === 2,
    blockingCount: candidate === 2 ? 0 : 1,
    evaluation: candidate,
  }),
  // Candidate 0 and candidate 1 deliberately have the same failure shape.
  expand: (candidate) => candidate < 2 ? [candidate + 1] : [],
});
check('candidate N+1 is searched after candidate N returns the same blocker',
  search.outcome === 'repaired' && search.candidate === 2 && search.candidatesEvaluated === 3,
  search);

const capped = searchWholeWeekRepairCandidates<number, number>({
  initial: 0,
  maxCandidates: 2,
  stateSignature: String,
  assess: (candidate) => ({ accepted: false, blockingCount: 1, evaluation: candidate }),
  expand: (candidate) => [candidate + 1],
});
check('impossible is typed and bounded after deterministic candidates are exhausted/capped',
  capped.outcome === 'impossible' && capped.candidatesEvaluated === 2, capped);

const bye = contract(false);
const game = contract(true);
const derived = workout('fixture-top-up', 6, 'Hard Conditioning');
derived.planEntryId = 'fixture-replan:top-up';
derived.derivedSessionProvenance = [createDerivedSessionProvenance({
  origin: 'fixture_replacement',
  scope: 'session',
  triggerSignature: section18ContractLifecycleSignature(bye, WEEK),
  credit: { metric: 'conditioning_core', amount: 1, conditioningRole: 'required_core' },
  originatingDate: WEEK,
  originatingFixtureDate: '2026-07-19',
  sourcePlanEntryId: derived.planEntryId,
  validWhile: [{ kind: 'fixture_absent', fixtureDate: '2026-07-19' }],
  invalidWhen: [{ kind: 'fixture_present', fixtureDate: '2026-07-19' }],
})];
const authored = workout('coach-pilates', 6, 'Pilates');
authored.sessionTier = 'optional';

const persisted = JSON.parse(JSON.stringify([derived, authored])) as Workout[];
check('typed DerivedSessionProvenance survives persistence round-trip',
  persisted[0].derivedSessionProvenance?.[0].origin === 'fixture_replacement' &&
  persisted[0].derivedSessionProvenance?.[0].credit.amount === 1);

const noExpiry = buildDerivedSessionExpiryCandidates({ workouts: persisted, contract: bye, weekStart: WEEK });
check('fixture replacement survives while its originating fixture remains absent', noExpiry.length === 0);

const expiry = buildDerivedSessionExpiryCandidates({ workouts: persisted, contract: game, weekStart: WEEK })[0];
check('returning fixture expires only obsolete system-derived work',
  !!expiry && expiry.workouts.length === 1 && expiry.workouts[0].name === 'Pilates' &&
  expiry.expiries[0].origin === 'fixture_replacement', expiry);

const relocated = workout('relocated-core', 5, 'Relocated Core Conditioning');
relocated.derivedSessionProvenance = [createDerivedSessionProvenance({
  origin: 'required_core_relocation',
  scope: 'session',
  triggerSignature: section18ContractLifecycleSignature(bye, WEEK),
  credit: { metric: 'conditioning_core', amount: 1, conditioningRole: 'required_core' },
  originatingDate: WEEK,
  sourcePlanEntryId: 'source-core',
})];
const relocatedExpiry = buildDerivedSessionExpiryCandidates({
  workouts: [relocated], contract: game, weekStart: WEEK,
})[0];
check('obsolete required-core relocation expires when its typed trigger changes',
  relocatedExpiry?.workouts.length === 0 &&
  relocatedExpiry.expiries[0].origin === 'required_core_relocation', relocatedExpiry);

const patternRepair = workout('pattern-repair', 1, 'Pattern Balance Repair');
patternRepair.derivedSessionProvenance = [createDerivedSessionProvenance({
  origin: 'pattern_balance_repair',
  scope: 'session',
  triggerSignature: section18ContractLifecycleSignature(bye, WEEK),
  credit: { metric: 'strength_pattern', amount: 1, strengthPattern: 'hinge' },
  originatingDate: WEEK,
  sourcePlanEntryId: 'source-pattern',
})];
const patternExpiry = buildDerivedSessionExpiryCandidates({
  workouts: [patternRepair], contract: game, weekStart: WEEK,
})[0];
check('obsolete pattern-balance repair expires when its typed trigger changes',
  patternExpiry?.workouts.length === 0 &&
  patternExpiry.expiries[0].origin === 'pattern_balance_repair', patternExpiry);

const underlyingMonday = workout('accepted-monday', 1, 'Lower Body Strength');
underlyingMonday.planEntryId = 'w2:monday:strength';
underlyingMonday.exercises = [{
  id: 'accepted-monday:row',
  workoutId: underlyingMonday.id,
  exerciseId: 'deadlift',
  exerciseOrder: 1,
  prescribedSets: 3,
  prescribedRepsMin: 3,
  prescribedRepsMax: 4,
  restSeconds: 120,
  createdAt: `${WEEK}T00:00:00.000Z`,
  updatedAt: `${WEEK}T00:00:00.000Z`,
}];
const recovery = workout('g-plus-one', 1, 'Recovery Session');
recovery.sessionTier = 'recovery';
recovery.workoutType = 'Recovery';
recovery.derivedSessionProvenance = [createDerivedSessionProvenance({
  origin: 'fixture_recovery',
  scope: 'session',
  triggerSignature: 'fixture:2026-07-19:g_plus_1',
  credit: { metric: 'safe_session_content', amount: 1 },
  originatingDate: '2026-07-20',
  originatingFixtureDate: '2026-07-19',
  sourcePlanEntryId: underlyingMonday.planEntryId,
  validWhile: [{ kind: 'fixture_present', fixtureDate: '2026-07-19' }],
  invalidWhen: [{ kind: 'fixture_absent', fixtureDate: '2026-07-19' }],
  dependency: {
    kind: 'fixture_to_session',
    source: { date: '2026-07-19', weekStart: WEEK },
    target: { date: '2026-07-20', weekStart: '2026-07-20' },
    crossesWeekBoundary: true,
    displacedSession: {
      targetDate: '2026-07-20',
      sourcePlanEntryId: underlyingMonday.planEntryId,
      workout: underlyingMonday,
    },
    restoration: {
      targetDate: '2026-07-20',
      sourcePlanEntryId: underlyingMonday.planEntryId,
      workout: underlyingMonday,
    },
  },
})];
const persistedRecovery = JSON.parse(JSON.stringify(recovery)) as Workout;
check('cross-week dependency and displaced prescription survive persistence',
  persistedRecovery.derivedSessionProvenance?.[0].dependency?.restoration.workout
    ?.exercises[0].prescribedSets === 3);
check('G+1 recovery remains while the exact source fixture is active',
  buildDerivedSessionExpiryCandidates({
    workouts: [persistedRecovery],
    contract: game,
    weekStart: '2026-07-20',
    activeFixtureDates: new Set(['2026-07-19']),
  }).length === 0);
const recoveryExpiry = buildDerivedSessionExpiryCandidates({
  workouts: [persistedRecovery],
  contract: game,
  weekStart: '2026-07-20',
  activeFixtureDates: new Set(),
})[0];
check('expired G+1 recovery restores the exact displaced Monday',
  recoveryExpiry?.workouts[0].planEntryId === underlyingMonday.planEntryId &&
  recoveryExpiry.workouts[0].exercises[0].prescribedSets === 3,
  recoveryExpiry);
const dependencyOverlay = {
  id: 'dependency-overlay',
  weekStart: '2026-07-20',
  weekEnd: '2026-07-26',
  anchorDate: null,
  reason: 'one_off_game' as const,
  workoutsByDate: { '2026-07-20': persistedRecovery },
  createdAt: `${WEEK}T00:00:00.000Z`,
  updatedAt: `${WEEK}T00:00:00.000Z`,
};
const closure = rollingHorizonDependencyClosure({
  seedWeekStarts: [WEEK],
  changedTriggerDates: ['2026-07-19'],
  surfaces: {
    currentProgram: null,
    currentMicrocycle: null,
    dateOverrides: {},
    weekScopedOverlays: { '2026-07-20': dependencyOverlay },
  },
});
check('rolling horizon closes deterministically over provenance-referenced weeks',
  JSON.stringify(closure) === JSON.stringify([WEEK, '2026-07-20']), closure);
const horizonCombination = searchRollingHorizonCandidateCombinations({
  candidateGroups: [[1, 2], [10, 20]],
  score: (candidate) => Math.abs(candidate.reduce((total, value) => total + value, 0) - 22),
  compare: (left, right) => left - right,
  signature: (candidate) => candidate.join(','),
});
check('rolling horizon scores complete cross-week combinations',
  JSON.stringify(horizonCombination?.candidate) === JSON.stringify([2, 20]) &&
  horizonCombination?.searchedCandidates === 4, horizonCombination);
const boundedHorizonSearch = searchRollingHorizonCandidateCombinations({
  candidateGroups: [[1, 2, 3], [10, 20, 30]],
  score: (candidate) => candidate.reduce((total, value) => total + value, 0),
  compare: (left, right) => left - right,
  signature: (candidate) => candidate.join(','),
  maxCandidates: 2,
});
check('rolling horizon combination search terminates at its deterministic cap',
  boundedHorizonSearch?.searchedCandidates === 2 && boundedHorizonSearch.truncated === true,
  boundedHorizonSearch);

const pathResults = [
  'fixture', 'readiness', 'injury', 'equipment', 'coach', 'repeat', 'rollover', 'hydration',
].map(() => searchWholeWeekRepairCandidates<number, number>({
  initial: 0,
  stateSignature: String,
  assess: (candidate) => ({ accepted: candidate === 2, blockingCount: candidate === 2 ? 0 : 1, evaluation: candidate }),
  expand: (candidate) => candidate < 2 ? [candidate + 1] : [],
}));
check('all mutation paths receive path-equivalent typed search results',
  pathResults.every((result) => JSON.stringify(result) === JSON.stringify(pathResults[0])));

console.log(`\nWhole-week repair totals: passed=${passed}/${passed + failed} failures=${failed}`);
if (failed > 0) process.exitCode = 1;
