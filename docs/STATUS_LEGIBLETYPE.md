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
  cells pass across 425 literal font-size occurrences in 65 distinct UI source
  files. The command is 5 passed / 1 failed on an inherited census of five
  React Native Text imports; the same five names were present before this task.
- `test:day-first-timeline`: typography/status/week-card cells now pass. The
  command is 55 passed / 1 failed on its inherited generated-Gunshow fixture.
- `test:session-execution`: 206 passed / 0 failed.
- `test:onboarding-presentation`: 109 passed / 0 failed.
- The chained mobility diagnostic is 71 passed / 3 failed on its inherited
  source-shape expectations around the shared session section.
- `test:compile`: product 0 errors, devtools 0 errors; the command remains red
  on 3 inherited test-harness errors across 2 distinct test files.
- `test:law-registry`: the updated typography law is guarded; current registry
  total is 218 laws, 197 guarded and 21 inherited UNENFORCED.

## First mutation finding

Lowering the shared `caption` token from 11pt to 10pt left the new scale cell
green. The old instrument sliced a fixed 260-character region after each style
anchor, so it found the next style's correct 11pt value and treated that as the
caption's. The mutation was real and the gate was blind.

The guard now extracts each named style only from its opening anchor through
its own closing brace, proving both anchors exist before checking size and line
height. The 10pt mutation will be rerun against that exact-block reader before
this task is accepted.

The rerun killed the shared-token mutation at the exact caption cell. A second
mutation lowered only the Day tile detail from 12pt to 10pt: the complete local
source census and the Day status-card cell both turned red, while the shared
token cell stayed green. Both mutations were restored by explicit reverse
patches; no checkout or whole-file restore was used.

The maintained census covers `.ts` and `.tsx` UI sources under screens,
components, navigation and theme; the starting one-off shell scan covered the
same production UI roots, so the guard is not narrower than the measurement.

## Simulator inspection — iPhone 17 Pro, iOS 26.3

One non-destructive Maestro flow kept the existing athlete data, traversed Day,
Week, Progress and Profile, and captured each surface. The flow completed every
step. Visual inspection found no clipped, overlapping or truncated text:

- Day: all three 12pt/16pt explanations fit inside equal tiles. Tired wraps to
  three lines; Sick and Injured remain balanced and the card keeps its bounds.
- Week: 11pt weekdays, tier badges and exercise counts fit all visible cards,
  including compound Strength + Team Training titles.
- Progress: enlarged captions fit the Load card and all four main-lift cards.
- Profile: setup labels and values remain aligned; the two-line Training
  Experience label is not clipped.

## NOT COVERED (current boundary)

- Smallest supported phone, physical iPhone, Dynamic Type, VoiceOver and Android.
- The five inherited shared-Text bypasses, generated-Gunshow fixture and three
  mobility source-shape failures; none was changed or treated as typography
  acceptance evidence.

## R-278 — Personal Injured-tile wording

- Sam directly replaced “Adapt training around an injury” with “Adapt training
  around your injury”. Tired and Sick remain unchanged.
- Two implementations were compared: hardcode the new sentence at the card, or
  update the existing signed-copy owner and bind its exact value in the Day
  card guard. The signed owner was selected so the shared component retains one
  copy source and the wording cannot diverge between callers.
- Test first: the exact-copy cell began red on the former “an injury” value;
  the separate inherited Gunshow fixture remained the only unrelated red.

## NOT COVERED (R-278 starting boundary)

- The focused Day-card cell now passes and signed-copy extraction is 7/7. The
  Day timeline command is 55 passed / 1 inherited generated-Gunshow failure;
  the law registry is 13 passed / 1 inherited failure for its 21 named
  UNENFORCED rows.
- The first simulator selector tried to locate the child Text by its exact
  sentence, but this composite accessible card exposes only its parent id to
  Maestro. That was an instrument miss, not a copy result: its failure
  screenshot visibly showed the new words. The rerun reached the stable
  `home-change-card` id, completed and captured `/tmp/lfa-injury-copy.png`.
- Visual inspection on iPhone 17 Pro / iOS 26.3 shows the new sentence in full
  over three balanced lines, with no clipping or collision; Tired and Sick are
  unchanged.

## NOT COVERED (R-278 current boundary)

- Deliberate post-commit mutation, physical iPhone, Dynamic Type, VoiceOver and
  Android.
