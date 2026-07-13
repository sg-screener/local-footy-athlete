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

export type Slice3ScenarioId =
  | 'early-offseason-healthy'
  | 'mid-offseason-primer'
  | 'late-offseason-valid-contrast'
  | 'late-offseason-invalid-contrast'
  | 'inseason-game-sat-g2-lower'
  | 'inseason-mixed-team-accounting'
  | 'hamstring-restriction-mixed'
  | 'equipment-no-barbell-lower'
  | 'low-readiness-downgrade'
  | 'multi-modality-conditioning';

export type AllBibleScenarioId = BibleScenarioId | Slice3ScenarioId;

export type Slice4ScenarioId =
  | 'generation-ai-fallback-equivalence'
  | 'noop-inseason-week-rebuild'
  | 'repeat-rich-week'
  | 'block-rollover-contract'
  | 'coach-add-bike-zone2'
  | 'coach-remove-contrast-lift'
  | 'direct-add-pallof'
  | 'move-combined-lower'
  | 'swap-upper-and-lower'
  | 'canonical-program-rehydrate'
  | 'legacy-program-rehydrate'
  | 'post-rehydrate-edit-rebuild';

export type ConformancePathId =
  | 'deterministic_generation'
  | 'ai_fixture_normalisation'
  | 'no_op_week_rebuild'
  | 'selected_week_rebuild'
  | 'repeat_week'
  | 'block_rollover'
  | 'coach_revision'
  | 'direct_exercise_edit'
  | 'conditioning_edit'
  | 'workout_move'
  | 'workout_swap'
  | 'tap_swap'
  | 'constraint_refresh'
  | 'store_rehydrate'
  | 'legacy_store_rehydrate';

export type AllBibleScenarioIdV4 = AllBibleScenarioId | Slice4ScenarioId;

export type ComponentRuleId =
  | 'ALL-COMP-MIXED-01'
  | 'ALL-COMP-TEAM-01'
  | 'ALL-TRUNK-SUPPORT-01'
  | 'ALL-RECOVERY-ADDON-01'
  | 'ALL-COND-SECTION-01'
  | 'ALL-ACCESSORY-CREDIT-01'
  | 'ALL-COMP-PROJECTION-01';

export type Slice3RuleId =
  | 'ALL-COND-MODALITY-01'
  | 'OS-EARLY-COND-01'
  | 'ALL-COND-EXPOSURE-01'
  | 'ALL-COND-MULTI-01'
  | 'OS-PWR-PHASE-01'
  | 'ALL-PWR-CONTRAST-01'
  | 'ALL-PWR-CONTENT-01'
  | 'IS-PWR-PROXIMITY-01'
  | 'ALL-SPACE-G2-LOWER-01'
  | 'ALL-SPACE-HARD-01'
  | 'ALL-ANCHOR-LOAD-01'
  | 'ALL-CONSTRAINT-AFFECTED-ONLY-01'
  | 'ALL-EQUIPMENT-COMPATIBLE-01'
  | 'ALL-READINESS-DOWNGRADE-01'
  | 'ALL-EXPOSURE-STRENGTH-01'
  | 'ALL-EXPOSURE-COND-01'
  | 'ALL-EXPOSURE-REGION-01'
  | 'ALL-EXPOSURE-CAPS-01';

export type Slice4RuleId =
  | 'ALL-PATH-EQUIV-01'
  | 'ALL-REBUILD-IDEMPOTENT-01'
  | 'ALL-REPEAT-CONSERVE-01'
  | 'ALL-ROLLOVER-CONSERVE-01'
  | 'ALL-EDIT-CANONICAL-01'
  | 'ALL-MOVE-IDENTITY-01'
  | 'ALL-SWAP-IDENTITY-01'
  | 'ALL-STORE-ROUNDTRIP-01'
  | 'ALL-STORE-IDEMPOTENT-01'
  | 'ALL-LEGACY-HYDRATE-01'
  | 'ALL-STORE-SCALAR-NONAUTH-01'
  | 'ALL-POST-REHYDRATE-WRITE-01';

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

export type Slice3TraceStage =
  | StrengthTraceStage
  | 'resolved_effective'
  | 'weekly_accounting';

export type Slice4TraceStage =
  | 'path_input'
  | 'path_output'
  | 'stored_before_rehydrate'
  | 'rehydrated'
  | 'rehydrated_twice'
  | 'post_rehydrate_edit'
  | 'post_rehydrate_rebuild';

export type AllTraceStage = Slice3TraceStage | Slice4TraceStage;

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

export type Slice3InvariantId =
  | 'INV_CONDITIONING_LEDGER_CONSERVED'
  | 'INV_MODALITY_IDENTITY_HONEST'
  | 'INV_EARLY_OFFSEASON_CONDITIONING_SAFE'
  | 'INV_MULTI_MODALITY_NO_COLLAPSE'
  | 'INV_POWER_PHASE_GATED'
  | 'INV_CONTRAST_STRUCTURALLY_VALID'
  | 'INV_POWER_CONTENT_IDENTITY_HONEST'
  | 'INV_GAME_PROXIMITY_POWER_SAFE'
  | 'INV_G2_HEAVY_LOWER_PROTECTED'
  | 'INV_HARD_LOAD_SPACING_VALID'
  | 'INV_TEAM_GAME_ANCHOR_CREDIT_VALID'
  | 'INV_CONSTRAINT_LOSS_AUTHORISED'
  | 'INV_UNAFFECTED_CONTENT_PRESERVED'
  | 'INV_EQUIPMENT_COMPATIBLE'
  | 'INV_READINESS_TRANSFORMATION_VALID'
  | 'INV_STRENGTH_FATIGUE_CREDIT_CONSERVED'
  | 'INV_CONDITIONING_EXPOSURE_CREDIT_CONSERVED'
  | 'INV_EFFECTIVE_REGION_CREDIT_VALID'
  | 'INV_WEEKLY_CAPS_RESPECTED'
  | 'INV_WEEK_DETAIL_CONDITIONING_POWER_AGREEMENT';

export type Slice4InvariantId =
  | 'INV_EQUIVALENT_CANONICAL_LEDGER'
  | 'INV_EQUIVALENT_VISIBLE_WEEK'
  | 'INV_EQUIVALENT_VISIBLE_DETAIL'
  | 'INV_EQUIVALENT_EXPOSURE_CREDIT'
  | 'INV_NOOP_REBUILD_IDEMPOTENT'
  | 'INV_REPEAT_WEEK_CONSERVES_CONTRACT'
  | 'INV_ROLLOVER_ONLY_AUTHORISED_CHANGE'
  | 'INV_EDIT_USES_CANONICAL_FINALISER'
  | 'INV_MOVE_PRESERVES_PLAN_IDENTITY'
  | 'INV_SWAP_PRESERVES_BOTH_IDENTITIES'
  | 'INV_STORE_ROUNDTRIP_CONSERVED'
  | 'INV_STORE_REHYDRATE_IDEMPOTENT'
  | 'INV_LEGACY_MIGRATION_CANONICAL'
  | 'INV_MODERN_TYPED_INTENT_WINS'
  | 'INV_SCALAR_FIELDS_NON_AUTHORITATIVE_AFTER_HYDRATE'
  | 'INV_POST_REHYDRATE_EDIT_EQUIVALENT'
  | 'INV_POST_REHYDRATE_REBUILD_EQUIVALENT'
  | 'INV_PLAN_ENTRY_JOIN_STABLE_ACROSS_PATHS';

export type AllBibleInvariantId = BibleInvariantId | Slice3InvariantId;
export type AllBibleInvariantIdV4 = AllBibleInvariantId | Slice4InvariantId;

export interface HarnessConditioningEntry {
  modality: 'running' | 'bike' | 'row' | 'ski' | 'mixed_off_feet' | 'other';
  intent: 'aerobic_base' | 'tempo' | 'intervals' | 'speed' | 'flush' | 'recovery';
  intensity: 'easy' | 'moderate' | 'hard' | 'unknown';
  minutes?: number;
  offFeet: boolean;
}

export type HarnessPowerIntent =
  | { kind: 'none' }
  | { kind: 'primer'; explosiveFamily?: string }
  | {
      kind: 'contrast';
      explosiveFamily: string;
      heavyLiftFamily: string;
      heavyLiftPresent: boolean;
    };

export interface HarnessExposureLedger {
  squatStrength: number;
  hingeStrength: number;
  upperPushStrength: number;
  upperPullStrength: number;
  conditioning: number;
  hardConditioning: number;
  sprintCod: number;
  power: number;
  upperStrengthFatigue: number;
  lowerStrengthFatigue: number;
  teamTrainingAnchors: number;
  gameAnchors: number;
  recovery: number;
  hardDays: number;
  mainStrength: number;
  running: number;
}

export interface HarnessTransformEvidence {
  domain: 'canonicalisation' | 'constraint' | 'power' | 'spacing';
  action: 'remove' | 'replace' | 'limit' | 'downgrade' | 'retain' | 'move';
  code: string;
  constraintIds?: string[];
  items?: string[];
  patterns?: string[];
  components?: string[];
  day?: number;
}

export interface Slice3GoldenScenario {
  id: Slice3ScenarioId;
  description: string;
  referenceDate: '2026-03-23';
  timezone: 'Australia/Melbourne';
  fixtureKind: Slice3ScenarioId;
  ruleIds: Slice3RuleId[];
}

export interface Slice3Rule {
  id: Slice3RuleId;
  category: 'conditioning' | 'power' | 'spacing' | 'constraint' | 'exposure';
  section: string;
  anchorQuote: string;
  statement: string;
  applicableScenarios: Slice3ScenarioId[];
  expectation: Record<string, unknown>;
}

export interface Slice3StageObservation {
  stage: Slice3TraceStage;
  planEntryId: string;
  day: string;
  date: string;
  workoutName: string | null;
  workoutType: string | null;
  intensity: string | null;
  components: HarnessSessionComponent[];
  plannedPatterns: StrengthPattern[];
  effectivePatterns: StrengthPattern[];
  exerciseNames: string[];
  conditioning: HarnessConditioningEntry[];
  power: HarnessPowerIntent;
  proximityPower?: {
    gMinus1: HarnessPowerIntent['kind'];
    gameDay: HarnessPowerIntent['kind'];
    gPlus1: HarnessPowerIntent['kind'];
    gMinus2: HarnessPowerIntent['kind'];
  };
  visibleTitle: string | null;
  visibleSubtitle: string | null;
  evidence: HarnessTransformEvidence[];
  accounting?: HarnessExposureLedger;
}

export interface Slice3ScenarioTrace {
  scenario: Slice3GoldenScenario;
  stages: Partial<Record<Slice3TraceStage, Slice3StageObservation>>;
  runtimeMs: number;
}

export interface HarnessCanonicalWorkoutLedger {
  planEntryId: string;
  dayOfWeek: number;
  archetype: StrengthArchetype | null;
  primaryPattern: StrengthPattern | null;
  plannedPatterns: StrengthPattern[];
  effectivePatterns: StrengthPattern[];
  components: HarnessSessionComponent[];
  strengthRows: string[];
  conditioning: HarnessConditioningEntry[];
  power: HarnessPowerIntent;
  supportRows: string[];
  recoveryAddons: string[];
  sessionTier: string | null;
  workoutType: string | null;
  visibleTitle: string | null;
  visibleSubtitle: string | null;
}

export interface HarnessCanonicalWeekLedger {
  workouts: HarnessCanonicalWorkoutLedger[];
  exposure: HarnessExposureLedger;
  visibleWeekComponents: HarnessSessionComponent[];
  visibleDetailComponents: HarnessSessionComponent[];
}

export interface Slice4GoldenScenario {
  id: Slice4ScenarioId;
  description: string;
  referenceDate: '2026-03-23';
  timezone: 'Australia/Melbourne';
  pathIds: ConformancePathId[];
  ruleIds: Slice4RuleId[];
  expected: Record<string, unknown>;
}

export interface Slice4Rule {
  id: Slice4RuleId;
  category: 'generation' | 'rebuild' | 'edit' | 'identity' | 'persistence';
  section: string;
  anchorQuote: string;
  statement: string;
  applicableScenarios: Slice4ScenarioId[];
  expectation: Record<string, unknown>;
}

export interface Slice4PathObservation {
  pathId: ConformancePathId;
  stage: Slice4TraceStage;
  ledger: HarnessCanonicalWeekLedger;
  persistence?: { key: string; version: number; mergeRuns: number; legacy: boolean };
  authorisedChanges: string[];
  runtimeMs: number;
}

export interface Slice4ScenarioTrace {
  scenario: Slice4GoldenScenario;
  observations: Slice4PathObservation[];
  runtimeMs: number;
}

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
  invariantId: AllBibleInvariantIdV4;
  ruleId: BibleRuleId | ComponentRuleId | Slice3RuleId | Slice4RuleId;
  scenarioId: AllBibleScenarioIdV4;
  stage: AllTraceStage;
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
  evidence?: string[];
  conformancePath?: ConformancePathId;
  before?: unknown;
  after?: unknown;
  persistence?: string;
}

export interface InvariantCheckResult {
  invariantId: AllBibleInvariantIdV4;
  scenarioId: AllBibleScenarioIdV4;
  applied: boolean;
  failures: InvariantFailure[];
}

export type Slice4MutationId =
  | 'ai_drops_conditioning'
  | 'rebuild_joins_by_weekday'
  | 'repeat_drops_conditioning'
  | 'move_replaces_plan_id'
  | 'swap_keeps_destination_ids'
  | 'rehydrate_drops_second_pattern'
  | 'workout_type_overwrites_components'
  | 'stale_name_restores_pattern'
  | 'second_hydration_mutates'
  | 'coach_bike_stays_strength_row'
  | 'contrast_survives_lift_removal'
  | 'post_rehydrate_rebuild_drops_component';

export interface Slice4MutationAcceptanceResult {
  mutationId: Slice4MutationId;
  killed: boolean;
  mutationActive: boolean;
  restored: boolean;
  invariantId: Slice4InvariantId | Slice3InvariantId;
  scenarioId: Slice4ScenarioId;
  firstDivergenceStage: Slice4TraceStage;
  report: string;
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

export type Slice3MutationId =
  | 'early_power_survives'
  | 'contrast_without_heavy'
  | 'offfeet_reported_running'
  | 'drop_second_modality'
  | 'mixed_strength_fatigue_zero'
  | 'team_false_squat_credit'
  | 'g2_heavy_survives'
  | 'constraint_drops_unrelated'
  | 'equipment_incompatible_survives'
  | 'trunk_creates_conditioning';

export interface Slice3MutationAcceptanceResult {
  mutationId: Slice3MutationId;
  killed: boolean;
  mutationActive: boolean;
  restored: boolean;
  invariantId: Slice3InvariantId;
  scenarioId: Slice3ScenarioId;
  firstDivergenceStage: Slice3TraceStage;
  report: string;
}
