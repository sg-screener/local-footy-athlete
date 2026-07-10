import {
  HIERARCHY_TIERS,
  PROGRAMMING_DECISION_TIERS,
  SAFE_TRAINING_FALLBACK_TIERS,
  assertHigherPriority,
  compareHierarchyTiers,
  compareProgrammingRiskLevels,
  explainHierarchyDecision,
  getHierarchyRank,
  getProgrammingEditDecision,
  getSafeTrainingFallbackRank,
} from '../rules/conflictResolutionHierarchy';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  ok ${name}`);
    return;
  }
  fail += 1;
  failures.push(name);
  console.log(`  fail ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
}

function eq(name: string, actual: unknown, expected: unknown): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

console.log('\n-- LFA Programming Bible §17.K hierarchy --');

eq('canonical tier ids and ranks match §17.K',
  HIERARCHY_TIERS.map(({ id, rank }) => [id, rank]),
  [
    ['hard_stop_safety', 1],
    ['injury_safety', 2],
    ['game_day_protection', 3],
    ['team_training_load', 4],
    ['athlete_availability', 5],
    ['readiness_safety', 6],
    ['weekly_load_caps', 7],
    ['season_phase', 8],
    ['training_age_capacity', 9],
    ['role_bias', 10],
    ['goal_bias', 11],
    ['user_preference', 12],
    ['ai_suggestion', 13],
  ]);

ok('red-flag hard stop outranks injury',
  compareHierarchyTiers('hard_stop_safety', 'injury_safety') < 0);
ok('red-flag hard stop outranks readiness, equipment and goals',
  ['readiness_safety', PROGRAMMING_DECISION_TIERS.equipmentAvailability, 'goal_bias']
    .every((tier) => compareHierarchyTiers('hard_stop_safety', tier) < 0));
ok('game anchor outranks a normal swap/move/delete',
  compareHierarchyTiers(
    PROGRAMMING_DECISION_TIERS.gameAnchor,
    PROGRAMMING_DECISION_TIERS.normalProgramEdit,
  ) < 0);
ok('team anchor outranks a normal swap/move/delete',
  compareHierarchyTiers(
    PROGRAMMING_DECISION_TIERS.teamTrainingAnchor,
    PROGRAMMING_DECISION_TIERS.normalProgramEdit,
  ) < 0);
ok('injury and readiness safety outrank role/goal/testing bias',
  [PROGRAMMING_DECISION_TIERS.injurySafety, PROGRAMMING_DECISION_TIERS.readinessSafety]
    .every((safetyTier) => [
      PROGRAMMING_DECISION_TIERS.roleBias,
      PROGRAMMING_DECISION_TIERS.goalBias,
      PROGRAMMING_DECISION_TIERS.testingBias,
    ].every((biasTier) => compareHierarchyTiers(safetyTier, biasTier) < 0)));
ok('equipment availability outranks exercise preference',
  compareHierarchyTiers(
    PROGRAMMING_DECISION_TIERS.equipmentAvailability,
    PROGRAMMING_DECISION_TIERS.exercisePreference,
  ) < 0);
ok('weekly caps outrank optional extras and all bias tiers',
  [
    PROGRAMMING_DECISION_TIERS.optionalExtra,
    PROGRAMMING_DECISION_TIERS.roleBias,
    PROGRAMMING_DECISION_TIERS.goalBias,
    PROGRAMMING_DECISION_TIERS.testingBias,
  ].every((tier) => compareHierarchyTiers(PROGRAMMING_DECISION_TIERS.weeklyCaps, tier) < 0));
ok('deload/recovery week and beginner policy outrank aggressive goals',
  [PROGRAMMING_DECISION_TIERS.deloadOrRecoveryWeek, PROGRAMMING_DECISION_TIERS.beginnerPolicy]
    .every((tier) => compareHierarchyTiers(tier, PROGRAMMING_DECISION_TIERS.goalBias) < 0));
eq('rank helper exposes the stable rank', getHierarchyRank('weekly_load_caps'), 7);

let assertionThrew = false;
try {
  assertHigherPriority('goal_bias', 'injury_safety');
} catch {
  assertionThrew = true;
}
ok('assertHigherPriority rejects an inverted priority claim', assertionThrew);
ok('decision explanation states the actual winner',
  /injury severity.*outranks.*goals/i.test(explainHierarchyDecision('goal_bias', 'injury_safety')),
  explainHierarchyDecision('goal_bias', 'injury_safety'));

console.log('\n-- §17.F risk escalation and safe fallback ladder --');

ok('hard stop is stronger than confirm-level warnings',
  compareProgrammingRiskLevels('hard_stop', 'strong') < 0);
eq('hard stop blocks edits', getProgrammingEditDecision('hard_stop'), 'block');
eq('strong warning confirms', getProgrammingEditDecision('strong'), 'confirm');
eq('soft warning confirms', getProgrammingEditDecision('soft'), 'confirm');
eq('info allows', getProgrammingEditDecision('info'), 'allow');
eq('safe fallback order remains pattern, muscle, unaffected, recovery, rest',
  SAFE_TRAINING_FALLBACK_TIERS.map(({ id, rank }) => [id, rank]),
  [
    ['same_movement_pattern', 1],
    ['similar_muscle_group', 2],
    ['unaffected_body_area', 3],
    ['recovery_easy_conditioning', 4],
    ['rest', 5],
  ]);
ok('recovery remains ahead of rest',
  getSafeTrainingFallbackRank('recovery_easy_conditioning') < getSafeTrainingFallbackRank('rest'));

console.log(`\nconflictResolutionHierarchyTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(`Failures: ${failures.join(', ')}`);
  process.exit(1);
}
