(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { Workout } from '../types/domain';
import {
  buildDerivedSessionExpiryCandidates,
  createDerivedSessionProvenance,
  section18ContractLifecycleSignature,
} from '../rules/derivedSessionProvenance';
import { searchWholeWeekRepairCandidates } from '../rules/wholeWeekRepairEngine';
import { buildSection18WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';

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
