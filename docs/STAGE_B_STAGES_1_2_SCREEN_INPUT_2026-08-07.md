# Stage B stages 1 + 2 — SCREEN-LEVEL INPUT for the combined device pass

Input for the seat's tap list. **Landed on `feat/stage-b-stage2` only** —
verified by ANCESTRY of every commit named in the two boundary reports, not by
reading commit subjects. No parked flags. Screens and sights, no suite names.

**Scope boundary, stated:** this covers the **stage 1 + stage 2** boundary
reports (`STAGE_B_STAGE1_BOUNDARY_REPORT_2026-08-04`,
`STAGE_B_STAGE2_CHECKPOINT_COMPLETE_2026-08-05`, `STAGE_B_UNIT7_BOUNDARY`,
`STAGE_B_IMPLEMENTATION_BATCH_BOUNDARY`, `STAGE_B_STAGE2_SWITCHOVER_BOUNDARY`).
It does **not** re-cover R5.3 / R5.7, which merged into this branch later and
already had their own tap list in the R5 boundary report.

**The two screens.** The Program tab's **week screen** (`HomeScreen`, which
renders the V2 week), and the **day screen** reached by tapping a day from it
(`DayWorkout`, which is the V2 day). Named from the navigator — I have not
tapped through a device, so treat button wording as mine to be corrected.

---

## A. The day screen — open any day carrying a conditioning or speed session

### A1. Conditioning sessions now carry Sam's signed names

**Expect** the workbook's names, verbatim — e.g. *Continuous Aerobic Run*,
*Classic 4×4*, *Two-Minute Repeats*, *Footy Shuttles*, *MAS 15:15 Blocks*,
*Short Flush*, *Nasal-Paced Easy*, *Erg EMOM*, *Extensive Tempo (100 m
repeats)*. **55 signed templates; there is no other place a conditioning dose
exists.**

**A finding is** any composed or code-flavoured name — anything with a machine
appended (`— Assault Bike`), anything reading like
*"Easy Aerobic Flush (2 × 10min easy Mixed Erg Block)"*, or the words
"micro-dose". Those were the code-authored names, and all fifteen code sites
that built them are deleted.

### A2. The dose text is the workbook's words, not generated prose

**Expect** work period, rest period, sets/rounds, intensity and effort cue to
read as authored. **A finding is** a dose that looks computed — rounded numbers
that don't match the sheet, or an intensity phrased differently from the row.

### A3. A `Warm-up` row first; NO cool-down row

**Expect** a structural warm-up row at the top of a conditioning session, and
**no cool-down row at all** — recovery is the Flush tab's job now, so a
cool-down is not composed. **A finding is** a surviving cool-down row.

### A4. The cue on a conditioning row is Sam's cue

**Expect** the authored effort cue + intensity verbatim. **A finding is** a
generic cue where the sheet has a specific one.

### A5. **A recovery session actually gives recovery work** — the sharpest one

This was a real defect, found and fixed inside stage 2. A session already marked
recovery was asking for aerobic base and getting a long steady run.

| | was | now |
|---|---|---|
| work | 30–50 min continuous | **10–20 min continuous easy** |
| intensity | 65–80% MAS, conversational | **very easy, 3–4/10** |
| cue | "steady the whole way" | **"finish better than you started"** |

**Where:** a day whose session is a recovery/flush slot — the planner has
already marked it optional, light, low-stress. **Expect** a short flush.
**A finding is** a 30–50 minute steady run sitting in that slot.

### A6. Speed sessions name their authored template

**Expect** *Hill Acceleration*, *20 m Acceleration Reps*, *30 m Repeats*,
*Fly 20 (20+20)*, *Off-Season Speed Reintroduction*, etc. In late off-season the
progression goes by position: ≤1 → *Hill Acceleration*, 2 → *20 m Acceleration
Reps*, otherwise *Off-Season Speed Reintroduction*.

### A7. Conditioning renders on machines you actually own

**Expect** the rendering to respect your machine set, and — if you are
off-feet-restricted — a substitution that is **another authored template of the
same quality that runs on a machine**, not a converted or halved version of the
running one. With no equipment in off-season, expect *Brisk Walking* or
*Bodyweight Circuit (no-equipment fallback)*. Sprint-family work is never
converted off-feet (there is no off-feet sprint row), so **expect it to be
absent rather than substituted**.

### A8. A rotating/mixed machine session shows whole-body muscles

**Expect** the authored whole-body row. **A finding is** muscles that look like
the four machine rows added together — the authored answer is deliberately not a
union.

---

## B. The week screen

### B1. A day you marked REST holds nothing

Stage 1 converged the live path onto the accepted answer, using Sam's own device
note as the ruling: the screen had prescribed **Lower Squat** on a day he had
marked rest, while the accepted week correctly held nothing.

**Expect** a day marked rest to stay empty. **A finding is** any prescribed
session appearing on it. Marks and removals still outrank a manual override.

### B2. An override on a date OUTSIDE the program block renders again

**Tape both B1 and B2 — they are the same commit's two sides.** The B1 fix
briefly took manual overrides below a "no block data" guard, and from that
commit any override dated outside the program's start/end resolved to nothing:
**the whole week came back empty**. That was found and fixed inside stage 2.

**Expect** an override placed outside the block to render its content, and the
rest of the week to be unaffected.

### B3. The readiness card shows the fact you actually tapped

When more than one readiness fact is live, the card and the trim now read the
same fact, carried from your tap. **A finding is** the card naming a different
fact from the one you entered — the old behaviour re-picked one **alphabetically
by fact kind**, so with two facts active it could show the wrong one.

### B4. Conditioning rows travel with the projected week

Sam's warm-up sentence shipping through the copy sheet unblocked the week
projection carrying conditioning rows for the first time. **Expect** conditioning
sessions to list their rows wherever the week screen shows session content.
**Lower confidence than the rest of this list** — I traced it in the reports, not
on a screen; if the week screen never showed rows for any session type, there is
nothing here to see.

---

## C. Removing and re-adding a session

**Expect** removing a session and then re-adding it to restore it. The restore is
now a typed decision being reversed rather than a side effect of the old override
writer.

---

## D. Two things Sam may see that are ALREADY KNOWN — not new findings

Recording these so a known defect does not get written up as a discovery.

### D1. Off-season block 2's deload week RESHAPES instead of shrinking

**Declared, measured, deliberately not fixed** — it needs a ruling first, and the
obvious fix was tried and reverted because it breaks pre-season generation
outright.

On an off-season block generated from a previous program, the deload week's days
change identity instead of the work shrinking — in the measured fixture, day 2
went from *Lower Body Strength* (Front Squat, Trap Bar Deadlift) to *Lower Hinge*
with **no anchor lift at all**. Block 1 is clean. Sam's law is "same week, same
days; the structure doesn't change, the work shrinks".

**If Sam sees this, it is the known one.** A block-1 deload showing it, or an
in-season/pre-season deload showing it, would be new.

### D2. A lighter day can now be re-filtered by a later injury

Stage 1 moved the lighter-day trim off the athlete's stored surface onto a
derived overlay. The trim itself is unchanged — same trim, same refusal, same
disclosure copy, same undo. But the old stored form was skipped by the injury
filter and the new one is not, so **a lighter day is now re-filterable by a later
injury**. That is a surfaced behaviour question, not a decided behaviour — worth
a tap if Sam wants to rule it.

---

## NOT COVERED, honestly

- **No device evidence.** Every item is traced from the boundary reports and the
  source; none has been seen on a phone. That is what this pass is for.
- **Screen and navigation wording is from the navigator**, not from a device
  tap-through — the two screens are right, the button text may not be.
- **B4 is the one item I would not bet on** (marked at its entry).
- Five week modes were never reached by stage 1's proof loop — **bye,
  bye_recovery, deload, optional, illness_recovery/full-pause**. Two modes are
  proven, not seven; a device pass that lands in one of the other five is
  crossing ground no test has.
- **The coach path is untouched and frozen**, so its doses remain a second
  authority until the coach rebuild — do not read a coach-authored dose as a
  contradiction of A1.
- **The known deload defect (D1) has no fix**, and the week-shape law it breaks
  is real; it is contained by declaration only.
