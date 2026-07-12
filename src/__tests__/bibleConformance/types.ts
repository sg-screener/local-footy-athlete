export type BibleRuleId =
  | 'ALL-STR-BLOCK-01'
  | 'ALL-FULLBODY-01'
  | 'IS-STR-MIN-01'
  | 'ALL-ACCESSORY-01';

export type StrengthScenarioId =
  | 'is-healthy-5d-tt2-game-sat'
  | 'is-low-availability-full-body'
  | 'is-display-copy-non-authoritative';

export type StrengthPattern = 'squat' | 'hinge' | 'push' | 'pull';
export type StrengthArchetype = 'lower' | 'upper' | 'full_body';

export type StrengthTraceStage =
  | 'allocation'
  | 'generated_fallback'
  | 'visible_week'
  | 'visible_detail';

export type StrengthInvariantId =
  | 'INV_PLANNED_CONTRACT_CONSERVED'
  | 'INV_NO_SINGLE_WINNER'
  | 'INV_HEALTHY_BLOCK_PATTERN_BALANCE'
  | 'INV_FULL_BODY_EXACT_LEDGER'
  | 'INV_DISPLAY_TEXT_NON_AUTHORITATIVE'
  | 'INV_WEEK_DETAIL_COMPONENT_AGREEMENT'
  | 'INV_PLAN_ENTRY_JOIN_UNAMBIGUOUS';

export interface BibleStrengthRule {
  id: BibleRuleId;
  section: string;
  anchorQuote: string;
  statement: string;
  applicableScenarios: StrengthScenarioId[];
  expectation:
    | { kind: 'block_patterns'; requiredPatterns: StrengthPattern[] }
    | { kind: 'full_body'; lowerPatternCount: 1; requiredUpperPatterns: ['push', 'pull'] }
    | { kind: 'minimum_strength'; minimumPerWeek: number }
    | { kind: 'accessory_no_credit'; expectedPatterns: [] };
}

export interface DisplayMutation {
  targetDay: string;
  focus: string;
  workoutName: string;
}

export interface StrengthGoldenScenario {
  id: StrengthScenarioId;
  description: string;
  referenceDate: '2026-03-23';
  timezone: 'Australia/Melbourne';
  profile: Record<string, unknown>;
  ruleIds: BibleRuleId[];
  expectedFullBodyDays?: string[];
  expectedAccessoryDays?: string[];
  displayMutation?: DisplayMutation;
}

export interface ObservedStrengthSession {
  stage: StrengthTraceStage;
  weekNumber: number;
  weekInBlock: number;
  day: string;
  date?: string;
  planEntryId: string;
  archetype: StrengthArchetype | null;
  primaryPattern: StrengthPattern | null;
  plannedPatterns: StrengthPattern[];
  effectivePatterns: StrengthPattern[];
  tier: string | null;
  workoutType: string | null;
  components: string[];
  exerciseNames: string[];
  strengthRowNames: string[];
  conditioningRowNames: string[];
  supportRowNames: string[];
  visibleItemDomains: string[];
  visibleTitle: string | null;
  visibleSubtitle: string | null;
  focus: string | null;
}

export interface StrengthScenarioTrace {
  scenario: StrengthGoldenScenario;
  sessions: Record<StrengthTraceStage, ObservedStrengthSession[]>;
  runtimeMs: number;
}

export interface InvariantFailure {
  invariantId: StrengthInvariantId;
  ruleId: BibleRuleId;
  scenarioId: StrengthScenarioId;
  stage: StrengthTraceStage;
  expected: unknown;
  actual: unknown;
  missing: string[];
  extra: string[];
  path: string;
  planEntryId?: string;
  day?: string;
  detail?: string;
}

export interface InvariantCheckResult {
  invariantId: StrengthInvariantId;
  scenarioId: StrengthScenarioId;
  applied: boolean;
  failures: InvariantFailure[];
}

export interface MutationAcceptanceResult {
  killed: boolean;
  mutationActive: boolean;
  restored: boolean;
  firstDivergenceStage: StrengthTraceStage | null;
  report: string;
}
