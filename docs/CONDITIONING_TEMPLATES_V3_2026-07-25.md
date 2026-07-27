# Conditioning Templates V3-FINAL — all eight rulings applied (2026-07-25)

Companion to `docs/CONDITIONING_TEMPLATES_V3_2026-07-25.xlsx` (updated in
place). V2 rebuilt 99 base templates into 54 rows against Sam's framework and
left 13 questions. V3 applied Sam's first five rulings; **V3-final applies the
last three and closes the flag work.**

**58 rows across 8 quality tabs.** Every ruling is named at the row it touches,
on the **V3 Rulings** tab, and in the **Change Log**.

---

## Final flag count

| | V2 | V3 | **V3-final** |
|---|---|---|---|
| ⚑ RATIO | 19 | 9 | **1** |
| ⚑ BAND | 5 | 5 | **0** |
| ⚑ INFERRED rows | 10 | 10 | **10** |
| **Rows carrying any ⚑** | 29 | 20 | **11** |
| In band / classified, unflagged | 21 | 32 | **41** |
| No framework band (COD 6, Flush 7) | 10 | 13 | 13 |

**Skim List tab = 11 rows: the 10 ⚑ INFERRED + the descending-rest variant.**
That is the whole remaining review queue, exactly as you called it.

The one surviving ratio mark is **not** on a row — it is on the optional
descending-rest *variant* inside 45 s Hard Repeats (rest falling 90 s → 30 s
hits 1:0.7 at the last rep). The base row is in band and unflagged. Confirm the
variant or drop it and the sheet has zero ratio marks.

---

## The three rulings

**1. Intensity classifies. W:R is only a property.**

Written as a one-line law in **both** places:
`CONDITIONING_FRAMEWORK_SAM_2026-07-25.md` (new section directly above the
governing table, with the bands re-described as "descriptive of the typical
case, not a filing test") and the Architecture tab, plus rule 7 in the standing
rules: *do not re-file a session because its ratio sits outside a band, and do
not re-dose it to fit one.* The sprint-family exemption is now also carried in
the framework doc as a footnote on the table.

The law cleared **9 flags on non-inferred rows at once** — more than the four
you named, because the same reasoning retires the whole class:

- the 4 tempo rows you named — 30:30 controlled, 1 min on/1 min, 2 min on/1 min,
  extensive tempo — all stay in Aerobic Capacity, where their 65–80% MAS
  intensity puts them;
- **MAS 15:15** and **30:30 Hard Intermittent** — ⚑ BAND for effort length below
  the 1–5 min column; at 100–110% MAS their intensity is aerobic power, so the
  effort length is a property;
- **60–90 s Max Sustained** — ⚑ BAND for the 90 s end exceeding the 15–60 s
  column; all-out sustained is glycolytic intensity, so it classifies in
  Anaerobic;
- the ratio marks on the 3 ⚑ INFERRED protocol rows (Tabata 2:1, Inverse Tabata
  1:2, Bodyweight Circuit ≈2:1). Those rows stay on the skim list, but as
  **INFERRED only** — their dose is invented, which is a different problem.

**One of the nine needs your eye.** *30 m Acceleration Reps* was ⚑ BAND because
its cue says "build to about 80–90%" while the alactic intensity is 95–100%. I
cleared it by reading your 80–90% as a **top-end-velocity** instruction (there
is no top-end on a 30 m rep) rather than a metabolic intensity — on that
reading it is still maximal-intent alactic work and classifies where it sits.
That reading is stated at the row. If you meant 80–90% metabolically, say so
and the flag comes back.

**2. 400 m Repeats depart every 3:00.** Structure changed, not relabelled: rest
is now the remainder of a 3:00 cycle (**≈100–105 s**), 4–6 reps, total 12–18 min.
True ratio **≈1:1.3** — and exactly **1:1** for an athlete running 400 m in ~90 s,
which is where your "~1:1-ish" lands. Flag cleared on both counts (the law
classifies it by intensity regardless). Worth noting the ratio here rides on
the sheet's 400 m ≈ 75–80 s assumption, which is listed on the Architecture tab.

**3. Deceleration and Landing Work stays in COD.** Q14 closed — landing
mechanics, not jump training. The row keeps only its ⚑ INFERRED dose mark
(the Bible names the drill, not the numbers).

---

## What's left for you

The Skim List tab, 11 rows, one line each:

- **⚑ Resisted Band Acceleration** — in neither the Bible nor the framework;
  keep as an inferred option or remove it the way the sled row went (Q13).
- **5 COD/Decel rows** — the Bible names each drill but gives no numbers, so
  every dose is this sheet's. Q6 (COD has no framework band at all) is still
  open and is the last structural question in the sheet.
- **⚑ Tabata, ⚑ Inverse Tabata, ⚑ Bodyweight Circuit, ⚑ Erg EMOM** — invented
  timings; confirm or replace.
- **45 s Hard Repeats** — the descending-rest variant only.

Also still unbuilt, listed not invented: three framework sessions with no
template row — 30:15 intervals, hard shuttles 2×4×30 s, footy repeat efforts
3×4×20 s. And Q9 (Off-Feet MetCon removed in both places) and Q10 (the 10 s
boundary on Row/Ski) remain open but touch no flag.

---

## NOT COVERED (Process Law L2)

Documents-only pass. Nothing below was touched or verified.

- **No code changed, no tests run, no gates.** `test:bible` and `test:compile`
  were not run — no source file changed, but that is an argument, not evidence.
- **Sam's framework doc was edited.** This pass added the classification law,
  the sprint-family footnote and the table asterisk to
  `CONDITIONING_FRAMEWORK_SAM_2026-07-25.md`. That file is your authored
  physiology; the additions are your words from this session, but they are
  edits to your document and worth reading back.
- **The classification law was applied beyond the four rows named.** Clearing
  the two short-intermittent rows, the 90 s row and the 30 m intensity row is
  an extension of your ruling, not a literal instruction. Each is stated at its
  row; the 30 m one rests on a reading of your cue and is called out above.
- **D14 is cited, not implemented**, and the mid-session mixing property still
  has no code representation. Both remain the likeliest engineering work.
- **No app wiring surveyed.** What MOVED rows, merged row names, the dissolved
  Grind tab and the four new rows do to anything referencing a template by
  quality or by name is unexamined.
- **No device pass, no acceptance of V3-final itself.** Per L7/L10 the rulings
  are applied but the sheet as a whole is not signed off; nothing here is "done".
- **Bible citations carried forward, not re-opened.**
- **Effort-length conversions remain assumptions** (400 m ≈ 75–80 s, 150 m ≈ 22 s,
  100 m @65–75% ≈ 16 s…), on the Architecture tab. Ruling 2's ≈1:1.3 and
  ruling 7's departure-cycle ratios inherit them.
- **Cue quality still not reviewed as a body** — only the cues you flagged were
  rewritten.
- **10 ⚑ INFERRED rows still stand.** Their numbers remain this sheet's
  invention, not a citation.
