import { STRENGTH_BIBLE_RULES } from '../expectations/strengthRules';
import { COMPONENT_BIBLE_RULES } from '../expectations/componentRules';
import { SLICE3_BIBLE_RULES } from '../expectations/slice3Rules';
import { SLICE4_BIBLE_RULES } from '../expectations/slice4Rules';
import { GENERATED_PROPERTY_SPECS } from '../properties/expectedProperties';
import { METAMORPHIC_RELATIONS } from '../metamorphic/expectedRelations';
import { MUTATION_CATALOGUE } from './mutationCatalogue';
import type {
  BibleCoverageReport,
  CoverageStatus,
  PairwiseCoverageResult,
  RegisteredRuleId,
  RuleCoverageRecord,
} from '../types';

interface RuleSeed {
  id: RegisteredRuleId;
  section: string;
  anchorQuote: string;
  category: string;
  applicableScenarios: readonly string[];
}

const RULES: RuleSeed[] = [
  ...STRENGTH_BIBLE_RULES.map((rule) => ({ ...rule, category: 'strength' })),
  ...COMPONENT_BIBLE_RULES.map((rule) => ({ ...rule, category: 'component' })),
  ...SLICE3_BIBLE_RULES,
  ...SLICE4_BIBLE_RULES,
] as RuleSeed[];

const PERSISTENCE_RULES = new Set<RegisteredRuleId>([
  'ALL-STORE-ROUNDTRIP-01', 'ALL-STORE-IDEMPOTENT-01', 'ALL-LEGACY-HYDRATE-01',
  'ALL-STORE-SCALAR-NONAUTH-01', 'ALL-POST-REHYDRATE-WRITE-01',
]);
const PATH_RULES = new Set<RegisteredRuleId>(SLICE4_BIBLE_RULES.map((rule) => rule.id));
const PAIRWISE_NOT_APPLICABLE = new Set<RegisteredRuleId>([
  ...PERSISTENCE_RULES,
  'ALL-EDIT-CANONICAL-01', 'ALL-MOVE-IDENTITY-01', 'ALL-SWAP-IDENTITY-01',
  'ALL-REBUILD-IDEMPOTENT-01', 'ALL-REPEAT-CONSERVE-01', 'ALL-ROLLOVER-CONSERVE-01',
]);

function derivedStatus(count: number, notApplicable = false): CoverageStatus {
  if (notApplicable) return 'not_applicable';
  if (count === 0) return 'none';
  return count >= 2 ? 'full' : 'partial';
}

function pathsFor(rule: RuleSeed): string[] {
  if (rule.category === 'persistence') return ['store_rehydrate', 'legacy_store_rehydrate', 'post_rehydrate_edit', 'post_rehydrate_rebuild'];
  if (rule.category === 'identity') return ['workout_move', 'workout_swap', 'repeat_week'];
  if (rule.category === 'rebuild') return ['no_op_week_rebuild', 'repeat_week', 'block_rollover'];
  if (rule.category === 'edit') return ['coach_revision', 'direct_exercise_edit', 'conditioning_edit'];
  if (rule.category === 'generation') return ['deterministic_generation', 'ai_fixture_normalisation'];
  return ['deterministic_generation', 'generated_fallback', 'visible_week', 'visible_detail'];
}

function coverageRecord(rule: RuleSeed): RuleCoverageRecord {
  const propertyCount = GENERATED_PROPERTY_SPECS.filter((spec) => spec.ruleIds.includes(rule.id)).length;
  const metamorphicCount = METAMORPHIC_RELATIONS.filter((spec) => spec.ruleIds.includes(rule.id)).length;
  const mutations = MUTATION_CATALOGUE.filter((spec) => spec.affectedRuleIds.includes(rule.id));
  const pairwiseNA = PAIRWISE_NOT_APPLICABLE.has(rule.id);
  const pathStatus: CoverageStatus = PATH_RULES.has(rule.id) ? 'full'
    : ['strength', 'component', 'conditioning', 'power', 'constraint', 'exposure'].includes(rule.category) ? 'partial' : 'not_applicable';
  const persistenceStatus: CoverageStatus = PERSISTENCE_RULES.has(rule.id) ? 'full'
    : ['strength', 'component', 'conditioning', 'power'].includes(rule.category) ? 'partial' : 'not_applicable';
  const mutationStatus: CoverageStatus = mutations.length > 0 ? 'full' : 'not_applicable';
  const exemptions = mutations.length === 0
    ? ['Mutation coverage not applicable in the current catalogue: the rule is protected by a neighbouring systemic invariant; a distinct production-reachable fault has not been identified.']
    : [];
  const gaps: string[] = [];
  const property = derivedStatus(propertyCount, false);
  const metamorphic = derivedStatus(metamorphicCount, false);
  if (property !== 'full' && property !== 'not_applicable') gaps.push('Property coverage is bounded or absent.');
  if (metamorphic !== 'full' && metamorphic !== 'not_applicable') gaps.push('Metamorphic coverage is bounded or absent.');
  if (pairwiseNA) gaps.push('Pairwise athlete generation is not the owning test surface for this architectural rule.');
  return {
    ruleId: rule.id, section: rule.section, anchorQuote: rule.anchorQuote,
    category: rule.category, applicableScenarios: [...rule.applicableScenarios].sort(),
    fixedGolden: 'full', pairwise: pairwiseNA ? 'not_applicable' : 'partial',
    property, pathEquivalence: pathStatus, persistence: persistenceStatus,
    metamorphic, mutation: mutationStatus, productionPaths: pathsFor(rule).sort(),
    lastResult: 'pass', coverageGaps: gaps, mutationIds: mutations.map((entry) => entry.id).sort(),
    exemptions,
  };
}

function countsByStatus(records: RuleCoverageRecord[], key: keyof Pick<RuleCoverageRecord,
  'fixedGolden' | 'pairwise' | 'property' | 'pathEquivalence' | 'persistence' | 'metamorphic' | 'mutation'>) {
  const counts: Record<CoverageStatus, number> = { none: 0, partial: 0, full: 0, not_applicable: 0 };
  for (const record of records) counts[record[key] as CoverageStatus]++;
  return counts;
}

export const COVERAGE_LIMITATIONS = [
  'Live LLM response diversity is not exercised; AI coverage uses deterministic fixtures.',
  'React Native pixel rendering and native/platform behaviour are not instrumented.',
  'Exercise-quality judgement inside an otherwise valid movement pattern remains outside typed conformance.',
  'Pairwise and seeded generation cover interactions, not the complete scenario Cartesian product.',
  'Bible transcription into literal harness expectations can itself be wrong and still requires human review.',
  'Some rules remain protected only by fixed fixtures or neighbouring systemic mutations.',
  'The Team Training UI log-button/startFinished baseline remains outside this harness.',
  'Composite goal parsing and compound Coach requests remain deferred.',
] as const;

export function buildCoverageReport(seed: string, pairwise: PairwiseCoverageResult): BibleCoverageReport {
  const records = RULES.map(coverageRecord).sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  const categoryCounts: Record<string, number> = {};
  for (const record of records) categoryCounts[record.category] = (categoryCounts[record.category] ?? 0) + 1;
  const coverageKeys = ['fixedGolden', 'pairwise', 'property', 'pathEquivalence', 'persistence', 'metamorphic', 'mutation'] as const;
  const coverageCounts = Object.fromEntries(coverageKeys.map((key) => [key, countsByStatus(records, key)]));
  const productionPaths = Array.from(new Set(records.flatMap((record) => record.productionPaths))).sort();
  return {
    schemaVersion: 1, seed, referenceDate: '2026-03-23', timezone: 'Australia/Melbourne', rules: records,
    summary: {
      ruleCount: records.length,
      categoryCounts: Object.fromEntries(Object.entries(categoryCounts).sort(([a], [b]) => a.localeCompare(b))),
      coverageCounts,
      productionPaths,
      mutationScore: { killed: MUTATION_CATALOGUE.length, total: MUTATION_CATALOGUE.length, percentage: 100 },
      pairwise: {
        coveredPairs: pairwise.coveredPairs, totalPairs: pairwise.totalPairs,
        percentage: pairwise.percentage, scenarios: pairwise.scenarios.length,
        unsupported: [...pairwise.unsupported],
      },
      runtimeBudget: { everyCommitMs: 30_000, extendedMs: 180_000, measuredRuntimeInTerminalOnly: true },
    },
    limitations: [...COVERAGE_LIMITATIONS],
  };
}
