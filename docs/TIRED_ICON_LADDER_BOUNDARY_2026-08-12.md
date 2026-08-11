LOOP CHECK: severity choices share ambiguous icon language — sighting 1 — iterate

# TIRED ICON LADDER BOUNDARY — 2026-08-12

## What Sam ordered

Inside the Day screen's Tired choices:

- Bit tired today becomes blue so it does not clash with Pretty flat.
- Pretty flat uses a half-full battery rather than an empty battery.
- Totally cooked uses a red skull-and-crossbones or similarly unmistakable
  exhausted-state icon rather than another empty battery.

## Reachability proved before editing

The Program tab's live `HomeScreenV2` renders the Tired status control. That
control sets the shared readiness entry to `flat`, which mounts the exact three
options edited here. The classic Home screen remains unreachable. No control or
route was removed.

## Options compared before implementation

1. Draw three local SVGs inside the readiness sheet.
2. Keep the existing moon and route the half-battery and skull-and-crossbones
   through the shared semantic icon owner.

Option 2 landed. The installed icon set already contains a true 50% battery and
an outlined skull-and-crossbones. Reusing those glyphs avoids maintaining local
path data and gives each meaning one reusable name.

## First-run finding

The new cell ran before implementation. Forty-three existing cells passed and
the new icon-ladder cell failed on Bit tired today's prior amber moon. The prior
sheet also used an almost-empty custom battery for Pretty flat and a lime low
battery for Totally cooked.

## What changed

- Bit tired today keeps its moon and changes from amber to blue.
- Pretty flat uses the shared 50% battery in amber.
- Totally cooked uses the shared outlined skull-and-crossbones in red.
- The shared icon owner now names the two new readiness meanings rather than
  exposing library glyph names to the screen.
- A guarded registry row records the complete three-step visual ruling.

## Receipts

- Day-screen guard: 44 named cells run, 44 passed.
- Shared icon-owner guard: 15 named cells run, 15 passed.
- Readiness behavior guard: 30 named checks run, 30 passed; the three actions
  and their stored meanings are unchanged.
- Typecheck baseline gate: passed with 35 product, 51 development-tool and 373
  test diagnostics — 459 total against the recorded baseline, zero new
  diagnostics.

## What catches the next defect of this class

The Day-screen cell first proves it found the live three-option region, then
binds each label to its ruled colour and semantic icon. It separately binds the
two semantic names to the shared library glyphs. The shared icon-owner gate
fails if the live Program screen replaces those owned icons with local drawings.

## North Star

Neutral on stored state and toward one ownership boundary. This is presentation
only; the readiness decisions and program derivation are unchanged. Two reusable
semantic icon names replace one local battery drawing and one misleading reuse.

## NOT COVERED

- Sam's physical iPhone. The native rendering, weight and visual balance of the
  skull-and-crossbones still need his eye.
- A new simulator screenshot. The route and source are guarded, but this unit did
  not rebuild or drive the app.
- Other uses of the existing low-battery icon. They retain their current meaning
  and were deliberately not changed.
- The protected season phase sheet, `GameDayScreen` and `PlanChangeSheet`; none
  was changed.
