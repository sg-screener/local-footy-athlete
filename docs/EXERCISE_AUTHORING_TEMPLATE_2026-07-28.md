# Exercise Authoring Template (2026-07-28)

> **AN AUTHORING TEMPLATE, SUPERSEDED AS A STATUS SURFACE.** Its boxes are fields
> to fill per exercise, not app status. The governing plan is
> `docs/PUBLISH_ROADMAP_2026-08-05.md`.

Read-only research report. **No code was changed to produce this.** Every field, allowed-value
list, and "what breaks" claim below was derived from reading the actual current schema, data
files, and enforcement tests — not from convention or memory. File:line citations are given so
you (or a terminal) can re-verify anything here before acting on it.

Fill in the template in **Section E** twice, once per new exercise. Everything in Sections A-D is
reference material explaining *why* each field in Section E exists and what happens if you leave
it blank.

---

## How "what breaks if missing" is scored

Three different failure modes exist in this codebase, and they matter differently:

- **LOUD** — a named test fails and blocks `npm run test:bible` / the build. You'll know
  immediately.
- **SILENT** — nothing fails, but the system quietly does the wrong thing (e.g. an omitted injury
  key defaults to "safe," an omitted `loadRatio` defaults to a fallback number). These are the
  dangerous ones — flagged in **bold** below.
- **NOT YET WIRED** — the field is required by a data-consistency test today, but no runtime
  selector reads it yet. Filling it in is still mandatory (the test enforces it), it just doesn't
  change athlete-visible behaviour yet.

---

## Section A — The join key

### A0. Canonical exercise name

The exact display string, used verbatim as the lookup key in every file in Section D. It is not
one field so much as the thing that ties all the others together — a typo'd variant in any single
file effectively creates a second, orphaned "exercise" the system can't reconcile.

- **Allowed values**: any string, but it must pass through the app's own name-normalisation
  unambiguously (`signatureTokens` in `src/utils/exerciseCanonicalisation.ts:144-154` — lowercases,
  strips punctuation, singularises each word, and expands known abbreviations: `ohp`→overhead
  press, `sa`→single arm, `db`→dumbbell, `bb`→barbell, `kb`→kettlebell, `rdl`→romanian deadlift,
  `dl`→deadlift, `banded`→band). If your name relies on an abbreviation not in that list, spell it
  out instead of inventing a new shorthand.
- **What breaks if inconsistent**: LOUD. `npm run test:exercise-canonicalisation` fails at build
  time if the name can't resolve to a single curated key; `npm run test:generation-vocabulary`
  fails if the AI-facing vocabulary and the selectable pool ever disagree on the name.

---

## Section B — Required for every exercise (with two narrow exemption paths noted inline)

### B1. Muscle & Experience sheet row — **`docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx`, sheet "Exercise Master"**

**This sheet is THE enforced source.** The code file `src/data/muscleExperienceMetadata.ts`
(`EXERCISE_MUSCLE_METADATA`) is described in its own header as "a typed projection, held to the
sheet by `muscleExperienceEqualityTests` in both directions. Do not hand-edit a muscle tag or a
gate here; change the sheet." Add the row to the xlsx first; the code array must then be updated
to match it exactly, or the equality test fails. Code must not lead the sheet.

| Column | Plain English | Allowed values | What breaks if missing |
|---|---|---|---|
| Pool | Which of the 24 authored exercise families this sits in | `Lower squat`, `Lower hinge`, `Upper push horizontal`, `Upper push vertical`, `Upper pull horizontal`, `Upper pull vertical`, `Lower plyometric`, `Carries`, `Accessories upper`, `Accessories lower`, `Shoulders`, `Upper back`, `Groin / adductors`, `Calves`, `Lower prehab`, `Midline`, `Shoulder health`, `Hamstring (light)`, `Tissue quality`, `Mobility`, `Easy cardio (zone 1)`, `Breathing reset`, `Conditioning`, `Power` | LOUD — the equality test checks pool membership matches exactly. |
| Exercise | Same canonical name as A0 | any string | LOUD if it doesn't match A0 byte-for-byte — reads as an unreconciled second exercise. |
| Primary Muscle Group(s) | The 1+ muscles this exercise mainly trains | One or more of: `Quads`, `Glutes`, `Hamstrings`, `Hips`, `Groin`, `Calves`, `Low back`, `Upper back`, `Lats`, `Chest`, `Shoulders`, `Triceps`, `Biceps`, `Traps`, `Midline`, `Knee`, `Feet`, `Outer hip`, `Grip` | NOT YET WIRED for selection (see below), but LOUD for the equality test if left blank. |
| Secondary Muscle Group(s) | Muscles this exercise trains as a support role | 0+ from the same list; use `—` if genuinely none (the sheet drops `—` on ingress — it is a placeholder, never a real tag) | Same as above. |
| Experience Level | The minimum training age Sam is comfortable auto-programming this to | Exactly one of: `everyone`, `everyone (regression)`, `1+ years`, `2+ years`, `advanced only` | LOUD (equality test) — and this is the field the training-age gate actually reasons on once Stage B wires it up. **This is Sam's own call, not derivable from the exercise's mechanics — the sheet header states "Changes require Sam."** |
| Notes | Free text; prefix with ⚑ if the gate above is a genuine judgment call rather than a settled one | any string, or blank | Nothing breaks; it's a human-readability aid only. |
| primaryCue | The mechanics/position/range/bracing cue | String, **18-word hard cap** (ideal 3-8 words), enforced per field. `PENDING — Stage B` is the only non-cue value allowed | LOUD. Blank fails "no sheet row has a blank cue"; over-length fails the cap; anything not matching code fails both directions. |
| secondaryCue | The intent/control/tempo/tension cue | Same cap; blank is legitimate (many cues are primary-only), and **must** be blank on a `PENDING` row | LOUD if it disagrees with code, or if a `PENDING` row carries one. |

**Important caveat, stated plainly**: `muscleExperienceMetadata.ts`'s own header says *"NOT WIRED
YET: nothing selects on this. Stage B consumes it."* Filling this row in is mandatory today only
because `exerciseContentReconciliationTests.ts:141` requires it unconditionally (no exemption
waives it) and because the equality test enforces sheet/code parity — but it does not yet change
what an athlete is actually offered. That will change when Stage B lands; author it correctly now
so nothing needs re-doing then.

Verify with: `npm run test:muscle-experience` (`src/__tests__/muscleExperienceEqualityTests.ts`).

### B2. Strength/movement tags — `src/data/exerciseTags.ts`, `EXERCISE_TAGS['<name>']`

Required **unless** the exercise is exempt as a `conditioning_format`, `zone1_recovery`, or
the typed exemption kinds (see Section D; `mobility_untagged` was retired on 2026-09-04 under R-364). If in doubt, fill it in — the
exemptions exist for genuine by-design gaps, not as a shortcut.

| Field | Plain English | Allowed values | What breaks if missing |
|---|---|---|---|
| `movement` | The movement pattern family — also the ONLY movement-grouping concept in the codebase (there is no separate "movement family" type; cue fallbacks and swap-pool routing both key directly off this) | `squat`, `lunge`, `hinge`, `plyo`, `horizontal_push`, `vertical_push`, `horizontal_pull`, `vertical_pull`, `carry`, `core`, `isolation_upper`, `isolation_lower`, `conditioning` | LOUD-ish: the whole exercise entry can't exist without it (required field); SILENT downstream — swap-pool fallback classification, the cue system's family-fallback cue, and the SessionRole auto-classifier (see Section C) all key off this, so a wrong value quietly misfiles the exercise into the wrong swap pool or cue family. |
| `region` | Body region | `lower`, `upper`, `full`, `core` | Same as above — used by pool/session-builder logic that groups by region. |
| `load` | How heavy this typically loads | `low`, `moderate`, `high` | SILENT — feeds session-builder scoring; a wrong value skews selection likelihood, doesn't hard-fail anything. |
| `fatigue` | Systemic fatigue cost | `low`, `moderate`, `high` | Same — scoring input only. |
| `doms` | Expected next-day soreness | `low`, `moderate`, `high` | Same — scoring input only. |
| `stability` | Balance/stabilisation demand | `low`, `moderate`, `high` | Same — scoring input only. |
| `unilateral` | Whether it's a single-limb movement | `true` / `false` | Same — scoring input only. |
| `eccentric` | Eccentric-loading demand | `low`, `moderate`, `high` | Same — scoring input only. |
| `lateWeek` | How appropriate this is close to game day (G-1/G-2 proximity, per the Bible's game-day rules — a separate concept from injury) | `good`, `caution`, `avoid` | SILENT — governs late-week session-building; a wrong value could quietly let a hard movement get programmed 1-2 days before a game, or needlessly block a safe one. |
| `power` (optional) | Marks this as a power/plyometric movement | `true` (omit entirely if not power-relevant) | Nothing breaks if omitted for a non-power exercise; omitting it for a genuine power movement means it won't be treated as one downstream. |
| `injury` | The 10-region injury-compatibility profile — see B3 below | see B3 | see B3 |

Verify indirectly with: `npm run test:content-reconciliation`, `npm run test:exercise-name-lock`.

### B3. Injury profile — `EXERCISE_TAGS['<name>'].injury`, all 10 keys

**This is the field most likely to fail silently, and there is no test that catches an incomplete
one — author it deliberately, not by omission.**

| Key | Plain English | Allowed values | What breaks if missing |
|---|---|---|---|
| `adductor`, `pubalgia`, `lowerBack`, `knee`, `hamstring`, `calf`, `ankle`, `shoulder`, `elbow`, `wrist` | How safe this exercise is when that body region is currently injured | `good` (no concern), `caution` (usable, deprioritise/reduce volume), `avoid` (hard-excluded while that injury is active) | **SILENT and dangerous.** The `inj()` helper (`src/data/exerciseTags.ts:157-160`) merges your overrides onto an all-`'good'` default — any key you don't explicitly set silently becomes `'good'`, i.e. "safe with this injury," whether or not that's true. Nothing in the test suite checks that all 10 keys were deliberately considered; an exercise authored with an accidentally-empty injury object is indistinguishable from one Sam reviewed and found genuinely safe everywhere. |

What each rating actually does at selection time (`src/utils/exerciseFilter.ts:149-198`,
`src/utils/exerciseScorer.ts:130-137`):
- `avoid` → hard-excluded outright whenever that injury is active (plus some region-specific extra
  exclusions for hamstring/adductor/lowerBack/calf/ankle around high-eccentric, plyo, or
  low-stability movements).
- `caution` → kept in the selectable set, but penalised in scoring (−4 or −8 points depending on
  reported severity), so it becomes less likely to be picked, not impossible.
- `good` → no penalty at all.

One more honesty note, since it affects how much weight to put on "severity": the Bible's 1-10
injury-severity scale (`src/rules/injurySeverityBands.ts`) exists in code and is used by the
substitution-risk path (`src/rules/injuryExerciseRisk.ts`), but the *main* session-builder filter
(`buildFilterContext`, `src/utils/exerciseFilter.ts:216-252`) collapses whatever severity the
athlete reports down to a crude mild-vs-everything-else before it ever reaches your `caution`/`avoid`
ratings. That's a pre-existing gap in the selection pipeline, not something you can author around —
noted here so "severity" isn't over-trusted as a fine-grained dial today.

### B4. Pool placement — exactly one of five systems, by exercise type

| If the exercise is... | ...it goes in | Required fields there |
|---|---|---|
| A main or accessory strength lift | `src/data/exercisePoolsStrength.ts`, `STRENGTH_POOLS[slot][role].entries` | `PoolEntry { name, loadRatio }` — see B5 |
| An accessory/prehab/carry/shoulder-health/mobility-adjacent catalog item | `src/data/exercisePools.ts`, `POOL_REGISTRY` | name + `equipment: EquipmentTag[]` (see B6) |
| A mobility-flow item | `src/data/mobilityFlowTemplates.ts`, `MOBILITY_FLOW_TEMPLATES` | — |
| A power/plyometric movement | `src/rules/powerExercisePool.ts`, `POWER_EXERCISE_POOL` | — |
| A conditioning session-format (not a discrete movement) | `src/data/exerciseTags.ts`, `CONDITIONING_META` | `{ tier, modality, impact }` — see Section B7 |

**What breaks if an exercise lands in none of these**: SILENT, not LOUD. `classifyPoolSlot`
(`src/data/exercisePoolsStrength.ts:498-527`) falls back to a tag-based heuristic keyed off
`movement`, so the exercise still gets *a* classification and won't hard-crash anything. What it
loses: `getSlotSiblings` returns nothing for it, so rotation-based progression transfer
(`extractSlotExposureHistory`) silently falls back to per-exercise-only history — the exercise
just never benefits from (or contributes to) cross-sibling progression logic. It is also, per
`selectableExerciseVocabulary.ts:28-36`, not actually "selectable" at all unless it's registered in
one of these five places — so omitting this step doesn't just degrade progression, it can mean the
exercise never appears to an athlete.

### B5. `loadRatio` (only for `STRENGTH_POOLS` entries)

- **Plain English**: what fraction of the pool slot's *reference* exercise's 1RM this movement is
  typically loaded at (e.g. Back Squat = 1.00 is the slot reference; Front Squat = 0.85).
  `0` means bodyweight.
- **Allowed values**: any number (no enforced range in code — use judgement, comparable existing
  entries are the working precedent).
- **What breaks if missing**: SILENT. If the exercise is never added to a pool at all, downstream
  code defaults an "original load ratio" lookup to `1.0` (`exerciseSubstitutes.ts:642`) and guards
  elsewhere skip the ratio-normalised progression transfer entirely for it
  (`progressionHelpers.ts:294-296`) — so it just silently loses accurate progression transfer, it
  doesn't crash.

### B6. Cue — `src/data/exerciseCues.ts`, `EXERCISE_CUES['<name>']`

**This changed on 2026-07-28.** Cues are now columns on the B1 sheet, and
`exerciseCues.ts` is a typed projection of it — held in **both directions**, exactly like
`muscleExperienceMetadata.ts`. Author the cue in the B1 row first; mirror it here second.

A cue that is not on the sheet fails the build, so this file can no longer be the place a
cue starts. That is the point: authored-ness used to accumulate across three documents
with nothing reconciling them, and 31 cues ended up here that the gate's document had
never heard of. See `docs/CUE_RECONCILIATION_DIAGNOSIS_2026-07-28.md`.

| Field | Plain English | Allowed values | What breaks if missing |
|---|---|---|---|
| `primaryCue` | The mechanics/position/range/bracing cue | String, **18-word hard cap** (ideal 3-8 words), enforced independently per field (not combined with secondary) | LOUD. `npm run test:authored-cues` fails the 18-word cap, the coverage check, AND "every shipped cue is on the sheet" if the B1 row disagrees. |
| `secondaryCue` | The intent/control/tempo/tension cue | String, same 18-word hard cap; **may be an empty string** (some authored entries are), but the field itself must exist | Same test, same failure mode. |

Do **not** add an entry here for an exercise whose B1 row reads `PENDING — Stage B`; the
gate treats that as an unruled cue shipping under the appearance of an authored one.

Verify with: `npm run test:authored-cues`. The exercise's canonical NAME must also resolve cleanly
through the token-normalisation system described in A0, or `npm run test:exercise-canonicalisation`
fails separately and, at runtime, `enforceCuratedCueContract` throws an `ExerciseVocabularyViolation`.

### B7. Video — `src/services/exerciseVideoService.ts`, `EXERCISE_DEMO_VIDEOS['<name>']`

| Field | Plain English | Allowed values | What breaks if missing |
|---|---|---|---|
| Video URL | The demo clip shown when an athlete taps the exercise | Preferred: `https://www.youtube.com/shorts/<videoId>`. Fallback: `https://www.youtube.com/watch?v=<videoId>`. Literal `null` explicitly disables the play button — that is a deliberate "not set" state, distinct from omitting the key entirely. **Never** a YouTube search URL. Must render 9:16 (Shorts aspect ratio). | LOUD. `npm run test:content-reconciliation` fails ("no selectable exercise lacks a video for an unexplained reason" / "every demoable selectable entry resolves a video") unless the exercise carries a typed exemption. If the key exists but is `null`, the athlete just sees a "Demo coming soon" placeholder — no test failure, an honest gap. |

The key must be the exact canonical name from A0 — same string used in `exerciseTags.ts` /
`exercisePools.ts`.

### B8. Load-map entry — `src/utils/loadEstimation.ts`, `EXERCISE_LOAD_MAP['<name>']`

| Field | Plain English | Allowed values | What breaks if missing |
|---|---|---|---|
| `equipment` | Controls how the app rounds working weights | `barbell`, `dumbbell`, `cable`, `machine`, `bodyweight`, `kettlebell` | If absent and unresolved, the exercise needs either a genuine load ruling recorded in `docs/EXERCISE_LOCKED_LIST_CHANGESET_2026-07-24.md` (checked by `npm run test:locked-list`) or the `load_ruling_pending` typed exemption — treat the exemption as a temporary placeholder to close out, not a default. |

---

## Section C — Not authored per-exercise (derived automatically — nothing to fill in, included so the consequences of B4/B2 are clear)

- **`SessionRole`** (`src/utils/sessionRoles.ts:28-34`: `power | main_lift | accessory | midline |
  prehab | conditioning`) — the badge an athlete sees on the exercise. It is **not a field you
  author**; it's computed at read time from your B4 pool placement and B2 `movement` tag (anchor
  role in its strength pool → `main_lift`; `movement: 'core'` or the trunk-anti-rotation pool →
  `midline`; specific prehab/pump pool categories → `prehab`/`accessory`; everything else defaults
  to `accessory`). If the exercise ends up with a badge you didn't expect, it's almost always
  because of the B4/B2 choices, not a separate setting to hunt for.
- **Regression flag** — there is no boolean or separate type for this anywhere in the codebase.
  The *only* way to mark an exercise as a regression variant is the B1 Experience Level value
  `everyone (regression)` — that single sheet field is the entire mechanism.

---

## Section D — Exhaustive file/sheet checklist, in the order to author them

1. **`docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx`** ("Exercise Master" sheet) — new row.
   Do this first; it is the enforced source of truth (B1).
2. **`src/data/muscleExperienceMetadata.ts`** — matching `EXERCISE_MUSCLE_METADATA` entry, must
   equal the sheet exactly (both directions).
3. **`src/data/exerciseTags.ts`** — `EXERCISE_TAGS['<name>']` entry (unless genuinely exempt — B2).
4. **Exactly one** pool-ownership file per B4: `src/data/exercisePoolsStrength.ts` /
   `src/data/exercisePools.ts` / `src/data/mobilityFlowTemplates.ts` /
   `src/rules/powerExercisePool.ts` / `CONDITIONING_META` (in `exerciseTags.ts`).
5. **`src/data/exerciseCues.ts`** — `EXERCISE_CUES['<name>']` entry.
6. **`src/services/exerciseVideoService.ts`** — `EXERCISE_DEMO_VIDEOS['<name>']` entry.
7. **`src/utils/loadEstimation.ts`** — `EXERCISE_LOAD_MAP['<name>']` entry, or a documented ruling.
8. If this is genuinely new loaded content: **`docs/EXERCISE_LOCKED_LIST_CHANGESET_2026-07-24.md`**
   — a load-ruling table entry.

**Typed exemption kinds** (the only legitimate way to skip a file above — not a workaround for
laziness): `conditioning_format`, `zone1_recovery`, `power_pool_pending`,
`load_ruling_pending` (content completeness, `src/data/selectableExerciseVocabulary.ts:55-60`), and
separately `not_an_exercise`, `session_label`, `recovery_flow`, `conditioning_prescription`,
`dead_mock_fixture`, `awaiting_sam_ruling` (hardcoded-literal lock,
`src/rules/exerciseNameLiteralSweep.ts:340-346`). `power_pool_pending` and `load_ruling_pending`
are meant to be temporary — a reconciliation test asserts zero exercises should be sitting on a
"pending" exemption at any given time.

**Verification commands** (report only — these are what a terminal would run after the edits,
listed for your reference, not run here):
```
npm run test:muscle-experience        # B1 sheet/code equality
npm run test:content-reconciliation   # B2/B6/B7/B1 completeness + exemption bookkeeping
npm run test:exercise-canonicalisation # A0 name resolves to one curated key
npm run test:generation-vocabulary    # AI vocabulary == selectable pool, exactly
npm run test:authored-cues            # B6 presence + 18-word cap
npm run test:exercise-name-lock       # no stray hardcoded name literals elsewhere in src/
npm run test:locked-list              # load-ruling table, if applicable (B8)
```

---

## Section E — Fill in twice, one per new exercise

### Exercise 1

**A0. Canonical name:** ________________________________

**B1. Muscle & Experience sheet row** (`docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx`)
- Pool: ________________________________
- Primary Muscle Group(s): ________________________________
- Secondary Muscle Group(s) (or `—`): ________________________________
- Experience Level (`everyone` / `everyone (regression)` / `1+ years` / `2+ years` / `advanced only`): ________________________________
- Notes (prefix ⚑ if debatable): ________________________________

**B2. Strength/movement tags** (`src/data/exerciseTags.ts`) — *skip this whole block only if B4 places the exercise as `conditioning_format`. Since 2026-09-04 (Sam, R-364) mobility, tissue, breathing and zone-1 recovery exercises carry tags and thirteen-region ratings like every other exercise*
- movement: ________________________________
- region: ________________________________
- load: ________________________________
- fatigue: ________________________________
- doms: ________________________________
- stability: ________________________________
- unilateral (true/false): ________________________________
- eccentric: ________________________________
- lateWeek: ________________________________
- power (true, or leave blank): ________________________________

**B3. Injury profile** (all 10 — do not leave any blank by default)
- adductor: ________  pubalgia: ________  lowerBack: ________  knee: ________  hamstring: ________
- calf: ________  ankle: ________  shoulder: ________  elbow: ________  wrist: ________

**B4. Pool placement** (choose exactly one)
- [ ] `exercisePoolsStrength.ts` → slot/role: ________________________________
- [ ] `exercisePools.ts` (`POOL_REGISTRY`) → category: ________________________________
- [ ] `mobilityFlowTemplates.ts`
- [ ] `powerExercisePool.ts`
- [ ] `CONDITIONING_META` → tier/modality/impact: ________________________________

**B5. loadRatio** (strength pool entries only): ________________________________

**B6. Cue**
- primaryCue (≤18 words): ________________________________
- secondaryCue (≤18 words, may be blank): ________________________________

**B7. Video URL** (Shorts URL, watch URL, or explicit `null`): ________________________________

**B8. Load-map equipment** (`barbell`/`dumbbell`/`cable`/`machine`/`bodyweight`/`kettlebell`): ________________________________

**B6 (pool-registry only). Equipment tags** (if placed in `POOL_REGISTRY`): ________________________________

---

### Exercise 2

**A0. Canonical name:** ________________________________

**B1. Muscle & Experience sheet row** (`docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx`)
- Pool: ________________________________
- Primary Muscle Group(s): ________________________________
- Secondary Muscle Group(s) (or `—`): ________________________________
- Experience Level (`everyone` / `everyone (regression)` / `1+ years` / `2+ years` / `advanced only`): ________________________________
- Notes (prefix ⚑ if debatable): ________________________________

**B2. Strength/movement tags** (`src/data/exerciseTags.ts`) — *skip this whole block only if B4 places the exercise as `conditioning_format`. Since 2026-09-04 (Sam, R-364) mobility, tissue, breathing and zone-1 recovery exercises carry tags and thirteen-region ratings like every other exercise*
- movement: ________________________________
- region: ________________________________
- load: ________________________________
- fatigue: ________________________________
- doms: ________________________________
- stability: ________________________________
- unilateral (true/false): ________________________________
- eccentric: ________________________________
- lateWeek: ________________________________
- power (true, or leave blank): ________________________________

**B3. Injury profile** (all 10 — do not leave any blank by default)
- adductor: ________  pubalgia: ________  lowerBack: ________  knee: ________  hamstring: ________
- calf: ________  ankle: ________  shoulder: ________  elbow: ________  wrist: ________

**B4. Pool placement** (choose exactly one)
- [ ] `exercisePoolsStrength.ts` → slot/role: ________________________________
- [ ] `exercisePools.ts` (`POOL_REGISTRY`) → category: ________________________________
- [ ] `mobilityFlowTemplates.ts`
- [ ] `powerExercisePool.ts`
- [ ] `CONDITIONING_META` → tier/modality/impact: ________________________________

**B5. loadRatio** (strength pool entries only): ________________________________

**B6. Cue**
- primaryCue (≤18 words): ________________________________
- secondaryCue (≤18 words, may be blank): ________________________________

**B7. Video URL** (Shorts URL, watch URL, or explicit `null`): ________________________________

**B8. Load-map equipment** (`barbell`/`dumbbell`/`cable`/`machine`/`bodyweight`/`kettlebell`): ________________________________

**B6 (pool-registry only). Equipment tags** (if placed in `POOL_REGISTRY`): ________________________________

---

## NOT COVERED

- **Whether the muscle/experience gate should be `1+ years` vs `2+ years` vs `everyone` for either
  new exercise** — that judgement call is explicitly Sam's per the sheet's own header ("Changes
  require Sam") and is not derivable from code.
- **The injury-severity pipeline gap** noted under B3 (the main filter collapses reported severity
  to mild-vs-not, bypassing the Bible's 1-10 bands) is a pre-existing code issue, not something
  this template can fix by careful authoring — flagged for awareness, out of scope for a read-only
  authoring template.
- **Whether either new exercise is a strength movement, a conditioning format, or a mobility item**
  — not stated in your request, so B4's branching table is given in full rather than assumed;
  you'll need to pick the right branch per exercise.
- **The `EXERCISE_NAME_ALIASES` table** (`exerciseVideoService.ts`) for shorthand video lookups —
  optional, only needed if you want an athlete-facing alias distinct from the canonical name; not
  included as a required field above since it has no completeness test forcing its use.
- **No code was edited or run** to verify a specific new exercise name against these tests — the
  verification commands in Section D are listed for after you complete the template, not executed
  here.
