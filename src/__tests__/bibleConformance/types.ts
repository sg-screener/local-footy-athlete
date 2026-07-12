export type BibleRuleId =
  | 'ALL-STR-BLOCK-01'
  | 'ALL-FULLBODY-01'
  | 'IS-STR-MIN-01'
  | 'ALL-ACCESSORY-01';

export type StrengthScenarioId =
  | 'is-healthy-5d-tt2-game-sat'
  | 'is-low-availability-full-body'
  | 'is-display-copy-non-authoritative';

export type ComponentScenarioId =
  | 'mixed-strength-aerobic'
  | 'team-training-plus-strength'
  | 'strength-plus-trunk-support'
  | 'strength-plus-recovery-addon'
  | 'accessory-gunshow-only';

export type BibleScenarioId = StrengthScenarioId | ComponentScenarioId;

export type ComponentRuleId =
  | 'ALL-COMP-MIXED-01'
  | 'ALL-COMP-TEAM-01'
  | 'ALL-TRUNK-SUPPORT-01'
  | 'ALL-RECOVERY-ADDON-01'
  | 'ALL-COND-SECTION-01'
  | 'ALL-ACCESSORY-CREDIT-01'
  | 'ALL-COMP-PROJECTION-01';

export type StrengthPattern = 'squat' | 'hinge' | 'push' | 'pull';
export type StrengthArchetype = 'lower' | 'upper' | 'full_body';

export type HarnessSessionComponent =
  | 'strength'
  | 'conditioning'
  | 'team_training'
  | 'power'
  | 'trunk_support'
  | 'recovery';

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

export type ComponentInvariantId =
  | 'INV_COMPONENT_SET_CONSERVED'
  | 'INV_MIXED_PRESERVES_BOTH'
  | 'INV_TEAM_STRENGTH_PRESERVES_BOTH'
  | 'INV_TRUNK_NOT_CONDITIONING'
  | 'INV_TRUNK_NO_MAIN_STRENGTH_CREDIT'
  | 'INV_RECOVERY_ADDON_NON_DESTRUCTIVE'
  | 'INV_CONDITIONING_NOT_IN_STRENGTH_ROWS'
  | 'INV_ACCESSORY_NOT_MAIN_EXPOSURE'
  | 'INV_WEEK_DETAIL_COMPONENT_AGREEMENT'
  | 'INV_SCALAR_LABEL_NON_AUTHORITATIVE';

export type BibleInvariantId = StrengthInvariantId | ComponentInvariantId;

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

export interface BibleComponentRule {
  id: ComponentRuleId;
  section: string;
  anchorQuote: string;
  statement: string;
  applicableScenarios: ComponentScenarioId[];
  expectation:
    | { kind: 'required_components'; components: HarnessSessionComponent[] }
    | {
        kind: 'trunk_support';
        supportRows: string[];
        strengthPatterns: StrengthPattern[];
        forbiddenComponents: ['conditioning'];
      }
    | { kind: 'conditioning_section'; conditioningRows: string[] }
    | { kind: 'accessory_no_credit'; expectedPatterns: [] }
    | { kind: 'projection_agreement' };
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

export interface ComponentGoldenScenario {
  id: ComponentScenarioId;
  description: string;
  referenceDate: '2026-03-23';
  timezone: 'Australia/Melbourne';
  profile: Record<string, unknown>;
  ruleIds: ComponentRuleId[];
  target: { weekInBlock: 1; day: string };
  sourceKind:
    | 'deterministic'
    | 'deterministic_with_recovery_addons'
    | 'direct_accessory_fixture';
  scalarMutation?: {
    workoutType: string;
    workoutName: string;
    subtitle: string;
  };
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
  components: HarnessSessionComponent[];
  rawComponentKinds: string[];
  exerciseNames: string[];
  strengthRowNames: string[];
  conditioningRowNames: string[];
  supportRowNames: string[];
  teamTrainingRowNames: string[];
  recoveryAddonNames: string[];
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

export interface ComponentScenarioTrace {
  scenario: ComponentGoldenScenario;
  sessions: Record<StrengthTraceStage, ObservedStrengthSession[]>;
  runtimeMs: number;
}

export interface InvariantFailure {
  invariantId: BibleInvariantId;
  ruleId: BibleRuleId | ComponentRuleId;
  scenarioId: BibleScenarioId;
  stage: StrengthTraceStage;
  expected: unknown;
  actual: unknown;
  missing: string[];
  extra: string[];
  path: string;
  planEntryId?: string;
  day?: string;
  detail?: string;
  weekComponents?: HarnessSessionComponent[];
  detailComponents?: HarnessSessionComponent[];
  row?: string;
}

export interface InvariantCheckResult {
  invariantId: BibleInvariantId;
  scenarioId: BibleScenarioId;
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

export type ComponentMutationId =
  | 'drop_mixed_conditioning'
  | 'drop_team_strength'
  | 'trunk_as_conditioning'
  | 'accessory_main_credit'
  | 'full_body_extra_lower';

export interface ComponentMutationAcceptanceResult extends MutationAcceptanceResult {
  mutationId: ComponentMutationId;
  invariantId: BibleInvariantId;
  scenarioId: BibleScenarioId;
}
