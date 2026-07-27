# Conditioning Templates — FINAL (2026-07-25)

`docs/CONDITIONING_TEMPLATES_FINAL_2026-07-25.xlsx`. Supersedes V2 and V3.
All seventeen of Sam's rulings applied.

## Final numbers

| | |
|---|---|
| **Templates** | **55** across 8 quality tabs |
| ⚑ RATIO | **0** |
| ⚑ BAND | **0** |
| ⚑ INFERRED | **0** |
| **Skim List** | **EMPTY** |

Trace: 99 base templates → 54 (V2) → 58 (V3, +4 Sam-authored) → **55** (final,
−3 binned). Per tab: Acceleration 7 · Top End Speed 4 · Repeat Sprint 5 ·
COD/Decel 4 · Anaerobic 9 · Aerobic Power 9 · Aerobic Capacity 10 · Flush 7.

Every one of the 99 base rows is still traced to its destination in the
**Change Log** tab; all 17 rulings are on the **V3 Rulings** tab.

## Schema change: a Properties column

Sam asked for finisher-role and fallback-only to be *properties*. Rather than
bury them in prose, the schema gained a **Properties** column — scope rules
that bind at selection time, machine-readable per row, and documented in the
framework doc:

| Property | Rows |
|---|---|
| `SET LENGTH ≤ 4–5 min` | MAS 15:15, 30:30 Hard Intermittent, Erg EMOM |
| `FINISHER ROLE ONLY · ERG ONLY · single set` | Tabata Finisher |
| `FALLBACK ONLY (no-equipment athletes)` | Bodyweight Circuit |
| `AVAILABILITY GATE: no-team-training weeks only · LOW priority` | all 4 COD/Decel rows |
| `MID-SESSION MIXING ALLOWED (flush-only)` | the 3 Flush Intervals rows |

## The rulings

**1 — short-intermittent set-length rule.** Now law in the framework doc under
Aerobic power. **Two of the three rows broke it and were restructured:**

- MAS 15:15 already complied (8 rounds = a 4 min block).
- **30:30 Hard Intermittent** ran 8–10 unbroken rounds = 8–10 min, over the cap
  → now **2 blocks × 5 rounds**, 2–3 min between, ≈12–13 min total.
- **Erg EMOM** ran 10–15 unbroken rounds = 10–15 min, over the cap → now
  **2–3 blocks × 5 rounds**, ≈12–21 min total. Its 40 s/20 s split is confirmed,
  so the row loses its inferred mark.

Encoding the rule as you asked forced those two restructures — the sessions
changed shape, so they're worth a look. I scoped the rule to the 15:15 class
(reps ≤ 40 s) only; it does not touch Footy Shuttles' 1 min reps or the 2–4 min
interval rows.

**2** — 30 m Acceleration Reps at 95–100%; the "build to 80–90%" cue is retired.
**3** — Resisted Band Acceleration binned. **4** — Inverse Tabata → **10 s
Repeat Efforts**, 10 s / 30 s, 8 rounds, 1:3, in the RSA band; Sam-authored so
no longer inferred. **6** — Tabata → **Tabata Finisher**, erg-only (Run
removed), single set, 4 min. **7** — descending-rest variant dropped; that was
the sheet's last ratio mark. **8** — **60 s Max Sustained Effort**, 4–6 × 60 s /
2 min, 12–18 min; effort length now inside the glycolytic column outright.
**9** — Bodyweight Circuit kept, fallback-only.

**5 — COD.** Two binned (Short COD Circuit, COD Finisher), all four survivors
gated, three drafted doses approved.

## Two things you should correct if I read them wrong

**COD kept 4 rows, not 2.** "Keep ONLY Low-Intensity Deceleration Drills +
45-Degree Cut Reps" and "bin Short COD Circuit and COD Finisher" name two
survivors but only two bins — and the tab had six rows. I read the ruling as
scoped to the five rows on the skim list (which is what you were ruling on), so:
kept those two + Deceleration & Landing per your earlier ruling, binned the two
you named, and **left Up-Back Shuttle**, which was never on the skim list — it's
the only Bible-sourced structured COD session you have. One line and it goes.

**Two 10 s rows now sit side by side in Repeat Sprint.** The renamed 10 s Repeat
Efforts (8 × 10 s / 30 s, 1:3) and the existing 10 s Max Sprint Repeats
(6 × 10 s / 50 s, 1:5). Both in band, genuinely different recovery, but they're
adjacent enough that you may want one. Not merged — you restructured one of them
deliberately.

## Residue (L2)

Everything that is *not* closed by these rulings:

- **Framework doc edited again.** This pass added the set-length rule (under
  Aerobic power) and a Template properties section. Combined with the earlier
  classification law and sprint-family footnote, your authored physiology doc
  now carries four blocks of text written this session from your rulings. Worth
  a read-back — it is your document.
- **Q9 (Off-Feet MetCon removed in both places)** and **Q10 (whether 10 s counts
  as "under 10 s" for Row/Ski)** are still open. Neither carries a flag, so
  neither appears on the Skim List — they'd be invisible if you only skim that
  tab.
- **Three framework sessions still have no template row**: 30:15 intervals,
  hard shuttles 2×4×30 s, footy repeat efforts 3×4×20 s. Listed, not invented.
- **COD has no framework band** and now never will — it is a gated mechanics
  row rather than a trained quality. That is a design position, not an
  oversight, but it is not written into the framework's governing table.
- **The Properties column has no code representation**, and neither does
  mid-session mixing, the availability gate, finisher-role or fallback-only.
  These are the four selection-time behaviours the app would have to learn;
  they are the largest engineering surface this sheet now implies.
- **D14 is cited, not implemented** — the 2 km TT screen, on-device MAS,
  experience-level defaults and re-test loop. Every %MAS row depends on it.
- **No code changed, no tests run, no gates, no device pass.** `test:bible` and
  `test:compile` were not run; no source file changed, but that is an argument,
  not evidence. Per L7/L10 the sheet carries your rulings back — it is not
  "done" until you've read it.
- **No app wiring surveyed**: what the dissolved Grind tab, the moved and merged
  row names, the 4 new rows and the 3 binned rows do to anything referencing a
  template by quality or name.
- **Effort-length conversions remain assumptions** (400 m ≈ 75–80 s, 150 m ≈ 22 s,
  100 m @65–75% ≈ 16 s…), on the Architecture tab. Several computed ratios
  inherit them.
- **Cue quality never reviewed as a body** — only the cues you flagged, plus the
  30 m cue rewritten this pass to match its new intensity.
- **Zero flags is not zero risk.** Every dose is now either framework-sourced,
  Bible-sourced or Sam-approved — but "approved as drafted" on the three COD
  rows means you accepted numbers this sheet invented. They are no longer
  marked, so nothing will remind you of that later. The Change Log and Source
  columns still record which rows those were.
