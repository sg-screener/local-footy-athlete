# The three unauthored translations — for Sam's signing

**Sam's instruction, 2026-07-30:** extract the remaining §4 translations from the
onboarding influence map as signing sheets, same drill — the `testingBias` squat/bench/
sprint bands, `LOCATION_EQUIPMENT`, and the `motivation` comma-split (propose typed
storage).

**Nothing is wired. No behaviour changed by this document.** Every number below is what
the app does TODAY, written out so it can be signed, amended or killed.

**The pattern they share**, and it is why they were grouped: each is a **table that turns
an answer into a number or a tag.** The answers are Sam's, the categories are usually
Sam's, and the translation between them is where authorship silently stopped. The
placement sheet found the same shape in composition; the mobility bundles found it in
grouping.

---

## §1 — THE TESTING BANDS: squat, bench and sprint → a lean

### 1.1 What the app does now

Two onboarding answers become a 0-4 BAND, and the GAP between the bands produces a lean:

| `squatStrength` | band | | `benchStrength` | band |
|---|---|---|---|---|
| I don't squat | 0 | | I don't bench | 0 |
| Less than bodyweight | 1 | | Less than bodyweight | 1 |
| Around bodyweight | 2 | | Around bodyweight | 2 |
| 1.5x bodyweight | 3 | | 1.25x bodyweight | 3 |
| 2x bodyweight+ | 4 | | 1.5x bodyweight+ | 4 |

Then:

| Condition | Effect |
|---|---|
| upper band − lower band **≥ 2** | lower-strength lean +1, accessory +0.5, "weak lower" signal |
| upper band − lower band **≤ −2** | upper-strength lean +1 (the mirror) |
| `sprintExposure === 'No sprint training'` | speed lean +0.5 |

All of it is then capped at 0.1 and phase-scaled (off-season 1.0, pre-season 0.6,
in-season 0.3), so the effect is a nudge to which template or exercise gets picked — never
a count.

### 1.2 What is authored and what is not

| Part | Authority |
|---|---|
| The answer options | **Sam's** — they are the onboarding questions |
| The 0-4 ORDERING of each ladder | effectively Sam's: it is his own ladder in his own order |
| **The ladders being COMPARABLE** | **[MINE]** — that squat band 3 and bench band 3 mean "the same amount of strong" |
| **The threshold of 2** | **[MINE]** — nothing says a two-band gap is the point where a lean is warranted |
| **The magnitudes** (+1, +0.5, 0.1 cap) | **[MINE]** |
| **`No sprint training` → speed lean** | **[MINE]**, though the direction is hard to argue with |

**The one I would put first, because it is the assumption underneath the others: the two
ladders are treated as the same scale.** `1.5x bodyweight` squat is band 3 and `1.25x
bodyweight` bench is band 3, so an athlete who squats 1.5x and benches 1.25x reads as
perfectly balanced. That may be exactly right — those are roughly matched standards — but
it is a strength-standards judgement nobody has made out loud, and every comparison the
mechanism draws rests on it.

### 1.3 What I would ask

1. **Are the two ladders comparable band-for-band?** If not, the gap arithmetic needs a
   different shape (an offset, or per-answer pairs you rule directly).
2. **Is a two-band gap the right trigger?** One band is noise; three may never fire.
3. **Should "I don't squat" (band 0) behave differently from a genuine weakness?** It is
   currently the same as "very weak", and it may mean "I have never tried".
4. **Kill or keep the sprint-exposure lean?** It is the smallest of the three and the
   easiest to justify, which is also why it is the easiest to leave unexamined.

---

## §2 — `LOCATION_EQUIPMENT`: a place → a kit list

### 2.1 What the app does now

`trainingLocation` becomes a set of equipment tags, which decides which exercises exist
for that athlete:

| Location | Tags |
|---|---|
| **Commercial gym** | bodyweight, dumbbells, barbell, cables, bands, bench, foam_roller, bike_or_treadmill, pullup_bar, kettlebell, machine |
| **Club gym** | as above **minus kettlebell** |
| **Home gym** | bodyweight, dumbbells, bands, foam_roller, kettlebell |
| **Outdoor** | bodyweight, bands |

Unknown location falls back to Commercial gym.

### 2.2 Why this one matters more than it looks

**It is the widest-blast-radius table in the sheet.** Equipment decides POOL MEMBERSHIP:
every pool draw filters on these tags, so this table silently determines which of Sam's
authored exercises an athlete can ever be shown. `Dead Hang` needs `pullup_bar` and
`Dumbbell Pullovers` needs `dumbbells`+`bench` — so a Home-gym athlete never sees either,
by this table's decision and no ruling.

**And three specific calls are doing real work with no argument behind them:**

1. **Club gym has no kettlebell, Home gym does.** That is a claim about Australian
   community football clubs versus garages. It may well be true; nobody wrote it down.
2. **Home gym has no bench and no pullup bar.** Both are common home-gym items, and their
   absence removes real exercises.
3. **Outdoor has bands but no foam roller.** A foam roller is more portable than a band set.

**The safe direction, if you would rather not rule a table:** the app already has
`equipmentSelectionCompleteness` and an explicit equipment answer. This table is only
reached when the athlete has NOT given one. So the honest fallback might be to ask rather
than infer — which would make the table a legacy path with a retirement plan instead of a
standing rule.

### 2.3 What I would ask

1. **Sign the four rows**, amend them, or
2. **rule that an inferred kit list is not good enough** and the app asks whenever the
   equipment answer is incomplete.

---

## §3 — THE `motivation` COMMA-SPLIT, and typed storage

### 3.1 What the app does now

`motivation` is stored as **one string**, and two consumers split it on `', '` to recover
a list:

```
goals: data.motivation ? data.motivation.split(', ') : []          // coachingEngine
goals: args.profile.motivation ? args.profile.motivation.split(', ') : []  // recoveryAddonBuilder
```

Those goals then drive `programmingBias` — role/goal leans on strength, conditioning and
accessory selection.

### 3.2 Why the split is a defect and not a detail

- **It is two copies of one parsing rule**, in two modules, either of which can drift.
- **It is separator-fragile.** An answer joined with `","` rather than `", "`, or an option
  whose own label contains a comma, silently produces the wrong goals — and every
  downstream lean is then computed from a mis-parsed list with no error anywhere.
- **It stores a DERIVED shape.** The athlete picked several goals; the app stored a
  sentence and now re-derives the list. The north star's rule is the other way round:
  store the decisions, derive the presentation.

### 3.3 The proposal: typed storage

> **`motivation` becomes `goals: MotivationGoal[]`** — a typed array of the authored
> options — and the display string is DERIVED at render, not stored.
>
> - one owner of the option list, so a goal the app can lean on is a goal the athlete can
>   pick, both directions gated;
> - a read-ingress lift for existing stored strings (the `powerBlock` / hydration
>   precedent), so no athlete is asked again;
> - the two `.split(', ')` sites are deleted, not fixed.

**Under L15 (one write format)** the lift is read-only and the new shape is the only thing
written from then on.

### 3.4 What I would ask

1. **Sign the typed-array direction**, or rule that the sentence is the truth and the
   goal-leans should read it differently.
2. **The option list** — the influence map notes `motivation` is [BIBLE] §12 for its
   effect but the OPTIONS themselves need pinning as an authored set if goals are to be
   typed.

---

## §4 — WHAT THIS SHEET DOES NOT COVER

- **`INJURY_BODY_AREA_MAP`** — census **LR-27**, per Sam's instruction. The single owner
  (`data/injuryRegions.ts`) already exists; two copies remain.
- **`teamTrainingIntensity` → stress** — resolved on 2026-07-30: a team night is a hard day
  unconditionally, and the answer is now an estimate seed
  (`docs/TEAM_NIGHT_SIZE_SHEET_2026-07-30.md`).
- **The load ratios** — verified RULED, not [MINE]; the influence map's §0 carries the
  correction and the receipts.

---

## §5 — WHAT I NEED FROM SAM

| # | Question | Where |
|---|---|---|
| 1 | Are the squat and bench ladders comparable band-for-band? | §1.3 |
| 2 | Is a two-band gap the right trigger, and are the magnitudes right? | §1.3 |
| 3 | Does "I don't squat" mean weak, or untested? | §1.3 |
| 4 | Sign the four `LOCATION_EQUIPMENT` rows, or rule that the app asks instead? | §2.3 |
| 5 | Sign typed `goals`, with a read-ingress lift for stored strings? | §3.4 |
| 6 | Pin the motivation OPTION list as an authored set? | §3.4 |
