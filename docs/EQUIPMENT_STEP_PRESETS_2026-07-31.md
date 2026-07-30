# Equipment step — preset tick-lists and step copy, for signing

**Per Sam's audit ruling 3 (2026-07-31):** the step asks "Where do you train?" first;
the choice pre-ticks the checklist as a visible starting point; the athlete unticks what
their place doesn't have and ticks what it does. **The stored answer is the final ticked
list — an athlete decision, never an inference.** Location is a UI seed, stored as coach
context only; a declaration + gate (`onboardingFieldInfluence`) now makes "nothing
downstream reads it" a red-gate law, and every dead read was deleted with it.

This sheet is the two things that need your signature: the three preset tick-lists and
the step's athlete-facing copy. **Presets are signed defaults, not rules** — the gate
holds them inside the derived vocabulary (`test:equipment-vocabulary`), and changing them
never changes any athlete's stored ticks.

## §1 — The three preset tick-lists (drafted over the 15-question vocabulary)

The derived vocabulary is now **10 equipment questions + 5 machine questions** (your "14"
plus the box you added in ruling 1).

| Question | Commercial gym | Club gym | Home gym |
|---|---|---|---|
| Barbell & rack | ✓ | ✓ | — |
| Dumbbells | ✓ | ✓ | ✓ |
| Cable machine | ✓ | — | — |
| Weight machines | ✓ | — | — |
| Resistance bands | ✓ | ✓ | ✓ |
| Bench | ✓ | ✓ | — |
| Pull-up bar | ✓ | — | — |
| Kettlebell | ✓ | — | — |
| Foam roller | ✓ | — | ✓ |
| Plyo box | ✓ | ✓ | — |
| Bike or bike erg | ✓ | ✓ | — |
| Air bike / assault bike | ✓ | — | — |
| Row erg | ✓ | — | — |
| Ski erg | ✓ | — | — |
| Treadmill | ✓ | — | — |

Commercial = all (your sketch). Club = your sketch ("barbell, rack, dumbbells, bike")
drafted out to the usual club-room kit — bench, bands and a box included; say the word
and any column changes. Home = basic (dumbbells, bands, foam roller).

## §2 — Step copy (proposed)

- Location screen: **"Where do you train?"** / "We'll start the equipment list from your
  answer — you'll fine-tune it next." Tiles: Commercial gym / Club gym / Home gym.
- Checklist screen: **"What can you train with?"** / "We've ticked the usual kit for a
  {location}. Untick anything your place doesn't have, and tick anything extra it does."
  Sections: "Gym equipment", "Cardio machines". Footnote: "Nothing ticked? Continue
  anyway — you'll get a bodyweight program."
- Item labels: the §1 question column, exactly (one label owner for step, Review row and
  profile surface).

## §3 — Recorded decisions inside the ruling

- Ticks only at onboarding: an untick is HAVE = no. NEVER (permanent exclusions) lives on
  the profile equipment surface. Editing an already-given answer from Review skips the
  location question and shows the saved ticks — re-seeding would overwrite a decision.
- A tick made while editing overwrites an earlier NEVER for that item (the newer decision
  wins); an untick preserves an existing NEVER rather than downgrading it to "not today".
- `trainingLocation` is declared coach-context-only; `AthleteContext` no longer carries a
  location at all.
