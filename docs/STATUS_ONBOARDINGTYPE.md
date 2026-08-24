# STATUS — ONBOARDING TYPOGRAPHY CONSISTENCY

Owner: `onboardingtype`

## What Sam found

The Season Phase choices were authored as `Off-season`, `Pre-season` and
`In-season`, but were rendered through the onboarding `h4` heading variant.
That variant uses the display heading face and forces uppercase, so answer text
was inheriting screen-heading presentation.

## Options compared

1. Override `textTransform` only on Season Phase. This fixes the visible case
   but leaves the wrong display font and seven separate answer-card recipes.
2. Give two-line onboarding answer cards one typography owner and move every
   existing consumer to it. This removes the whole drift class while preserving
   layout-specific card padding and authored copy.

Option 2 landed.

## Audit result

- One style-driven all-caps outlier: Season Phase (`h4`, 20px display face).
- One smaller alternate recipe: Gym Experience (16px semibold + 12px caption).
- Five duplicated copies of the dominant two-line answer recipe.
- Single-line choices, number grids and sliders are separate control shapes and
  retain their layout-specific alignment and sizing.

All seven two-line choice screens now read title and supporting-line typography
from `answerCardTitle` and `answerCardSubtitle`. The owner never forces casing.
Authored uppercase strings remain unchanged because they are copy, not style.

## Evidence

- TEST FIRST: `npm run test:onboarding-presentation` — 70/80; the new ten cells
  were the only failures.
- AFTER: `npm run test:onboarding-presentation` — 80/80.
- `npm run test:prototype-typography` — 4/5; its one existing failure names
  five athlete-facing shared-Text bypass files, none changed here.
- `npm run test:compile` — 484 total errors and 60 worsened file/scope pairs;
  none names a file changed here. This is the concurrent repo baseline, not a
  green compile claim.
- `npm run test:law-registry` — 11/14 cells; the three existing reds are the
  missing `test:game-feedback` script, one unregistered LR-18 guard and 21
  UNENFORCED laws. The new row is guarded and in-chain.
- `npm run test:ruling-registry` — 6/8 cells; the two existing reds are nine
  UNENFORCED rulings and 16 pre-existing uncited question sites. R-151 adds no
  match to either set.
- `npm run test:repo-law-guards` — 52/63 cells; 11 existing repo-process reds,
  none names this status file or a source file changed here.

## NOT COVERED

- Simulator pixels after the shared style change.
- Small-screen wrapping and Dynamic Type (font scaling is disabled app-wide).
- The next physical-iPhone Release build.
