import { STRENGTH_GOLDEN_SCENARIOS } from './strengthGoldens';
import type { ComponentGoldenScenario } from '../types';

const HEALTHY_IN_SEASON = STRENGTH_GOLDEN_SCENARIOS[0].profile;
const LOW_AVAILABILITY_FULL_BODY = STRENGTH_GOLDEN_SCENARIOS[1].profile;
const HEALTHY_OFF_SEASON_SIX_DAY: Record<string, unknown> = {
  ...HEALTHY_IN_SEASON,
  seasonPhase: 'Off-season',
  trainingDaysPerWeek: 6,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  usualGameDay: undefined,
  gameDay: undefined,
};
const HEALTHY_OFF_SEASON_FIVE_DAY: Record<string, unknown> = {
  ...HEALTHY_OFF_SEASON_SIX_DAY,
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
};

export const COMPONENT_GOLDEN_SCENARIOS: readonly ComponentGoldenScenario[] = [
  {
    id: 'mixed-strength-aerobic',
    description: 'Healthy off-season strength session with a real typed aerobic conditioning component.',
    referenceDate: '2026-03-23',
    timezone: 'Australia/Melbourne',
    profile: HEALTHY_OFF_SEASON_SIX_DAY,
    ruleIds: ['ALL-COMP-MIXED-01', 'ALL-COND-SECTION-01', 'ALL-COMP-PROJECTION-01'],
    target: { weekInBlock: 1, day: 'Monday' },
    sourceKind: 'deterministic',
    scalarMutation: {
      workoutType: 'Strength',
      workoutName: 'Renamed Session — scalar display only',
      subtitle: 'Display subtitle only',
    },
  },
  {
    id: 'team-training-plus-strength',
    description: 'Healthy in-season Tuesday team training combined with a real upper-pull contribution.',
    referenceDate: '2026-03-23',
    timezone: 'Australia/Melbourne',
    profile: HEALTHY_IN_SEASON,
    ruleIds: ['ALL-COMP-TEAM-01', 'ALL-COMP-PROJECTION-01'],
    target: { weekInBlock: 1, day: 'Tuesday' },
    sourceKind: 'deterministic',
  },
  {
    id: 'strength-plus-trunk-support',
    description: 'Healthy low-availability full-body strength session with canonical Pallof trunk support.',
    referenceDate: '2026-03-23',
    timezone: 'Australia/Melbourne',
    profile: LOW_AVAILABILITY_FULL_BODY,
    ruleIds: ['ALL-TRUNK-SUPPORT-01', 'ALL-COMP-PROJECTION-01'],
    target: { weekInBlock: 1, day: 'Monday' },
    sourceKind: 'deterministic',
  },
  {
    id: 'strength-plus-recovery-addon',
    description: 'Healthy off-season strength session with a real deterministic recovery add-on attachment.',
    referenceDate: '2026-03-23',
    timezone: 'Australia/Melbourne',
    profile: HEALTHY_OFF_SEASON_FIVE_DAY,
    ruleIds: ['ALL-RECOVERY-ADDON-01', 'ALL-COMP-PROJECTION-01'],
    target: { weekInBlock: 1, day: 'Monday' },
    sourceKind: 'deterministic_with_recovery_addons',
  },
  {
    id: 'accessory-gunshow-only',
    description: 'Direct canonical Gunshow fixture isolated from G−1 removal so accessory visibility and zero main credit can be audited.',
    referenceDate: '2026-03-23',
    timezone: 'Australia/Melbourne',
    profile: HEALTHY_IN_SEASON,
    ruleIds: ['ALL-ACCESSORY-CREDIT-01', 'ALL-COMP-PROJECTION-01'],
    target: { weekInBlock: 1, day: 'Wednesday' },
    sourceKind: 'direct_accessory_fixture',
  },
];
