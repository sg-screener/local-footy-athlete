# STATUS — condfix

## 2026-08-26 — audit item 3: conditioning clarity

Owned by `condfix`.

Measured before edits:

- A real `conditioning-showcase` generation produces one `Classic 4×4` row but
  `buildSessionTemplate` wraps it as a one-option `conditioning_choice` titled
  `Hard Intervals`. The screen therefore presents a generic session title and
  then the authored session name underneath, although there is no choice.
- `workToRest` is internal physiology data and has no production renderer, but
  several athlete-facing template names still contain ratio-looking shorthand
  (`1:1`, `2:1`, `30:30`) while the explicit Work and Recovery fields sit below.
- Four projected prescription fields contain mutually exclusive instructions:
  Steady Blocks, Hill Repeats, Easy Aerobic Flush and Erg Flush Blocks.
- Standalone conditioning rows print the structured `Recovery:` line and then
  independently print `restSeconds` again beneath it.

Options compared:

1. Rewrite the signed workbook rows and their typed mirror.
2. Keep internal/authored physiology intact and make the existing shared
   athlete-facing conditioning projection choose one clear display title and
   one concrete prescription; make a single option render as a direct row.

Option 2 owns the fix because it removes display ambiguity without creating a
second dose source or changing selection, placement, fatigue, or progression.

Sam's simulator review added two corrections:

- The dated source called the four-by-four VO₂ session `Classic 4×4` and
  prescribed `3 min easy jog`. The internal historical identity remains stable,
  but the athlete now reads `4×4 VO₂ Max`; the Rest period is re-authored to
  `3 min complete rest`, with no jogging.
- Conditioning selection was audited for the strength-style first-entry trap.
  The real selector is block-stable and advances by `miniCycleNumber`; a new
  C14 drives all seven requestable categories through twelve mini-cycles and
  proves each advances beyond its first eligible template.

Verification:

- `test:conditioning-templates`: 106/106 green across all 55 templates.
- `test:session-template`: 85/85 green.
- `test:conditioning-copy-census`: 35/35 green.
- `test:conditioning-dose`: 12/12 green.
- signed-copy extraction 7/7, projection ownership 13/13, exercise display
  29/29.
- Mutation proof: forcing selection index `0` killed C14 with all seven
  categories printed as stuck; restoring mini-cycle selection returned the
  conditioning suite to green (now 106/106 after R-240).
- Real iOS Simulator flow green: one `4×4 VO₂ Max` row, `Work: 4 min hard`,
  `Recovery: 3 min complete rest`, `Rounds: 4`; no `Hard Intervals`, `Choose
  one`, `1:1`, `easy jog`, or duplicate rest line.

The final simulator review shortened the whole card system rather than patching
one screen: all 55 templates now omit Heart rate lines; the 4×4 cue is exactly
`Choose a pace you can repeat across all 4 rounds.`; and the one shared renderer
bolds Work, Recovery, Rounds/Reps/Blocks and Intensity for standalone and real
multi-option rows. The refreshed simulator screenshot confirms the shorter card
and visible emphasis; its flow also refuses the retired long cue and any Heart
rate text.
The final spacing review increased prescription leading and adds a five-point
gap below the conditioning title in both row paths; the refreshed simulator
screenshot and two additional session-template cells hold it.

NOT COVERED:

- Physical-iPhone Release acceptance.
- VoiceOver reading order.
- Every persisted legacy title.
- Athlete interaction with genuinely multi-option conditioning blocks.
- The Stage-B whole-generation golden is red before any conditioning-field
  divergence: its first mismatch is the already-landed Single-Leg RDL →
  Hamstring Curl program change. This item does not rewrite that shared golden.
- The inherited stale `test:conditioning-rotation` file: its direct selector
  cells agree with C14, but its old sprint pool still includes a warm-up-only
  row and its latter sections exercise the retired pre-Stage-B builder. It is
  not named as this law's guard; C14 runs through the current selection owner in
  the green, in-chain template suite.
