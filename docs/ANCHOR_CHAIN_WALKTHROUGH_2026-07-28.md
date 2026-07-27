# How the app gets to the first weight on a card

**Read this before ruling on `LOAD_RATIO_REVIEW_2026-07-28.xlsx`.** Current behaviour
only — nothing here is a proposal, and nothing was changed to write it.

## Worked example: 80 kg athlete, 1–2 years experience

Onboarding asks bodyweight and experience separately from strength. Say they answer
squat *"Around bodyweight"* and bench *"Less than bodyweight"*.

**Step 1 — bodyweight × a multiplier gives two anchor 1RMs.**

    squat 1RM  = 80 kg × 1.0   = 80 kg     ("Around bodyweight")
    bench 1RM  = 80 kg × 0.65  = 52 kg     ("Less than bodyweight")

**Step 2 — each exercise names an anchor and a ratio.**

    Back Squat    anchor squat,  ratio 0.82
    Bench Press   anchor bench,  ratio 0.82

**Step 3 — multiply, then round to the equipment increment (barbell = 2.5 kg),
then floor at the equipment minimum (barbell = 20 kg).**

    Back Squat    80 × 0.82 = 65.60  →  65 kg      ← printed on the card
    Bench Press   52 × 0.82 = 42.64  →  42.5 kg    ← printed on the card

Same ratio, different weights, purely because the two anchors differ.

**Step 4 — the card prefers a real number over an estimate.** Display order is:
athlete's own override → weight stored on the workout → this estimate. The estimate is
only the *first* number they ever see; after that it is theirs.

---

## The three questions, answered precisely

### Does bodyweight scale anchors? **Yes — directly.**

Anchor 1RM *is* bodyweight × multiplier. Every one of the 77 ratios multiplies that.
A 100 kg athlete answering the same way gets `100 × 1.0 × 0.82 = 82 kg` on Back Squat
instead of 65 kg.

If bodyweight is missing, the code substitutes **82 kg** ("average AFL player"), which
is itself an unauthored number.

### Does experience scale anchors? **No — but it scales the final weight, for one group only.**

Experience never touches the anchor. It applies a multiplier *after* the ratio:

| Experience | multiplier |
|---|---|
| Complete beginner | **× 0.5** |
| 1–2 years | × 1 |
| 2–5 years | × 1 |
| 5+ years | × 1 |

So the example athlete (1–2 years) gets **× 1 — no reduction at all**. Only a complete
beginner is halved: their Back Squat would read 32.5 kg, not 65 kg.

**Two things about that ×0.5 worth knowing before you rule:**

1. It is **yours** — attributed to you, 2026-07-27, and it says it supersedes "an
   invented 0.75". It is one of the very few load numbers in the app with a real
   ruling behind it.
2. **It only applies on the generation path.** `defaultProgram` multiplies by it when
   it builds a workout. The render-time fallback in `useDayWorkout` — the one that
   fills in a weight for a card that doesn't have one, explicitly there to catch
   pre-existing programs — calls the estimator **directly and skips the multiplier**.
   So the same complete beginner can see 32.5 kg on a freshly generated card and
   65 kg on one that fell through to the fallback. I have not touched this; you asked
   for current truth.

### Does age scale anything? **No.**

`ageRange` is collected in onboarding and passed to the coach as conversational
context. It touches no load, set, rep or dose decision anywhere in the app.

---

## Important: squat is **not** flat 88 kg

The review sheet shows a "kg @ ref athlete" column computed at **squat 1RM = 88 kg**.
That is a **review-time reference athlete I chose**, so the numbers in the sheet could
be checked against the four figures in your 2026-07-25 load ruling — which fall out of
an 88 kg squat exactly.

**It is not a runtime constant.** No athlete is pinned at 88 kg. Every athlete's anchor
comes from their own bodyweight and their own strength answer, per Step 1.

Read the sheet's kg column as *"what this ratio produces for one specific athlete"*,
not *"what the app gives everyone"*. The **ratio** is the thing you are ruling on; the
kg column is only there to make the ratio legible.

---

## What this means for the sheet

Three layers sit between an athlete and their first weight, and you are only being
asked about the middle one right now:

| Layer | Where | Authored? |
|---|---|---|
| Bodyweight → anchor 1RM multipliers | **13 rows**, tab 1 | **No** |
| Anchor × ratio | 77 rows, tabs 2–5 | 6 yes, **71 no** |
| Experience multiplier | 2 values | **Yes** (you, 2026-07-27) |

> **Correction.** An earlier revision of this table said "11 values" for the top layer.
> That number was wrong — I wrote it without counting. It is **12 onboarding answers
> (6 squat, 6 bench) plus the missing-bodyweight fallback = 13 rows**, covering 8
> distinct multiplier values. Recording it here rather than quietly fixing it, since
> an uncounted number in a unit about unauthored numbers is the whole problem in
> miniature.

The top layer is upstream of all 77 ratios — an error there moves every suggested
weight in the app at once, so it may be worth ruling on before the ratios beneath it.

And the bench anchor is the specific gap: your 2026-07-25 ruling pinned squat 1RM but
never pinned bench, so every bench-anchored kilogram in the sheet rests on the app's
own `0.65 × bodyweight` default rather than on anything you said.
