LOOP CHECK: local font sizes inheriting stale line boxes — sighting 2 — compress at the shared owners
LOOP CHECK: session rows imitating one another through separate renderers — sighting 3 — retire the duplicate renderer

# Text line boxes + measured session load — boundary report — 2026-08-11

## Sam's orders

- The photographed `Session feedback` title is cut off at the top. Find every
  instance of this class across the app and fix it, rather than patching only the
  photographed title.
- When Team Training was performed, additionally ask its duration and its own
  1–5 effort so the dated session result carries better load evidence.
- Games and practice matches use the same 1–5 effort scale as regular session
  feedback.
- Mobility uses the same square checkbox as every other live-session row.
- Every session checkbox is vertically centred against its complete row.
- Mobility / Warm-up uses Strength's complete row layout: numbering, authored
  prescription, cue disclosure, performed-load control and video action.
- Week keeps its navigator below Day / Week, but the physical-phone 28pt / 11pt
  treatment is too small.

## Options compared before implementation

### Text clipping

1. Add or increase `lineHeight` beside every local `fontSize`. This would edit
   hundreds of occurrences and allow the next local override to recreate the
   defect.
2. Resolve the effective caller font size at the shared Text and AppTextInput
   owners, then enforce one safe minimum line box after caller styles. This
   removes the whole class and makes the existing no-bypass census meaningful.

Option 2 owns the result. The first-run typography gate was green while a 22px
title inherited the base body's 17px line box; its old cells checked the family
and base scale, not the effective pair that React Native rendered.

### Team Training load

1. Create a second Team Training log/store beside session feedback.
2. Add the two measurements to the existing dated session outcome, through its
   existing adapter, validator, accepted transaction and durable envelope.

Option 2 owns the result. One performed session now produces one saved fact.
Duration is a positive hours+minutes result and effort is an integer 1–5. A
skipped Team Training component asks neither question and stores neither answer.

### Match effort

The existing game surface already classified scheduled games and practice
matches through one taxonomy and one form. The UI still generated ten choices
and the transaction still accepted 1–10 even though the rest of the scale had
moved to five. Both the form and shared payload validator now use 1–5.

### Session checkbox shape

1. Copy the ordinary row's dimensions into Mobility's separate style.
2. Keep each row's existing tap target, but make both consume one shared square
   checkbox, checked-state and tick recipe.

Option 2 owns the result. Mobility can no longer drift back to a circle while
the rest of the checklist stays square.

### Session-row parity and alignment

1. Keep the lightweight Mobility renderer and add copied prescription, cue,
   load, video and alignment styles until it resembles Strength.
2. Delete the lightweight renderer, adapt each selected D17 movement into the
   existing Strength exercise-card contract, and centre the one shared
   checklist owner against the complete card.

Option 2 owns the result. Mobility now reaches the same card owner as Strength;
its duration and per-side dose are passed in as the authored prescription. The
shared checkbox row uses centre alignment and has no hard-coded top margin.
Derived Mobility does not receive the stored-workout swap/remove callbacks,
because copying controls whose transaction cannot target a derived row would
create dead affordances.

### Week navigator scale

The order and ownership were already correct. The rejected dimensions were not:
28pt controls, 13pt chevrons and 11pt range text were visibly too small on the
physical phone. The same three doors now use 40pt geometry, 17pt chevrons and a
13/18pt range label without moving the navigator above the Day / Week control.

## Verification boundary

- The typography gate executes the minimum line-box rule and reports the local
  font-size occurrence and distinct-file census behind the two shared owners.
- The execution gate proves performed Team Training asks both measurements,
  requires both before save, and accepts only 1–5 effort.
- The execution gate proves Mobility and ordinary session rows consume the same
  square checkbox recipe.
- The same gate proves the one checklist owner vertically centres every box and
  that Mobility consumes the complete Strength exercise-card owner.
- The Program-shape gate pins the Week navigator's 40pt controls, 17pt chevrons
  and 13/18pt range label below Day / Week.
- The transaction gate drives a real Team Training workout and proves the two
  values survive the tap adapter, accepted transaction, dated feedback store and
  durable program envelope.
- The match gate proves scheduled and practice matches share five choices, the
  exact scale anchors and the shared 1–5 validator.

## What catches the next defect of this class

- A future raw React Native Text import on an athlete-facing surface fails the
  owner census. A local font-size override cannot bypass the final line-box
  calculation.
- A Team Training measurement outside its valid shape, attached to a non-Team
  session, or attached to a skipped session is refused at the transaction.
- A sixth game/practice-match effort choice or payload value fails the shared
  match gate.
- A second Mobility row renderer, a checkbox top-margin guess, or removal of
  prescription/cue/load/video props from the shared card fails the execution
  owner gate.

## NOT COVERED

- Physical rendering on Sam's iPhone remains the acceptance instrument for the
  clipped-glyph fix, the five-choice row widths, checkbox optical alignment,
  Mobility row density and Week navigator scale.
- Mobility swap/remove remains outside this unit. Those existing Strength
  actions target stored workout rows; Mobility is a derived D17 flow. Giving it
  those icons requires an explicit stored decision and accepted transaction,
  not visually copied buttons.
- The saved Team Training duration and effort are evidence only in this unit.
  No new readiness weighting or automatic program adjustment was invented;
  that formula is a separate product ruling.
- This pass does not claim the whole app is green. The law registry remains red
  for its pre-existing unguarded laws.
