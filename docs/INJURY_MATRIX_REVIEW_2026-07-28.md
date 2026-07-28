# Injury matrix review — 2026-07-28

**Twin of `docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx`.** The workbook is the
artifact Sam rules on; this is the prose record of what it contains and why.

**Status: PHASE 1 — awaiting Sam's ruling. No code changed.**

---

## The defect

`EXERCISE_TAGS[name].injury` decides whether an exercise is offered to an athlete
with an active injury. Each entry carries ten ratings, one per injury region,
each `'good' | 'caution' | 'avoid'`.

```ts
const SAFE: InjuryProfile = { adductor: 'good', /* …all ten… */ wrist: 'good' };
function inj(overrides: Partial<InjuryProfile>): InjuryProfile {
  return { ...SAFE, ...overrides };
}
```

Any key not written is filled with `'good'`. So a pair nobody ever assessed and a
pair Sam reviewed and passed as safe are byte-identical once merged. **Absence
renders as approval** — the same defect class the provenance inventory found
repo-wide, and the one Sam has already ruled dead (precedent: the deliberate
ten-key profile on `Scap Pull Ups`, `exerciseTags.ts:623`).

## A correction to the inventory's count

The inventory reported **934 of 1,240 pairs** implicit. That denominator covers
only the 124 entries that call `inj({...})`. It misses **25 entries written as
`injury: SAFE`** — the bare all-good constant, with no override at all. Those are
the same defect in its purest form: ten unruled pairs each, and not one of them
was counted.

|  | Inventory | Actual |
|---|---|---|
| Entries | 124 | **149** |
| Pairs | 1,240 | **1,490** |
| Explicitly authored | 306 | **306** |
| Never ruled | 934 (75%) | **1,184 (79%)** |

The explicit figure matches exactly, which is what confirms the gap is in the
denominator rather than in the method. The real queue is **250 pairs larger** than
the inventory stated.

## Scope

**In: all 149 `EXERCISE_TAGS` entries** — 128 strength plus 21 conditioning.
Sam's ruling, 2026-07-28: *"the gate must cover the whole map with no carve-outs."*

The conditioning entries are not analogous to mobility. They live in the same
map and are read through the same consumer — `tags?.injury[bucket]`,
`tapSwapHierarchy.ts:268`. Same mechanism, same defect.

**Out: mobility contraindications.** A genuinely different mechanism —
`exercisePools` carries an `InjuryTag[]` list with its own vocabulary
(`hip`, `groin`, `lower_back`), filtered at `sessionBuilder.ts:308`. Already
Sam-authored, and out by his standing ruling. Untouched here.

**Vocabulary check — no stop-rule trip.** No exercise in `EXERCISE_TAGS`
references an injury region outside the ten. `InjuryBucket = InjuryKey`
(`programAdjustmentEngine.ts:428`), so the consumer vocabulary matches the
profile exactly. Nothing to widen, and no vocabulary question for Sam.

---

## The workbook

Four tabs, in the load-ratio sheet's mould: prose on its own tab, headers on row
1 of each data tab, readable by the repo's own `xlsxReader`.

| Tab | What it is |
|---|---|
| `README` | How to rule, the count correction, what the flags are and are not |
| `Injury matrix` | 149 rows × 10 injury columns — the ruling surface |
| `Group sign-off` | 15 rows. The mechanism that promotes untouched defaults |
| `Flag rules` | The muscle→region and pattern→region table behind every CHECK |

### Cell vocabulary

| Shown | Means |
|---|---|
| `caution` / `avoid` | authored today — a real decision someone made |
| `good` | authored today as an explicit safe |
| `good (defaulted)` | **never ruled.** The helper wrote it, not a person |
| `good (defaulted — CHECK)` | never ruled, and a flag rule says look harder |

Sam rules by overwriting a cell with a bare `good` / `caution` / `avoid`. Ten
separate `SAM:` columns would make a 24-column sheet nobody could read; at this
width in-place is the only workable shape, and the `(defaulted)` suffix is what
lets the Phase 2 ingest tell an untouched cell from a ruled one.

### Group sign-off is not optional

Correcting cells is only half a ruling. The cells Sam *leaves alone* are still
sitting on the blank default, and they are not promoted to an authored `'good'`
on anyone's reading but his. Tab 3 asks, per group, whether the remaining
defaults are safe.

**A group with no sign-off keeps its defaults unruled, and Phase 2 fails the
build on them rather than assume.** That is the whole point of the unit: never
again convert silence into approval.

---

## The flags

**159 defaulted cells flagged, across 89 exercises.** A flag fires when the
exercise's own **primary** muscles — from `MUSCLE_EXPERIENCE_FINAL_2026-07-25.xlsx`,
Sam's own authored sheet — or its movement pattern overlap that injury region.
Secondary muscles deliberately do not fire: they would flag most of the sheet and
the signal would be worthless.

The flags are **inference, not evidence**. They are mine, not Sam's. An unflagged
cell is not endorsed; it merely did not trip a rule. Tab 4 lists every rule so a
rule can be rejected wholesale rather than argued with forty cells at a time.

### Per group, in the sitting order

Lower-body loaded patterns lead, per the unit brief. Conditioning sits fifth
rather than last: running is a loaded lower-body pattern by stakes, and it is the
one group where the flags give Sam no help at all, so it wants his attention
while he is fresh.

| # | Group | Exercises | Defaulted | Flagged | Flag coverage |
|---|---|---|---|---|---|
| 1 | LOWER BODY — SQUAT / LUNGE | 16 | 120 | 14 | all rows flag-reviewed |
| 2 | LOWER BODY — HINGE | 10 | 73 | 12 | all rows flag-reviewed |
| 3 | LOWER BODY — POWER / PLYO | 10 | 52 | 7 | all rows flag-reviewed |
| 4 | LOWER BODY — ISOLATION | 14 | 113 | 26 | all rows flag-reviewed |
| 5 | CONDITIONING | 21 | 167 | 0 | **NO FLAG RULE RAN on 21 of 21** |
| 6 | CARRIES | 4 | 24 | 1 | all rows flag-reviewed |
| 7 | CORE / TRUNK | 16 | 135 | 8 | all rows flag-reviewed |
| 8 | UPPER BODY — VERTICAL PUSH | 7 | 59 | 12 | all rows flag-reviewed |
| 9 | UPPER BODY — HORIZONTAL PUSH | 11 | 83 | 13 | all rows flag-reviewed |
| 10 | UPPER BODY — VERTICAL PULL | 6 | 53 | 5 | all rows flag-reviewed |
| 11 | UPPER BODY — HORIZONTAL PULL | 6 | 53 | 9 | all rows flag-reviewed |
| 12 | UPPER BODY — POWER / PLYO | 4 | 32 | 3 | all rows flag-reviewed |
| 13 | SHOULDERS / UPPER BACK | 9 | 82 | 17 | all rows flag-reviewed |
| 14 | ARMS — BICEPS | 8 | 75 | 18 | all rows flag-reviewed |
| 15 | ARMS — TRICEPS | 7 | 63 | 14 | all rows flag-reviewed |
| | **Total** | **149** | **1,184** | **159** | |

### The 21 rows the flags could not review

Every conditioning row is marked **`no flag rule — unreviewed by flags`**, and
shaded grey rather than amber, so flag-clean-*by-analysis* and
flag-clean-*by-blindness* are never confused for one another.

The reason is more specific than "missing data", and worth stating precisely:

- **20 of the 21 ARE in the muscle sheet.** Sam authored their muscle lists
  **empty on purpose** — *"session format, not an individual movement — no
  meaningful muscle group"* (`Light Circuits`). So the muscle rule has nothing to
  match on.
- **1 (`MetCon`) is absent from the muscle sheet** entirely.
- `'conditioning'` also has no movement-pattern rule, deliberately — inventing
  one from `CONDITIONING_META`'s modality/impact would be a new rule nobody
  authored, smuggled in under a flag column.

So both paths produce nothing, by different routes, and neither is evidence of
safety. **These 21 rows need Sam's eye more than the flagged ones, not less** —
167 unruled pairs, zero automated help, and they cover sprinting, which is where
a wrong `'good'` on `hamstring` does the most damage.

By contrast, **39 strength rows are flag-clean by analysis**: real muscle signal,
rules ran, nothing overlapped. All 128 strength rows carry real primary-muscle
data — there are no blind spots on that side of the sheet.

---

## Verification

Round-trip proven against the repo's **own** `src/__tests__/support/xlsxReader.ts`
— the reader the Phase 2 equality suite will use. A sheet the gate cannot read
would be decoration. **24 assertions, 0 failures**, including:

- every one of the 149 code exercises appears, and the sheet invents none
- **every cell resolves to the exact effective rating in code today** — the
  sheet is a faithful mirror of the current state, not a re-derivation
- the counts hold: 306 explicit, 1,184 defaulted, 159 flagged
- the cell vocabulary is closed to the five permitted strings
- CHECK cells and the `Flags` column agree on every row
- all 15 groups reach the sign-off tab, every sign-off cell starts empty, and its
  counts sum to 149 / 1,184 / 159

### One trap found while proving it

The sign-off tab first read back **14 groups instead of 15**. A blank spacer row
above the header emits no `<row>` element at all, and `xlsxReader` indexes the
rows it actually reads — so the spreadsheet row number and `readSheetRecords`'
`headerRow` drifted apart by one, and the gate read the first data row as its
header. Silently, and while still passing its own row count.

Fixed by removing the spacer so the two can never disagree, plus two standing
assertions that the header is the 5th row the reader sees and that no blank row
sits above it. Worth recording because any future sheet with authored preamble
above a header can hit exactly this, and it fails by quietly losing a row rather
than by erroring.

---

## Phase 2 — after the sheet comes back

Not started. Waits on Sam's ruled workbook.

1. **Sheet leads, code follows.** Ingest the rulings; the sheet becomes the source
   of truth, on the muscle/experience and load-ratio precedent.
2. **Equality in both directions.** A gate holds `EXERCISE_TAGS.injury` equal to
   the workbook — Sam editing a cell fails the build, and so does a code-only
   rating that no cell authorises.
3. **Retire the default.** Every entry authors all ten keys explicitly. The gate
   fails on any missing key. `inj()` either dies or becomes a validator that
   refuses an incomplete profile.
4. **Close the authoring-template trap permanently.** A new exercise cannot enter
   the map half-specified, so this defect cannot regrow.

Unruled groups — any Sam does not sign off — do not get promoted. They fail the
gate until ruled, which is the correct failure direction: *fail loud, and fail
toward not prescribing.*
