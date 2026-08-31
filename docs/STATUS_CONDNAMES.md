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
