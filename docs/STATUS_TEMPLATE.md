# STATUS — `template`

**Seat opened 2026-08-27.** Sam is rebuilding the live screens toward the
prototype template he holds, **one piece at a time**, judging each piece on the
simulator himself. This file is the running record of those pieces.

## Working rule for this seat

Sam's instruction, 2026-08-27: *"don't fucking need you to take screenshots or
anything, just change it and i will decide if its good or not"* — and, when the
app stopped responding, *"you need to refresh the app yourself"*. So: **make the
change, reload the app, hand it back. No screenshot ceremony, no asking him to
verify what I could have verified.**

## Pieces

### 1. MY STATUS header pill — the glow is gone — WORKING

`src/components/ModifiersStrip.tsx`, `coachStrip`. The Program header doorway
carried `borderColor: rgba(200,255,0,0.42)` over `backgroundColor: '#11150D'` —
a lime edge on a green-tinted fill, which read as a glow above the day card.
Both values now match the `strip` style directly above them (`#1F1F1F` on
`#101010`). **No new token; no test bound either old value** (grepped `src/`,
`.maestro/`, `docs/` for both literals — zero hits outside the component).

### 2. Onboarding build screen, ready state — cards leave, tick centres — WORKING

`src/screens/onboarding/CompleteScreen.tsx`. Sam: the three education cards go
when the build finishes, and the tick + "Your program is ready / Time to get to
work" **slides down to sit centred on screen.**

- The cards belong to the WAIT: they now render only in `phase === 'generating'`
  and fade out on the same `loadingOpacity` as the spinner, so they leave with
  it rather than popping.
- The ready group drops in on `readyTranslateY` (`READY_SLIDE_FROM = -44` → 0,
  420ms) alongside the existing opacity fade.
- **Centring is measured, not assumed.** First attempt centred inside the
  ScrollView and landed low — Sam: *"needs to be centred more - maybe equal
  padding between top of screen and top of 'start your program' button"*. Two
  reasons it sat low: the scroll view starts BELOW the top safe-area inset, and
  the footer is `position: 'absolute'`, so the scroll view runs underneath it.
  The ready content now pays both back:
  `paddingBottom = insets.top + (measuredFooterHeight − FOOTER_TOP_PADDING)`,
  with the footer height read from its own `onLayout` and `FOOTER_TOP_PADDING`
  shared with the footer style so the two cannot drift.

**Proof:** Sam judged it on the simulator — *"yep thats good"*. Compile gate
(`npm run test:compile`) reports no error against either file; the gate's other
reds are pre-existing on this branch and belong to the test-truth seat.

## Notes for whoever holds this next

- **Four orphaned Maestro runs were driving this simulator** on 2026-08-27
  morning (two from 7:08PM the night before), which is why Sam's taps stopped
  landing. Killed all four. `ps aux | grep maestro.cli` before blaming the app.
- The branch in the shared checkout is `codex/failure-only-state-export` and
  another seat is live in it (test-truth files). **Commit with an explicit
  pathspec only.**
