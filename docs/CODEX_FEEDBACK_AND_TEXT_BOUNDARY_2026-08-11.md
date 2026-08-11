LOOP CHECK: local font sizes inheriting stale line boxes — sighting 2 — compress at the shared owners

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

## Verification boundary

- The typography gate executes the minimum line-box rule and reports the local
  font-size occurrence and distinct-file census behind the two shared owners.
- The execution gate proves performed Team Training asks both measurements,
  requires both before save, and accepts only 1–5 effort.
- The execution gate proves Mobility and ordinary session rows consume the same
  square checkbox recipe.
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

## NOT COVERED

- Physical rendering on Sam's iPhone remains the acceptance instrument for the
  clipped-glyph fix and the five-choice row widths.
- The saved Team Training duration and effort are evidence only in this unit.
  No new readiness weighting or automatic program adjustment was invented;
  that formula is a separate product ruling.
- This pass does not claim the whole app is green. The law registry remains red
  for its pre-existing unguarded laws.
