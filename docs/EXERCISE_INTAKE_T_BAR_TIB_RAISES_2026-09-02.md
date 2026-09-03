# Exercise Intake — T-Bar Tib Raises

Signed by Sam, 2026-09-02.

## 1. T-Bar Tib Raises

- **Video:** https://youtube.com/shorts/wRLoLlsgXLk?si=1_FC_ZIrgFjosAMU
- **Category:** Accessories / prehab — lower-body prehab
- **Primary plane:** Sagittal
- **Secondary plane:** None
- **Main muscles:** Tibialis anterior (`Calves` is the closest app muscle bucket)
- **Primary cue:** Pull your toes toward your shins through the full range.
- **Secondary cue:** Keep knees still, pause at the top, and lower under control.
- **Equipment:** Tib bar
- **Dosing:** Total repetitions, not per side
- **Experience:** Everyone
- **Use:** Lower-body prehab, shin accessory, ankle preparation and lower-body Movement Prep
- **Selection:** Automatic equipment progression from Tib Raises when a tib bar is available; direct Swap from Tib Raises; manual Add/Swap
- **Season / game:** All phases. A familiar light dose is permitted at G-1; do not introduce heavy loading near a game.
- **Prescription:** Same as Tib Raises — 2 × 15–20 repetitions with 30 seconds rest
- **Loading:** Tib bar with compatible plates. Start empty or light, use 2.5 kg weight-control steps, retain full ankle range and record total external load.
- **Demand:** Low loading, low fatigue, moderate soreness, low balance demand, moderate eccentric demand
- **Near-game suitability:** Caution
- **Restrictions:** Active ankle dorsiflexion, front-of-shin pain, ankle impingement or pressure across the top of the foot. Reduce load or range if the athlete cannot lower the tib bar under control. Focal or severe shin pain needs review.

| Region | Rating |
| --- | --- |
| Groin | Good |
| Hip | Good |
| Quad | Good |
| Hamstring | Good |
| Knee | Good |
| Calf | Caution |
| Ankle/foot | Caution |
| Ribs | Good |
| Lower back | Good |
| Neck | Good |
| Shoulder | Good |
| Elbow | Good |
| Wrist/hand | Good |

Guard: `LAW-t-bar-tib-raises-intake` through chained `test:exercise-intake`,
which invokes `test:t-bar-tib-raises`.

## NOT COVERED

- Independent clinical validation of the supplied ratings and restrictions.
- Physical-iPhone acceptance or external video playback.

---

**Addendum, 2026-09-03 (seat `integrate`, on Sam's "build all three fixes").**
The injury ratings above were authored by hand at intake. The ruled injury
matrix (2026-07-28, Sam's rules on the movement-pattern and primary-muscle
axes, strictest rule wins, named exceptions only) rates `Tib Raises` — the
same movement pattern and primary muscle, with no named exception — caution
on groin, hip, quad, hamstring, knee and lower back. One ruling model rates
both tib raises: `T-Bar Tib Raises` now carries the same row as `Tib Raises`
in `exerciseTags.ts`, and `test:t-bar-tib-raises` holds the two equal. The
workbook itself was last built 2026-08-27 and does not yet list the
post-08-27 intakes; `verify:injury-matrix-sheet` reports that gap.
