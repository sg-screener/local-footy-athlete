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

## R-164 — enlarge programmed-part headings only

Sam found **Mobility / Warm-up** and **Strength** too small beside the rest of
the Program Day card. Two options were compared:

1. Enlarge the existing shared timeline headline style. This would also enlarge
   Team Training's **Session status** metadata.
2. Add one programmed-part scale override and apply it only to the owned
   mobility row and projected programmed-part loop.

Option 2 landed. Both programmed headings now use the same 15px scale as **Need
to make a change?**, while exercise counts and Team Training status stay compact.

### Evidence

- TEST FIRST: `test:day-first-timeline` — 52/55; the new programmed-heading
  scale cell was the only additional red beside the two existing failures.
- AFTER: `test:day-first-timeline` — 53/55. The two existing failures remain
  the front-review mobility-flow handoff and the Gunshow fixture reachability.
- The guard requires exactly two render owners to use the larger scale, so a
  global change that also inflates Team Training status fails.
- `test:law-registry` — 11/14 with the same three existing reds: missing
  `test:game-feedback`, unregistered LR-18 and 21 UNENFORCED laws. The new row
  raises the measured registry to 169 laws / 148 guarded without increasing
  UNENFORCED.
- `test:ruling-registry` — 6/8 with its existing nine UNENFORCED rulings and 16
  uncited historical question sites. R-164 adds neither.
- `test:compile` — the concurrent baseline remains 483 errors and 60 worsened
  file/scope pairs. Neither changed source file is named.

### NOT COVERED

- Simulator pixels after the type change.
- Long translated headings and Dynamic Type.
- Physical-iPhone Release rebuild.

---

## R-165 — darken ordinary Week cards

Sam found Week view still used the lighter default card colour. Two options
were compared:

1. Give Week cards another copied dark colour. This would create a second token
   that could drift from Day view.
2. Reuse Day view's existing programmed-card surface on unselected Week rows,
   while excluding the selected current day and keeping edit feedback later.

Option 2 landed. Strength, Team Training, Rest Day and Game Day rows now share
the darker Day surface. Today's lime selection and move-target feedback remain
visible.

### Evidence

- TEST FIRST: `test:day-first-timeline` — 53/56; the new Week-surface cell was
  the only additional red beside the two existing failures.
- AFTER: `test:day-first-timeline` — 54/56. The two existing failures remain
  the front-review mobility-flow handoff and Gunshow fixture reachability.
- The guard pins surface reuse, selected-state ownership and override order.
- `test:law-registry` — 11/14 with the same three existing reds: missing
  `test:game-feedback`, unregistered LR-18 and 21 UNENFORCED laws. The new row
  raises the measured registry to 170 laws / 149 guarded without increasing
  UNENFORCED.
- `test:ruling-registry` — 6/8 with its existing nine UNENFORCED rulings and 16
  uncited historical question sites. R-165 adds neither.
- `test:compile` — the concurrent baseline remains 483 errors and 60 worsened
  file/scope pairs. Neither changed source file is named.

### NOT COVERED

- Simulator pixels after the surface change.
- Pressed-state and week-edit picker pixels.
- Physical-iPhone Release rebuild.

---

## R-166 — darken every Profile page card

Sam found Profile had the same lighter card colour. Two options were compared:

1. Change only Program Setup and the visible FAQ row. Support, Legal and Danger
   Zone would retain the old surface below the fold.
2. Give every Profile page section one named dark surface, while leaving setup
   sheets separate and preserving semantic green/red treatments.

Option 2 landed. Program Setup, FAQ, Support, Developer Tools, Legal and Danger
Zone now use one `#101010` page-card surface.

### Evidence

- TEST FIRST: `test:profile-reset-ui` — 171/172; the new whole-page surface
  cell was the only failure.
- AFTER: `test:profile-reset-ui` — 172/172.
- The guard separately pins Program Setup, the shared FAQ/Support row, both
  info-card mounts and Danger Zone's surface-before-border order.
- `test:law-registry` — 11/14 with the same three existing reds: missing
  `test:game-feedback`, unregistered LR-18 and 21 UNENFORCED laws. The new row
  raises the measured registry to 171 laws / 150 guarded without increasing
  UNENFORCED.
- `test:ruling-registry` — 6/8 with its existing nine UNENFORCED rulings and 16
  uncited historical question sites. R-166 adds neither.
- `test:compile` — the concurrent baseline remains 483 errors and 60 worsened
  file/scope pairs. Neither changed source file is named.

### NOT COVERED

- Simulator pixels after the surface change.
- Setup-sheet cards and the separate FAQ detail screen.
- Physical-iPhone Release rebuild.

---

## R-167 — Full athletic development

Sam replaced the first Welcome-card heading **Train everything that matters**
with **Full athletic development**. The body remains **Strength, speed,
conditioning and recovery.**

### Evidence

- TEST FIRST: `test:onboarding-presentation` — 93/95; the approved-copy and
  retired-copy cells were the only failures.
- AFTER: `test:onboarding-presentation` — 95/95.
- The guard requires the new heading and independently rejects the retired
  wording, so both an omission and a rollback fail.
- `test:law-registry` — 11/14 with the same three existing reds: missing
  `test:game-feedback`, unregistered LR-18 and 21 UNENFORCED laws. R-167 updates
  an existing guarded Welcome law, so the registry remains 171 / 150 guarded.
- `test:ruling-registry` — 6/8 with its existing nine UNENFORCED rulings and 16
  uncited historical question sites. R-167 adds neither.
- `test:compile` — the concurrent baseline remains 483 errors and 60 worsened
  file/scope pairs. Neither changed source file is named.

### NOT COVERED

- Simulator pixels and wrapping after the copy change.
- Physical-iPhone Release rebuild.

---

## R-168 — first-letter weekday row

Sam corrected the seven-across picker: it should show **M T W T F S S**, not
three-letter abbreviations. The fix lives in the shared single-row layout, so it
corrects both Game Day and usual gym days without changing Team Training's
3-3-1 picker.

### Evidence

- TEST FIRST: `test:onboarding-presentation` — 95/96; the new visual-label and
  accessibility cell was the only failure.
- AFTER: `test:onboarding-presentation` — 96/96.
- The guard requires the first-letter visual label, the full-day accessibility
  label and the unchanged default grid path together.
- `test:law-registry` — 11/14 with the same three existing reds: missing
  `test:game-feedback`, unregistered LR-18 and 21 UNENFORCED laws. R-168 updates
  an existing guarded weekday-row law, so the registry remains 171 / 150 guarded.
- `test:ruling-registry` — 6/8 with its existing nine UNENFORCED rulings and 16
  uncited historical question sites. R-168 adds neither.
- `test:compile` — the concurrent baseline remains 483 errors and 60 worsened
  file/scope pairs. Neither changed source file is named.

### NOT COVERED

- Simulator pixels after the label correction.
- Physical-iPhone Release rebuild.

---

## R-169 — Team Training matches the letter row

Sam required Team Training Days to use the same seven-across **M T W T F S S**
picker as Game Day and usual gym days. The screen now selects the shared layout;
its multi-select state, Continue rule and feedback copy are unchanged.

### Evidence

- TEST FIRST: `test:onboarding-presentation` — 96/97; the Team Training layout
  cell was the only failure.
- AFTER: `test:onboarding-presentation` — 97/97.
- The guard requires the Team Training screen to select the same shared layout,
  so its letters and geometry cannot drift independently.
- `test:law-registry` — 11/14 with the same three existing reds: missing
  `test:game-feedback`, unregistered LR-18 and 21 UNENFORCED laws. R-169 updates
  the existing guarded weekday-row law; the registry remains 171 / 150 guarded.
- `test:ruling-registry` — 6/8 with its existing nine UNENFORCED rulings and 16
  uncited historical question sites. R-169 adds neither.
- `test:compile` — the concurrent baseline remains 483 errors and 60 worsened
  file/scope pairs. Neither changed source file is named.

### NOT COVERED

- Simulator pixels after the layout correction.
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

---

## R-161 — centre generation icons horizontally

The old card geometry used 16px left padding, a 28px icon and a 10px gap. That
put the text at 54px but left the icon centre at 30px, so the empty space around
the icon was visibly uneven. Two options were compared:

1. Apply a one-off negative margin to nudge the icon left.
2. Make the entire 54px pre-text area an icon column and centre the icon in it.

Option 2 landed. The words remain at the exact same horizontal position, while
all three icons now share a real centred column. Vertical centring is unchanged.

### Evidence

- TEST FIRST: `test:onboarding-presentation` — 94/95; the new horizontal
  centring cell was the only failure.
- AFTER: `test:onboarding-presentation` — 95/95.
- The existing vertical icon structure and alignment cells remain green.
- `test:compile` remains at the concurrent baseline of 483 errors and 60
  worsened file/scope pairs; CompleteScreen is not named.
- `test:law-registry` — 11/14 with the same three existing reds; the updated
  generation-icon row remains guarded and UNENFORCED stays at 21.
- `test:ruling-registry` — 6/8 with the same nine UNENFORCED rulings and 16
  uncited historic question sites. R-161 adds neither.

### NOT COVERED

- Simulator reinspection after refresh.
- Dynamic Type wrapping.
- Physical-iPhone Release rebuild.

---

## R-162 — match all three Program Day-card surfaces

The programmed session already used the darker `dayRowCalm` surface
(`#101010`, border `#1F1F1F`). Team Training and the change card fell back to
the lighter default Card surface (`#161616`). Two options were compared:

1. Copy the dark colours into both lower-card styles.
2. Apply the programmed card's existing surface style to both lower cards.

Option 2 landed, so one token owns all three backgrounds and borders.

### Evidence

- BEFORE: `test:day-first-timeline` — 52/54 with two unrelated existing reds.
- TEST FIRST: 52/55; the new surface-sharing cell was the only additional red.
- AFTER: 53/55; only the same two unrelated mobility/Gunshow reds remain.
- The first post-fix run exposed a test-anchor fault: `<Card style` did not
  match formatted JSX with a newline. The corrected `<Card\\s+style` anchor
  reaches the real mount while retaining independent assertions for the shared
  token and both consumers.
- `test:compile` remains at the concurrent baseline of 483 errors and 60
  worsened file/scope pairs; neither HomeScreenV2 nor the edited suite is named.
- `test:law-registry` — 11/14 with the same three existing reds; the new row is
  guarded, raising guarded laws 145 → 146 without raising UNENFORCED (21).
- `test:ruling-registry` — 6/8 with the same nine UNENFORCED rulings and 16
  uncited historic question sites. R-162 adds neither.

### NOT COVERED

- Simulator reinspection after refresh.
- Week-view cards and the active Session-screen change hub.
- Physical-iPhone Release rebuild.

---

## R-163 — add the team-only training helper

The Team Training-only card now shows **"Have fun at training!"** through the
signed-copy sheet, in the same `expandedMeta` position as Game Day's **Good
luck!** line. The existing Log Session pop-up door was not changed.

### Evidence

- BEFORE: `test:day-first-timeline` — 52/54 with two unrelated existing reds.
- TEST FIRST: 52/55; the amended team-only cell was the only additional red.
- AFTER: 53/55; only the same mobility/Gunshow reds remain.
- `test:signed-copy-extraction` — 7/7.
- `test:copy-rulings-binding` — 9/9.
- `test:compile` remains at the concurrent baseline of 483 errors and 60
  worsened file/scope pairs; neither HomeScreenV2 nor projectionCopy is named.
- `test:law-registry` — 11/14 with the same three existing reds; the new row is
  guarded, raising guarded laws 146 → 147 without raising UNENFORCED (21).
- `test:ruling-registry` — 6/8 with the same nine UNENFORCED rulings and 16
  uncited historic question sites. R-163 adds neither.

### NOT COVERED

- Simulator reinspection after refresh.
- The logged team-only state and Team Training beside programmed work.
- Physical-iPhone Release rebuild.
