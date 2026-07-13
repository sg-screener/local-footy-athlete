import type { Slice3GoldenScenario, Slice3RuleId } from '../types';

const FIXED = {
  referenceDate: '2026-03-23' as const,
  timezone: 'Australia/Melbourne' as const,
};

function golden(
  id: Slice3GoldenScenario['id'],
  description: string,
  ruleIds: Slice3RuleId[],
): Slice3GoldenScenario {
  return { id, fixtureKind: id, description, ruleIds, ...FIXED };
}

export const SLICE3_GOLDEN_SCENARIOS: readonly Slice3GoldenScenario[] = [
  golden('early-offseason-healthy', 'Healthy experienced early off-season strength plus easy off-feet aerobic work.', [
    'ALL-COND-MODALITY-01', 'OS-EARLY-COND-01', 'OS-PWR-PHASE-01',
  ]),
  golden('mid-offseason-primer', 'Mid off-season heavy lower session eligible for primer-only power.', [
    'OS-PWR-PHASE-01', 'ALL-PWR-CONTENT-01',
  ]),
  golden('late-offseason-valid-contrast', 'Late off-season same-family heavy squat and explosive lower contrast.', [
    'OS-PWR-PHASE-01', 'ALL-PWR-CONTRAST-01', 'ALL-PWR-CONTENT-01',
  ]),
  golden('late-offseason-invalid-contrast', 'Late off-season contrast candidate without a surviving heavy main lift.', [
    'ALL-PWR-CONTRAST-01', 'ALL-PWR-CONTENT-01',
  ]),
  golden('inseason-game-sat-g2-lower', 'Typed high-intensity lower session two days before a Saturday game.', [
    'IS-PWR-PROXIMITY-01', 'ALL-SPACE-G2-LOWER-01', 'ALL-SPACE-HARD-01',
  ]),
  golden('inseason-mixed-team-accounting', 'In-season mixed lower, Team Training plus upper pull, and Saturday game accounting.', [
    'ALL-COND-EXPOSURE-01', 'ALL-SPACE-HARD-01', 'ALL-ANCHOR-LOAD-01',
    'ALL-EXPOSURE-STRENGTH-01', 'ALL-EXPOSURE-COND-01', 'ALL-EXPOSURE-REGION-01',
    'ALL-EXPOSURE-CAPS-01',
  ]),
  golden('hamstring-restriction-mixed', 'Hamstring-limited mixed session containing affected hinge and unaffected upper/aerobic work.', [
    'ALL-CONSTRAINT-AFFECTED-ONLY-01', 'ALL-COND-EXPOSURE-01',
    'ALL-EXPOSURE-COND-01', 'ALL-EXPOSURE-REGION-01',
  ]),
  golden('equipment-no-barbell-lower', 'No-barbell constraint with barbell and dumbbell squat options.', [
    'ALL-EQUIPMENT-COMPATIBLE-01',
  ]),
  golden('low-readiness-downgrade', 'Low-readiness strength session with optional power and hard conditioning extras.', [
    'ALL-READINESS-DOWNGRADE-01', 'ALL-COND-EXPOSURE-01',
  ]),
  golden('multi-modality-conditioning', 'Typed tempo conditioning choices containing both bike and RowErg modalities.', [
    'ALL-COND-MODALITY-01', 'ALL-COND-MULTI-01',
  ]),
  {
    id: 'early-offseason-legacy-commercial', fixtureKind: 'early-offseason-legacy-commercial',
    description: 'Legacy positive Commercial-gym checklist across edge Week 1 and fallback Week 2.',
    referenceDate: '2026-07-13', timezone: 'Australia/Melbourne',
    ruleIds: ['OS-COND-CROSS-WEEK-01', 'ALL-COND-PATH-EQUIV-01', 'ALL-COND-FEASIBILITY-01', 'ALL-COND-NOTE-TRUTH-01'],
  },
  {
    id: 'early-offseason-modern-full-gym', fixtureKind: 'early-offseason-modern-full-gym',
    description: 'Complete modern Full Gym selection across edge Week 1 and fallback Week 2.',
    referenceDate: '2026-07-13', timezone: 'Australia/Melbourne',
    ruleIds: ['OS-COND-CROSS-WEEK-01', 'ALL-COND-PATH-EQUIV-01', 'ALL-COND-FEASIBILITY-01', 'ALL-COND-NOTE-TRUTH-01'],
  },
  {
    id: 'early-offseason-explicit-no-cardio', fixtureKind: 'early-offseason-explicit-no-cardio',
    description: 'Complete modern no-cardio selection rejects edge Bike and fallback conditioning equally.',
    referenceDate: '2026-07-13', timezone: 'Australia/Melbourne',
    ruleIds: ['ALL-COND-PATH-EQUIV-01', 'ALL-COND-FEASIBILITY-01', 'ALL-COND-NOTE-TRUTH-01'],
  },
  {
    id: 'early-offseason-row-only', fixtureKind: 'early-offseason-row-only',
    description: 'One permitted RowErg modality replaces unavailable defaults deterministically in every path.',
    referenceDate: '2026-07-13', timezone: 'Australia/Melbourne',
    ruleIds: ['ALL-COND-PATH-EQUIV-01', 'ALL-COND-FEASIBILITY-01', 'ALL-COND-NOTE-TRUTH-01'],
  },
];
