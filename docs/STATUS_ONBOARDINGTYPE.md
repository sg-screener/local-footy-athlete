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

---

## R-155 — replace the gym-days slider with a wheel picker

Sam clarified that the reference interaction is a horizontal wheel, not a
rail-and-thumb slider. Two options were compared:

1. Add a visual variant to `DiscreteSlider`, mixing two unrelated interaction
   models inside the feedback control.
2. Give the centred wheel its own small reusable component and leave feedback
   sliders unchanged.

Option 2 landed. The picker opens on **4**, snaps 1–7 through the centre, and
animates scale and opacity continuously while the athlete drags. Tapping a
number also centres it. The offset-to-value calculation has a separate pure
owner so its rounding and edge clamping run headlessly.

### Evidence

- TEST FIRST: `test:onboarding-presentation` — 81/85; the four revised picker
  cells were the only failures against the rail-and-thumb screen.
- AFTER: `test:onboarding-presentation` — 86/86, including the added headless
  rounding and both-edge clamp cell.
- `test:effort-scale` — 42/42; feedback sliders and their 1–10 contract are
  unchanged.
- `test:compile` remains at the concurrent baseline of 483 errors and 60
  worsened file/scope pairs. Neither new picker file nor TrainingCommitment is
  named.
- `test:law-registry` — 11/14 with the same three existing reds: one missing
  script, one unregistered LR-18 guard and 21 UNENFORCED laws. The renamed law
  remains guarded and in-chain.
- `test:ruling-registry` — 6/8 with the same nine UNENFORCED rulings and 16
  uncited historic question sites. R-155 adds neither.

### NOT COVERED

- Simulator pixels and physical drag/tap feel.
- Small-screen clipping and Dynamic Type.
- Physical-iPhone Release rebuild.

---

## R-156 — remove the equipment-checklist footer text

Sam identified both notes below the equipment list as outdated. Deleting the
copy and its obsolete tap target is cleaner than hiding it visually: the screen
now ends at the final cardio-machine choice, then uses the existing Continue
button.

### Evidence

- TEST FIRST: `test:equipment-answer` — 41/43; the two new footer-removal cells
  were the only failures.
- AFTER: `test:equipment-answer` — 43/43.
- The guard rejects the retired copy, hidden Pressable and unused footnote
  style independently.
- `test:compile` remains at the concurrent baseline of 483 errors and 60
  worsened file/scope pairs. Neither EquipmentScreen nor its edited suite is
  named.
- `test:law-registry` — 11/14 with the same three existing reds; the new row is
  guarded, raising guarded laws 142 → 143 without raising UNENFORCED (21).
- `test:ruling-registry` — 6/8 with the same nine UNENFORCED rulings and 16
  uncited historic question sites. R-156 adds neither.

### NOT COVERED

- Simulator pixels and final vertical spacing after deletion.
- Physical-iPhone Release rebuild.

---

## R-157 — vertically centre generation-card icons

Sam found that each icon was centred against the title while the body sat in a
separate row below it. Two options were compared:

1. Add a one-off top offset to the icon.
2. Make each card one row: icon beside a text block containing title and body.

Option 2 landed. It remains correct when the sentence wraps because the icon is
centred against the text block's real height rather than a fixed pixel guess.

### Evidence

- TEST FIRST: `test:onboarding-presentation` — 86/88; the two new alignment
  cells were the only failures.
- AFTER: `test:onboarding-presentation` — 88/88.
- The guard pins the structure, the centred row, the flexible text block and
  removal of the old body-only left inset.
- `test:compile` remains at the concurrent baseline of 483 errors and 60
  worsened file/scope pairs. Neither CompleteScreen nor the edited presentation
  suite is named.
- `test:law-registry` — 11/14 with the same three existing reds; the new row is
  guarded, raising guarded laws 143 → 144 without raising UNENFORCED (21).
- `test:ruling-registry` — 6/8 with the same nine UNENFORCED rulings and 16
  uncited historic question sites. R-157 adds neither.

### NOT COVERED

- Simulator pixels and Dynamic Type wrapping.
- Physical-iPhone Release rebuild.

---

## R-158 — replace the first Welcome-card heading

Sam replaced **Built as one program** with **Train everything that matters**.
The existing short body remains unchanged.

### Evidence

- TEST FIRST: `test:onboarding-presentation` — 86/88; the exact-copy and
  retired-copy cells were the only failures.
- AFTER: `test:onboarding-presentation` — 88/88.
- `test:law-registry` — 11/14 with the same three existing reds; the updated
  Welcome law remains guarded and in-chain.
- `test:ruling-registry` — 6/8 with the same nine UNENFORCED rulings and 16
  uncited historic question sites. R-158 adds neither.

### NOT COVERED

- Simulator pixels and heading wrapping.
- Physical-iPhone Release rebuild.

---

## R-159 — make Game Day one seven-across row

Sam supplied the newer seven-across Game Day design while explicitly retaining
the app's more square rounded boxes. Two options were compared:

1. Render a second hard-coded weekday list inside GameDayScreen.
2. Give the canonical shared DayGrid an explicit single-row layout while
   retaining its existing 3-3-1 default.

Option 2 landed. Game Day now asks the shared owner for one horizontal row. At
this checkpoint the team-training and usual-gym-day screens were unchanged;
R-160 later makes usual gym days match while Team Training retains the default.
The instruction line is **"Select the day you play most often."**

### Evidence

- TEST FIRST: `test:onboarding-presentation` — 89/93; the four new requirements
  were the only failures.
- AFTER: `test:onboarding-presentation` — 93/93.
- `test:game-anchor` — its whole-week picker cell remains green; suite 13/15 on
  the same unrelated midweek-generation and deleted-reader findings.
- The guard requires canonical seven-day mapping in one container, compact
  flex-one square geometry, rounded rather than circular tiles, the exact
  instruction and retention of the other screens' 3-3-1 default.
- `test:compile` remains at the concurrent baseline of 483 errors and 60
  worsened file/scope pairs; neither GameDayScreen nor DayGrid is named.
- `test:law-registry` — 11/14 with the same three existing reds; the new row is
  guarded, raising guarded laws 144 → 145 without raising UNENFORCED (21).
- `test:ruling-registry` — 6/8 with the same nine UNENFORCED rulings and 16
  uncited historic question sites. R-159 adds neither.

### NOT COVERED

- Simulator pixels and small-screen clipping.
- Dynamic Type.
- Physical-iPhone Release rebuild.

---

## R-160 — make usual gym days match Game Day

The usual gym-day picker now requests the same shared seven-across
rounded-square layout as Game Day. No second layout or weekday list was added,
and the existing up-to-N cap, dimming and Continue transaction were untouched.

### Evidence

- TEST FIRST: `test:onboarding-presentation` — 93/94; the new usual-gym-days
  row cell was the only failure.
- AFTER: `test:onboarding-presentation` — 94/94.
- The earlier Game Day layout cells and the shared 3-3-1 default cell remain
  green.
- `test:compile` remains at the concurrent baseline of 483 errors and 60
  worsened file/scope pairs; neither PreferredTrainingDays nor DayGrid is named.
- `test:law-registry` — 11/14 with the same three existing reds; the updated
  row remains guarded and UNENFORCED stays at 21.
- `test:ruling-registry` — 6/8 with the same nine UNENFORCED rulings and 16
  uncited historic question sites. R-160 adds neither.

### NOT COVERED

- Simulator pixels and multi-selection feel.
- Small-screen clipping and Dynamic Type.
- Physical-iPhone Release rebuild.
