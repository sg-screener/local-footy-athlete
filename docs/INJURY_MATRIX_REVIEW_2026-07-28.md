# Injury matrix review — 2026-07-28

**Twin of `docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx`.** The workbook is the
artifact Sam rules on; this is the prose record of what it contains and why.

**Built on Sam's FINAL 12-region list, ruled 2026-07-28.**
**Status: PHASE 1 — awaiting Sam's ruling. No code changed.**

---

## The defect

`EXERCISE_TAGS[name].injury` decides whether an exercise is offered to an athlete
with an active injury.

```ts
const SAFE: InjuryProfile = { adductor: 'good', /* …all ten… */ wrist: 'good' };
function inj(overrides: Partial<InjuryProfile>): InjuryProfile {
  return { ...SAFE, ...overrides };
}
```

Any key not written is filled with `'good'`. A pair nobody assessed and a pair Sam
reviewed and passed are byte-identical once merged. **Absence renders as
approval** — the defect class Sam has ruled dead (precedent: the deliberate
ten-key profile on `Scap Pull Ups`, `exerciseTags.ts:623`).

## The region vocabulary — Sam's final twelve

> groin, hip, quad, hamstring, knee, calf, ankle/foot, lowerBack, neck,
> shoulder, elbow, wrist/hand

`ankle/foot` and `wrist/hand` are single combined regions; the slash is part of
the athlete-facing label. Fingers and hand roll into `wrist/hand`, foot into
`ankle/foot`. No ribs, no upper back; concussion stays with the illness doors.

### The 10 → 12 migration

| Old key | New region | Note |
|---|---|---|
| `adductor` | `groin` | **merged** |
| `pubalgia` | `groin` | **merged** |
| `ankle` | `ankle/foot` | renamed, widened |
| `wrist` | `wrist/hand` | renamed, widened |
| `lowerBack`, `knee`, `hamstring`, `calf`, `shoulder`, `elbow` | unchanged | |
| — | `hip`, `quad`, `neck` | **new — no predecessor** |

## The counts

| | |
|---|---|
| Exercises × regions | 149 × 12 = **1,788 pairs** |
| Authored (carried through the migration) | **280** |
| Never ruled | **1,503 (84%)** |
| — of which brand-new regions (`hip`/`quad`/`neck`) | **447** |
| Conflicted — Sam must pick | **5** |
| Flagged for a closer look | **250**, across 113 exercises |

The 280 is lower than the old vocabulary's 306 because the merge collapses two
columns into one: 60 old `adductor`/`pubalgia` cells become 34 authored `groin`
cells plus 5 left unruled for Sam.

### A correction to the provenance inventory

The inventory reported **934 of 1,240** on the old ten. That denominator covered
only the 124 entries calling `inj({...})` and missed **25 written as
`injury: SAFE`** — the bare all-good constant, the same defect with no override.
On the old ten the real figure was **1,184 of 1,490**. Explicit pairs matched
exactly at 306 both ways, which is what proved the gap was the denominator and
not the method.

---

## The merge carried nothing silently

Sam's ruling: *"the 16 agreeing overlaps and the 13 pubalgia-only ratings carry
over as authored; the 5 conflicts go on Sam's ruling list… flagged with both
prior values so he sees what each label used to say. Nothing auto-picked."*

| Case | Count | What happened |
|---|---|---|
| `adductor` and `pubalgia` agreed | 16 | carried over as authored |
| `pubalgia` only | 13 | carried over as authored |
| `adductor` only | 5 | carried over as authored |
| **Disagreed** | **5** | **left UNRULED — tab 5, both prior values shown** |
| | **34 authored + 5 for Sam** | |

The five conflicts are all `pubalgia = avoid` against `adductor = caution`:
**Back Squat, Front Squat, Bulgarian Split Squats, Walking Lunges, Nordic Lower.**
Auto-merging would silently pick a winner — taking `caution` under-restricts,
taking `avoid` over-restricts. Neither is mine to choose.

Tab 2 carries a **`groin — prior labels`** column recording, for every merged
cell, which old label it came from. Nothing about that column is untraceable.

### `pubalgia` was unreachable — that is why this matters

No free-text input in **either** engine ever resolved to the `pubalgia` bucket.
Probed directly: `pubalgia` → null, `sports hernia` → null, `osteitis pubis` →
null. Those 34 ratings — the most heavily authored non-obvious column in the
matrix, 9 `avoid` and 24 `caution` on the heaviest lower-body lifts — **never
once fired**, and the bespoke handling downstream (`programAdjustmentEngine.ts:994`,
*"No heavy hinge or kicking work"*) is unreachable code.

Merging into `groin` is what makes that thinking reachable for the first time.

---

## The workbook

| Tab | What it is |
|---|---|
| `README` | How to rule, the migration, the count correction, what the flags are not |
| `Injury matrix` | 149 rows × 12 regions — the ruling surface |
| `Group sign-off` | 15 rows. Promotes untouched cells, or refuses to |
| `Flag rules` | The muscle→region and pattern→region table behind every CHECK |
| `Conflicts & routing` | Part A: the 5 conflicts. Part B: the routing rules |

### Cell vocabulary

| Shown | Means |
|---|---|
| `caution` / `avoid` | authored — a real decision someone made |
| `good` | authored as an explicit safe |
| `good (defaulted)` | **never ruled.** The helper wrote it, not a person |
| `good (defaulted — CHECK)` | never ruled, and a flag rule says look harder |
| `unruled (new region)` | `hip`/`quad`/`neck` — no value has ever existed |
| `unruled (new region — CHECK)` | same, and flagged |
| `CONFLICT — adductor=… vs pubalgia=…` | one of the 5 |

Sam rules by overwriting a cell with a bare `good` / `caution` / `avoid`.

### `unruled (new region)` is deliberately not `good (defaulted)`

A defaulted cell has been silently acting as `'good'` in the running app. A
new-region cell has **never existed at all**. They are shaded and worded
differently so an empty new column is never mistaken for a reviewed-and-safe one
— which is the same absence-as-approval trap this unit exists to kill, and the
easiest way to reintroduce it would have been to seed `hip`/`quad`/`neck` from
their current proxies.

### Group sign-off is not optional

A group with no sign-off keeps its unruled cells unruled — including its new
`hip`/`quad`/`neck` cells — and **Phase 2 fails the build on them rather than
assume**.

| # | Group | Exercises | Unruled | of which new | Flagged | Conflicts |
|---|---|---|---|---|---|---|
| 1 | LOWER BODY — SQUAT / LUNGE | 16 | 158 | 48 | 45 | 4 |
| 2 | LOWER BODY — HINGE | 10 | 95 | 30 | 24 | 1 |
| 3 | LOWER BODY — POWER / PLYO | 10 | 77 | 30 | 26 | 0 |
| 4 | LOWER BODY — ISOLATION | 14 | 144 | 42 | 43 | 0 |
| 5 | **CONDITIONING** | 21 | 209 | 63 | **0** | 0 |
| 6 | CARRIES | 4 | 33 | 12 | 5 | 0 |
| 7 | CORE / TRUNK | 16 | 170 | 48 | 8 | 0 |
| 8 | UPPER BODY — VERTICAL PUSH | 7 | 73 | 21 | 12 | 0 |
| 9 | UPPER BODY — HORIZONTAL PUSH | 11 | 106 | 33 | 13 | 0 |
| 10 | UPPER BODY — VERTICAL PULL | 6 | 65 | 18 | 11 | 0 |
| 11 | UPPER BODY — HORIZONTAL PULL | 6 | 65 | 18 | 9 | 0 |
| 12 | UPPER BODY — POWER / PLYO | 4 | 40 | 12 | 4 | 0 |
| 13 | SHOULDERS / UPPER BACK | 9 | 100 | 27 | 17 | 0 |
| 14 | ARMS — BICEPS | 8 | 91 | 24 | 19 | 0 |
| 15 | ARMS — TRICEPS | 7 | 77 | 21 | 14 | 0 |
| | **Total** | **149** | **1,503** | **447** | **250** | **5** |

---

## The flags

**250 unruled cells flagged across 113 exercises.** A flag fires when the
exercise's own **primary** muscles — from `MUSCLE_EXPERIENCE_FINAL_2026-07-25.xlsx`,
Sam's own sheet — or its movement pattern overlap that region. Secondary muscles
deliberately do not fire.

The flags are **inference, not evidence**, and they are mine. An unflagged cell is
not endorsed; it merely did not trip a rule. Tab 4 lists every rule so one can be
rejected wholesale.

`neck` is deliberately conservative: it fires only from a `Traps` primary muscle
and from loaded carries. Inventing a neck rule for pressing or core would have
manufactured confidence nobody authored.

### The 21 rows the flags could not review

Every conditioning row is marked **`no flag rule — unreviewed by flags`** and
shaded grey, so flag-clean-*by-analysis* and flag-clean-*by-blindness* are never
confused.

- **20 of 21 ARE in the muscle sheet**, with muscle lists Sam authored **empty on
  purpose** — *"session format, not an individual movement"*.
- **1 (`MetCon`) is absent** from that sheet entirely.
- `'conditioning'` has no movement-pattern rule either — deliberately. Inventing
  one from `CONDITIONING_META`'s modality/impact would be an unauthored rule
  smuggled in under a flag column.

**209 unruled pairs, zero automated help, covering sprinting.** They sit fifth in
the sitting order rather than last.

Only **15 rows are flag-clean by analysis** now (down from 39 on the old ten) —
adding `hip`, `quad` and `neck` gave the rules three more places to fire.

---

## Routing — tab 5, Part B

Authoring a region is worth nothing if athlete free text cannot reach it. That is
exactly how `pubalgia` died. Three of Sam's new regions are **silent proxies**
today, and one of his roll-ups reaches nothing at all:

| Athlete types | Routes to today | Status |
|---|---|---|
| `quad` / `quads` | **knee** | proxy — the code labels it one |
| `hip` / `hips` | **adductor** | proxy |
| `neck` | **shoulder** | proxy |
| `hand` / `fingers` / `thumb` | **nothing — null** | hole; Sam's ruling fixes it |
| `glute` / `glutes` | **hamstring** | proxy; no glute region in the twelve |
| `upper back` | **lowerBack** | proxy; Sam ruled no upper back |
| `hip flexor`, `pubalgia`, `ribs` | **nothing — null** | holes |

A quad strain is currently scored against knee ratings. These candidates need
Sam's ruling or the new columns will be authored and still unreachable.

### And there are two divergent copies of that mapping

`BODY_PART_TO_BUCKET` exists in **both** `programAdjustmentEngine.ts:438` and
`injuryAdjustmentEngine.ts:110`, and they disagree — the second has no `wrist`,
no `elbow`, no `neck`. Per CLAUDE.md that is a two-representations problem, so
Phase 2 should collapse them to one owner rather than edit both in step.

---

## Verification

Round-trip proven against the repo's **own** `src/__tests__/support/xlsxReader.ts`
— the reader the Phase 2 equality suite will use. **37 assertions, 0 failures**,
including:

- all 12 regions present in Sam's order; the retired keys gone as columns
- **every straight-through cell mirrors code exactly**, checked against what the
  source actually authors rather than against the post-`inj()` value
- the merge verified per exercise: 16 agreed, 13 pubalgia-only, 5 adductor-only
  carried; **5 conflicts left unruled with both prior values visible**, and no
  conflict cell pre-filled
- the arithmetic closes: 280 + 1,503 + 5 = 1,788
- 447 new-region cells, none of them on an old region
- the three flag states stay distinguishable, and no conditioning row carries a CHECK
- **no data tab contains a blank row anywhere** (see below)

### The trap this sheet is built to avoid

On the first build the sign-off tab read back **14 groups instead of 15**, while
still passing its own row count. A blank spacer row emits no `<row>` element, and
`xlsxReader` indexes the rows it actually reads — so the spreadsheet row number
and `readSheetRecords`' `headerRow` drifted apart and the gate read a data row as
its header.

It nearly recurred: the second build's `Conflicts & routing` tab separated Part A
from Part B with a blank row. Both are now titled separator rows, and a standing
assertion fails if **any** blank row appears on a data tab at all — a stronger
invariant than checking above the header, because the tab has two headers.

---

## Phase 2 — after the sheet comes back

Not started. Waits on Sam's ruled workbook.

1. **Sheet leads, code follows.** Ingest the rulings; the sheet becomes the source
   of truth, on the muscle/experience and load-ratio precedent.
2. **Equality in both directions.** Sam editing a cell fails the build; so does a
   code-only rating no cell authorises.
3. **Migrate the type to the twelve.** `InjuryProfile` gains `hip`, `quad`, `neck`;
   `adductor`/`pubalgia` collapse to `groin`; `ankle`→`ankleFoot`,
   `wrist`→`wristHand`, with the slashed athlete-facing labels authored in **one**
   owner rather than duplicated.
4. **Collapse the two `BODY_PART_TO_BUCKET` copies to one owner** and author the
   routing rules from tab 5, so no region is authored-but-unreachable again.
5. **Retire the default.** Every entry authors all twelve regions explicitly. The
   gate fails on any missing key. `inj()` either dies or becomes a validator that
   refuses an incomplete profile.

Unruled groups do not get promoted — they fail the gate until ruled, which is the
correct failure direction: *fail loud, and fail toward not prescribing.*
