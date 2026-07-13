import type { GeneratedDomain, RegisteredRuleId } from '../types';

export interface GeneratedPropertySpec {
  id: string;
  domain: GeneratedDomain;
  statement: string;
  ruleIds: RegisteredRuleId[];
}

/** Literal Bible-authored relationships. Production adapters may observe them; this registry may not. */
export const GENERATED_PROPERTY_SPECS: readonly GeneratedPropertySpec[] = [
  { id: 'strength-order-insensitive', domain: 'strength', statement: 'Pattern order does not change meaning.', ruleIds: ['ALL-STR-BLOCK-01'] },
  { id: 'strength-primary-planned', domain: 'strength', statement: 'Primary strength is a planned pattern.', ruleIds: ['ALL-STR-BLOCK-01'] },
  { id: 'strength-secondary-additive', domain: 'strength', statement: 'Adding a valid secondary pattern cannot remove an existing pattern.', ruleIds: ['ALL-STR-BLOCK-01'] },
  { id: 'strength-scalars-nonauthoritative', domain: 'strength', statement: 'Display and scalar fields cannot overwrite typed intent.', ruleIds: ['ALL-STR-BLOCK-01', 'ALL-STORE-SCALAR-NONAUTH-01'] },
  { id: 'strength-effective-subset', domain: 'strength', statement: 'Effective patterns stay within planned intent absent authorised replacement.', ruleIds: ['ALL-STR-BLOCK-01'] },
  { id: 'strength-canonical-idempotent', domain: 'strength', statement: 'Canonicalisation is idempotent.', ruleIds: ['ALL-REBUILD-IDEMPOTENT-01'] },
  { id: 'components-mixed-both', domain: 'components', statement: 'Strength and conditioning both survive.', ruleIds: ['ALL-COMP-MIXED-01'] },
  { id: 'components-team-strength-both', domain: 'components', statement: 'Team training and strength both survive.', ruleIds: ['ALL-COMP-TEAM-01'] },
  { id: 'components-trunk-not-conditioning', domain: 'components', statement: 'Trunk support is not conditioning.', ruleIds: ['ALL-TRUNK-SUPPORT-01'] },
  { id: 'components-recovery-nondestructive', domain: 'components', statement: 'Recovery add-ons do not replace main components.', ruleIds: ['ALL-RECOVERY-ADDON-01'] },
  { id: 'components-order-insensitive', domain: 'components', statement: 'Component order does not change meaning.', ruleIds: ['ALL-COMP-PROJECTION-01'] },
  { id: 'conditioning-blocks-preserved', domain: 'conditioning', statement: 'Every meaningful conditioning block remains represented.', ruleIds: ['ALL-COND-EXPOSURE-01'] },
  { id: 'conditioning-second-modality-additive', domain: 'conditioning', statement: 'Adding a valid modality cannot delete the first.', ruleIds: ['ALL-COND-MULTI-01'] },
  { id: 'conditioning-running-honest', domain: 'conditioning', statement: 'Running identity requires running.', ruleIds: ['ALL-COND-MODALITY-01'] },
  { id: 'conditioning-offfeet-not-running', domain: 'conditioning', statement: 'Off-feet work cannot become running.', ruleIds: ['ALL-COND-MODALITY-01'] },
  { id: 'conditioning-not-strength-row', domain: 'conditioning', statement: 'Conditioning rows cannot remain in strength rows.', ruleIds: ['ALL-COND-SECTION-01'] },
  { id: 'power-contrast-heavy-family', domain: 'power', statement: 'Contrast requires final same-family heavy strength.', ruleIds: ['ALL-PWR-CONTRAST-01'] },
  { id: 'power-remove-heavy-invalidates', domain: 'power', statement: 'Removing the heavy lift invalidates Contrast.', ruleIds: ['ALL-PWR-CONTENT-01'] },
  { id: 'power-early-offseason-none', domain: 'power', statement: 'Early off-season resolves to no power.', ruleIds: ['OS-PWR-PHASE-01'] },
  { id: 'power-mid-no-contrast', domain: 'power', statement: 'Mid off-season never resolves to Contrast.', ruleIds: ['OS-PWR-PHASE-01'] },
  { id: 'power-idempotent', domain: 'power', statement: 'Canonicalisation cannot resurrect removed power.', ruleIds: ['ALL-PWR-CONTENT-01'] },
  { id: 'constraint-equipment-monotonic', domain: 'constraints', statement: 'Removing equipment cannot create a stronger requirement.', ruleIds: ['ALL-EQUIPMENT-COMPATIBLE-01'] },
  { id: 'constraint-equipment-additive', domain: 'constraints', statement: 'Adding equipment cannot erase valid intent.', ruleIds: ['ALL-EQUIPMENT-COMPATIBLE-01'] },
  { id: 'constraint-affected-only', domain: 'constraints', statement: 'Restrictions remove only affected content.', ruleIds: ['ALL-CONSTRAINT-AFFECTED-ONLY-01'] },
  { id: 'constraint-monotonic-exposure', domain: 'constraints', statement: 'Adding a restriction cannot increase prohibited exposure.', ruleIds: ['ALL-CONSTRAINT-AFFECTED-ONLY-01'] },
  { id: 'constraint-readiness-monotonic', domain: 'constraints', statement: 'Low readiness cannot increase hard load.', ruleIds: ['ALL-READINESS-DOWNGRADE-01'] },
  { id: 'placement-move-identity', domain: 'placement', statement: 'Moving preserves workout identity.', ruleIds: ['ALL-MOVE-IDENTITY-01'] },
  { id: 'placement-swap-identities', domain: 'placement', statement: 'Swapping preserves both identities.', ruleIds: ['ALL-SWAP-IDENTITY-01'] },
  { id: 'placement-array-order-nonauthoritative', domain: 'placement', statement: 'Array order is not programming identity.', ruleIds: ['ALL-MOVE-IDENTITY-01', 'ALL-SWAP-IDENTITY-01'] },
  { id: 'edits-invariants-after-each', domain: 'edits', statement: 'Canonical invariants hold after every edit.', ruleIds: ['ALL-EDIT-CANONICAL-01'] },
  { id: 'edits-independent-commute', domain: 'edits', statement: 'Independent edits commute semantically.', ruleIds: ['ALL-EDIT-CANONICAL-01'] },
  { id: 'edits-rehydrate-neutral', domain: 'edits', statement: 'Save and rehydrate between edits is neutral.', ruleIds: ['ALL-POST-REHYDRATE-WRITE-01'] },
  { id: 'edits-invalid-shape-blocked', domain: 'edits', statement: 'Invalid requested shapes cannot bypass canonical policy.', ruleIds: ['ALL-EDIT-CANONICAL-01'] },
];
