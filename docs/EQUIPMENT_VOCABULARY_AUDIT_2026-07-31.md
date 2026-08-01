# Equipment vocabulary audit — the checklist, derived from the library

**Sam's ruling 1, 2026-07-31:** *derive the complete equipment vocabulary from the
exercise library itself… That derived list IS the onboarding checklist's content: if
nothing needs it, it is not asked; if anything does, it cannot be omitted.*

This sheet is that derivation, measured — not read off a document. The deriver is
`src/rules/equipmentVocabulary.ts`; it imports the authored data modules and unions every
requirement they can place on a generated session. The gate (`test:equipment-vocabulary`,
in `test:bible`) re-runs the derivation on every build and is red in both directions:
an authored exercise requiring an unaskable tag, or an asked tag nothing requires.

**Sources read** (every authored surface that can put a requirement on a session):
`POOL_REGISTRY` (accessory/prehab/recovery, typed tags), `STRENGTH_POOLS` (equipment
class via the load-authority classifier generation itself filters with),
`POWER_EXERCISE_POOL` (authored requirement strings), `DEFAULT_EXERCISES` (the live
`buildWorkoutsFromCoach` database), `CONDITIONING_META` + all 55
`CONDITIONING_TEMPLATES` (modalities). The adjustment layer was checked and authors no
requirements of its own — its session names resolve through `CONDITIONING_META`.

---

## §1 — THE CHECKLIST (what the step will ask)

### Strength & accessory equipment — nine questions

| Ask | Requiring sites | Example |
|---|---|---|
| Dumbbells | 57 | Hammer Curl; 36 strength-pool entries |
| Barbell (+ rack) | 26 | Back Squat and every anchor lift family |
| Cables | 15 | Tricep Pushdown, Cable Face Pull |
| Resistance bands | 13 | Band Pull-Apart, Banded Bicep Curl |
| Bench | 10 | Incline Dumbbell Curl, DB Bench Press |
| Machines | 8 | Leg Press, Seated Calf Raise |
| Pull-up bar | 5 | Chin-Up Negative, Hanging Leg Raise |
| Foam roller | 5 | the tissue-quality pool |
| Kettlebell | 2 | Kettlebell Swings, Bottoms-Up KB Press |

### Conditioning machines — four questions

| Ask | Sites | Provenance |
|---|---|---|
| Bike erg / air bike | 43 | 6 authored sessions + 37 template rows |
| Row erg | 35 | 3 + 32 |
| Ski erg | 32 | 3 + 29 |
| Treadmill | 1 | **substitution ladder only** — no authored row is treadmill-native; it exists so conditioning can land indoors when ergs are missing |

### Not asked, with pinned justifications (both asserted by the gate)

- **bodyweight** — not equipment an athlete can lack; the resolver seeds it
  unconditionally.
- **bike_or_treadmill** (the coarse tag) — derived from the modality answers above;
  asking it separately would store one fact twice.

That is the whole list: **9 equipment questions + 4 machine questions.** Nothing else in
the library can require anything else, and the gate keeps that sentence true.

---

## §2 — WHAT THE GATE HOLDS

- A new exercise requiring a tag the checklist does not ask → **red the day it is
  authored**, not the day an athlete misses a session it silently gated.
- An asked tag nothing requires (a dead question — how the old 8-tag constant survived) →
  red.
- A new `EquipmentTag` type member → fails compilation until classified
  asked / always-available / derived.
- Every strength-pool name must be classifiable by the load-authority classifier —
  an entry whose equipment generation cannot see is red (today: zero).
- Template `modalityNotes` are prose (a known representation gap, recorded with the five
  selection-time properties); until typed, every note must use a recognised modality form
  so a new modality cannot arrive invisibly. The gate already caught and now understands
  Sam's "All 5 modalities" shorthand.

---

## §3 — QUESTIONS FOR SAM (the only ones the derivation surfaced)

1. **Depth Jumps requires `'Box'`, and no athlete can ever answer "I have a box."**
   Measured consequence, pinned by the gate: Depth Jumps is **unselectable for every
   athlete today, even with a full gym** — a dead authored row. Options:
   (a) a plyo-box question joins the checklist (the derivation adds it automatically the
   moment the requirement maps); (b) you re-author the requirement away (a bench or
   ledge works); (c) the row retires. **This is authored content, so it is your call,
   not mine.** Until ruled, the requirement sits in a pinned pending list
   (`UNMAPPABLE_REQUIREMENTS_PENDING_RULING`) that the gate holds to exactly one entry.

2. **Air bike vs bike erg.** Your template notes distinguish them ("Air Bike (native)";
   the flywheel rule excludes ski/row but allows air bike), but the equipment vocabulary
   has one `bike`. One question ("Any bike — erg or air bike") keeps today's shape; two
   questions would let rendering respect the native-air-bike rows properly. The step can
   ship either way; the derivation carries whichever you rule.

3. **Easy Swim** (modality `swim`) is reachable when an athlete asks the coach for an
   off-feet swap. No pool-access question exists and none is proposed — flagged so the
   sheet is complete, not because it needs an answer now.

---

## §4 — NOT COVERED

- The onboarding step UI itself — built after this sheet returns (ruling: audit back to
  Sam before the step ships). Copy through the signed sheet; visuals ride with the
  buttons/UI unit.
- Typing the five selection-time template properties (incl. renderable modalities) —
  named debt, not this unit.
- The coach-chat `baseline_equipment` producer — LR-6 standing STOP, untouched.
- Whether the nine equipment labels above are the athlete-facing WORDING — labels are
  copy and go through you with the step.
