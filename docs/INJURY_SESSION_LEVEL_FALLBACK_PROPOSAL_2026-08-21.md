# PROPOSAL — the unaffected-area fallback stops pretending to be a swap

**FOR SAM'S APPROVAL. NO CODE HAS BEEN CHANGED.** Branch
`feat/injury-session-level-fallback`, from `main` at `f2b76282`. Seat
`sheetshell`.

Sam, 2026-08-21: *"The problem is the Injury review applying the 'unaffected
body area' fallback separately to every blocked row, producing false pairings
like Back Squat -> Row and RDL -> Floor Press … Preserve the existing ordered
ladder … If those stages find nothing safe, do not describe unrelated
upper-body work as replacing that specific lower-body exercise. Handle the
unresolved rows at session level … First show me the proposed before-and-after
session for this exact knee 7/10 example before changing code."*

**REGISTRY-GREP: R-103, R-114, R-115, R-121, R-122.** None of them rules on this
question. R-103 requires partial coverage to be DISCLOSED, R-115 built the
withheld-row treatment this proposal reuses, R-114/R-122 fixed which candidates
may be admitted at 6-7 — all of which this leaves exactly as they are.

---

## 1. THE MECHANISM, MEASURED

`planInjuryRecomposition` loops **per unsafe row** and calls `getTapSwapChoices`,
which walks the whole ladder — rungs 1-6 — and takes the first legal named
answer. There is no distinction anywhere between "the ladder found a replacement
for THIS exercise" and "the ladder found something safe to do INSTEAD OF LEGS",
so a rung-5 answer is written into an `InjurySubstitution { from, to }` and drawn
with an arrow.

Run: `npm run probe:injury-review-pairings` (added on this branch, read-only —
it rebuilds the `standard-in-season-week` world through the real generator and
asks the real ladder).

### The exact case, knee 7/10, Mon 13 July

| # | row | dose | verdict |
| --- | --- | --- | --- |
| 1 | Vertical Jump | 2 x 3 | UNSAFE |
| 2 | Back Squat | 3 x 2-4 @ 110kg | UNSAFE |
| 3 | RDLs | 3 x 2-4 @ 90kg | UNSAFE |
| 4 | Cossack Squat | 3 x 8-12 | UNSAFE |
| 5 | Single-Leg RDL | 3 x 6-8 @ 20kg | UNSAFE |
| 6 | Band Pallof Press | 2 x 8-12 | safe |

**Rungs 1-4 accept ZERO candidates for all five rows.** Not "few" — zero:

| row | r1 same movement | r2 secondary compound | r3 accessory/isometric | r4 adjacent pattern | r5 unaffected area |
| --- | --- | --- | --- | --- | --- |
| Vertical Jump | 0 of 5 | 0 of 3 | 0 of 0 | 0 of 0 | **44** |
| Back Squat | 0 of 3 | 0 of 12 | 0 of 3 | 0 of 7 | **73** |
| RDLs | 0 of 2 | 0 of 4 | 0 of 4 | 0 of 16 | **68** |
| Cossack Squat | 0 of 6 | 0 of 9 | 0 of 3 | 0 of 7 | **44** |
| Single-Leg RDL | 0 of 0 | 0 of 3 | 0 of 4 | 0 of 19 | **44** |

So every arrow the athlete is shown comes from rung 5, and the loop simply hands
each row the next unused name off a 44-73 long list. **The pairing carries no
information at all** — `Back Squat -> Chest-Supported DB Row` and
`RDLs -> Single-Arm DB Floor Press` would swap partners if the rows were
reordered.

### AND TWO OF THE FIVE ARE ALREADY IN THIS WEEK

The week the session sits in:

```
Mon 13/7  Strength        Vertical Jump, Back Squat, RDLs, Cossack Squat,
                          Single-Leg RDL, Band Pallof Press
Tue 14/7  Team Training   Explosive Push-up, Barbell Row, Lat Pulldown,
                          Band Pull-Apart
Thu 16/7  Team Training   Single-Arm DB Floor Press, DB Shoulder Press,
                          Banded External Rotation
Sat 18/7  Game
```

`Band Pull-Apart` is Tuesday's. `Single-Arm DB Floor Press` is Thursday's. The
review proposes both again on Monday, and takes the athlete's upper-body rows
for the week from **7 to 12**. That is Sam's *"duplicate or excessive upper-body
volume"*, already happening.

### HOW WIDE IS THIS? — every region swept at 6-7

| area | day | rows | unsafe | rungs 1-4 accepted | rung 5 accepted |
| --- | --- | --- | --- | --- | --- |
| Knee | Mon | 6 | 5 | **0** | 273 |
| Hamstring | Mon | 6 | 5 | **0** | 273 |
| Hip | Mon | 6 | 5 | **0** | 273 |
| Groin | Mon | 6 | **6** | **0** | 219 |
| Calf / Achilles | Mon | 6 | 5 | **0** | 273 |
| Ankle / foot | Mon | 6 | 5 | **0** | 273 |
| Lower back | Mon | 6 | 6 | **0** | 33 |
| Lower back | Tue | 4 | 3 | 3 | 15 |
| Lower back | Thu | 3 | 2 | 5 | 5 |
| Shoulder | Mon | 6 | 2 | 21 | 52 |
| Shoulder | Tue | 4 | 4 | **0** | 155 |
| Shoulder | Thu | 3 | 3 | **0** | 108 |
| Elbow | Tue | 4 | 4 | 3 | 157 |
| Neck | Thu | 3 | 1 | 17 | 81 |

⚠ **RUNGS 1-4 ARE REAL AND MUST BE PRESERVED** — Lower back on Tue/Thu, Shoulder
on Mon, Elbow on Tue and Neck on Thu all get genuine per-exercise answers from
them. **But for EVERY lower-limb region on the lower-body day they are
structurally empty**, because Sam's ruled matrix rates 0 of 9 squats, 0 of 7
lunges and 0 of 8 hinges as `good` for any lower-limb region, and the 6-7 band
correctly refuses `caution`. This is not an edge case on that day; it is the
whole behaviour.

Also worth naming: **Groin at 6-7 makes 6 of 6 rows unsafe**, including
Band Pallof Press — so the "keep the safe work" half has a world with nothing to
keep.

---

## 2. THE PROPOSED RULE

**Nothing about the ladder changes. Nothing about the matrix changes.** The only
change is what happens to a row when rungs 1-4 come back empty.

1. **Rungs 1-4 stay exactly as they are** — per-exercise, first legal answer
   wins, same movement -> secondary compound -> accessory/isometric -> safe
   adjacent pattern. Every arrow the athlete sees comes from one of these four,
   and only from these four.

2. **A row rungs 1-4 cannot answer is WITHHELD, not paired.** This is the
   treatment that already exists and that R-115 already approved: the row stays
   on the session, marked, worded by `injuryWithholdingExplanation` —
   *"Back Squat is not safe with your knee right now — skip it this session."*
   No arrow, no partner.

3. **Then ONE session-level step runs, for the session as a whole**, only when
   at least one row was withheld. It adds a block of unaffected-area work that
   is attached to the SESSION, not to any row:
   - **at most 3 rows**, and never more than the number of withheld rows;
   - **never an exercise already anywhere in the current week** (this is what
     the per-row loop cannot see — it only avoids the same session);
   - **prefers the patterns the rest of the week carries least**;
   - drawn from the same pool rung 5 already uses, through the same legality
     gate — so **the matrix is untouched and a merely `caution` exercise is
     never admitted at 6-7** (measured: every candidate below is rated `good`);
   - stays inside the session's own section — Strength stays Strength, which is
     R-115's rule and is already enforced.

4. **The review shows three lists, not five arrows: PAUSED, KEPT, ADDED**, and
   names the paused patterns in the athlete's own words. Those words already
   exist and are already derived — for this case they are
   *jumping, squatting, deadlift-type work, single-leg hip work*.

---

## 3. BEFORE AND AFTER — knee 7/10, Mon 13 July

### BEFORE (what the session is)

```
Vertical Jump          2 x 3
Back Squat             3 x 2-4   110kg
RDLs                   3 x 2-4   90kg
Cossack Squat          3 x 8-12
Single-Leg RDL         3 x 6-8   20kg
Band Pallof Press      2 x 8-12
                                          6 rows · 16 working sets
```

### AFTER, TODAY (what the app does now — the defect)

```
Vertical Jump      ->  Band Pull-Apart              (already on Tuesday)
Back Squat         ->  Chest-Supported DB Row
RDLs               ->  Single-Arm DB Floor Press    (already on Thursday)
Cossack Squat      ->  Banded Bicep Curl
Single-Leg RDL     ->  Tricep Pushdown
Band Pallof Press      kept
                                          6 rows · upper rows this week 7 -> 12
```

### AFTER, PROPOSED — **OPTION A (recommended)**

```
PAUSED THIS SESSION — your knee
  Vertical Jump          jumping
  Back Squat             squatting
  RDLs                   deadlift-type work
  Cossack Squat          squatting
  Single-Leg RDL         single-leg hip work

KEPT
  Band Pallof Press      2 x 8-12          unchanged

ADDED INSTEAD — nothing through the knee
  Chest Supported Row    2 x 10-12  40kg
  Ab Wheel               2 x 8-12
  Side Plank             2 x 8-12 per side
                                          4 live rows · 8 working sets
                                          upper rows this week 7 -> 8
```

**WHY THOSE THREE.** The week already carries pressing twice and pulling twice;
it carries midline **once**. So the block is one pull the week is short of plus
the two midline rows it has none of. Every one is legal with the athlete's kit,
rated `good` for knee in Sam's matrix, and appears nowhere else in the week. The
doses are the app's own Add door's, asked with the knee injury live — not
invented here.

**Carries were available and deliberately not chosen.** `Farmer Carry`,
`Suitcase Carry`, `Bear Carry` and `Overhead Carry` are all rated `good` for
knee and the week has none, so the "least-carried pattern" rule would reach for
them first. Loaded walking on a knee at 7/10 is the one I would not pick. **This
is a judgement, not a rule the data makes — if Sam wants carries in, the rule
takes them.**

### THE OTHER TWO SHAPES, IF A IS WRONG

**OPTION B — more training (5 live rows, 11 sets).** Adds a press:

```
  Bench Press            3 x 5-8   107.5kg
  Chest Supported Row    2 x 10-12 40kg
  Ab Wheel               2 x 8-12
  Band Pallof Press      2 x 8-12          kept
```
Upper rows this week 7 -> 9. Closer to the session's original hard-strength
intent; costs a third press in a week that already has two.

**OPTION C — minimal (3 live rows, 6 sets).** Midline only, no upper at all:

```
  Band Pallof Press      2 x 8-12          kept
  Ab Wheel               2 x 8-12
  Side Plank             2 x 8-12 per side
```
Adds nothing to the week's upper load. The most conservative reading of *"do not
create duplicate or excessive upper-body volume"*.

---

## 4. WHAT I NEED SAM TO APPROVE

1. **The shape** — A, B or C.
2. **Do the paused rows stay listed on the session, marked**, which is the
   existing R-115 withheld treatment, **or come off it entirely?**
3. **The cap** — "at most 3 rows, never more than the number withheld". Is 3 the
   right number?
4. **Carries in or out** for a lower-limb injury, given the matrix rates them
   `good`.

## 5. NOT COVERED, NAMED

- **Groin at 6-7 leaves nothing to keep** — 6 of 6 rows unsafe, Band Pallof
  Press included. The proposal produces a session that is entirely added work.
  That is arguably correct and it is worth Sam seeing before it ships.
- **The week-level view is new.** No existing owner asks "what does the rest of
  this week already carry" when choosing an injury replacement; the per-row loop
  only avoids the current session. The session-level step needs that reader, and
  it is the one genuinely new piece of machinery here.
