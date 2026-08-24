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

## R-173 — anchor Off-season to the athlete's real finish date

### LOOP CHECK

No repeated implementation loop. This is a new athlete-owned calendar fact
feeding the existing season clock; it does not add a second subphase system.

### Options compared

1. Ask the athlete to choose early, mid or late Off-season and persist that
   bucket. It is quick, but becomes stale immediately as weeks pass.
2. Store the exact season-finish date and derive the phase week through the
   existing clock. This removes a parallel answer and keeps every later week
   deterministic.

Option 2 landed. The first complete Monday after the final day is Phase Week 1.
Weeks 1–2 remain early, 3–4 mid and 5 onward late under the already signed
Bible policy. A not-sure answer remains explicit null and uses the honest
recently-finished fallback.

The question is conditional after choosing Off-season, appears on Review, and
is also asked by the existing season-shift sheet before rebuilding into
Off-season. One shared three-field date control and one validation owner serve
both surfaces. Real generation reads the saved date, and an exact answer
outranks a stale same-phase clock.

### Evidence

- TEST FIRST: the clock/generation cells began at a missing-export load red;
  the four onboarding presentation cells were the only new reds at 97/101;
  the conditional resume cell was the reliability suite's only new red.
- `test:season-finish-date` — 12/12, including impossible/future dates,
  following-Monday ownership, mid/late derivation, stale-clock correction,
  not-sure fallback, real generation and both phase-shift answer shapes.
- MUTATION: removing `seasonFinishedOn` from the real generation boundary
  reddened the named generation cell; restoring it returned the tape to 12/12.
- `test:onboarding-presentation` — 101/101.
- `test:profile-reset-ui` — 173/173.
- `test:onboarding-generation-outcome` — 50/50.
- `test:settings-persistence` — 187/187.
- `test:onboarding-reliability` — 23/24; its one existing red is the persisted-
  store parser for `blockSelectionHistoryStore.ts`.
- `test:compile` — the concurrent baseline remains 483 errors across 60
  worsened file/scope pairs; zero feature file errors.
- `test:law-registry` — 11/14, 175 rows / 154 guarded / 21 UNENFORCED. R-173's
  row is guarded and introduces no additional registry red.

### What catches the next defect of this class

The conditional step registry makes a missing answer block Review; the focused
generation tape proves the saved date reaches the real season clock and checks
both edit-door answer shapes. A future date-entry surface must reuse those same
owners or the presentation/profile guards and clock tape diverge red.

### NOT COVERED

- Simulator pixels, keyboard next-field behaviour and small-screen layout.
- Locale-specific date formatting beyond the Australian DD/MM/YYYY display.
- Editing the date from Profile while already inside Off-season; the live flow
  covers entering Off-season and onboarding Review covers pre-generation edits.
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

---

## R-170 — minutes-only feedback with stopwatch handoff

The stored duration was already total minutes, but every form split it into
Hours and Minutes and rebuilt the total on save. The strength timer also only
prefilled after End: Pause persisted its timestamps but the form did not read
them, and Log Session opened feedback without capturing the running timer.

Two options were compared:

1. Keep the split fields and thread timer values through screen callbacks.
2. Display the stored unit directly and make the stopwatch store answer for one
   exact workout/date across paused, ended and Log Session paths.

Option 2 landed. Team Training, Game and strength feedback each have one editable
Minutes field. Pause is durably readable, End stores the result, and Log Session
finalises the opened workout before showing feedback. A saved manual answer wins;
no timer leaves the field blank.

### Evidence

- `test:session-logging-ui` — 25/25, then its in-chain duration tape 14/14.
- Three liveness mutations each reddened the intended claim: removed Log Session
  capture (1 red), date-only timer matching (1 red), and a Game Hours regression
  (2 reds).
- `test:journal-load` — 125/125; `test:training-logging` — 12/12;
  `test:workout-log-progression-wiring` — 34/34;
  `test:session-outcome-control` — 5/5.
- `test:session-execution` — 194/199. Its hours/minutes cell now passes; the five
  remaining failures are the same unrelated chevron, stale team-result,
  equipment-sheet and date-line cells.
- `test:compile` remains at the concurrent baseline of 483 errors and 60
  worsened file/scope pairs; none names a changed product file in this slice.
- `test:law-registry` — 11/14 with its same three existing reds. The new row
  raises guarded laws 150 → 151 without increasing UNENFORCED (21).
- `test:ruling-registry` — 6/8 with the existing nine UNENFORCED rulings and 16
  uncited historical question sites. R-170 adds neither.

### NOT COVERED

- Simulator keyboard/layout pixels after collapsing each pair to one field.
- A real-time start/pause/end/log walk on glass, including relaunch while paused.
- The next physical-iPhone Release rebuild.

---

## R-177 — remove the duplicate Profile page header

Profile now uses the same compact hierarchy as the other main tabs: the shared
LFA wordmark is followed directly by **Program Setup**. The redundant
**Profile** heading and its orphaned subtitle were removed together, along with
their dead styles.

### Evidence

- TEST FIRST: `test:lfa-wordmark` moved from 13/13 to 13/14; the one new red
  named the duplicated Profile heading/subtitle.
- AFTER: `test:lfa-wordmark` is 14/14.
- LIVENESS: temporarily restoring a visible `PROFILE` heading made the new cell
  fail at 13/14; removing the mutation returned it to green.
- The older `test:profile-reset-ui` expectations were inverted to guard the
  new hierarchy and the full suite remains 173/173.
- LIVE SIMULATOR: after clearing a stale DevE2E clock receipt and reloading the
  app, Profile shows the LFA wordmark directly above **Program Setup** with no
  duplicate heading, subtitle or leftover gap.
- Registry baselines are unchanged: law registry 177 rows / 156 guarded / 21
  `UNENFORCED` with the same three inherited reds; ruling registry 176 rulings
  with the same two inherited reds.

### NOT COVERED

- The next physical-iPhone Release rebuild.
- Real VoiceOver reading order.

---

## R-178 — let the Coach ask the question directly

Removed the visible *“Your coach has something to ask about your week.”*
preamble bubble. The real weekly question now follows the greeting directly.
The derived tab dot and its accessibility announcement remain intact.

### Evidence

- TEST FIRST: the weekly-reduction mount cell was changed to require the real
  question and forbid the preamble test ID; it failed while the Bubble remained.
- AFTER: that named cell passes and the question/card still share the same live
  conversation guard.
- LIVENESS: temporarily restoring the real signed preamble Bubble made that
  named cell fail; removing the mutation returned it to green.
- `test:signed-copy-extraction`: 7/7.
- LIVE SIMULATOR: Coach now shows its greeting followed immediately by the
  weekly question; the generic announcement bubble is absent and the choice
  card is unchanged.
- The full weekly-reduction tape still hits its inherited R-173 fixture failure
  and later section-[7] crash; the R-178 cell executes and passes before it.
- Registry baselines: 178 laws / 157 guarded / 21 `UNENFORCED` with the same
  three inherited reds; 177 rulings with the same two inherited reds.

### NOT COVERED

- The next physical-iPhone Release rebuild.
- Real VoiceOver speech.

---

## R-179 — Profile goal label and edit-button treatment

Changed **Main goal / focus** to **Main goal/s**. The setup-change action now
uses the established dark rounded edit-button shape, with a small lime pencil
and white label, while keeping the same guided setup-sheet door.

### Evidence

- TEST FIRST: two new Profile cells produced exactly two reds: the old label
  and the old flush-footer treatment.
- AFTER: `test:profile-reset-ui` 174/174; chained `test:lfa-wordmark` 14/14.
- Registry baselines: 179 laws / 158 guarded / 21 `UNENFORCED` with the same
  three inherited reds; 178 rulings with the same two inherited reds.

### NOT COVERED

- Physical-iPhone Release and Sam's visual acceptance.
- Real VoiceOver speech.

---

## R-180 — extend the wordmark to workout detail and My Status

Programmed workout detail now uses the shared LFA wordmark in place of its
generic top title; its Mobility / Warm-up, Strength and Conditioning section
headings are unchanged. My Status now shows the same wordmark before its status
content.

### Evidence

- TEST FIRST: two new wordmark cells produced exactly two reds.
- AFTER: `test:lfa-wordmark` 15/15; in-chain `test:profile-reset-ui` 174/174.
- The workout keeps the stable `day-workout-title` test coordinate on the logo.
- Registry baselines: 179 laws / 158 guarded / 21 `UNENFORCED` with the same
  three inherited reds; 179 rulings with the same two inherited reds.

### NOT COVERED

- Physical-iPhone Release and Sam's visual acceptance.
- Real VoiceOver speech.

---

## R-174 — one quick-action system across every exercise row

Sam restored row-level Swap/Remove as explicit shortcuts. The implementation
does not restore the deleted private row editor: every row renderer delegates to
one `QuickExerciseActions` component, the established tap-swap hierarchy, the
durable ProgramControlAction door, the decision ledger and the existing
exclusion/Undo owners.

Derived D17 warm-ups and optional recovery add-ons needed one structural change:
their edits are stored as ledger decisions and folded into the live projection.
No copied warm-up or recovery list is persisted. The source slot id survives a
swap, so repeated taps remain attached to the original slot and advance through
one ranked list.

### Evidence

- TEST FIRST: the new tape initially stopped on the missing projection module;
  after the pure decision fold existed it reached 13/22, with the nine remaining
  reds all naming absent UI/prompt wiring.
- `test:quick-exercise-actions` — 34/34. It covers real Strength, Mobility and
  Conditioning ranking/family retention, repeated A→B→C→A choice,
  exact-date isolation, reversal, derived warm-up swap/remove, optional recovery
  swap/remove, stable ids, every live row renderer, icon identity and the
  post-remove replacement ask, top-right icon geometry/size, bottom-right
  completion placement without added card height, exact checkbox/weight-control
  centring, the single-circle Remove glyph, the session-wide hub retaining only
  Equipment/Injury/Add, and the ledger-only durable branch.
- MUTATION: changing the exhausted-list wrap from first-ranked back to the
  second answer made the A-after-wrap cell red (21/22); restoring it returned
  the then-22-cell tape to green; the final six real-family cells bring it to
  28/28.
- `test:mobility-flow` — 59/59 and now invokes the quick-action tape from the
  `test:bible` chain.
- `test:compile` remains at 483 errors / 60 worsened pairs, the measured shared
  baseline. Its four `programControlActions.ts` errors are in the pre-existing
  equipment-availability block, outside this diff; it names neither new module
  nor the changed Day/Home screens.
- `test:exercise-removal-owner` remains 32/35 on its three pre-existing restart
  reds.
- LIVE SIMULATOR: the first D17 tap initially failed because the material-program
  transaction correctly found no stored row and refused before the ledger could
  append. The corrected ledger-owned path then advanced the same stable row from
  `Hip 90/90 Stretch` → `Cat-Cow` → `World’s Greatest Stretch`; Remove opened
  the replacement question, **No** left it out, and **Yes** opened populated
  Closest Matches / Similar Options groups. The photographed row has Swap/Remove
  top right at the exercise-name glyph size and its checkbox bottom right.
  The follow-up layout correction puts that checkbox in the same absolute
  control row as the weight toggle, so their centres coincide without making
  the card taller; Remove now draws only the outer red button and its minus.

### NOT COVERED

- VoiceOver reading order and the next physical-iPhone Release rebuild.

---

## R-176 — Quick Remove stays pending until the athlete decides

Quick Remove now opens one pending decision and writes nothing. **Go back**
closes it with the original row intact; **No, remove it** reaches the durable
remove door; **Yes, show replacements** keeps the row while showing the ranked
list, then commits the chosen answer as one swap instead of remove-plus-add.
The duplicated exercise-name subtitle is gone.

### Evidence

- TEST FIRST: the expanded quick-action tape began 34/40; six reds named the
  eager write, direct row wiring, missing three-way choice, duplicate subtitle,
  delayed removal commit and remove-plus-add replacement.
- AFTER: the first correction reached 40/40. The simulator then caught a typed
  warm-up slot being ranked from its ambiguous exercise name and offering
  Strength work. Two real-row family cells began 41/42; the shared ranking owner
  now accepts the row's typed family, and the completed tape is 43/43. Its
  in-chain parent `test:mobility-flow` is 59/59 before running those same cells.
- LIVENESS: routing one live exercise family back to the eager remove door made
  the pending-routing cell fail (39/40); restoring the request-only owner
  returned 40/40. Removing the typed-family input from one of its two live
  ranking callers made the caller-totality cell fail (42/43); restoring it
  returned 43/43.
- LIVE SIMULATOR: the pending sheet shows one exercise name, **Yes**, **No** and
  one **Go back** exit. After Go back, the photographed row remains. The ranked
  replacement list opens with the original row still visible behind it, and a
  selected answer lands as one visible replacement rather than an empty slot.
- Targeted TypeScript output names no changed-file error. The session-shell
  suite remains at its inherited 58/59: its source scan counts the existing
  feedback Sheet in DayWorkoutScreenV2, unrelated to this edit flow.
- Registry baselines are unchanged apart from this new ruling: law registry
  177 rows / 156 guarded / 21 `UNENFORCED` with the same three reds; ruling
  registry 175 rulings / 6 of 8 checks green with the same two reds.
- `test:exercise-add-candidates` remains unrunnable before its first cell: its
  existing fixture reaches the current gender-required generation gate without
  a gender answer. It supplied no regression signal for this change.

### NOT COVERED

- A physical-iPhone Release and real VoiceOver speech.
- Restarting the app on glass after committing either choice; the same durable
  swap and removal doors remain covered headlessly by their existing tapes.

---

## R-175 — one supplied LFA wordmark across the four main tabs

The black and white files carry identical geometry and differ only by fill. One
`LfaWordmark` vector owner now preserves the supplied three paths and accepts a
colour; white is the dark-app default. Program, Coach, Progress and Profile all
render it top-left. Coach and Progress no longer draw fake italic text, and
nested workout detail deliberately stays unbranded so its back/title hierarchy
remains primary.

### Evidence

- TEST FIRST: `test:lfa-wordmark` began 1/13; twelve reds named the missing
  owner, exact SVG contract, four mounts and fake-text retirement.
- AFTER: `test:lfa-wordmark` is 13/13. It runs after `test:profile-reset-ui`,
  whose own 173 checks remain green.
- LIVENESS: changing the shared `viewBox` from `871` to `870` made the exact
  geometry cell fail (12/13); restoring the supplied value returned 13/13.
- LIVE SIMULATOR: one Maestro route opened Coach, Progress, Profile and Program
  and captured each tab. The wordmark is visible top-left on all four; Coach's
  My Status remains opposite it and the other screen titles/controls remain
  below it.
- Targeted TypeScript output names no wordmark error. Its five HomeScreenV2
  errors are the existing `TemporarySourceFact.factId` failures in the unrelated
  modifier block.
- Registry measurements remain at their inherited baseline: law registry 177
  rows / 156 guarded / 21 `UNENFORCED` with the same three red checks; ruling
  registry 174 rulings / 6 of 8 checks green with the same two inherited reds.

### NOT COVERED

- The next physical-iPhone Release and real VoiceOver speech.
- A future light surface using the black tint, onboarding/splash branding and
  non-phone widths.

---

## R-171 — preserve added-session identity on team nights

The photographed failure was not a Day-screen wording error. The shared Add
materialiser deliberately cleared composed-session identity whenever it stacked
two workouts. That is correct for two gym sessions whose parts must name
themselves, but wrong when the existing workout is Team Training-only: Team
Training is an anchor beside the added session, not another gym component.

Two options were compared:

1. Teach the Day renderer to recognise Recovery exercises and rename the box.
2. Preserve the added template's typed identity at the one stack owner only
   when the base is Team Training-only, then let every downstream reader consume
   that fact.

Option 2 landed. Recovery promotes its existing Recovery workout type into the
same marker already owned by Mobility, Gunshow, Accessories and Primer. True
mixed gym stacks still clear the marker, preserving the earlier projection law.

### Evidence

- `test:athlete-door-matrix` adds one real 10-category x 2-destination cell:
  all live Add categories go through the production transaction onto an empty
  day and a Team Training-only day, then through the real visible projection.
- For Recovery, Mobility, Gunshow, Accessories and Primer, row name and
  prescription signatures are equal across both destinations. This holds the
  photographed content-shrink defect as well as the title.
- The Team Training anchor survives every team-night add and is absent from
  every free-day result.
- MUTATION: forcing the stack owner back to `composedOptionalKind: undefined`
  reddened the new cell at `team_only_night/recovery: Recovery has no
  exercises`; restoring the owner returns it to green.
- Full `test:athlete-door-matrix`: 419/434, versus measured baseline 418/433;
  the same 15 existing reds remain (one scoped-power move and 14 sprint
  placement coordinates).
- `test:session-components`: 33/39 versus measured baseline 29/36. Its new
  Recovery/Mobility + Team cells pass and one old low-load combination red is
  removed; the remaining six power/support cells are existing reds.
- `test:surface-agreement` 5/5; `test:session-type-charter` 44/44;
  `test:recovery-template` 39/39; `test:primer-session` 27/27;
  `test:mobility-accessory-doors` 31/31.
- Existing adjacent reds remain existing: `test:day-first-timeline` 54/56;
  `test:plan-change-producer` is stale against the expanded template count and
  required onboarding profile; `test:workout-canonicalisation` has its existing
  hinge failure and stale undefined validator import.

### NOT COVERED

- Simulator or physical-iPhone pixels.
- Starting, completing and logging all 20 added-session/destination combinations.
- Accumulated multi-edit weeks beyond the matrix's accepted team-only and empty
  destination states.
- The next physical-iPhone Release rebuild.

---

## R-172 — share the Week Game Day trophy with Add a game

The Week Game Day row already renders the app's shared `RowIcon` game trophy.
The Edit-this-week action independently chose Material Community Icons'
`trophy-outline`, creating the visible mismatch Sam found.

Two options were compared: choose a closer library trophy, or delete the second
icon decision and use the established Game Day owner. The shared owner landed;
the sheet retains its existing 18px action-row size and reads the same amber
colour owner as the Week row.

### Evidence

- TEST FIRST: `test:day-first-timeline` moved from its existing 54/2 baseline to
  53/3; the only added red named the Week edit icon treatment.
- AFTER: `test:day-first-timeline` returned to 54/2. Its two existing
  mobility-warm-up and generated-Gunshow reds are unchanged.
- `test:approved-icons` remains at its existing 24/2 baseline.

### NOT COVERED

- Simulator reinspection and optical alignment in the Edit-this-week row.
- The next physical-iPhone Release rebuild.

---

## R-181 — put Day plan actions in the change card

The separate Day *Want to change something?* link and the dedicated session
Swap route were two ways into one editing system. The Day card is now the one
visible owner: Tired, Sick, Injured, Add, Move and Remove. Week keeps Add, Move
and Remove and no longer offers a separate Swap action. The open workout hub
remains Equipment, Injury and Add.

The move producer now returns an explicit placement fact: `move`, `combine` or
`swap`. A Team Training destination derives `combine` from the projected typed
parts, so moving strength there preserves Team Training and tells the athlete it
joins the day. An ordinary occupied destination remains a legal `swap`.

### Evidence

- `test:session-change-hub`: 58/58.
- `test:day-first-timeline`: 54/56, its exact pre-change baseline; the two
  existing mobility-warm-up and generated-Gunshow reds are unchanged.
- `test:move-scoping`: 17/18; the new combine and ordinary-swap cells pass. Its
  one existing unanchored multi-kind fixture red is unchanged.
- MUTATION: removing the Team Training projected-part classifier changed
  `test:move-scoping` from 17/1 to 16/2 and named Strength -> Team Training as
  `swap`, then restoration returned the new cell to green.
- `test:compile`: concurrent baseline remains 483 errors / 60 worsened
  file-scope pairs; none of this slice's changed product files is named.

### NOT COVERED

- Simulator or physical-iPhone pixels (Sam requested no screenshot loop).
- A real multi-edit sequence trading two ordinary occupied sessions.
- VoiceOver order and the next physical-iPhone Release build.

---

## R-182 — make Profile setup change a primary button

The dark rounded Profile edit control still blended into its card. It now uses
the exact shared medium primary-button primitive used by Start Session: lime
fill, black label, black 18-point pencil and the existing full-width geometry.
Profile owns only the small inset margins, so the button treatment cannot drift
from the app's primary action owner.

### Evidence

- TEST FIRST: the new treatment cell made `test:profile-reset-ui` 173/1 against
  the dark control.
- AFTER: `test:profile-reset-ui` is 174/174 and its chained LFA wordmark tape is
  15/15.

### NOT COVERED

- Simulator or physical-iPhone pixels (Sam requested no screenshot loop).
- Real VoiceOver speech and the next Release rebuild.

## R-183 — align the Profile setup flow

The setup flow was using the generic `#141414` popup surface across almost the
whole phone, while Profile behind it uses the app's near-black background and
darker cards. Changing the global Sheet would have restyled every popup, so the
flow now passes a local Profile surface into the shared Sheet instead.

The flow background is `colors.surface.primary`; summary and edit rows use the
same `#101010` surface and 12-point radius as Profile cards. Labels now use the
Profile 13/600/18 scale, values use 14/600/20, row padding matches Profile, and
edit actions use the established 15-point action scale. Shared popup headers,
buttons, keyboard ownership and selection controls remain unchanged.

### Evidence

- TEST FIRST: the setup-style cell made `test:profile-reset-ui` 174/1.
- AFTER: `test:profile-reset-ui` is 175/175 and the chained wordmark tape is
  15/15.

### NOT COVERED

- Simulator or physical-iPhone pixels (Sam requested no screenshot loop).
- Small-screen text wrapping, real VoiceOver speech and the next Release build.

---

## R-184 — remove the Profile setup button pencil

The **Something changed? Tell the coach** wording already explains the action,
so its decorative pencil has been removed. The full-width lime shared button,
label, press behaviour and accessibility label are unchanged.

### Evidence

- TEST FIRST: the bounded CTA cell made `test:profile-reset-ui` 174/175 against
  the existing pencil.
- AFTER: `test:profile-reset-ui` is 175/175 and its chained LFA wordmark tape is
  15/15.

### NOT COVERED

- Simulator or physical-iPhone pixels (Sam requested no screenshot loop).
- Real VoiceOver speech and the next Release rebuild.

---

## R-185 — make Profile setup a real page

The setup review is no longer hosted by the modal Sheet. Profile now swaps its
main content for a full-height setup subpage, following My Status' existing
tab-local page pattern. The tab bar stays present; the top-left Back button exits
from the overview and walks backwards through nested edit steps.

The one existing setup decision and profile-program transaction remain in
place. Equipment keeps its focused editor, but that editor now closes back onto
the setup page instead of dropping the athlete at Profile home.

### Evidence

- TWO OPTIONS COMPARED: a new stack route would require extracting the setup's
  coupled draft state and transaction into another screen; the established My
  Status-style local subpage removes the popup without creating another state
  owner.
- TEST FIRST: five page-ownership cells made `test:profile-reset-ui` 171/176
  against the Sheet implementation.
- AFTER: `test:profile-reset-ui` is 176/176 and its chained LFA wordmark tape is
  15/15.
- `test:equipment-answer` reaches 42/43; its sole existing SeasonFinished
  resume-order failure is unrelated to this surface.
- `test:phase-shift-atomicity` and `test:phase-skew-repair` still stop on their
  existing incomplete gender/profile fixtures before this UI surface runs.
- `test:compile` remains at the shared 483-error / 60-worsened-pair baseline and
  does not name ProfileScreen or the two setup transaction owners changed here.

### NOT COVERED

- Simulator or physical-iPhone pixels (Sam requested no screenshot loop).
- Hardware/gesture Back, real VoiceOver order, the updated golden tape on a
  device and the next Release rebuild.

---

## R-186 — unify the Profile setup edit actions

The Profile doorway now uses the same dark row, lime label and chevron as the
three edit actions inside the setup page. Rather than separately styling four
lookalike controls, all four now render through one `SetupEditAction` owner.

### Evidence

- TEST FIRST: the exact shared-action cell made `test:profile-reset-ui` 175/176
  against the lime primary doorway.
- AFTER: `test:profile-reset-ui` is 176/176 and its chained LFA wordmark tape is
  15/15.

### NOT COVERED

- Simulator or physical-iPhone pixels (Sam requested no screenshot loop).
- Real VoiceOver speech and the next Release rebuild.

---

## R-187 — use normal casing for programmed section headings

Every component heading in the Day programmed-work box now opts out of the
compact label's uppercase transform through the one shared
`programmedPartHeadline` style. Mobility / Warm-up, Strength, Conditioning,
Primer, Recovery, Gunshow and future projected sections therefore keep their
authored casing. CORE and compact status labels remain uppercase.

### Evidence

- TWO OPTIONS COMPARED: rewriting individual signed strings would couple copy
  to presentation and miss future section types; overriding the shared
  programmed-heading style fixes the whole renderer without touching copy.
- TEST FIRST: the casing cell changed the inherited targeted baseline from
  54/56 to 53/56.
- AFTER: `test:day-first-timeline` returned to its exact inherited 54/56
  baseline; the two remaining failures are the pre-existing mobility-flow and
  generated-Gunshow fixtures.

### NOT COVERED

- Simulator or physical-iPhone pixels (Sam requested no screenshot loop).
- Week-card section typography, real VoiceOver speech and the next Release
  rebuild.

---

## R-188 / R-189 — remove false Midline identity and false swap similarity

The same two underlying mistakes reached multiple surfaces. Component
classification promoted a role into a session identity after removing power
from its content check. Quick Swap promoted membership of the entire Strength
family into a similarity claim. Both broad claims are gone at their shared
owners rather than hidden on the screens where Sam saw them.

### Evidence

- MIDLINE TEST FIRST: the tape reported a support component, no Strength
  component and the exact Explosive Push-up + Dragon Flag mechanism before the
  component owner changed.
- MIDLINE AFTER: all four new identity cells pass; the stale copy-file census
  was re-sited from the deleted frozen Coach files to the live session owners,
  and `test:midline` is 23/23.
- SWAP MEASUREMENT: Band Pallof Press had more than 100 “similar” fallback
  answers, including Box Jumps, because every other Strength leaf was admitted.
- SWAP TEST FIRST: the role-totality and literal Box Jumps cells were the only
  two new reds. AFTER: its behavior cells passed, and explicit source-anchor
  liveness brought `test:quick-exercise-actions` to 56/56.
- `test:day-first-timeline` remains at its exact inherited 54/56 baseline.

### NOT COVERED

- The simulator and physical iPhone (no screenshot loop in this pass).
- Existing persisted support-component feedback, accumulated repeated swaps on
  glass, the broader scroll/tap/onboarding stability investigation and the next
  Release rebuild.

---

## R-190 — stabilise fresh onboarding installation

The cold-start harness reproduced the reported onboarding failure before any
screen assertion: program installation entered the accepted-state transaction
while Calendar and Readiness were still unhydrated, and both write owners called
`Object.keys` on an absent map. The Calendar crash hid the identical Readiness
crash directly behind it.

### Evidence

- TWO OPTIONS COMPARED: delay installation until every store happened to expose
  a map, or make each accepted-state ownership boundary canonicalise its own
  input. Boundary normalisation landed because it also covers legacy missing
  fields and removes the hydration-order dependency entirely.
- BEFORE: the cold-start suite repeatedly threw from Calendar, then from
  Readiness after Calendar was corrected.
- AFTER: the crash paths are gone; the cold-start suite reaches all 15 cases.
  Its remaining assertions are established compatibility/horizon debt rather
  than exceptions from either writer.
- `test:calendar-ownership` is 9/9 and
  `test:readiness-store-ownership` is 8/8, including new unhydrated-state cells.
- The repaired session-list matrix now completes real onboarding in all three
  phase worlds and is 6/6 across 18 reached day-type/content coordinates.
- The action walker now completes its real generated walks. It remains 16/20
  on older schedule/restore debt, and exposed one raw `upper_pull` confirmation
  that was removed at the shared confirmation-copy boundary.
- The day-card interaction guard had drifted behind the current shared Card
  owner and falsely stopped checking four click/accessibility properties. Those
  cells now bind the real conditional press and nested-control geometry;
  `test:accessibility-contracts` improved from 40/47 to 44/47. Its three
  remaining reds are existing Sheet-header/title contracts.

### NOT COVERED

- Exact scroll or missed-tap reproduction on glass; Sam has not yet named the
  screen and gesture, and requested no screenshot loop.
- The simulator and physical iPhone, legacy disk payloads beyond the two
  accepted maps, and the next Release rebuild.

---

## R-191 — new onboarding owns a genuinely fresh training context

The visual pass found two separate post-generation failures beneath the same
onboarding handoff. First, real onboarding was turning the Profile's recurring
game day into one dated Calendar override per week. Each unnecessary write
rebuilt the accepted week until a healthy program was refused with WC-142.
Second, after that duplication was removed, the visible Week rendered almost
entirely as Rest because a prior simulator athlete's severe shoulder injury,
fatigue modifier and low-readiness answer still constrained the new athlete.

The accepted onboarding boundary now clears the old program/result state and
publishes an explicitly empty fact context with the new program. Recurring game
day remains virtual from the accepted Profile. Deterministic harness worlds may
still request dated fixture marks through an explicitly named fixture-only
installer; product onboarding cannot reach that path by default.

### Evidence

- TWO OPTIONS COMPARED: add another cleanup call to each screen/store after
  navigation, or declare new-onboarding acceptance as the one fresh-context
  owner. The accepted-program boundary landed because it clears the entire
  input class before any screen can read a mixed old/new athlete world.
- LIVE BEFORE: the simulator system log named
  `set_game_day:2026-08-29` and `not_enough_legal_gym_days: WC-142`; after that
  was removed, the simulator's persisted files named an old
  `training_paused` shoulder injury, fatigue constraint and low readiness while
  the new generated program itself contained Monday Strength and Tuesday /
  Thursday Team Training.
- TEST FIRST: the acceptance tape seeds those three stale fact kinds before
  installing a real locally generated program. AFTER:
  `test:accept-boundary-contract` is 11/11 and proves successful installation,
  zero explicit game marks, zero readiness signals and zero coach constraints.
- LIVE AFTER: the Simulator reaches Program and the Week visibly contains
  Monday Strength plus Tuesday/Thursday Strength + Team Training, with its rest
  days intact and no Midline Work session headline.

### NOT COVERED

- A physical-iPhone Release rebuild, historical session records that may live
  outside the accepted program stores, real VoiceOver, and an exhaustive
  gesture sweep of every screen.
- The original broad “faulty clicks / scrolling” report has no single named
  remaining gesture. The Review scroll, Generate press, Program handoff and
  Week-tab press were exercised successfully in this pass; any remaining
  screen/gesture should be reported by its exact location so it can be added to
  the interaction matrix rather than guessed at.

---

## R-192 — remove forced capitals from onboarding steps

The earlier consistency pass fixed the local answer-card styles but left the
whole onboarding navigator inside a legacy typography scope whose heading face
was Bebas Neue and whose h1-h4 variants forced uppercase. Because that font has
no useful lowercase presentation, a local `textTransform: none` could never fix
the rendered questions. Several answer lists also authored their labels in
capitals, bypassing the local style correction entirely.

The shared onboarding heading variants now retain their existing large sizes
and line heights while using System bold with natural casing. The remaining
hard-coded Position, Team Training, Injury, experience, conditioning, sprint
and recent-load questions/options are sentence case. Welcome branding and
small intentional label treatments remain unchanged.

### Evidence

- TWO OPTIONS COMPARED: keep overriding each screen after the uppercase scope,
  or remove uppercase and the all-caps face from the shared h1-h4 owner. The
  shared owner landed because it fixes existing and future steps; copy literals
  were then normalised only where they could still bypass that owner.
- TEST FIRST: the new audit added four reds to the presentation suite: the
  all-caps display face, forced transform, hard-coded answer copy and dynamic
  injury-area uppercasing. AFTER: `test:onboarding-presentation` is 105/105.
- LIVE SIMULATOR: the first real step renders **What should I call you?** and
  the hierarchy explicitly contains no **WHAT SHOULD I CALL YOU?** node.
- `test:prototype-typography` keeps its four typography cells green; its one
  inherited red still names five unrelated athlete-facing files bypassing the
  shared Text owner. `test:onboarding-reliability` remains 23/24 on its existing
  block-selection persistence-name parser red.

### NOT COVERED

- Every step viewed manually on the Simulator, the physical-iPhone Release,
  exceptionally long accessibility sizes (font scaling is currently disabled
  app-wide), and translated copy.

---

## R-193 — injury save cannot blank the program or disappear from My Status

The injury fact was accepted before the app performed its final whole-world
settle. That settle deliberately cleared the derived program and compatibility
state before regenerating it; if generation or acceptance then failed, the
half-built blank world escaped. Separately, My Status read the CoachUpdates
compatibility mirror and filtered facts through the visible program week, so a
canonical saved injury could still be hidden when the mirror or program output
was missing.

The complete post-decision settle now runs inside the existing exact accepted-
state transaction. A failure restores memory, mirrors, the durable ProgramStore
envelope and visible projection together. My Status now reads the canonical
accepted context and deliberately does not apply Program's visible-week proof
filter.

### Evidence

- TWO OPTIONS COMPARED: patch the injury card after failure, or make the entire
  settle atomic and read status from the typed-fact owner. The latter landed
  because it protects every post-decision rebuild and removes the second injury
  authority rather than repairing one screen.
- REAL-ACTION TEST: a generated athlete reports a shoulder injury through the
  production action, the CoachUpdates mirror is deliberately emptied, and the
  My Status selector still finds the canonical episode.
- FORCED FAILURE TEST: `commitRebuiltProgram` throws after the settle has taken
  its clean slate; the complete state fingerprint and durable envelope return
  byte-exact, the program remains non-null, and the injury remains visible.
- LIVENESS: reverting My Status to the mirror made the new injury test red;
  bypassing the atomic settle made it red; passing `visibleWeekDays` back into
  Coach made `test:my-status-modifiers` red.
- LIVE SIMULATOR, no screenshots: fresh seed → report moderate shoulder injury
  → Program screen remains → Coach → My Status shows `Shoulder issue active`
  and does not show the empty state. The complete Maestro flow passed.
- `test:my-status-modifiers`: 10/10 green. `test:quiescent-boot`: the new injury
  coordinate is green; suite total remains 5/6 because the pre-existing
  zero-decision boot byte test still reports `coach-updates` / profile envelope
  shape changes unrelated to this action.

### NOT COVERED

- Physical-iPhone Release acceptance, every injury body area/severity, injury
  update/resolution, a real process kill during the settle, and the broader
  scrolling/faulty-click/onboarding reports outside this injury coordinate.

---

## R-194 — separate athlete status from day scheduling

The Day change card now shows only Tired, Sick and Injured as immediate status
controls. One full-width **Edit day** doorway sits separately beneath them and
opens the existing Add / Move / Remove capability menu. No plan-edit chip or
second mutation path was added: the existing PlanChangeSheet still validates,
previews, confirms and commits the action.

### Evidence

- TWO OPTIONS COMPARED: retain six equal-weight chips and explain the difference
  through labels, or separate state from scheduling while reusing the canonical
  menu. The second landed because it makes the athlete's choice clearer and
  deletes presentation complexity without duplicating program logic.
- TEST FIRST: the revised hub contract produced five reds against the old six-
  chip Day card. AFTER: `test:session-change-hub` is 60/60. Its final cell was
  added after the first simulator run caught the optional action silently
  defaulting to Add instead of showing the menu.
- `test:day-first-timeline` remains at its exact inherited 54/2 baseline; its
  Edit day cell passes and the two existing failures still name mobility review
  wiring and a missing generated Gunshow fixture.
- `test:signed-copy-extraction` is 7/7. **Edit day** is a signed R-194 copy row.
- LIVE SIMULATOR, no screenshots: Tired, Sick and Injured were reachable; the
  direct Add id was absent; Edit day was present; tapping it showed Add, Move
  and Remove together. The corrected interaction flow passed end to end.
- `test:compile` remains at the concurrent 483-error / 60-worsened-pair
  baseline and names none of this slice's changed product files.

### NOT COVERED

- Physical-iPhone Release, VoiceOver order, every day capability combination
  and a real committed Add/Move/Remove sequence.

---

## R-195 — reword the Day status card only

The Day card now asks **Not feeling 100%?** and says **Tell us what’s changed
and we’ll adjust your training.** The active-workout Equipment / Injury / Add
hub retains its own **Need to make a change?** heading, so a Day-only copy
change does not make the session-edit surface ask the wrong question.

### Evidence

- TWO OPTIONS COMPARED: replace the shared heading globally, or split only the
  heading identity while keeping one shared visual component. The isolated
  signed heading landed because the two surfaces now ask different questions.
- TEST FIRST: two exact-copy cells were red against the old shared wording.
  AFTER: `test:session-change-hub` is 61/61.
- `test:day-first-timeline` remains at its exact inherited 54/2 baseline, with
  the signed-copy and no-hardcoded-copy cells green.
- LIVE SIMULATOR, no screenshots: both new lines, Tired, Injured and Edit day
  were visible together in the Day card.

### NOT COVERED

- Physical-iPhone Release, VoiceOver reading, the retained active-session
  heading viewed on glass in this pass and unusual accessibility text sizes.
