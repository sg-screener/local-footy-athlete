export const PRESEASON_EXPOSURE_RULES = [
  {
    id: 'PS-EXPOSURE-CONTRACT-01',
    section: 'Session and stress accounting — weekly caps',
    anchorQuote: '4 main strength sessions per week',
    statement: 'Required pre-season strength and conditioning exposures are calculated before weekday placement.',
    applicableScenarios: ['preseason-exposure-first-six-day'],
  },
  {
    id: 'PS-RECOVERY-YIELDS-01',
    section: 'Strength balance rules',
    anchorQuote: 'Gunshow, accessories, prehab, mobility and recovery work are useful, but they do not replace proper upper or lower strength exposure.',
    statement: 'Recovery and optional placeholders cannot displace unresolved safe required exposure.',
    applicableScenarios: ['preseason-exposure-first-six-day'],
  },
  {
    id: 'PS-HARD-DAY-PREFERENCE-01',
    section: 'Session and stress accounting — hard days',
    anchorQuote: 'A hard day is a calendar day that contains one or more hard exposures.',
    statement: 'A preferred hard-day count cannot erase required strength or conditioning exposure.',
    applicableScenarios: ['preseason-exposure-first-six-day'],
  },
  {
    id: 'PS-TEAM-CONDITIONING-CREDIT-01',
    section: 'Conditioning philosophy',
    anchorQuote: 'Team training and games count as conditioning load. The app should not ignore them.',
    statement: 'Team training counts toward conditioning and field load, but not main-strength patterns.',
    applicableScenarios: ['preseason-exposure-first-six-day'],
  },
  {
    id: 'PS-ADDITIONAL-CONDITIONING-01',
    section: 'Session and stress accounting — conditioning caps',
    anchorQuote: '3-5 conditioning exposures per week',
    statement: 'Remaining conditioning after team-training credit is allocated or explicitly reduced for a typed reason.',
    applicableScenarios: ['preseason-exposure-first-six-day'],
  },
  {
    id: 'PS-EDGE-FALLBACK-EQUIVALENCE-01',
    section: 'Conditioning components and double days',
    anchorQuote: 'The app should not remove useful conditioning just because it is attached to a strength session.',
    statement: 'Edge and deterministic fallback preserve the same typed weekly exposure contract.',
    applicableScenarios: ['preseason-exposure-first-six-day'],
  },
] as const;
