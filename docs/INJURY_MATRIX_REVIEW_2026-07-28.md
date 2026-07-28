# Injury matrix — AUTHORED FINAL, 2026-07-28

**Twin of `docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx`.** Generated from
`docs/INJURY_MATRIX_RULINGS_2026-07-28.json`, the transcript of Sam's ruling set.
Nothing is hand-edited — regenerate rather than patch.

**Phase 1 COMPLETE. Two items ruled but NOT implementable — see Blocked below.**

---

## The declaration — signed by Sam, 2026-07-28

> *"Any exercise/region cell with no matching rule and no exception = good. From
> here, 'good' is always authored, never assumed."*

That signature is what closes the unit. The `inj()` default made absence look like
approval; every `'good'` in the final matrix now traces to a rule, an exception,
or this declaration. `declaration.signed` gates it in code — unsign it and
unmatched cells revert to `null`, which fails the build rather than guessing.

## Resolution model

> Rules live on **either** axis — movement pattern or primary muscle. The
> **strictest** matching rule wins. Named exercise **exceptions beat all rules**.
> No precedence ordering to author.

A lattice join plus an override — `strictest` is associative and commutative, so
the axes cannot disagree about who goes first.

## The thirteen regions

groin, hip, quad, hamstring, knee, calf, ankle/foot, **ribs**, lowerBack, neck,
shoulder, elbow, wrist/hand

`ribs` was added by amendment, superseding both the earlier twelve and the
"ribs stay unroutable" line. Sam's rationale on record: *bracing and impact load
the ribs; severity bands handle the broken-ribs case (8–10 pauses affected work),
while low-severity corks keep training minus aggravators. An unroutable real
complaint would be silently ignored — the defect class this app doesn't do
anymore.*

`hip`, `quad`, `neck`, `ribs` have no predecessor, so every rule on them is Sam's
directly; no evidence could exist.

---

## The numbers

| | |
|---|---|
| Cells | 149 × 13 = **1,937**, all authored |
| Distribution | **924 caution · 24 avoid · 989 good** |
| Rules | **157** (20 authored by Sam for the new regions) |
| — of which currently bind | **33**; 124 redundant |
| Exceptions | **18** — all stand, **0 dissolved** |
| Conflicts Sam resolved by hand | **5** |

**Where each final cell comes from:** rule 1,020 · declaration 804 · ruling 75 ·
exception 18 · authored 12 · authored-stricter 8.

### Ruling 1 — the five conflicts

All five resolve to `caution` (Back Squat, Front Squat, Bulgarian Split Squats,
Walking Lunges, Nordic Lower). Sam's reasoning on record: caution's severity
behaviour (untouched 1–3, reduced 4–5, removed 6+) matches how he'd coach it, and
the old pubalgia `avoid` thinking survives in the stricter plyo exceptions.

All five land on `caution` **straight from the rules** — none needed an exception,
so the ruling and the evidence agree.

### Ruling 5 — all 18 exceptions survive

None dissolved. The new rules are all on new regions, and the conflict
resolutions agree with the rules, so nothing collapsed. The list is unchanged:
14 stricter than their rule, 4 looser (three of them `Scap Pull Ups`, the
deliberate profile that started this unit).

### Ruling 3 — conditioning, by hand

Sam's authored principle, recorded verbatim for the future quality-grid unit:

> *"caution any region the modality's equipment or movement meaningfully uses;
> severity does the rest."*

Stricter-wins held: the sprint `hamstring`/`calf` avoids stand above the blanket
cautions, verified. `Easy Bike` stays `good` in all thirteen — Sam's escape hatch.

---

## BLOCKED — ruled by Sam, not implementable

### 1. The three dual routes

`hip flexor` → hip + quad · `achilles` → calf + ankle/foot · `upper back` →
shoulder + neck.

**The mechanism is single-target.** `resolveInjuryBucket` returns
`InjuryBucket | null` — one bucket — and that scalar is threaded through
`coachInjuryTargetResolver`, `programAdjustmentEngine`, `trainAroundEngine`,
`injuryAdjustmentEngine` and `guidedInjuryControl`. Per Sam's own stop condition
these are **recorded on the Routing tab and not implemented**.

The change is deeper than widening a return type:

- `coachInjuryTargetResolver.ts:165` uses bucket **equality** to decide whether
  two injury mentions are the same episode. With duals that becomes set overlap —
  does a new "hip flexor" match a prior "quad" episode? A semantic ruling.
- Four `switch (bucket)` sites emit per-bucket copy and dosing
  (`programAdjustmentEngine:886`, `injuryAdjustmentEngine:280`,
  `constraintPlan:265`, `exposureEngine:512`).
- `trainAroundEngine.ts:67` requires a non-null scalar.

The other **8 single-target routes are ruled and implementable**, including
`rib`/`ribs` → `ribs`.

### 2. The `Traps` → `neck` rule is inert

`Traps` is in Sam's authored `MuscleGroup` vocabulary but is **never a primary
muscle on any strength exercise** — it appears only as *secondary*, on exactly two
(`Overhead Press`, `Shrugs`). So the rule can never fire.

The consequence is specific. **`Shrugs`** — the most neck-loading lift in the pool
— has primary `Upper back` and pattern `isolation_upper`. Sam's neck pattern rules
are `carry` and `vertical_push`, so `Shrugs` matches **no neck rule at all** and
lands on `good` via the declaration. `Overhead Press` is covered, but only because
it is `vertical_push`.

This is the same failure mode as `pubalgia`: authored, and unreachable. The
derivation records and reports inert rules rather than dropping them; a muscle
absent from the vocabulary entirely still throws as a typo.

**Sam's options:** move the rule to `Upper back` primary, add `isolation_upper` to
the neck pattern list, or name `Shrugs` as an exception.

### 3. A third body-part map, not two

Beyond the known twin, `guidedInjuryControl.ts:103` carries a **third**
regex-based mapping that disagrees with both — and its `rib` → `shoulder` line is
now wrong under the amendment, as are `quad` → `knee`, `hip` → `adductor`,
`neck` → `shoulder` and `upper back` → `lowerBack`. Phase 2 collapses **three**
owners, not two.

---

## Verification

`npm run verify:injury-matrix-sheet` — **38 assertions, 0 failures.**

It parses the rule grids, exceptions and declaration **out of the workbook** and
re-derives the matrix from scratch, rather than checking the sheet against the
JSON it was built from. It also holds the sheet to `exerciseTags.ts`: every rating
the code authors today must survive into the final matrix, since the exceptions
exist precisely to preserve those judgements. Stricter-wins on conditioning is
asserted, as is the blocked status of the duals.

Headers are pinned **by content** at their reader row. A blank row emits no
`<row>` element, so it is invisible from the read side and a "no blank rows" check
is vacuous — proven by mutation earlier in this unit.

---

## Phase 2 — not started

Blocked in part, so it is not begun rather than half-begun.

**Unblocked:** sheet↔code equality both directions; migrate `InjuryProfile` to the
thirteen regions; every entry authors all regions explicitly; `inj()` dies or
becomes a validator refusing incomplete profiles.

**Blocked on Sam:** the dual-route decision (which gates the
`BODY_PART_TO_BUCKET` collapse, since the collapsed owner's signature depends on
whether routing becomes multi-target), and the `Traps`/`Shrugs` neck gap.

Gates for Phase 2: `test:bible` EXIT=0, `tsc`, content locks.
