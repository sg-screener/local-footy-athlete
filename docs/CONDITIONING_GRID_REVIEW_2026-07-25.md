# The Conditioning Grid — Athletic-Quality Review Sheet (2026-07-25)

Read-only sheet generation for Sam's review. This **replaces** the earlier
D12 goal-based draft of this same review (Finisher/Short/Hard/Long
Intervals/Continuous × modality), which is superseded by this brief:
**athletic quality** (Acceleration · Top End Speed · Repeat Sprint · Change
of Direction/Decel · Anaerobic · Aerobic Power · Aerobic Capacity · Flush ·
Grind — **9 rows**, Tempo dropped per Sam's amendment below) × **modality**
(Run · Bike · Ski · Row · Air Bike).

Every existing census conditioning format (`CONDITIONING_META` in
`exerciseTags.ts`, 37 entries) and every Bible-prescribed conditioning/sprint
dose (`docs/LFA_PROGRAMMING_BIBLE.md`) is sorted into a cell below, using the
Bible's own wording where it gives one. Physically meaningless cells
(e.g. top-end speed on an erg, COD on a bike) are marked **—**. Genuinely
uncoverable cells are marked **EMPTY** for Sam to fill or strike.

**Amendment applied (Sam, mid-review):** dropped the Tempo row — nine
quality rows, not ten. Tempo formats were redistributed by intent:
easy/recovery-pace tempo (`Tempo Run`, `Long Nasal Run`, `Flush Run` class)
→ **Flush**; controlled harder blocks (`30:30 Tempo Blocks`, `Tempo
Intervals`) → **Aerobic Capacity**.

## Working definitions (none of these 9 labels exist verbatim in the Bible — read this before the grid)

The Bible has a detailed, explicitly-named taxonomy for four of these rows
(Acceleration, Max velocity, Change of direction, Repeated sprint — Section
7, "Sprint, speed and COD rules", L1535-1768, mirrored more briefly in
Section 4 at L590-646). Deceleration is explicitly folded into COD rather
than given its own dose menu (L612-613: "Usually covered through team
training, strength, single-leg work, landing mechanics... Do not make
deceleration a big standalone category"), which is why it rides with COD as
one combined row rather than getting independent doses.

The remaining five rows (Anaerobic, Aerobic Power, Aerobic Capacity, Flush,
Grind) are **not** Bible section names — they are a physiological-quality
overlay on top of the Bible's own conditioning sections ("Easy aerobic",
"Tempo / extensive conditioning", "Hard intervals", "Recovery"). The
sorting below reflects the following working definitions, used to decide
which Bible dose lands in which row. Where a dose could plausibly sit in
more than one row it is cross-listed, exactly as the census-placement check
does for modality.

- **Anaerobic** — short (≲30 sec) maximal glycolytic/alactic bursts. Anchor:
  `masIntensityForWorkSeconds` (`src/utils/masCopy.ts`) rates work ≤30s at
  110% MAS — the Bible's own numeric line between "sprint-short" and
  "sustained-hard" doses.
- **Aerobic Power** — VO2max-range hard efforts, roughly 2-6 min work bouts
  (4x4min, 1km repeats, longer-rep MAS work at 100% MAS). This is the Bible's
  "Hard intervals" bucket at its longer end.
- **Aerobic Capacity** — controlled, repeatable tempo-scale work: the
  Bible's "Tempo / extensive conditioning" section (L1215-1252) in full,
  now that the harder Tempo-named census formats have been folded in here
  per Sam's amendment.
- **Flush** — easy/recovery-pace continuous or light work, PLUS (per Sam's
  amendment) the easy-paced tempo-named census formats (`Tempo Run`, `Long
  Nasal Run`) that read as continuous aerobic-base pace rather than true
  controlled-tempo effort. This absorbs the Bible's "Recovery" (L463-504)
  and "Easy aerobic" (L1183-1214) sections.
- **Grind** ⚑ — **the one row with no Bible section at all.** The only
  textual anchor is a single throwaway line: "Footy athletes must be able
  to sprint, repeat sprint, grind for up to 1 min, have a big engine as
  well as play for 2 hours" (L1483). Read literally, "grind" names the
  ~45-90 second sustained-maximal zone between Anaerobic's short bursts and
  Aerobic Power's 2min+ efforts — the domain of a hard 400m, a long hill
  sprint repeated, or a MetCon under fatigue. Every placement in this row
  is an editorial best-fit against that one line, not a sourced dose menu.
  **Structural flag, up front: Sam should either (a) give this row an
  explicit duration/intensity definition, or (b) fold it back into
  Anaerobic/Aerobic Power and drop it as a separate row.** Everything below
  it is provisional.

**13 rows are flagged ⚑ UNCERTAIN** below — genuine judgment calls (Bible
ambiguity, census/Bible mismatches, or the row-definition questions above)
rather than confident sorting.

## Grid overview

| Quality \ Modality | Run | Bike | Ski | Row | Air Bike |
|---|---|---|---|---|---|
| Acceleration | 5 variants | — | — | — | — |
| Top End Speed | 5 variants | — | — | — | — |
| Repeat Sprint | 6 variants | EMPTY | 1 variant | 1 variant | 2 variants |
| Change of Direction/Decel | 3 variants | — | — | — | — |
| Anaerobic | 3 variants | EMPTY | 1 variant | 1 variant | 3 variants |
| Aerobic Power | 6 variants | 3 variants | 3 variants | 3 variants | 4 variants |
| Aerobic Capacity | 7 variants | 5 variants | 2 variants | 2 variants | 3 variants |
| Flush | 10 variants | 6 variants | 1 variant | 2 variants | EMPTY |
| Grind ⚑ | 3 variants | EMPTY | 1 variant | 1 variant | 1 variant |

## Acceleration

Bible source: Section 7, "Acceleration" (L1542-1577). Field-sprint
mechanics quality — physically meaningless on any erg (task's own worked
example).

### Run

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| 6-10 x 10m | | Bible §7 Acceleration, L1547 | |
| 4-8 x 20m | | Bible §7 Acceleration, L1548 | |
| 4-6 x 30m | | Bible §7 Acceleration, L1549 | |
| Hill sprints / sled pushes, used carefully | `Hill Sprints` | Bible §7 Acceleration, L1550 | ⚑ cross-listed at Grind (repeated-fatigue use) — Sam's call on primary home. |
| 3-4 x 10-20m accelerations (in-season micro-dose, can double as TT warm-up) | | Bible, L1704 | |

### Bike / Ski / Row / Air Bike

**— physically meaningless.** Acceleration is a field-sprint-mechanics
quality; the census's own Tier-A rule explicitly excludes bike-based sprint
work from this category ("Bike-based sprint work is explicitly excluded
from Tier A").

## Top End Speed

Bible source: Section 7, "Max velocity" (L1578-1614). Also field-only —
"physically meaningless on an erg" is the task's own worked example for
this exact quality.

### Run

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| 20m build + 20m fast | | Bible §7 Max velocity, L1584 | |
| 30m build + 30m fast | | Bible §7 Max velocity, L1585 | |
| 40-60m smooth sprint exposure, gradually building | | Bible §7 Max velocity, L1586 | |
| 3-5 flying sprints | `Flying Sprints` | Bible §7 Max velocity, L1587 | |
| Quality Sprints (census format, full-recovery max-velocity reps) | `Quality Sprints` | Bible §7 Max velocity "high-quality reps", L1587-1588 | ⚑ Bible doesn't name "Quality Sprints" directly — placement inferred from the quality-rep language attached to Max velocity. |

### Bike / Ski / Row / Air Bike

**— physically meaningless.**

## Repeat Sprint

Bible source: Section 7, "Repeated sprint" (L1649-1690), mirrored briefly
at §4 L614-620. The one speed-quality row with genuine erg equivalents —
Bible explicitly gives assault bike and rower/ski dose variants.

### Run

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| 10-15 x 20m with walk-back recovery | | Bible §7, L1654 (§4's shorter form gives "10x20m", L616 — minor wording discrepancy) | |
| 10 x 30m with walk-back recovery | | Bible §7, L1655 / §4 L617 | |
| 3-5 sets of 3-5 short sprints | | Bible §7, L1656 / §4 L618 | |
| Sprint / jog / walk repeat patterns | | Bible §7, L1657 | |
| Sprint Intervals (census format, generic repeated-effort dose) | `Sprint Intervals` | census tier A | ⚑ name is generic; Bible gives no exact structure — placed here as the best-fit repeated-effort home; could also belong under Acceleration or Top End Speed. |
| Free Sprint Session (census format, open/unstructured) | `Free Sprint Session` | census tier A | ⚑ same ambiguity — no Bible-specified structure; genuinely could be any of the four speed rows depending on how the athlete runs it. |

### Bike

**EMPTY.** No Bible or census dose names a repeat-sprint structure for a
regular/road-style bike — only the assault bike (Air Bike column) is
named. Sam to decide whether to extend or leave uncovered.

### Ski

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| 20-30 sec sprints every 90 sec-2 min, repeat 10-15 min | | Bible §7, L1659 / §4 L620 (Bible names "rower or ski erg" as one combined option) | |

### Row

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| 20-30 sec sprints every 90 sec-2 min, repeat 10-15 min | | Bible §7, L1659 / §4 L620 | |

### Air Bike

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| 3 x 20 sec max sprints, starting every 2 min | `Max Effort Sprint Accumulation` | Bible §7, L1658 / §4 L619 | |
| 6 x 10 sec max sprints, starting every minute | | Bible §7, L1658 | |

## Change of Direction/Decel

Bible source: Section 7, "Change of direction" (L1615-1648), mirrored at §4
L604-611. Field-cutting quality — physically meaningless on any erg (task's
own worked example). Deceleration has **no independent dose menu** — the
Bible explicitly folds it into COD/team-training/strength rather than
dosing it standalone (L612-613), which is why this row is combined rather
than split.

### Run

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| Up-back shuttle: 30m out, 180° turn, 30m back, walk recovery, repeat 10-15 min after warm-up | | Bible §7, L1627-1632 / §4 L606-611 | The only structured COD example the Bible gives at all. |
| Low-intensity deceleration drills (athlete building from zero) | | Bible, L1758 | ⚑ this is the closest thing to a "Decel" dose in the whole document, and it's one clause inside an "athlete does no sprint work" onboarding ladder, not a standing prescription. |
| Deceleration and landing work (off-season) | | Bible, L1739 | ⚑ named but not dosed — no reps/sets/duration given anywhere in the Bible. |

### Bike / Ski / Row / Air Bike

**— physically meaningless.**

## Anaerobic

Working definition: short (≲30 sec) maximal glycolytic/alactic bursts — see
"Working definitions" above.

### Run

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| MAS 15:15 Blocks: 8 rounds of 15s hard / 15s easy, 2 min rest between, repeat | `MAS 15:15 Blocks` | Bible Hard-intervals, L1271 / L1260 / L559 | 15s work interval = 110% MAS per `masIntensityForWorkSeconds` (`src/utils/masCopy.ts`). |
| Tabata Intervals (census format, ~20s on/10s easy assumed) | `Tabata Intervals` | census tier A | ⚑ Bible never defines exact Tabata timing — classic protocol assumed, not sourced. Sam should confirm or author the real timing. |
| Inverse Tabata (flipped work:rest) | `Inverse Tabata` | census tier A | ⚑ same — Bible doesn't define this; timing assumed from the name only. |

### Bike

**EMPTY.** The Bible's ≤20s hard-burst dose is explicitly named for
"assault bike/rower/ski," not regular bike (L1273) — regular-bike anaerobic
dosing isn't sourced anywhere. Sam to decide.

### Ski

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| 6-10 x 10-20 sec hard | | Bible Hard-intervals work/rest, L1273 | Bible names this for "assault bike/rower/ski" as one group, not ski-exclusive. |

### Row

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| 6-10 x 10-20 sec hard | | Bible Hard-intervals work/rest, L1273 | Same cross-modality sourcing as Ski. |

### Air Bike

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| 6-10 x 10-20 sec hard on assault bike | `Max Effort Sprint Accumulation` | Bible, L1273 / L561 | |
| 3 x 20 sec flat out every 2 min (in-season small dose) | `Air Bike Sprints` | Bible in-season small-dose example, L1340 | ⚑ census tags this format tier B-low (moderate) — cross-listed at Aerobic Capacity to match its official tier; this specific Bible dose reads short/max-effort, i.e. genuinely anaerobic. Sam's call on primary home. |
| 6 x 10 sec every minute | | Bible in-season small-dose example, L1340 | |

## Aerobic Power

Working definition: VO2max-range hard efforts, roughly 2-6 min work bouts —
see "Working definitions" above. This is the longer end of the Bible's
"Hard intervals" bucket (L1253-1308).

### Run

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| 4-5 x 4 min hard / 2-3 min easy | | Bible Hard conditioning, L557 | ⚑ the Bible states this dose two ways in two places — L557 says "2-3 min easy", L1269 says "3 min easy" flat. Sam should confirm the intended rest. |
| 4-6 x 1km with controlled rest, up to 3 min | `6x1km` | Bible, L558 / L1270 | `1km Repeat Intervals` (census) is the same dose under a different name — likely redundant; Sam may want to merge or strike one. |
| 1km Repeat Intervals (census format, same dose as above) | `1km Repeat Intervals` | Bible, L1270 / L1259 | See note on 6x1km — probable duplicate census entry for the same Bible dose. |
| MAS intervals / MAS running (longer-rep MAS, 100% MAS per `masCopy.ts`) | `MAS Training` | Bible, L565 / L1359 | |
| 200m/400m repeats | `200m/400m Repeat Runs` | Bible, L1261 / L566 | ⚑ cross-listed at Grind — the 400m half sits closer to the ~60-90s "grind" zone than a classic 3-5min VO2 effort; Sam's call on primary home. |
| 20-30 min total hard conditioning time (session-length envelope, not a specific work/rest structure) | | Bible, L1274 / L1283 | Pairs with any of the doses above. |

### Bike

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| Bike VO2 | | Bible, L573 | No exact census-format name match. |
| 4x4 VO2 (census format, mixed modality) | `4x4 VO2` | census tier B-high, modality 'mixed' | Not bike-exclusive — cross-listed under Ski/Row below rather than duplicated as separate dose text. |
| 4-5 x 4 min hard / 2-3 min easy (bike application) | | Bible, L557 / L1269 | Same rest-length discrepancy noted under Run. |

### Ski

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| Ski intervals (hard) | `Hard SkiErg Intervals` | Bible, L575 | Duration unspecified beyond the 4-8min/10-min-cap rule (L1319 / L4102). |
| Erg EMOM | `Erg EMOM` | Bible, L576 | Cross-modality — also fits Row/Air Bike/Bike. |
| 4x4 VO2 (cross-listed, mixed modality) | `4x4 VO2` | census tier B-high | See Bike cell for the primary note. |

### Row

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| Rower intervals (hard) | `Hard Row Intervals` | Bible, L574 | Same duration-unspecified caveat, capped by L1318 / L4102. |
| Erg EMOM | `Erg EMOM` | Bible, L576 | Cross-modality — also fits Ski/Air Bike/Bike. |
| 4x4 VO2 (cross-listed, mixed modality) | `4x4 VO2` | census tier B-high | See Bike cell for the primary note. |

### Air Bike

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| Assault bike intervals (hard) | `Hard Assault Bike Intervals` | Bible, L572 | |
| 8-12 x 30 sec hard / 30-60 sec easy | | Bible, L1272 | ⚑ 30-sec-plus work bouts placed here rather than Anaerobic (which holds ≤20 sec bouts) — explicit duration boundary Sam should confirm. |
| Erg EMOM | `Erg EMOM` | Bible, L576 | Cross-modality — also fits Ski/Row/Bike. |
| Off-feet metcon | `MetCon` | Bible, L577 / L1266 | ⚑ cross-listed at Grind — census tags MetCon modality 'mixed'; Sam's call on whether its true home is sustained-VO2 (Aerobic Power) or fatigue-resistance (Grind). |

## Aerobic Capacity

Working definition: controlled, repeatable tempo-scale work — the Bible's
"Tempo / extensive conditioning" section (L1215-1252) in full, now that the
harder Tempo-named census formats are folded in here per Sam's amendment
(the easy-paced ones went to Flush instead — see that row).

### Run

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| 30:30 controlled tempo blocks (30 sec on / 30 sec easy) | `30:30 Tempo Blocks` | Bible, L1228 | Per Sam's amendment — moved here from the dropped Tempo row. |
| 1 min on / 1 min easy | `Tempo Intervals (1min on / 1min easy)` | Bible, L1229 | Per Sam's amendment. |
| Cruise intervals | `Cruise Intervals` | Bible, L1221 | |
| Controlled shuttles | | Bible, L1222 | Named as a running tempo example; no matching census format exists — Sam to decide whether to author one. |
| Repeat 100s/200s at controlled pace | | Bible, L1223 | |
| Footy-style run-throughs | | Bible, L1224 | |
| 3-5 min moderate blocks with easy recovery | | Bible, L1238 | |

### Bike

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| 3 x 8 min easy with 2 min between | `Bike/Row/Ski Tempo Intervals` | Bible, L522 | |
| 4 x 6 min easy with 1-2 min between | | Bible, L523 | |
| Controlled 10-20 min blocks | | Bible, L1231 | |
| 1 min on / 1 min easy | | Bible, L1229 | |
| 2 min on / 1 min easy | | Bible, L1230 | |

### Ski

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| SkiErg intervals (moderate) | `SkiErg Intervals` | Bible, L1231 | Bounded by the 4-8min/10-min-cap rule (L1319 / L4102) — a "3x8min" structure sits right at that edge. |
| 1 min on / 1 min easy | | Bible, L1229 | |

### Row

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| Row intervals (moderate) | `Row Intervals` | Bible, L1231 | Same round-length cap caution as Ski (L1318 / L4102). |
| 1 min on / 1 min easy | | Bible, L1229 | |

### Air Bike

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| 2 min on / 1 min easy | | Bible, L1230 | |
| Assault Bike Intervals (census format) | `Assault Bike Intervals` | census tier B-low + Bible tempo examples, L1226-1230 | ⚑ reads near-identical in tier/intensity to Air Bike Sprints (below) — likely two census names for the same dose. Sam may want to merge or differentiate by work:rest ratio. |
| Air Bike Sprints (census format, tier B-low despite the name) | `Air Bike Sprints` | census tier B-low + Bible tempo examples, L1226-1230 | ⚑ "Sprints" in the name reads Anaerobic/max-effort, but the census's own tagging (B-low, moderate) puts it here — cross-listed at Anaerobic. Worth Sam confirming this isn't a misfiled short-interval format. |

## Flush

Working definition: easy/recovery-pace continuous or light work, PLUS (per
Sam's amendment) the easy-paced Tempo-named census formats. Absorbs the
Bible's "Recovery" (L463-504) and "Easy aerobic" (L1183-1214) sections.

### Run

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| 8-12 min easy flush | `Flush Run` | Bible finisher variety, L1500 | |
| Long Run (steady continuous run) | `Long Run` | census tier B-high; Bible aerobic-base/long-run framing | ⚑ census tags this tier B-high (moderate load, high fatigue), not tier C — Sam's amendment moves its class here on pace/intent, but the tier tag disagrees. Flagging rather than silently overriding the census. |
| Long Nasal Run | `Long Nasal Run` | Bible, L510 | Per Sam's explicit amendment example. |
| Tempo Run (census name — not the Bible's harder "Tempo/extensive conditioning" section) | `Tempo Run` | census tier B-low + Sam's explicit amendment example | ⚑ the Bible itself lists "Tempo runs" under the harder tempo menu (L1220) and under Hard-conditioning's running examples (L567); Sam's amendment overrides this and reassigns the census-named format here. No independent dose text exists for it beyond the name. |
| Easy run / walk-jog | | Bible, L508-509 | |
| Controlled easy grass run | | Bible, L511 | |
| Short flush: 15-25 min | | Bible duration guide, L1189 / L527 | |
| Normal easy aerobic: 25-40 min | | Bible duration guide, L1190 / L528 | |
| Longer aerobic base: 35-60 min | | Bible duration guide, L1191 / L529 | |
| Duration menu: 30 / 40 / 50 / 60 min | | PROGRAMMING_DESIGN_SESSION D12 example | Sam's own D12 example wording, distinct from the Bible's overlapping-range guide above — Sam to pick one duration convention or keep both. |

### Bike

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| Easy Bike | `Easy Bike` | Bible Recovery + Easy aerobic sections | |
| Zone 2 Bike | | Bible, L516 | |
| Bike flush | | Bible, L517 | |
| Short flush: 15-25 min / Normal: 25-40 min / Longer: 35-60 min | | Bible duration guide, L1189-1191 | |
| Duration menu: 30 / 40 / 50 / 60 min | | PROGRAMMING_DESIGN_SESSION D12 example | |
| Light Circuits (census format, easy low-intensity circuit) | `Light Circuits` | census tier C | ⚑ `CONDITIONING_META` tags this modality 'bike', but the name and tier (C, recovery) read more like the Bible's "easy circuits — EMOMs, 30:30x30, 8 on 2 off x3 rounds" (L1341), a mixed-equipment format, not bike-exclusive. Placed here on the census's literal modality tag; Sam may want to re-tag it as mixed or rename it. |

### Ski

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| Single continuous block, 8-10 min max | `Easy Ski` | Bible off-feet cap, L1319 / L4102 | Bible explicitly rules out true continuous ski work beyond 10 min ("No continuous RowErg or SkiErg block should be longer than 10 minutes... must be intervalised") — this is the boundary exception, not a full continuous session. |

### Row

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| Single continuous block, 8-10 min max | `Easy Row` | Bible off-feet cap, L1318 / L4102 | Same explicit rule against long continuous row work — boundary exception only. |
| 3 x 8 min easy mixed erg blocks with 2 min between | | Bible recovery example, L497 | Bible gives this as a recovery-session example (mixed erg, not row-exclusive); listed here as the row-specific application. |

### Air Bike

**EMPTY — Bible explicitly rules this out**, not just uncoverable by
omission: the Recovery section's own "Bad examples" list names "Assault
bike sprints called recovery" (L501) alongside "30 min hard ski erg" as
things that should NOT be programmed as recovery/flush. Whether a genuinely
*easy* air-bike spin would be acceptable isn't addressed either way — Sam's
call on whether to leave this EMPTY or explicitly strike it as an
off-limits combination.

## Grind ⚑ (no Bible section — see "Working definitions" above)

Every entry below is an editorial best-fit against one line (L1483,
"grind for up to 1 min"), not a sourced dose menu. Treat this whole row as
provisional pending Sam's ruling on whether it should exist as a separate
row at all.

### Run

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| Footy Fartlek (random-effort, footy-specific fatigue simulation) | `Footy Fartlek` | Bible, L1262 / L568 | ⚑ best-fit for "grind" by feel, not an explicit Bible label. |
| 200m/400m Repeat Runs (~60-90s reading of the 400m half) | `200m/400m Repeat Runs` | Bible, L1261 / L566 | ⚑ cross-listed from Aerobic Power — Sam's call on primary home. |
| Hill Sprints, repeated for fatigue-resistance rather than pure acceleration | `Hill Sprints` | Bible, L1550 / L1738 | ⚑ cross-listed from Acceleration — same format, different intent depending on how it's dosed (few crisp reps = Acceleration; many repeated reps under fatigue = Grind). |

### Bike

**EMPTY.** No census or Bible dose reads as bike-specific "grind" —
`MetCon` (below) is the closest fit but is explicitly mixed-modality, not
bike-exclusive.

### Ski

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| Off-feet MetCon (sustained fatigue, mixed-modality) | `MetCon` | Bible, L577 / L1266 / L1316 | ⚑ cross-listed from Aerobic Power — "grinding through fatigue" is arguably MetCon's defining trait more than a VO2max quality; Sam's call on primary home. |

### Row

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| Off-feet MetCon (cross-listed, mixed modality) | `MetCon` | Bible, L577 / L1266 / L1316 | Same note as Ski. |

### Air Bike

| Dose Variant | Census Format | Source | Notes |
|---|---|---|---|
| Off-feet MetCon (cross-listed, mixed modality) | `MetCon` | Bible, L577 / L1266 / L1316 | Same note as Ski/Row. |

## Census format placement check

36 of the 37 census conditioning formats map into the grid below (format →
every cell it appears in; more than one cell means genuine cross-listing,
not duplication):

- `1km Repeat Intervals` — Aerobic Power/Run
- `200m/400m Repeat Runs` — Aerobic Power/Run, Grind/Run
- `30:30 Tempo Blocks` — Aerobic Capacity/Run
- `4x4 VO2` — Aerobic Power/Bike, Aerobic Power/Ski, Aerobic Power/Row
- `6x1km` — Aerobic Power/Run
- `Air Bike Sprints` — Anaerobic/Air Bike, Aerobic Capacity/Air Bike
- `Assault Bike Intervals` — Aerobic Capacity/Air Bike
- `Bike/Row/Ski Tempo Intervals` — Aerobic Capacity/Bike
- `Cruise Intervals` — Aerobic Capacity/Run
- `Easy Bike` — Flush/Bike
- `Easy Row` — Flush/Row
- `Easy Ski` — Flush/Ski
- `Erg EMOM` — Aerobic Power/Ski, Aerobic Power/Row, Aerobic Power/Air Bike
- `Flush Run` — Flush/Run
- `Flying Sprints` — Top End Speed/Run
- `Footy Fartlek` — Grind/Run
- `Free Sprint Session` — Repeat Sprint/Run
- `Hard Assault Bike Intervals` — Aerobic Power/Air Bike
- `Hard Row Intervals` — Aerobic Power/Row
- `Hard SkiErg Intervals` — Aerobic Power/Ski
- `Hill Sprints` — Acceleration/Run, Grind/Run
- `Inverse Tabata` — Anaerobic/Run
- `Light Circuits` — Flush/Bike
- `Long Nasal Run` — Flush/Run
- `Long Run` — Flush/Run
- `MAS 15:15 Blocks` — Anaerobic/Run
- `MAS Training` — Aerobic Power/Run
- `Max Effort Sprint Accumulation` — Repeat Sprint/Air Bike, Anaerobic/Air Bike
- `MetCon` — Aerobic Power/Air Bike, Grind/Ski, Grind/Row, Grind/Air Bike
- `Quality Sprints` — Top End Speed/Run
- `Row Intervals` — Aerobic Capacity/Row
- `SkiErg Intervals` — Aerobic Capacity/Ski
- `Sprint Intervals` — Repeat Sprint/Run
- `Tabata Intervals` — Anaerobic/Run
- `Tempo Intervals (1min on / 1min easy)` — Aerobic Capacity/Run
- `Tempo Run` — Flush/Run

- `Easy Swim` — **not placed**. The Bible explicitly rules it out of app
  programming ("Swimming — do not program this in but an athlete may
  choose to add swimming in", L4119), and Swim isn't one of the grid's 5
  declared modality columns.

That accounts for all 37 (36 placed, `Easy Swim` explicitly excluded, same
as the earlier D12 draft).

## NOT COVERED

- **The row-definition problem itself**: four of these nine rows
  (Acceleration, Top End Speed, Repeat Sprint, Change of Direction/Decel)
  are Bible-named and dosed. Five (Anaerobic, Aerobic Power, Aerobic
  Capacity, Flush, Grind) are an editorial physiological overlay this sheet
  invented to sort the Bible's existing conditioning sections into Sam's
  requested taxonomy — see "Working definitions" up front. Treat every
  placement in the latter five rows as provisional against that overlay,
  not just the ⚑-flagged rows individually.
- **Grind as a standalone row**: no Bible section addresses it; every entry
  is inferred from one line (L1483). This is the single biggest open
  question in the sheet — see the Grind section's framing note.
- **Deceleration's missing dose menu**: the Bible explicitly declines to
  dose deceleration as its own category (L612-613), so the combined
  "Change of Direction/Decel" row is genuinely COD-dosed with Decel riding
  along undosed, not an oversight of this sheet.
- **The Anaerobic/Aerobic Power duration boundary**: placements split at
  ~20-30 sec vs 2min+ using the MAS 110%/100% line and the Bible's own
  examples, but the Bible never draws this exact boundary for every dose
  (see the ⚑ note on "8-12 x 30 sec hard" in Aerobic Power/Air Bike) — Sam
  should treat every Anaerobic/Aerobic Power split as provisional, same
  caveat the earlier D12 draft carried for its Short/Hard/Long boundary.
- **Load/intensity prescriptions beyond dose structure** (target HR zones,
  RPE targets, pace calculators): out of scope — this sheet sorts dose
  *structure* (work/rest/duration) into cells, not the intensity-targeting
  layer.
- **Generation-code wiring**: this is a read-only sorting pass. No changes
  were made to `exerciseTags.ts`, `CONDITIONING_META`, or any
  generation/session-builder code — the grid becomes load-bearing only
  once Sam curates it and a future unit encodes it, matching how the
  exercise vocabulary lock landed.
- **Device/UI verification**: read-only spreadsheet generation — no app
  screens touched, nothing to device-test here.
