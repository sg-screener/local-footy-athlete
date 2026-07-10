/**
 * Canonical conflict-resolution order from LFA Programming Bible §17.K.
 *
 * Rank 1 is the highest priority. Consumers may decide how a rule is applied,
 * but they must not redefine which concern wins when two concerns conflict.
 */

export const HIERARCHY_TIERS = [
  { id: 'hard_stop_safety', rank: 1, label: 'Hard stop / safety issue' },
  { id: 'injury_safety', rank: 2, label: 'Injury severity and serious symptoms' },
  { id: 'game_day_protection', rank: 3, label: 'Game day protection' },
  { id: 'team_training_load', rank: 4, label: 'Team training and actual field load' },
  { id: 'athlete_availability', rank: 5, label: 'Athlete availability' },
  { id: 'readiness_safety', rank: 6, label: 'Fatigue, sickness and readiness' },
  { id: 'weekly_load_caps', rank: 7, label: 'Weekly hard exposure and running caps' },
  { id: 'season_phase', rank: 8, label: 'Season phase' },
  { id: 'training_age_capacity', rank: 9, label: 'Training age, strength and fitness level' },
  { id: 'role_bias', rank: 10, label: 'Position / role bucket' },
  { id: 'goal_bias', rank: 11, label: 'Goals' },
  { id: 'user_preference', rank: 12, label: 'User preference' },
  { id: 'ai_suggestion', rank: 13, label: 'AI suggestion' },
] as const;

export type ProgrammingHierarchyTier = (typeof HIERARCHY_TIERS)[number]['id'];

const HIERARCHY_BY_ID = new Map<ProgrammingHierarchyTier, (typeof HIERARCHY_TIERS)[number]>(
  HIERARCHY_TIERS.map((tier) => [tier.id, tier]),
);

/**
 * Common decision sources mapped onto the exact §17.K tiers. Equipment is
 * an availability constraint, so it shares the athlete-availability tier
 * instead of inserting a new rank into the Bible order.
 */
export const PROGRAMMING_DECISION_TIERS = {
  redFlagMedicalStop: 'hard_stop_safety',
  injurySafety: 'injury_safety',
  gameAnchor: 'game_day_protection',
  teamTrainingAnchor: 'team_training_load',
  scheduleAvailability: 'athlete_availability',
  equipmentAvailability: 'athlete_availability',
  readinessSafety: 'readiness_safety',
  weeklyCaps: 'weekly_load_caps',
  deloadOrRecoveryWeek: 'season_phase',
  seasonPhase: 'season_phase',
  beginnerPolicy: 'training_age_capacity',
  testingBias: 'training_age_capacity',
  roleBias: 'role_bias',
  goalBias: 'goal_bias',
  exercisePreference: 'user_preference',
  normalProgramEdit: 'user_preference',
  optionalExtra: 'ai_suggestion',
  aiSuggestion: 'ai_suggestion',
} as const satisfies Record<string, ProgrammingHierarchyTier>;

export function getHierarchyRank(tier: ProgrammingHierarchyTier): number {
  const definition = HIERARCHY_BY_ID.get(tier);
  if (!definition) throw new Error(`Unknown programming hierarchy tier: ${tier}`);
  return definition.rank;
}

/** Standard comparator: a negative result means `a` has higher priority. */
export function compareHierarchyTiers(
  a: ProgrammingHierarchyTier,
  b: ProgrammingHierarchyTier,
): -1 | 0 | 1 {
  const difference = getHierarchyRank(a) - getHierarchyRank(b);
  return difference < 0 ? -1 : difference > 0 ? 1 : 0;
}

export function higherPriorityTier(
  a: ProgrammingHierarchyTier,
  b: ProgrammingHierarchyTier,
): ProgrammingHierarchyTier {
  return compareHierarchyTiers(a, b) <= 0 ? a : b;
}

export function assertHigherPriority(
  winner: ProgrammingHierarchyTier,
  loser: ProgrammingHierarchyTier,
): void {
  if (compareHierarchyTiers(winner, loser) >= 0) {
    throw new Error(`${winner} does not outrank ${loser} in LFA Programming Bible §17.K`);
  }
}

export function explainHierarchyDecision(
  winner: ProgrammingHierarchyTier,
  loser: ProgrammingHierarchyTier,
): string {
  const winnerDefinition = HIERARCHY_BY_ID.get(winner)!;
  const loserDefinition = HIERARCHY_BY_ID.get(loser)!;
  if (winner === loser) {
    return `${winnerDefinition.label} and ${loserDefinition.label} share hierarchy rank ${winnerDefinition.rank}.`;
  }
  const actualWinner = higherPriorityTier(winner, loser);
  const actualLoser = actualWinner === winner ? loser : winner;
  const actualWinnerDefinition = HIERARCHY_BY_ID.get(actualWinner)!;
  const actualLoserDefinition = HIERARCHY_BY_ID.get(actualLoser)!;
  return `${actualWinnerDefinition.label} (rank ${actualWinnerDefinition.rank}) outranks ${actualLoserDefinition.label} (rank ${actualLoserDefinition.rank}) under LFA Programming Bible §17.K.`;
}

// §17.F warning escalation is orthogonal to the rule tiers above. A lower
// rank is again stronger, so risk consumers can use the same comparator shape.
export const PROGRAMMING_RISK_LEVELS = [
  { id: 'hard_stop', rank: 1, editDecision: 'block' },
  { id: 'strong', rank: 2, editDecision: 'confirm' },
  { id: 'soft', rank: 3, editDecision: 'confirm' },
  { id: 'info', rank: 4, editDecision: 'allow' },
] as const;

export type ProgrammingRiskLevel = (typeof PROGRAMMING_RISK_LEVELS)[number]['id'];
export type ProgrammingEditDecision = (typeof PROGRAMMING_RISK_LEVELS)[number]['editDecision'];

const RISK_LEVEL_BY_ID = new Map<ProgrammingRiskLevel, (typeof PROGRAMMING_RISK_LEVELS)[number]>(
  PROGRAMMING_RISK_LEVELS.map((level) => [level.id, level]),
);

export function getProgrammingRiskRank(level: ProgrammingRiskLevel): number {
  const definition = RISK_LEVEL_BY_ID.get(level);
  if (!definition) throw new Error(`Unknown programming risk level: ${level}`);
  return definition.rank;
}

/** Standard comparator: a negative result means `a` is the stronger risk. */
export function compareProgrammingRiskLevels(
  a: ProgrammingRiskLevel,
  b: ProgrammingRiskLevel,
): -1 | 0 | 1 {
  const difference = getProgrammingRiskRank(a) - getProgrammingRiskRank(b);
  return difference < 0 ? -1 : difference > 0 ? 1 : 0;
}

export function getProgrammingEditDecision(
  level: ProgrammingRiskLevel,
): ProgrammingEditDecision {
  return RISK_LEVEL_BY_ID.get(level)!.editDecision;
}

/**
 * Safe-option ladder used only after the global safety/equipment gates pass.
 * This is intentionally separate from the global §17.K conflict hierarchy.
 */
export const SAFE_TRAINING_FALLBACK_TIERS = [
  { id: 'same_movement_pattern', rank: 1 },
  { id: 'similar_muscle_group', rank: 2 },
  { id: 'unaffected_body_area', rank: 3 },
  { id: 'recovery_easy_conditioning', rank: 4 },
  { id: 'rest', rank: 5 },
] as const;

export type SafeTrainingFallbackTier = (typeof SAFE_TRAINING_FALLBACK_TIERS)[number]['id'];

const SAFE_FALLBACK_RANK = Object.fromEntries(
  SAFE_TRAINING_FALLBACK_TIERS.map((tier) => [tier.id, tier.rank]),
) as Record<SafeTrainingFallbackTier, number>;

export function getSafeTrainingFallbackRank(tier: SafeTrainingFallbackTier): number {
  return SAFE_FALLBACK_RANK[tier];
}

export function compareSafeTrainingFallbackTiers(
  a: SafeTrainingFallbackTier,
  b: SafeTrainingFallbackTier,
): -1 | 0 | 1 {
  const difference = getSafeTrainingFallbackRank(a) - getSafeTrainingFallbackRank(b);
  return difference < 0 ? -1 : difference > 0 ? 1 : 0;
}
