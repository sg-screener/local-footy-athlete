# Conditioning muscle + experience sheet — SIGNED, Sam, 2026-08-05

Completes ruling 2 of docs/SWITCHOVER_PARKED_RULINGS_2026-08-05.md. The
workbook docs/MUSCLE_EXPERIENCE_CONDITIONING_PROPOSED_2026-08-05.xlsx is
SIGNED IN FULL (Sam, in chat: "all looks good"; per-row status cells
flipped SIGNED 2026-08-05). It is now the authored source for conditioning
muscle/experience metadata, equality-gated like every signed sheet.

## The architecture Sam directed (his call, this session)

**Machine sessions carry the MACHINE's muscles, not the template's.**
Sam: "they're all going to be the same no matter what session it is."
So the workbook has two authored surfaces:

1. **Modality Muscle Map tab** — one authored row per machine modality
   (Bike, Air Bike, Row, Ski). A machine-rendered session's muscles DERIVE
   at read/render from the modality that renders it. Stored once, derived
   everywhere — the north star's own shape.
2. **Per-template rows (first tab)** — the 26 run-based templates keep
   per-template muscles, because running load varies with the quality
   (top-end = hamstring-dominant; acceleration = glute/quad). The 27
   machine-agnostic templates carry "— from map —" and NO per-template
   muscles: deriving one from the map AND storing one would be two
   answers.

## Sam's authored specifics (recorded verbatim-adjacent)

- Bike: Quads primary; Calves, Knee, Glutes secondary ("bike is quads,
  calves, knee").
- Row: Low back, Glutes, Hamstrings primary; Shoulders, Upper back, Grip
  secondary ("lower back, glutes, hammies, shoulders, wrist").
- **Vocabulary decision:** "Wrist" is not in the muscle vocabulary; Grip
  is the signed stand-in. Adding Wrist as a new word remains open to Sam —
  do NOT add it unprompted.
- Ski: Lats, Triceps, Midline primary (Midline promoted — "does ski erg
  have grip and midline as well?", confirmed); Shoulders, Low back, Grip
  secondary.
- Experience gates: run-based sprint families one_plus_years with Sam's ⚑
  debate note (mirrors the signed MAS 15:15 Blocks row); machine/erg,
  aerobic capacity, flush, low-intensity decel/landing, and session
  formats = everyone.

## Build notes (for the implementing session)

- Extend muscleExperienceMetadata (or its successor owner) from this
  workbook the usual equality-bound way; the modality map needs its own
  typed owner and a derive-at-render path for machine-rendered sessions.
  One owner for "which muscles does this session load" — no surface
  composes its own answer.
- This retires the SELECTABLE_WITHOUT_METADATA derived gap once landed.
- The existing signed rows (MAS 15:15 Blocks, Erg EMOM) are unchanged and
  must not be re-derived from this sheet.
