import type { Slice4GoldenScenario } from '../types';

const FIXED = { referenceDate: '2026-03-23' as const, timezone: 'Australia/Melbourne' as const };
const scenario = (
  id: Slice4GoldenScenario['id'],
  description: string,
  pathIds: Slice4GoldenScenario['pathIds'],
  ruleIds: Slice4GoldenScenario['ruleIds'],
  expected: Record<string, unknown>,
): Slice4GoldenScenario => ({ id, description, pathIds, ruleIds, expected, ...FIXED });

export const SLICE4_GOLDEN_SCENARIOS: readonly Slice4GoldenScenario[] = [
  scenario('generation-ai-fallback-equivalence', 'Deterministic and malformed AI fixture represent the same combined lower plus aerobic plan.', ['deterministic_generation', 'ai_fixture_normalisation'], ['ALL-PATH-EQUIV-01'], { patterns: ['squat', 'hinge'], components: ['strength', 'conditioning'] }),
  scenario('noop-inseason-week-rebuild', 'Identical fixed-date in-season rebuilds preserve canonical meaning.', ['no_op_week_rebuild'], ['ALL-REBUILD-IDEMPOTENT-01'], { changes: 0 }),
  scenario('repeat-rich-week', 'Repeat Week carries Mixed, team-strength, support and recovery content.', ['repeat_week'], ['ALL-REPEAT-CONSERVE-01'], { conserve: true }),
  scenario('block-rollover-contract', 'Four-week block rollover retains balanced typed strength and components.', ['block_rollover'], ['ALL-ROLLOVER-CONSERVE-01'], { patterns: ['squat', 'hinge', 'push', 'pull'] }),
  scenario('coach-add-bike-zone2', 'Coach add-conditioning edit promotes Bike Zone 2 out of strength rows.', ['conditioning_edit'], ['ALL-EDIT-CANONICAL-01'], { components: ['strength', 'conditioning'] }),
  scenario('coach-remove-contrast-lift', 'Removing the final heavy lift invalidates stale Contrast.', ['coach_revision'], ['ALL-EDIT-CANONICAL-01'], { contrast: false }),
  scenario('direct-add-pallof', 'Direct Pallof edit remains support without conditioning/main credit.', ['direct_exercise_edit'], ['ALL-EDIT-CANONICAL-01'], { support: ['Pallof Press'] }),
  scenario('move-combined-lower', 'Combined lower moves to a free day with workout-owned identity.', ['workout_move'], ['ALL-MOVE-IDENTITY-01'], { identityTravels: true }),
  scenario('swap-upper-and-lower', 'Occupied upper and lower workouts exchange days with both identities.', ['workout_swap'], ['ALL-SWAP-IDENTITY-01'], { identitiesTravel: true }),
  scenario('canonical-program-rehydrate', 'Modern rich program survives the real ProgramStore envelope and merge.', ['store_rehydrate'], ['ALL-STORE-ROUNDTRIP-01', 'ALL-STORE-IDEMPOTENT-01', 'ALL-STORE-SCALAR-NONAUTH-01'], { storageKey: 'program-store', version: 0 }),
  scenario('legacy-program-rehydrate', 'Legacy contribution arrays migrate once through real hydration.', ['legacy_store_rehydrate'], ['ALL-LEGACY-HYDRATE-01', 'ALL-STORE-IDEMPOTENT-01', 'ALL-STORE-SCALAR-NONAUTH-01'], { patterns: ['squat', 'hinge'] }),
  scenario('post-rehydrate-edit-rebuild', 'Post-rehydrate edit and rebuild match equivalent live paths.', ['store_rehydrate', 'conditioning_edit', 'no_op_week_rebuild'], ['ALL-POST-REHYDRATE-WRITE-01'], { editEquivalent: true, rebuildEquivalent: true }),
];
