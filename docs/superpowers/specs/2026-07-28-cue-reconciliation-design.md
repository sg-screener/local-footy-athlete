# Cue Reconciliation — one enforced source for coaching cues (2026-07-28)

Closes Gap 2 of `docs/PROVENANCE_INVENTORY_2026-07-28.md`. Phase 1 diagnosis is
`docs/CUE_RECONCILIATION_DIAGNOSIS_2026-07-28.md`; this spec is Phase 2.

## What Phase 1 established

| Class | Count |
|---|---|
| (a) in code + an authored doc, matching | 170 |
| (b) in code, in NO doc — orphaned | 5 |
| (c) in a doc, not in code | 0 |
| (d) in both, text DIFFERS — Sam rulings | **0** |

No conflicts. The gap is filing, not disagreement, so no ruling round on cue
text was needed. Two further facts drive the design:

- **Every one of the 175 cues already has a row on the muscle/experience
  sheet.** Cues are two new columns on rows that already exist.
- The 23 sheet rows without a cue are all conditioning and all selectable.
  Eight render the unauthored family pair; **fifteen render no cue at all.**

## Sam's rulings (2026-07-28)

1. **DELETE** the 12 latent family-fallback pairs. The coverage gate makes them
   unreachable, and fail-loud beats a safety net nobody authored.
2. The live `conditioning` pair stays **UNRULED** on the pending list, attributed
   pending-Stage-B. Do not bless it, do not replace it; it renders as-is on test
   devices (no live users). Stage B resolves it: template `effortCue`s supersede
   it where templates take over, and `Easy Swim` gets a Sam-authored cue then.
   **Tripwire:** if the app approaches real athletes before Stage B lands, this
   line comes back to Sam.
3. Canonical source is the muscle/experience sheet, renamed as the exercise
   master sheet. Orphans filed as Sam-authored-as-shipped. `CUE_REVIEW` marked
   non-canonical.
4. Delete the mechanism, not just the 12 entries.

## Architecture

### The canonical source

`docs/MUSCLE_EXPERIENCE_FINAL_2026-07-25.xlsx`
→ `docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx`

Two columns appended after `Notes`: `primaryCue`, `secondaryCue`.
`support/xlsxReader.ts` is header-driven, so appending is safe and column order
does not bind. Tab renamed to match the file; both are single constants.

198 rows, every one accounted for:

| Rows | `primaryCue` |
|---|---|
| 175 | the authored cue, verbatim as shipped |
| 23 | the literal `PENDING — Stage B`, `secondaryCue` blank |

The pending list stops being a list someone maintains and becomes a cell on the
row that already owns the exercise. A change-log row records the merge, per the
sheet's existing convention.

The five orphans are written in as Sam-authored-as-shipped, each with its
attributing commit SHA in `Notes` — attribution moves out of a commit message
and into the sheet.

### Deleting the mechanism

`FAMILY_FALLBACKS` is `Record<MovementPattern, ExerciseCue>`. Deleting 12 of 13
keys leaves a one-key record: a type pretending to be a mechanism, and a table a
later unit can refill with no gate noticing. So the table goes:

```ts
/** Unruled. Pending Stage B. NOT Sam-authored — see the diagnosis doc. */
export const PENDING_CONDITIONING_CUE: ExerciseCue = { ... };
```

`getExerciseCue` returns it for `movement === 'conditioning'` and the suppressed
generic otherwise. A future movement family cannot silently acquire an
unauthored cue, because there is no table to add one to. This is ruling 1 made
unforgeable rather than merely applied.

### The gate

`src/__tests__/authoredCueLibraryTests.ts`, reading the master sheet:

- **Both directions.** Every sheet pair present in code verbatim; **every code
  cue present on the sheet.** Orphans become structurally impossible — the
  reverse assertion Gap 2 asked for. New cues can only enter through the source.
- **Coverage derives from `selectableExerciseNames()`**, replacing
  `POOL_REGISTRY + STRENGTH_POOLS`. That substitution is the fix for the hiding
  place: the old list could not see the conditioning modalities at all.
- **The pending set is pinned at exactly 23**, so a 24th cannot appear silently.
- **18-word cap** unchanged, enforced per field.
- The pending pair is asserted to equal its shipped text exactly, and labelled
  unruled — pinned, not blessed.

### What the superseded documents keep doing

`CUE_CHANGESET_2026-07-23.md` is **not** retired. Its **Renames** and
**Deletions** sections still drive the "retired names appear nowhere in src"
ban, derived from the document rather than hardcoded. Only its *Final cue
library* section is superseded by the sheet.

`CUE_REVIEW_2026-07-23.xlsx` is marked non-canonical — a historical pointer,
with a note that its rewrite columns are blank and Sam's edited copy was never
committed.

No dated sign-off record is rewritten.

## Risks

- **No xlsx write library.** Column surgery is python `zipfile` plus a
  round-trip proof: all 198 rows × 6 existing fields byte-identical after edit.
- **Hidden count pins** in the equality test move with the sheet.
- **Exercise-name literal lock** — new test code derives names from the sheet
  and must list none.

## Testing

Tests-first. Then full gates: content locks, `tsc`, `test:bible` EXIT=0.

## Not covered

- The `conditioning` pending pair is not resolved — deferred to Stage B by
  ruling 2, with the tripwire recorded.
- The 15 selectable conditioning sessions that render no cue text at all are
  recorded on the pending entry, not fixed here.
- Cues are not merged into `EXERCISE_MUSCLE_METADATA` as a single typed
  projection. `exerciseCues.ts` keeps its own type and consumer API; the sheet
  is what becomes singular. Collapsing the two projections is a later step.
