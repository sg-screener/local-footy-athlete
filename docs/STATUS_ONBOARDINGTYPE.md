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

---

## R-152 — retire the team-session intensity question

Sam removed the **“What are team sessions like?”** onboarding step. Two options
were compared:

1. Hide the live screen and leave its required answer, Review row, dead route
   and estimate seed behind.
2. Retire the answer end to end: delete both obsolete screens, remove the
   routes and required step, advance straight from team-training days to gym
   availability, remove the Review row, and let completed-session feedback be
   the only team-size evidence.

Option 2 landed. Existing stored duration/intensity fields remain on the profile
only so old data can still be read; no new onboarding door writes either.

The earlier typography audit now has six live two-line answer-card consumers;
the seventh audited consumer was the obsolete intensity screen deleted here.

### Evidence

- TEST FIRST: `test:onboarding-presentation` — 79/83, four new removal cells
  red; AFTER — 83/83.
- TEST FIRST: `test:team-night-size` — 50/54, four flow-removal cells red;
  AFTER — 50/50 with the old seed tests replaced by feedback-only truth.
- `test:onboarding-field-influence` — 26/28; the two existing unrelated reds
  are `ageRange` and `trainingLocation`. Both retired team-session answers pass
  their no-consumer and no-collector checks.
- `test:onboarding-reliability` — 23/24; the fresh full journey, resume order,
  completeness and generation fields pass. Its one existing red is the
  persisted-store gate failing to parse `blockSelectionHistoryStore.ts`.
- `test:dead-affordances` — 6/6 across 96 remaining screen sources.
- `test:dev-onboarding-skip` — 7/7; `test:profile-reset-ui` — 171/171.
- `test:compile` — 483 total baseline errors and 60 worsened file/scope pairs;
  no changed product file is named. The edited onboarding reliability test
  improves from five type errors to four.
- `test:law-registry` — 11/14 with the same three existing reds; the new row is
  guarded and raises guarded laws 141 → 142 without raising UNENFORCED (21).
- `test:ruling-registry` — 6/8 with the same nine UNENFORCED rulings and 16
  uncited historic question sites; R-152 adds neither.
- `test:prototype-typography` — 4/5; the remaining five shared-Text bypasses
  are unchanged and outside onboarding.
- `test:onboarding-cold-start` could not reach this flow: its existing accepted-
  state transaction crash (`calendarStore` receives an undefined map) fails the
  scenarios before onboarding route acceptance. No cold-start pass is claimed.

### NOT COVERED

- Simulator pixels and a cold-start walkthrough after deletion.
- Physical-iPhone Release rebuild.
- The derived team-night size has no production programming consumer today;
  this change makes its source honest but does not claim feedback already
  changes a future program.

---

## R-153 — shorten the first Welcome card

Sam asked for the first card to end after **recovery** and for **Everything
works together** to be replaced. Two options were compared:

1. Change only the body and leave the generic heading.
2. Shorten the body and make the heading describe the product structure.

Option 2 landed: **Built as one program** / **Strength, speed, conditioning and
recovery.** This removes the repeated season explanation while preserving the
point of the card.

### Evidence

- TEST FIRST: `test:onboarding-presentation` — 81/83; the two revised Welcome
  copy cells were the only failures.
- AFTER: `test:onboarding-presentation` — 83/83.
- The same guard rejects both retired first-card strings independently.
- `test:law-registry` — 11/14 with the same three existing reds: one missing
  script, one unregistered LR-18 guard and 21 UNENFORCED laws. The updated law
  remains guarded and in-chain.
- `test:ruling-registry` — 6/8 with the same nine UNENFORCED rulings and 16
  uncited historic question sites. R-153 adds neither.

### NOT COVERED

- Simulator pixels and small-screen wrapping after the copy change.
- Physical-iPhone Release rebuild.

---

## R-154 — left-align Position choices

Sam asked to uncentre the five Position choices. The direct screen-level fix is
the elegant option here: Position owns this list geometry, while the shared
SelectableTile continues to own the selected border, fill and top-right tick.

### Evidence

- TEST FIRST: `test:role-buckets` — 52/54; the two new alignment cells were the
  only failures.
- AFTER: `test:role-buckets` — 54/54.
- The guard separately pins the tile content alignment and the label's text
  alignment.
- `test:law-registry` — 11/14 with the same three existing reds: one missing
  script, one unregistered LR-18 guard and 21 UNENFORCED laws. The updated law
  remains guarded and in-chain.
- `test:ruling-registry` — 6/8 with the same nine UNENFORCED rulings and 16
  uncited historic question sites. R-154 adds neither.

### NOT COVERED

- Simulator pixels after the alignment change.
- Physical-iPhone Release rebuild.
