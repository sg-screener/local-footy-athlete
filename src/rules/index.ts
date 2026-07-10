/**
 * src/rules — Programming Bible rules kernel (Phase 1).
 *
 * READ-ONLY classification, counting, and rule DATA. Nothing in this
 * package mutates programs, gates writes, or changes scheduling. Later
 * phases (weekly-structure validation, strength/conditioning enforcement,
 * injury re-banding) build on these primitives behind their own plans.
 */

export * from './sessionTaxonomy';
export * from './stressClassification';
export * from './sessionClassificationAdapter';
export * from './weeklyExposureCounts';
export * from './injurySeverityBands';
export * from './phaseRepSchemes';
export * from './weekStructureValidator';
export * from './recoveryAddonCoverage';
export * from './offseasonSubphase';
export * from './offseasonSubphasePolicy';
export * from './preseasonSubphase';
export * from './preseasonSubphasePolicy';
export * from './sprintExposureGate';

// Role bias mapper already lives in utils/roleBuckets (5 user-facing roles
// → 4 programming biases, high_forward_back → outside_runner). Re-exported
// here so rules consumers have one import surface; do NOT duplicate it.
export {
  getProgrammingRoleBias,
  normalizeRoleBucket,
  type ProgrammingRoleBias,
} from '../utils/roleBuckets';
