import type { BibleStrengthRule } from '../types';

/**
 * Bible-authored expectations only.
 *
 * This file deliberately contains literal data. It must never import the
 * production allocator, classifiers, ledgers, naming helpers or projections.
 */
export const STRENGTH_BIBLE_RULES: readonly BibleStrengthRule[] = [
  {
    id: 'ALL-STR-BLOCK-01',
    section: '5. Strength programming rules — Strength balance rules',
    anchorQuote: 'LFA should make best efforts to balance the major strength patterns across the week and across each training block.',
    statement: 'A healthy block preserves meaningful squat, hinge, upper-push and upper-pull exposure.',
    applicableScenarios: [
      'is-healthy-5d-tt2-game-sat',
      'is-display-copy-non-authoritative',
    ],
    expectation: {
      kind: 'block_patterns',
      requiredPatterns: ['squat', 'hinge', 'push', 'pull'],
    },
  },
  {
    id: 'ALL-FULLBODY-01',
    section: '4. Session types — Full body',
    anchorQuote: '1 squat or hinge',
    statement: 'A normal full-body session contains one lower pattern, upper push and upper pull.',
    applicableScenarios: ['is-low-availability-full-body'],
    expectation: {
      kind: 'full_body',
      lowerPatternCount: 1,
      requiredUpperPatterns: ['push', 'pull'],
    },
  },
  {
    id: 'IS-STR-MIN-01',
    section: '1. Season phase rules — In-season',
    anchorQuote: 'lift 2x minimum per week',
    statement: 'A healthy, available in-season athlete retains at least two useful main-strength exposures.',
    applicableScenarios: [
      'is-healthy-5d-tt2-game-sat',
      'is-display-copy-non-authoritative',
    ],
    expectation: {
      kind: 'minimum_strength',
      minimumPerWeek: 2,
    },
  },
  {
    id: 'ALL-ACCESSORY-01',
    section: '5. Strength programming rules — Strength balance rules',
    anchorQuote: 'Gunshow, accessories, prehab, mobility and recovery work are useful, but they do not replace proper upper or lower strength exposure.',
    statement: 'Accessory, gunshow and prehab sessions receive no main-pattern credit.',
    applicableScenarios: [
      'is-healthy-5d-tt2-game-sat',
      'is-display-copy-non-authoritative',
    ],
    expectation: {
      kind: 'accessory_no_credit',
      expectedPatterns: [],
    },
  },
];
