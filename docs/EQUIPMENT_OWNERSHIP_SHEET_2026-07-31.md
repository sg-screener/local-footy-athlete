# Equipment — the survey Sam commissioned, and the fix as a sheet

**Sam's instruction, 2026-07-30:** *"survey before ruling."* He reported that the
equipment question is **no longer in the onboarding flow**, and recalled that the app
assumes location-typical equipment. Both halves of that recollection are correct, and the
survey found the situation is **worse than the influence map described**.

**Nothing is wired. No behaviour changed by this document.**

---

## §0 — THE HEADLINE: the influence map was wrong, and so was I

The map (`ONBOARDING_INFLUENCE_MAP_2026-07-30.md` §2.4) says:

> | `trainingLocation` | `inferEquipment`, athlete context | which equipment tags are assumed | **[MINE]** |
> | `equipment` | 89 rules/data sites | which exercises exist for this athlete | **[RULED]** |

And `UNAUTHORED_TRANSLATIONS_SHEET_2026-07-30.md` §2.2 says:

> This table is only reached when the athlete has **NOT** given [an equipment answer].

**Every one of those statements is misleading, and the last one is simply false.**

The truth, with receipts below:

1. **No onboarding step collects `equipment`.** There is no equipment question to have
   been removed — the registry has never had one.
2. **No onboarding step collects `trainingLocation` either, and no screen in the app
   writes it.** It is a hardcoded constant, `'Commercial gym'`, for every athlete alive.
3. **`LOCATION_EQUIPMENT` is not a fallback. It is the live path for 100% of athletes**,
   and it fires *in addition to* the stored checklist rather than instead of it.
4. So the widest-blast-radius table in the app is keyed on **an answer nobody is asked**,
   and I presented it to Sam for signing as though its four rows were the question. **The
   rows are not the question. The absence of a door is the question.**

The `[RULED]` mark on `equipment` was earned by the equipment *lattice* — the tag
vocabulary and its provenance lock, which are genuinely Sam's. It says nothing about how
an athlete's tags are chosen, and I let it imply that it did.

---

## §1 — THE RECEIPTS

### 1.1 There is no equipment step, and no location step

`src/utils/onboardingSteps.ts` — `ONBOARDING_STEPS` declares 19 steps. Neither
`equipment` nor `trainingLocation` appears in any step's `collects`. Instead, lines
218-221:

```ts
/**
 * Profile fields the store guarantees from its initial state rather than
 * collecting through a step. They are required for generation but can never be
 * missing, so no step can own them.
 */
export const PROFILE_DEFAULT_REQUIRED_FIELDS: readonly (keyof OnboardingData)[] = [
  'trainingLocation',
  'equipment',
];
```

That comment is accurate and its consequence is the finding: *"can never be missing"* is
true because **nothing can ever set them.**

### 1.2 What the store hands every athlete

`src/store/profileStore.ts:45-57`:

```ts
const initialOnboardingData: OnboardingData = {
  trainingLocation: 'Commercial gym',
  equipment: [
    'barbell', 'dumbbells', 'squat_rack', 'pullup_bar',
    'cable_machine', 'hamstring_curl', 'knee_extension', 'bands',
  ],
};
```

Eight tags and a location, authored by nobody, identical for every athlete.

### 1.3 What that resolves to — measured, not read

Running `resolveEquipmentCapabilities` on exactly that profile:

```
source            : legacy_positive_plus_location
completeness      : legacy_incomplete
tags              : bodyweight, dumbbells, barbell, cables, bands, bench,
                    foam_roller, bike_or_treadmill, pullup_bar, kettlebell, machine
modalities        : bike, row, ski, treadmill
```

The mechanism, in `src/utils/equipmentAvailability.ts`:

- `inferredSelectionCompleteness` finds no explicit completeness, a non-empty checklist,
  no *current*-vocabulary option, and all eight keys in `LEGACY_POSITIVE_KEYS` → returns
  **`legacy_incomplete`** (`:222-228`);
- because completeness is `legacy_incomplete`, `resolveEquipmentCapabilities` **unions in
  `inferEquipment(location)` and every conditioning modality of that location**
  (`:519-522`) — *on top of* the checklist, not as a substitute for it;
- `LOCATION_CONDITIONING_MODALITIES['Commercial gym']` is all four
  (`bike`, `row`, `ski`, `treadmill`) (`:197-202`).

**So Sam's ski-erg complaint reproduces exactly, and it is not an edge case — it is the
only case.** `'SkiErg Intervals'` and `'Hard SkiErg Intervals'` are real authored rows
(`src/data/exerciseTags.ts:123,150`, modality `ski`), and every athlete in the app is
eligible for them because a hardcoded location said so.

### 1.4 The doors that exist for baseline equipment

| Door | Where | Reachable? |
|---|---|---|
| `saveBaselineEquipmentSelection` | `equipmentAvailability.ts:642` | **NO product caller.** Exported, tested, wired to nothing |
| `baseline_equipment` change kind | `profileProgramTransaction.ts:108` | one producer: **coach chat** (`coachTurnController.ts:4008`) — and LR-6 is a standing STOP on that pipeline |
| `EquipmentLimitationSheet` | `screens/home/` | **YES** — but it writes a *temporary, dated* constraint fact, never the baseline |

So the app has a complete, typed, transactional baseline-equipment write path with a save
planner, a rebuild trigger and its own athlete-action trace — **and no screen calls it.**
This is the shape recorded in `[[authored-source-already-exists]]`: the owner exists and
sits unwired.

### 1.5 What is signed, and what is not

| Thing | Authority |
|---|---|
| The `EquipmentTag` vocabulary and the pool filters that read it | **[RULED]** — the equipment lattice + provenance lock |
| The exercise→tag requirements (`Dead Hang` needs `pullup_bar`) | **[RULED]** — authored per exercise |
| `TEMPORARY_EQUIPMENT_PRESETS` (the this-week sheet) | **[MINE]** — seven presets, unsigned |
| **`LOCATION_EQUIPMENT`'s four rows** | **[MINE]** — unsigned, as the map said |
| **`LOCATION_CONDITIONING_MODALITIES`'s four rows** | **[MINE]** — *not previously listed anywhere*; this is what puts ski/row on every athlete |
| **`initialOnboardingData`'s eight-tag checklist** | **UNAUTHORED** — no ruling, no marking, and it is the real default |
| **`trainingLocation` defaulting to `'Commercial gym'` with no door** | **UNAUTHORED** |

**The map listed one unsigned table here. There are four, and the two that decide the
most were not on the list.**

---

## §2 — THE FIX, AS A SHEET

Sam's direction, verbatim: *a **PROFILE EQUIPMENT surface** where athletes record what
they have / will **NEVER** have (permanent exclusions), so the app stops programming ski
erg for athletes without one — distinct from the existing "Missing equipment this week"
temporary flow.*

### 2.1 The shape that follows from the north star

Two facts, two lifetimes, one derivation. **Not** three copies of "what equipment exists".

```
HAVE      — the athlete's baseline kit          (a profile answer, permanent, editable)
NEVER     — permanent exclusions                (a profile answer, permanent, editable)
THIS WEEK — temporary restriction               (a dated life-fact — EXISTS ALREADY)

availableEquipment(date) = derive(HAVE, NEVER, active temporary facts, date)
```

`resolveEquipmentCapabilities` is already exactly this function and already takes
constraints and a date. **It does not need rebuilding — it needs its first input to stop
being a hardcoded constant.**

### 2.2 Why HAVE and NEVER are two answers and not one

They differ in what silence means, which is the same distinction the strength answers
just had ruled (`untested ≠ weak`):

- **HAVE** unchecked = "not today" — the app may ask again, may offer it, may assume it
  at a commercial gym.
- **NEVER** = "stop offering this, permanently" — a standing instruction. A ski erg the
  athlete will never own is not a gap in an answer; it is an answer.

One checklist cannot carry both, and collapsing them is what produces the current bug in
reverse: an unchecked box being *helpfully* re-inferred from location.

### 2.3 What this deletes

Under L15 (one write format) and the north star's "remove representations":

1. **`initialOnboardingData`'s eight-tag checklist — deleted.** A profile with no
   equipment answer must be *honestly empty*, not silently full. (`test:onboarding-
   generation-outcome` already establishes the precedent: the silent `DEFAULT_PROGRAM`
   fallback was retired for exactly this reason.)
2. **`LOCATION_EQUIPMENT` and `LOCATION_CONDITIONING_MODALITIES` — retired**, not signed,
   once a door exists. An inferred kit list is a stored derivation of an answer the app
   can simply ask for. This is §2.3's option (2) of the translations sheet, and the
   survey is why I now recommend it rather than offering it.
3. **The `legacy_incomplete` union branch — retired** with them; it exists only to
   rescue profiles whose checklist predates the current vocabulary, and those get a
   read-ingress lift, not a location guess.

### 2.4 The three questions this leaves for Sam

1. **Where does the surface live — onboarding, profile, or both?** Adding an onboarding
   step lengthens a flow Sam has already said is long; a profile-only surface means a
   fresh athlete has no equipment answer on day one. **I lean profile surface + an
   onboarding step**, because generation on day one is exactly when a wrong kit list does
   its damage. **[MINE]** either way — it is a ruling.
2. **What does the app do for an athlete with no answer yet?** The honest options are
   *refuse to generate* (the `test:onboarding-generation-outcome` precedent) or
   *bodyweight-only until answered*. I lean **bodyweight-only**: it is the one assumption
   that can never program something the athlete does not have.
3. **Does the temporary flow stay a preset list?** Its seven presets are unsigned
   `[MINE]`, and once HAVE exists, "this week I only have dumbbells" could be expressed
   against the athlete's own kit rather than a fixed menu.

### 2.5 Until it exists — the honest statement

Recorded here so it is not discovered again: **today, every athlete's equipment is the
full commercial-gym kit plus all four conditioning modalities, chosen by a constant in
the profile store and a location with no door. No athlete has ever answered an equipment
question in this app.** The `[MINE]`/UNAUTHORED marks in §1.5 are the current state, and
they should be readable from the code, not only from this file — which is what
`ONBOARDING_FIELD_DECLARATIONS` exists for, and why the declaration gate is the right
home for it.

---

## §3 — WHAT THIS SHEET DOES NOT COVER

- **The coach-chat `baseline_equipment` producer.** It is a live write path into the
  profile, and LR-6 is a standing STOP on the coach pipeline. Named, not touched.
- **The seven `TEMPORARY_EQUIPMENT_PRESETS`.** Unsigned, flagged in §1.5, not proposed —
  they belong with question 2.4.3 once HAVE exists.
- **Whether the four `LOCATION_EQUIPMENT` rows are factually right.** The survey makes
  the question moot: I am recommending retirement, not amendment, so the club-gym
  kettlebell argument is not worth Sam's time.
- **The 89 downstream sites that read resolved tags.** They read the derivation and are
  unaffected by where its input comes from — that is the point of fixing the input.
- **Migration for existing installs.** A read-ingress lift under L15; its shape depends
  on ruling 2.4.2 and is not designed here.
