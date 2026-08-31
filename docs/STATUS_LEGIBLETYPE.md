# Readable typography seat

Owner: `legibletype`

## Scope

- Raise the three Day status explanations to 12pt with a 16pt line height.
- Audit athlete-facing production type and remove readable words below the
  iPhone 11pt minimum.
- Preserve intentionally non-text witnesses and the selected-tile checkmark
  glyph, which are not copy an athlete has to read.
- Do not change programming, copy, navigation, stored state or athlete actions.

## Starting measurement — 2026-08-31

- Shared main-app typography owner: 7 of 9 distinct non-heading/button tokens
  are below 11pt (`bodySmall`, `bodySmallEmphasis`, `caption`,
  `captionEmphasis`, `label`, `labelSmall`, `overline`).
- Athlete-facing screen/component source scan: 23 literal `fontSize` occurrences
  below 11pt across 9 distinct files, excluding Developer Tools. Two are
  invisible 1pt automation witnesses and one is the icon-only selected-tile
  checkmark; 20 occurrences render words an athlete may need to read.
- The named Day status detail is 9.5pt/13pt.

## Options compared

1. Raise only the three photographed lines and then patch matching screens one
   at a time. This fixes the screenshot but leaves the shared caption, label and
   overline tokens able to recreate the same problem elsewhere.
2. Raise the shared semantic typography floor once, then correct the remaining
   local styles and guard the complete production source census. This removes
   the repeat class while preserving the larger onboarding scale.

Option 2 is the selected route. Local layout changes are limited to places
whose readable words are currently below 11pt.

## NOT COVERED (starting boundary)

- No production edit, focused test result, deliberate mutation, simulator
  screenshot, physical iPhone, Dynamic Type or VoiceOver result yet.

## First guarded implementation

- Shared tokens below 11pt: 7 of 9 distinct non-heading/button tokens before,
  0 of 9 after.
- Local athlete-facing source: 23 below-floor literal occurrences across 9
  distinct files before; 3 occurrences across 3 distinct files after. The three
  remaining occurrences are exactly the two invisible automation witnesses and
  one icon-only selected-tile checkmark named by the guard.
- The Day status detail moved from 9.5pt/13pt to 12pt/16pt.
- All 20 readable local occurrences named by the first red run are now at least
  11pt. The withheld-session SKIP marker grew horizontally so its larger word
  is not squeezed back down inside the former checkbox-width box.

## Verification so far

- `test:prototype-typography`: the new scale and complete local-source floor
  cells pass. The command is 5 passed / 1 failed on an inherited census of five
  React Native Text imports; the same five names were present before this task.
- `test:day-first-timeline`: typography/status/week-card cells now pass. The
  command is 55 passed / 1 failed on its inherited generated-Gunshow fixture.
- `test:session-execution`: 206 passed / 0 failed.
- `test:onboarding-presentation`: 109 passed / 0 failed.
- The chained mobility diagnostic is 71 passed / 3 failed on its inherited
  source-shape expectations around the shared session section.

## NOT COVERED (current boundary)

- Deliberate liveness mutation, simulator screenshots, smallest supported phone,
  physical iPhone, Dynamic Type, VoiceOver and Android.
