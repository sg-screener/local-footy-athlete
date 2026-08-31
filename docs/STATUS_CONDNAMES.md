# STATUS — condnames

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
