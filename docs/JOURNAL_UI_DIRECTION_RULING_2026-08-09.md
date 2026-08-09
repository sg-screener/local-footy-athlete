# JOURNAL UI DIRECTION — RULED (Sam, 2026-08-09)

Sam judged the seat's v2 mock (docs/JOURNAL_UI_MOCK_V2_2026-08-09.html —
committed beside this doc) and ruled: "yeah sounds good for now - it
needs to match the style of the rest of the app too." The mock is
DIRECTION, not a pixel spec; its words are placeholders under the copy
regime. Commit as authored.

## THE ORGANISING RULE: EXCEPTION-BASED FRONT PAGE

Nothing appears unless it has something to say. A surface earning its
place by having news IS the design — an athlete learns that seeing a
card means "pay attention".

## DEFAULT SCREEN (most weeks, the WHOLE screen):

1. HERO: week status as the headline (big type), the week's job under
   it, the load band — sweet-spot zone shaded, marker on it. No
   paragraphs.
2. STAT STRIP: three glanceables — sessions done / load vs normal
   arrow+% / game feel.
3. WEEK SHAPE AS BARS, not letters: tall=Hard, mid=Moderate, short=
   Easy, flat dot=Rest, outlined=Game. SUPERSEDES batch 15-b's H/M/E/G
   letter presentation (the letters die; spoken names stay on
   accessibility).
4. YOUR LIFTS: names, kg × reps, up/flat/down arrows.
5. YOUR MONTH: the one permanent drawer (progress always has something
   to say once history exists) — charts live behind it.
6. THE NOTE BOX, quiet, at the bottom.

## EARNED CARDS (exist only on weeks that cross a line):

- REGION HOT ("Hamstrings ran hot — heavy lower Tuesday, speed Friday")
- BALANCE DRIFTING ("Push running +32% over pull")
- Placement: ABOVE the lifts — attention beats routine. They vanish
  when back in range; reappearance is the signal.
- NIGGLE HISTORY surfaces only with an active issue or repeat flag —
  never standing furniture. Note resurfacing only where relevant.
- WHAT CHANGED: one credit line inside the hero on weeks a change
  happened ("Thursday upper moved to Friday — everything still got
  done"), nothing otherwise. Data stays stored/derived regardless.

## THRESHOLDS ARE SAM'S

What counts as "out of whack" (balance skew line, region-hot line,
load-band edges) are athlete-affecting constants: ship PROPOSED, join
the load model's constants batch, ONE signing sitting.

## STYLE LAW (Sam's rider, verbatim "match the style of the rest of the
app"): ONE design language. Reuse the app's existing tokens and
components — the Program tab's colours, card shapes, radii, spacing,
type scale, chip patterns. The mock's specific hexes/fonts are NOT law;
the app's are. No second design system is born in this slice.
