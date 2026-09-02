# T-Bar Tib Raises — 2 September 2026

Owner: `tibbar`

## Boundary

Add T-Bar Tib Raises through the existing lower-prehab, equipment, loading,
automatic selection and Add/Swap owners. Add one athlete-answerable `Tib bar`
equipment capability with a T glyph. Keep Bodyweight `Tib Raises` as the
equipment-free base movement and use the same 2 × 15–20 repetition dose with
30 seconds rest.

## Design choice

Two options were checked:

1. Add name-specific branches to the lower warm-up, strength composer and Swap
   menu.
2. Record one typed equipment-progression relation beside the existing exercise
   variation families, then let every automatic pool filter and the existing
   Swap ladder consume that relation.

Option 2 is used. It keeps the base movement available when there is no tib bar,
prefers the loaded version automatically when the equipment is present, and
prevents both versions appearing in one session without creating another
exercise programmer.

## Verification

Starting checkpoint: `cca002a0d0239d048f977e410bac9168da19b1fd`.

- Red-first focused guard: 0/8 before the exercise and tib-bar equipment answer
  existed.
- `test:t-bar-tib-raises`: 10/10. It covers the exact dose, cues, video,
  muscles, sagittal plane, demand and injury ratings, new `Tib bar` answer and
  T glyph, total-kilogram control, 2.5 kg buttons, everyone/G-1/Primer policy,
  automatic progression, direct Swap, manual Add/Swap and shared family.
- Mutation: changing the progression source from `Tib Raises` to `Calf Raises`
  made the automatic-progression and direct-Swap cells fail; restoring it
  returned the guard to 10/10.
- Exercise Master workbook: one canonical row added; workbook equality is
  97/97, formula-error scan is 0, and the rendered sheet was visually checked.
- Catalogue intake: 913/913 across 15 distinct submitted exercises before its
  chained suites; equipment vocabulary 98/98; movement planes 10/10; compound
  grouping 8/8; equipment answers 50/50; equipment load increments 9/9; quick
  actions 64/64; TypeScript compilation passed.
- The full chained `test:exercise-intake` is not wholly green. It reaches and
  passes this exercise, then stops at the existing authored-cue load checks:
  54/56, with `Tib Raises` and `Copenhagen Plank (Half)` lacking the load
  classification that suite expects. Both failures are present in the starting
  checkpoint's sources and are outside this intake.
- Other existing repository reds remain: `test:form-cue-equipment` is 22/23 on
  `Pigeon Stretch`; `test:law-registry` is 13/14 because 21 older laws remain
  unguarded; `test:repo-law-guards` is 51/63 on its recorded shared-repo debt;
  and the second half of `test:power-primer-policy` stops because its fixture
  does not provide the now-required team-training-days answer. None of their
  named source owners were changed here.

No unusual app architecture was added. The only new shared concept is one small
equipment-progression relation, consumed by the existing automatic pool filters
and existing Swap ladder. This avoids name-specific selection branches.

## NOT COVERED

- Independent clinical validation of Sam's supplied ratings and restrictions.
- Physical-iPhone acceptance or external video playback.
- Full-year PDF audit and phone installation were not run.
- The pre-existing red suites listed above were measured, not repaired.
