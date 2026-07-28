# Injury matrix — rule table, 2026-07-28

**Twin of `docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx`.** The workbook is the
artifact Sam rules on; this is the prose record.

**Status: PHASE 1 — awaiting Sam's ruling. No product code changed.**
**One sitting: rule table + 21 conditioning rows + conflicts + routing.**

---

## The defect

`EXERCISE_TAGS[name].injury` decides whether an exercise is offered to an athlete
with an active injury. The `inj()` helper fills any key not written with
`'good'`, so a pair nobody assessed and a pair Sam reviewed and passed are
byte-identical once merged. **Absence renders as approval.**

## Why a rule table and not 1,788 cells

149 exercises × 12 regions is 1,788 individual ratings. Nobody should rule those
one at a time. So the sitting is rules-first, on Sam's ruling of 2026-07-28:

> Rules live on **either** axis — movement pattern or primary muscle.
> The **strictest** matching rule wins. Named exercise **exceptions beat all
> rules**. There is no precedence ordering to author.

That works because `strictest` is associative and commutative — a lattice join
plus an override. The axes cannot disagree about who goes first, which is exactly
why no ordering needs authoring.

### The rules reproduce Sam's authored data exactly

| | |
|---|---|
| Pattern-axis rules pre-filled from evidence | **59** of 144 grid cells |
| Muscle-axis rules pre-filled from evidence | **78** of 192 grid cells |
| Named exceptions | **18** (14 stricter than their rule, 4 looser) |
| Authored ratings reproduced | **237 strength**, 0 divergences |
| Conditioning ratings, ruled by hand | 43 authored + the rest blank |

**137 rules plus 18 exceptions regenerate every one of the 237 authored strength
ratings, exactly.** The derivation script *throws* if that ever stops being true,
and `verify-injury-matrix-sheet.ts` re-checks it by parsing the rules back out of
the workbook. This is a faithful compression of Sam's own decisions, not a
summary that approximates them.

The exceptions are the interesting artifact — they are where Sam already made a
judgement no general rule can express:

| Exercise | Region | Rule says | Authored |
|---|---|---|---|
| Back Squat | lowerBack | caution | **avoid** |
| Deadlift | lowerBack | caution | **avoid** |
| RDLs, Nordic Lower | hamstring | caution | **avoid** |
| RFE Split Squat Jump | groin, hamstring, knee, calf, ankle/foot | caution | **avoid** |
| Depth Jumps | knee, ankle/foot | caution | **avoid** |
| Scap Pull Ups | lowerBack, elbow, wrist/hand | caution | **good** |
| Trap Bar Deadlift | groin | avoid | **caution** |
| Ab Wheel, Dragon Flag, Lateral Bounds | groin / lowerBack | caution | **avoid** |

`Scap Pull Ups` is the precedent that started this unit — Sam's deliberate ten-key
"reviewed and safe" profile. The model preserves it as a looser exception rather
than flattening it into the rule.

### Only 31 of the 137 rules currently bind

Both axes were derived from the same authored ratings, so they mostly agree.
Remove one and the other still returns the same answer. **106 rules are redundant
today.**

This is not a fault to fix — two agreeing axes are belt-and-braces. But it changes
how editing feels, so it is stated in the README and shown in **bold** on the
grids:

- **Loosening** a non-binding rule appears to do nothing. The other axis still binds.
- **Tightening** any rule always has effect, because strictest wins.

Redundancy is therefore asymmetric, not harmless. Tab 7 shows what the rules
actually produce, so an edit can always be traced to where it landed.

---

## The workbook

| Tab | What it is |
|---|---|
| `README` | How to rule, resolution model, the migration |
| `Rules — pattern` | 12 patterns × 12 regions, + the completeness declaration |
| `Rules — muscle` | 16 muscles × 12 regions |
| `Exceptions` | 18 named + 6 spare rows |
| `Conditioning` | 21 rows × 12 regions, by hand |
| `Conflicts & routing` | Part A: 5 groin conflicts. Part B: 11 routing rules |
| `Reference` | 128 strength rows — what the rules produce. Read-only |

### Rule cell vocabulary

| Shown | Means |
|---|---|
| `caution ·7/7` | 7 exercises authored this, all agreed |
| `caution ·5/6 split` | 5 of 6 agreed; the outlier is a named exception |
| `—` | no evidence. Author fresh, or leave blank for "no rule" |
| `— new region` | `hip`/`quad`/`neck`. No evidence *can* exist |
| **bold** | this rule currently binds |

### The completeness declaration

If no rule matches an exercise/region and no exception names it, what is it? The
safe reading is `'good'` — but **that is precisely the blank-means-safe default
this unit exists to kill**, so it is not assumed. The pattern tab carries one
declaration line for Sam to sign. Unsigned, those cells stay unruled and Phase 2
fails the build on them.

### Conditioning is ruled by hand — Sam's ruling

No new tier/impact taxonomy was invented. Both axes are structurally blind to
these 21 rows: conditioning has no movement-pattern rule, and Sam authored their
muscle lists **empty on purpose** (*"session format, not an individual
movement"*). Neither axis can carry a rule, so they are ruled directly.

They cover sprinting, where a wrong `'good'` on `hamstring` does the most damage.

> **Follow-up, logged not done:** conditioning ratings should eventually key to
> Sam's authored quality grid rather than being per-exercise, once Stage B's
> templates land. That is a separate unit with its own sitting — deliberately not
> smuggled into this one.

---

## The 10 → 12 migration

Sam's final list: groin, hip, quad, hamstring, knee, calf, ankle/foot, lowerBack,
neck, shoulder, elbow, wrist/hand.

| Old | New | Note |
|---|---|---|
| `adductor` + `pubalgia` | `groin` | **merged** |
| `ankle` → `ankle/foot`, `wrist` → `wrist/hand` | | renamed, widened |
| — | `hip`, `quad`, `neck` | **new, no predecessor** |

**The merge carried nothing silently.** 16 agreeing + 13 pubalgia-only + 5
adductor-only = 34 authored `groin` ratings. The **5 that disagree** — Back Squat,
Front Squat, Bulgarian Split Squats, Walking Lunges, Nordic Lower, all
`pubalgia = avoid` vs `adductor = caution` — are on tab 6 unruled, showing both
prior values.

### `pubalgia` was unreachable

No free-text input in either engine ever resolved to that bucket: `pubalgia` →
null, `sports hernia` → null, `osteitis pubis` → null. Its 34 ratings never once
fired, and the handler at `programAdjustmentEngine.ts:994` is dead code.

That is also why tab 6 Part B exists. **A region nobody can reach is a region that
does not exist.** Three of Sam's new regions are silent proxies today
(`quad`→knee, `hip`→adductor, `neck`→shoulder) and `hand`/`fingers`/`thumb` reach
nothing at all.

`BODY_PART_TO_BUCKET` also exists in **two** files —
`programAdjustmentEngine.ts:438` and `injuryAdjustmentEngine.ts:110` — and they
disagree; the second has no `wrist`, `elbow` or `neck`. **Load-bearing, not
cosmetic:** that copy would strand `neck` outright. Phase 2 collapses them to one
owner rather than editing both.

---

## Verification

`npm run verify:injury-matrix-sheet` — **44 assertions, 0 failures.** It does not
check the sheet against the JSON it was built from (that would only prove the
writer agrees with itself). It **parses the rule grids and exceptions out of the
workbook**, evaluates Sam's model, and checks the result against what
`exerciseTags.ts` actually authors — read from source text, because after `inj()`
runs an omitted key and an authored `'good'` are indistinguishable.

Assertions are split into **structural** (must always hold) and **pre-ruling
snapshot** (pinned to the sheet as generated). The snapshot pins are *expected* to
fail once Sam rules — that is the signal to promote the script into the Phase 2
equality gate, not to edit the numbers. It is deliberately not in `test:bible`.

### Mutation-tested

| Mutation | Result |
|---|---|
| Silently resolve a groin conflict | **fails** — "conflict auto-picked" |
| Delete an exception | **fails** — Back Squat lowerBack diverges |
| Tighten a rule (`hinge`/`lowerBack` → avoid) | **fails** — 4 cells diverge |
| Insert a content row above a header | **fails** — 4 assertions |
| *Loosen* a non-binding rule | **passes** — and that is correct |

That last one is not a gap. It is how the 106-redundant-rules finding was
discovered: the other axis still binds, so the outcome genuinely does not change.

### A correction carried forward

An earlier version of this document claimed a standing assertion would fail if any
blank row appeared on a data tab. **That assertion was vacuous.** A blank row emits
no `<row>` element, so it is invisible from the read side — `sheet.rows` never
contains one, and inserting one into a finished workbook is harmless because the
reader's indices never move.

The real hazard is generator-side: counting a blank row while computing a header
position works in spreadsheet coordinates while the reader works in emitted-row
coordinates, and the two differ by one. That is what lost a sign-off group on an
earlier build. Every header is now pinned **by content at its expected reader
row**, which is what actually catches a shift.

---

## Phase 2 — after the sheet comes back

Not started. Waits on Sam's ruled workbook.

1. **Sheet leads, code follows** — ingest rules, exceptions, conditioning rows,
   conflicts and routing; equality held in **both** directions.
2. **Migrate the type to the twelve.** `InjuryProfile` gains `hip`/`quad`/`neck`;
   `adductor`/`pubalgia` collapse to `groin`; slashed athlete-facing labels
   authored in **one** owner.
3. **Collapse the two `BODY_PART_TO_BUCKET` copies** and author the routing rules,
   so no region is authored-but-unreachable again.
4. **Retire the default.** Every entry authors all twelve regions. The gate fails
   on any missing key. `inj()` dies or becomes a validator refusing incomplete
   profiles.
5. **Log the conditioning/quality-grid follow-up** as its own unit.

Unruled cells do not get promoted — they fail the gate until ruled: *fail loud,
and fail toward not prescribing.*
