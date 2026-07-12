import type { BibleComponentRule } from '../types';

/**
 * Literal Bible-authored component expectations.
 *
 * This registry must never calculate expected components through production
 * taxonomy, row classifiers, canonicalisation or visible-item helpers.
 */
export const COMPONENT_BIBLE_RULES: readonly BibleComponentRule[] = [
  {
    id: 'ALL-COMP-MIXED-01',
    section: 'Conditioning components and double days',
    anchorQuote: 'The app should not remove useful conditioning just because it is attached to a strength session.',
    statement: 'Meaningful strength and conditioning remain two real components when programmed together.',
    applicableScenarios: ['mixed-strength-aerobic'],
    expectation: { kind: 'required_components', components: ['strength', 'conditioning'] },
  },
  {
    id: 'ALL-COMP-TEAM-01',
    section: 'In-season ideal weekly structure',
    anchorQuote: 'tuesday upper body pull plus team training',
    statement: 'A team-training anchor combined with gym strength preserves both components and the exact strength intent.',
    applicableScenarios: ['team-training-plus-strength'],
    expectation: { kind: 'required_components', components: ['strength', 'team_training'] },
  },
  {
    id: 'ALL-TRUNK-SUPPORT-01',
    section: 'Core/trunk rules',
    anchorQuote: 'Core and carries are mostly secondary/accessory work.',
    statement: 'Pallof Press and Side Plank remain support work and never manufacture conditioning or main-pattern credit.',
    applicableScenarios: ['strength-plus-trunk-support'],
    expectation: {
      kind: 'trunk_support',
      supportRows: ['Pallof Press'],
      strengthPatterns: ['squat', 'push', 'pull'],
      forbiddenComponents: ['conditioning'],
    },
  },
  {
    id: 'ALL-RECOVERY-ADDON-01',
    section: 'General programming rules — optional recovery',
    anchorQuote: 'You can always add a recovery or mobility flow to any day as optional.',
    statement: 'An attached recovery add-on remains visible without replacing the useful primary session.',
    applicableScenarios: ['strength-plus-recovery-addon'],
    expectation: { kind: 'required_components', components: ['strength', 'recovery'] },
  },
  {
    id: 'ALL-COND-SECTION-01',
    section: 'Conditioning components',
    anchorQuote: 'A conditioning component is proper planned conditioning work that may sit on the same day as strength.',
    statement: 'Conditioning prescriptions remain separate from ordinary strength rows.',
    applicableScenarios: ['mixed-strength-aerobic'],
    expectation: {
      kind: 'conditioning_section',
      conditioningRows: ['Aerobic conditioning component (3 x 8min zone 2 Rower)'],
    },
  },
  {
    id: 'ALL-ACCESSORY-CREDIT-01',
    section: 'Strength balance rules',
    anchorQuote: 'Gunshow, accessories, prehab, mobility and recovery work are useful, but they do not replace proper upper or lower strength exposure.',
    statement: 'A visible Gunshow/accessory session earns no squat, hinge, push or pull main-pattern credit.',
    applicableScenarios: ['accessory-gunshow-only'],
    expectation: { kind: 'accessory_no_credit', expectedPatterns: [] },
  },
  {
    id: 'ALL-COMP-PROJECTION-01',
    section: 'Session and stress accounting',
    anchorQuote: 'The app should not treat every session as equal.',
    statement: 'Weekly and detail projections preserve the generated canonical component ledger without invention or loss.',
    applicableScenarios: [
      'mixed-strength-aerobic',
      'team-training-plus-strength',
      'strength-plus-trunk-support',
      'strength-plus-recovery-addon',
      'accessory-gunshow-only',
    ],
    expectation: { kind: 'projection_agreement' },
  },
];
