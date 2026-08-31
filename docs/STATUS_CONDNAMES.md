# STATUS — condnames

## 2026-08-31 — all 55 conditioning templates use the approved athlete copy

Owned by `condnames`.

Sam rejected the existing conditioning catalogue as too long, repetitive and
awkward to execute. Several sprint rows printed approximate seconds beside a
distance prescription, and several work/recovery pairs forced the athlete to
add odd figures repeatedly just to know when to start again. He approved a
complete rewrite and then finalised the shared Warm-up wording.

Two options compared:

1. Rewrite the signed workbook and thereby alter the source that owns template
   physiology, eligibility, selection and safety limits.
2. Keep that signed source intact and replace the existing partial display maps
   with one total, reviewed athlete-facing projection over all 55 templates.

Option 2 landed. `conditioningAthleteCopy.ts` is the one complete display
source. It gives every template an exact title, work, recovery, count,
intensity and cue; the three older partial title/cue/prescription maps are gone.
The first integration run caught a boundary error: internal cap and rest readers
were consuming display text. Those readers now consume the signed template
fields directly, so simplifying what the athlete reads cannot alter selection,
eligibility, modality caps or stored recovery.

The final Warm-up is:

- `5–10 min build-up`
- `Start with an easy jog, then progress into run-throughs, increasing the intensity as you go.`

Test-first and liveness receipt:

- Before the product source existed, two new C13 cells were red: all 55 exact
  cards and the final Warm-up.
- `test:conditioning-templates`: 161 / 161 green. This includes exact fixture
  equality for all 55 cards, all 55 generated workout rows, the Warm-up source
  and an emitted Warm-up row.
- `test:conditioning-copy-census`: 35 / 35 green over all 55 rendered cards.
- Mutation: replacing the 30-second hard cue with `MUTATION: wrong cue.` killed
  both the exact all-55 cell and the universal-card cell (157 / 159). Restoring
  the approved cue returned 161 / 161.
- `test:conditioning-dose`: 12 / 12; `test:signed-copy-extraction`: 7 / 7;
  `test:projection-ownership`: 13 / 13; product and devtools TypeScript: zero
  errors.
- The broader test TypeScript gate still reports four errors in three
  concurrently edited test files; this unit adds no product/devtools error.
  `test:session-template` and `test:session-execution` retain their existing
  source-contract reds unrelated to this copy change.
- `test:scenarios` completed 53 / 65 with its 12 existing game-proximity,
  coaching-engine and stale-detection failures; none concerns conditioning
  copy.
- The full canonical compiler slice completed 10,381 / 10,387. All exhaustive
  conditioning-copy, flush and equipment-matrix cells are green; the six
  remaining reds are the four standing pre-season restart-selection failures
  and two concurrent Primer heavy-option expectations.

Simulator receipt: the real `conditioning-showcase` session displayed the new
30-second card with `2 blocks × 5 rounds`, `30s hard / 30s easy`, `3 min between
blocks`, `100–110% MAS` and the shorter cue. The flow completed the session,
reloaded the app and reopened the completed Conditioning section successfully.
Screenshot: `artifacts/visible/conditioning-one-prescription.png`.

NOT COVERED:

- Each of the other 54 templates individually rendered on the simulator; their
  generated athlete copy is covered by the exhaustive in-chain projection
  guard rather than 54 more screenshots.
- Physical-iPhone Release acceptance.
- VoiceOver reading order and Dynamic Type scaling.

## 2026-08-31 — Speed is a real session section in the athlete-specified order

Owned by `condnames`.

The active session discarded the typed speed rows. Its component fallback then
rendered a generic `Session` disclosure containing the bare label `speed work`.
The Day overview knew Speed existed, but the active-session template did not
consume `speedBlock.exerciseIds`.

Two options compared:

1. Rename and reposition the rowless fallback.
2. Carry the already-typed speed rows into the canonical session template and
   give them the same execution-section and prescription-card model as the
   other prescribed work.

Option 2 landed. Both prescribed speed rows now appear in a `Speed` section
with the bolt icon, normal cards and per-row completion. There is no generic
`Session / speed work` fallback. Sam corrected the first attempted ordering;
the active session is exactly Mobility / Warm-up, Strength, Speed, then
Conditioning.

Test-first receipt:

- `test:session-template`: two new speed cells began red, then returned green;
  current result is 87 passed / 1 pre-existing numeric-index source-contract
  failure.
- `test:session-execution`: four new speed cells began red, then returned
  green; current result is 208 passed / 2 pre-existing source-contract
  failures.
- Mutation/liveness: emptying the real `speedRows` loop killed both template
  cells and the execution actual-rows/no-fallback cell. Restoring it returned
  those guards green.
- `test:session-components`: 39 / 39 green.
- `test:action-walker`: reached its final report with no Speed-kind failure;
  the standing result is 14 passed / 6 unrelated action-law failures.
- `test:maestro-element-contract`: the new flow adds no missing product id; the
  standing repository result still lists its existing missing-id debt.
- `test:law-registry` accepts R-287, its in-chain guards and ruling site; the
  standing global 21-UNENFORCED-law red remains. `test:ruling-registry` adds no
  R-287 error and retains its existing R-070 path, ratchet and re-ask reds.
- Product and devtools TypeScript: 0 errors. Test TypeScript has four errors in
  three concurrently edited files; this change adds none.

Simulator receipt: the cold-seeded `conditioning-showcase` session walked
downward through `Mobility / Warm-up`, `Strength`, `Speed` and `Conditioning` in
that exact order. The Speed disclosure reported 0/2, both authored cards were
visible with `Mode: Run`, and the flow completed after reaching Conditioning.

NOT COVERED:

- Physical-iPhone Release acceptance.
- Completing and reopening a Speed section.
- VoiceOver reading order and a standalone speed-only day.

## 2026-08-31 — equipment delivery no longer renames conditioning templates

Owned by `condnames`.

Sam's screenshot showed `Outdoor Aerobic Run` above the exact Work, Recovery,
Blocks, Intensity and cue of `Continuous Aerobic Run`. The former name is not
one of the 55 authored templates. The equipment-feasibility boundary selected
the `outdoor_running` delivery family and then overwrote the already-selected
template name after materialisation.

Two options compared:

1. Special-case `Outdoor Aerobic Run` back to `Continuous Aerobic Run`.
2. Restore ownership: the template owns title and dose; equipment owns a
   separate delivery-mode line for every substitution family.

Option 2 landed. The substitution boundary no longer writes exercise names and
the now-dead substitution-name catalogue and signed-copy registration are
removed. Treadmill, outdoor run, hill run/walk, brisk walk, bodyweight and safe
mixed delivery all retain the selected template name. The active-session mode
reader derives a separate delivery label from the typed feasibility family.

Test-first receipt, `test:conditioning-identity`:

- Baseline: 47 passed / 8 failed.
- New exact screenshot cells before the fix: 46 passed / 11 failed; the three
  new reds were template title, block title and separate mode.
- After: 61 passed / 8 failed. All twelve family-matrix cells and the three
  screenshot cells are green. The same eight concurrent generation failures
  remain byte-for-byte by name; this unit neither owns nor hides them.
- Mutation: restoring the exact `Outdoor Aerobic Run` overwrite made the three
  relevant cells red (58 passed / 11 failed). Restoring the implementation
  returned 61 / 8, and the source file's SHA-256 returned byte-identical to its
  pre-mutation value.

The exact view-boundary cell drives `buildSessionTemplate`: the main item now
reaches the session view as `{ title: 'Continuous Aerobic Run', mode: 'Run ·
running' }`, rather than proving only the underlying workout object.

Related receipts:

- `test:conditioning-templates`: 152 / 152 green — the complete 55-template
  authored sheet still equals what ships.
- `test:projection-ownership`: 13 / 13 green. Its first run exposed a real
  follow-on copy gap: revealing the proper template caused the projected Work
  dose to exist, but the completed finite line was not registered. The copy
  owner now registers every rendered label + authored dose combination; direct
  checks for Continuous Aerobic Run's Work, Rest, Sets and total-time lines are
  all signed.
- `test:signed-copy-extraction`: 7 / 7 green.
- `test:session-template`: 84 / 85; the sole existing red is “the numeric index
  is back in the row header”, unrelated to conditioning naming.
- `test:compile`: product 0 and devtools 0. The test scope has four errors in
  three concurrently edited test files; this unit adds none and
  `conditioningVisibleIdentityTests.ts` type-checks cleanly.
- `test:law-registry`: all registry structure, guard, chain and ruling-site
  cells green; the standing global 21-UNENFORCED-law red remains.
- `test:ruling-registry`: R-282 parses and creates no new re-ask match. The
  standing R-070 stale path, nine-ruling ratchet and fifteen existing question
  matches remain red.

NOT COVERED:

- Fresh simulator generation and screenshot.
- Physical-iPhone Release acceptance.
- Persisted sessions already saved with a former substitution alias.
- VoiceOver speech and genuinely multi-option conditioning blocks.

## 2026-08-31 — the separate mode field uses one clean label

The first correction preserved template identity but introduced wording Sam
had not authored: `Run · running`, alongside the existing `Bike · off-leg` and
machine equivalents. Sam rejected that as redundant and unprofessional and
specified the field directly: `Mode: Run`, `Mode: Bike`, `Mode: SkiErg`, etc.

The mode owner now emits exactly:

- `Mode: Run`, `Mode: Bike`, `Mode: Air Bike`, `Mode: RowErg`, `Mode: SkiErg`;
- `Mode: Bike → RowErg` for an ordered mixed sequence;
- `Mode: Run / Walk`, `Mode: Walk`, `Mode: Bodyweight` and `Mode: Mixed` for
  equipment fallbacks.

Test-first receipt: `test:conditioning-identity` was 54 passed / 17 failed
after the nine exact wording cells were changed and before the product fix. It
is now 63 passed / 8 failed; all nine wording cells are green and the same eight
concurrent generation failures remain. `test:session-template` remains 84 / 85
with only its pre-existing numeric-index source-contract red.

Simulator receipt: the `conditioning-showcase` world was cold-reset, opened
through the real Day → session route and asserted by test id plus exact Mode
grammar. The card on glass reads `30-Second Hard Intervals` and `Mode: Bike`.
The short flow passed through screenshot capture; the committed visible flow's
old `Bike · off-leg` assertion is replaced with `Mode: Bike`.

NOT COVERED:

- Fresh simulator generation of every other single and mixed modality.
- Physical-iPhone Release acceptance and VoiceOver speech.

## 2026-08-31 — one font size throughout the conditioning card

Sam's simulator screenshot showed three sizes inside one card: a 15-point title,
14-point Mode/prescription copy and 12-point pace. The screen now has one
`SESSION_ROW_TEXT_SIZE` owner set to 15. Both conditioning render paths use it
for title, option title/description, Mode, structured prescription, cue and
pace; weight and colour remain available for hierarchy.

Test-first receipt: the new `test:session-template` source-contract cell began
red at 84 / 2 and returned green at 85 / 1. Its sole remaining red is the
pre-existing numeric-index source contract. Product TypeScript is 0 errors.

Simulator receipt: after a cold reset into `conditioning-showcase`, the real
session card was captured with `30-Second Hard Intervals`, `Mode: Bike` and the
structured lines all at the shared 15-point size. The short glass flow passed.

NOT COVERED:

- Dynamic Type accessibility scaling and VoiceOver.
- Physical-iPhone Release acceptance.

## 2026-08-31 — structured labels use the body style

The font sizes were unified, but the screenshot still showed `Work`,
`Recovery`, `Rounds` and `Intensity` in an extra-bold white nested span while
their values used the ordinary body style. That survived because R-284 had
explicitly allowed weight and colour hierarchy; Sam's glass review rejected
that interpretation.

The nested-label parser and `conditioningPrescriptionLabel` style are removed.
The shared renderer now prints the complete structured copy in one Text node,
so label and value necessarily inherit the same size, weight and colour.

Test-first receipt: the changed `test:session-template` typography cell began
red at 84 / 2 and returned green at 85 / 1. Its sole remaining red is the same
pre-existing numeric-index source contract. Product TypeScript remains at 0
errors.

Simulator receipt: the cold-seeded `conditioning-showcase` card was rendered
again after this change. `Work: 30 s hard` and `Recovery: 30 s easy…` now show
the label and value in the same body weight and colour; the exact `Mode: Bike`
flow passed and captured `/private/tmp/lfa-mode-verified.png`.

NOT COVERED:

- Title and personal-pace colour hierarchy; Sam's correction named the
  structured labels specifically.
- Physical-iPhone Release acceptance, Dynamic Type and VoiceOver.

## 2026-08-31 — athlete hierarchy replaces the field stack

Sam supplied the target card hierarchy and caught a semantic defect in the
same screenshot: a Bike session was showing a min/km running pace. The previous
card was still a styled database projection (`Mode:`, `Work:`, `Recovery:`,
`Rounds:`, `Intensity:`), so changing font treatments could not make it read
like an athlete instruction.

Two options were compared:

1. Rearrange and strip labels inside the React card.
2. Add one pure athlete-card projection above React and make both card paths
   consume its named concepts.

The second landed. `conditioningCardPresentation` now lifts the canonical
conditioning lines into modality, structure, work/recovery, recovery detail,
intensity, cue and total. It handles the continuous-session exception without
showing a fake `1 block`, and the full 55-template sweep proves every authored
template reaches structure, intensity and cue. React only applies the approved
visual hierarchy.

The 30-second card projects exactly:

- `Bike`
- `2 blocks × 5 rounds`
- `30s hard / 30s easy`
- `2–3 min between blocks`
- `100–110% MAS`
- `Repeat the same effort throughout each block; do not sprint.`

The personal-target gate reads typed delivered modality. Only exact `Run`
allows `personalPaceLine`; every machine, mixed, walking and run/walk modality
returns no target. The lime copy now says `Your target` / `Estimated target`.

Test-first receipt: the three new C13 projection cells first stopped on the
absent projection; the session source contract began 80 / 6, and identity
printed the former `Mode:` values before stopping on the absent relevance
owner. After implementation, `test:conditioning-templates` is 156 / 156,
`test:session-template` is 85 / 1 with only its pre-existing numeric-index red,
the new plain-modality cells are green at 63 / 8 with the same eight concurrent
generation failures, and the eight-arm personal-target relevance matrix is in
the fully green template suite. `test:conditioning-copy-census` moved its
target line green and remains red only on the pre-existing `Total` allow-list
cell. Product TypeScript is 0 errors.

Mutation/liveness: forcing the non-continuous card projection to allow a
personal target for every modality killed both the exact Bike-card cell and the
eight-arm relevance matrix at 154 / 156. Restoring the exact-Run condition
returned the suite to 156 / 156.

Simulator receipt: the cold-seeded `conditioning-showcase` Bike card passed
exact assertions for all six hierarchy lines, absence of all five database
labels and absence of `Your target`. The real card was captured at
`/private/tmp/lfa-mode-verified.png`.

NOT COVERED:

- Physical-iPhone Release acceptance, Dynamic Type and VoiceOver.
- A glass capture of a pure Run card showing its relevant personal target; its
  typed modality matrix is covered in `test:conditioning-identity`.
