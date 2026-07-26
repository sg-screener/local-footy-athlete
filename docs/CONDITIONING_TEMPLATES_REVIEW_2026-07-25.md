# Conditioning TEMPLATES Review (2026-07-25)

Read-only sheet generation for Sam's review. This **replaces** the modality x quality grid (`CONDITIONING_GRID_REVIEW_2026-07-25.md`) with a templates-first structure, per Sam's architecture direction.

## The D12-revised architecture: template-as-stimulus, modality-as-rendering-rule

The 2026-07-25 grid draft (`CONDITIONING_GRID_REVIEW_2026-07-25.md`) sorted doses into a
modality x quality matrix — 45 independent cells, each hand-filled per modality. Sam's
revision: **the template is the stimulus; modality is a rendering rule.** A session
template (e.g. "4 x 4 min hard / 3 min easy") is a single row-owned object. Which
modality an athlete runs it on is a rendering decision applied to that one template,
not a reason to duplicate the content five times.

This sheet replaces the grid with **9 quality tabs of 6-15 session templates each**
(fewer where the quality is naturally narrow — Acceleration, Top End Speed, Change of
Direction/Decel). Every template carries: **Name - Structure (work/rest/sets/rounds) -
Effort cue (one line) - Base unit - Source - Modality notes** (the rendering rule
applied to that specific template).

### The four rendering rules

1. **TIME-FIRST.** Prescriptions default to time (self-scales across athlete speeds).
   Distance is permitted for short work where distance is the point: sprints, top-end
   exposure, and mid-length intervals (200m/400m/1km-style reps). Calories are permitted
   for EMOM-style erg work.
2. **Distance rendering across modalities.** Run/Ski/Row share the same nominal
   distance number. Bike = distance x 2. Air Bike is time-based only — a distance
   prescription converts to time via Sam's anchor: **250m ~ 1 min**.
3. **The 8-minute hard cap.** Work intervals longer than 8 minutes are offered on
   **Run and Bike only**. Ski, Row and Air Bike never carry a single work interval
   longer than 8 minutes, and preferably no more than 6. This is encoded per template
   in the Modality notes column, not left as a general rule to remember.
4. **Sprint-family templates are run-only.** Acceleration, Top End Speed, and Change
   of Direction/Decel are field-mechanics qualities by nature (per the earlier grid's
   own "physically meaningless on an erg" cells) — no modality rendering applies to
   them at all.

### Sourcing and the ⚑ flag

Every template is prefilled from one of three places: the earlier grid sort, the
Bible's own named formats/doses, or standard S&C practice where the Bible names a
quality/format but gives no exact numbers (or doesn't cover a gap at all). **Every
template in the third category is marked ⚑ INFERRED** — in the template name, and
named explicitly in the Source column — so Sam's edit pass hits those first. A ⚑ does
not mean the template is wrong; it means the specific numbers are this sheet's
invention, not a citation.

**51 of 99 templates carry the ⚑ flag.** Two qualities are edge cases worth reading
before the tables: **Change of Direction/Decel** is the Bible's own thinnest category
(it explicitly says COD/Decel isn't a major programmed area — L1616-1619, L612-613),
so most of its 6 templates are inferred structure around a named-but-undosed concept.
**Grind** has no Bible section at all — every template there is inferred against one
line (L1483, "grind for up to 1 min") and the row itself remains a standing question:
does Sam want it, or should it fold back into Anaerobic/Aerobic Power?


## Template counts by quality

| Quality | Templates | ⚑ Inferred | Sourced |
|---|---|---|---|
| Acceleration | 8 | 3 | 5 |
| Top End Speed | 8 | 3 | 5 |
| Repeat Sprint | 10 | 3 | 7 |
| Change of Direction/Decel | 6 | 5 | 1 |
| Anaerobic | 14 | 9 | 5 |
| Aerobic Power | 14 | 7 | 7 |
| Aerobic Capacity | 14 | 6 | 8 |
| Flush | 15 | 5 | 10 |
| Grind | 10 | 10 | 0 |
| **Total** | **99** | **51** | **48** |

## Acceleration

| Name | Structure | Effort Cue | Base Unit | Source | Modality Notes |
|---|---|---|---|---|---|
| 10m Acceleration Reps | 6-10 reps x 10m, full recovery walk-back between reps | Quick and light off the ground - not a max sprint, a crisp first-step drill. | distance | Bible Sect.7 Acceleration, L1547 | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| 20m Acceleration Reps | 4-8 reps x 20m, full recovery walk-back between reps | Drive phase should look the same on rep 1 and rep 8 - stop if it doesn't. | distance | Bible Sect.7 Acceleration, L1548 | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| 30m Acceleration Reps | 4-6 reps x 30m, full recovery walk-back between reps | Longer accel, still no top-end - build to about 80-90% and hold form. | distance | Bible Sect.7 Acceleration, L1549 | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| Team-Training Warm-Up Dose | 3-4 reps x 10-20m, done inside the TT warm-up | Piggyback this on the warm-up you're already doing - don't add a separate session for it. | distance | Bible, L1704 | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| Return-to-Speed Ladder | 3-6 reps x 10-20m, beginner / no-recent-sprint dose | First exposure back - err on the side of too easy, not too hard. | distance | Bible, L1756 | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| ⚑ Hill Acceleration | 4-6 reps x 15-20m uphill, full recovery walk-down | Hill takes the top-end off the table for you - just drive and go. | distance | Concept Bible-named (hill sprints for acceleration, L1550/L1738); rep/rest numbers INFERRED | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| ⚑ Loaded Sled Acceleration | 4-6 reps x 10-15m light-moderate sled push, full recovery | Load should slow you down, not break your posture - stand tall, drive through the ground. | distance | Bible mentions sled pushes in passing (L1550) with no dose; INFERRED from standard S&C practice | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| ⚑ Resisted Band Acceleration | 4-6 reps x 10m band-resisted starts, full recovery | Band pulls you back so the first 3 steps do the work - release and finish naturally. | distance | INFERRED - not mentioned in the Bible at all | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |

## Top End Speed

| Name | Structure | Effort Cue | Base Unit | Source | Modality Notes |
|---|---|---|---|---|---|
| Fly 20 (20+20) | 3-6 reps: 20m build + 20m fly, 2-4 min rest between reps | Build smooth, don't force top speed - let it arrive by the fly zone. | distance | Bible Sect.7 Max velocity, L1584 | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| Fly 30 (30+30) | 3-6 reps: 30m build + 30m fly, 2-4 min rest between reps | Same idea, longer build - stop the moment speed drops off. | distance | Bible Sect.7 Max velocity, L1585 | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| Progressive Sprint Exposure | 3-6 reps x 40-60m smooth, gradually building to top speed | This is exposure, not a time trial - smooth and fast beats fast and scrappy. | distance | Bible Sect.7 Max velocity, L1586 | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| Flying Sprints | 3-5 reps, full flying-sprint structure, 2-4 min rest | Full recovery every rep - if you're still breathing hard, you haven't rested enough. | distance | census `Flying Sprints`; Bible, L1587 | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| ⚑ Quality Sprints | 3-5 reps, full-recovery max-velocity reps (structure mirrors Flying Sprints) | Quality over everything - one sloppy rep and you're done for the day. | distance | census `Quality Sprints`; Bible's "quality reps" language, L1587-1588 - exact structure INFERRED as equivalent to Flying Sprints | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| Off-Season Speed Reintroduction | 2-4 flying sprints, longer rest, beginner dose | Building back gently - mechanics first, speed follows. | distance | Bible, L1757 | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| ⚑ Resisted Overspeed | 3-5 reps x 20-30m light-band-assisted or gentle-downhill overspeed, full recovery | Let the assistance do a little of the work - this is about turnover, not muscling it. | distance | INFERRED - standard S&C variant, not in the Bible | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| ⚑ Acceleration-to-Fly Contrast | 3-5 reps: 20m build accel + 20m top-speed fly, full recovery | Two qualities in one rep - drive out, then let the legs turn over at the top. | distance | INFERRED combination drill, not in the Bible | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |

## Repeat Sprint

| Name | Structure | Effort Cue | Base Unit | Source | Modality Notes |
|---|---|---|---|---|---|
| 20m Walk-Back Repeats | 10-15 reps x 20m, walk-back recovery between reps | Recovery is the walk, not a rest - keep moving between reps. | distance | Bible Sect.7, L1654 (Sect.4's shorter form gives "10x20m", L616) | Run/Ski/Row: same nominal distance (20m). Bike: distance x2 (40m) - not Bible-sourced for this quality, derived via rule 2. Air Bike: not applicable at this distance (sub-10s effort) - use the Assault Bike time-based templates below instead. |
| 30m Walk-Back Repeats | 10 reps x 30m, walk-back recovery between reps | Longer rep, same rule - if speed drops badly, cut it short. | distance | Bible Sect.7, L1655 / Sect.4 L617 | Run/Ski/Row: same nominal distance (30m). Bike: distance x2 (60m) - derived via rule 2, not Bible-sourced for this quality. Air Bike: use the time-based Assault Bike templates instead. |
| Sprint Sets (3x3-5) | 3-5 sets of 3-5 short sprints, 2-4 min rest between sets | Sets should feel similar to each other - if set 3 falls apart, that's the end point. | distance | Bible Sect.7, L1656 / Sect.4 L618 | Run-native. Ski/Row/Air Bike/Bike: render as the equivalent short-burst time templates in Anaerobic instead - this specific set/rep shape is running-native. |
| ⚑ Sprint/Jog/Walk Pattern | Continuous rotation of sprint / jog / walk segments, ~10-15 min total | Keep the pattern honest - the jog and walk are real recovery, not more work. | time | Bible names the pattern (L1657) without exact segment lengths; structure INFERRED | Time-based, ≤8 min per segment - renders on all 5 modalities without a cap issue; Bike/Air Bike substitute easy spin for the jog/walk portions. |
| ⚑ Generic Sprint Intervals | 6-8 reps x 20-40m, short incomplete recovery (~30-45s) | This one's open-ended by design - hold the standard: quality first, volume second. | distance | census `Sprint Intervals` - no Bible-given structure, INFERRED | Run/Ski/Row: same nominal distance. Bike: distance x2. Air Bike: convert to time via 250m~1min anchor (rule 2). |
| ⚑ Free Sprint Session | Open/unstructured - athlete or coach chooses distances and reps within the repeat-sprint envelope | Free doesn't mean lazy - still stop the moment it turns into conditioning. | distance | census `Free Sprint Session` - open format, INFERRED structure | Run-native open format. Cross-modality rendering not meaningful for an unstructured template - Sam's call on whether this belongs in the sheet at all. |
| Assault Bike 20s Repeat | 3 reps x 20s max sprint, starting every 2 min | All-out for 20 seconds, then really recover - this only works if the effort is real. | time | Bible Sect.7, L1658 / Sect.4 L619 | Time-based, well under the 8 min cap. Native to Air Bike; Row/Ski render the same 20s/2min structure directly. Run: the walk-back distance templates above are the running-native equivalent, not a strict time conversion. |
| Assault Bike 10s Repeat | 6 reps x 10s max sprint, starting every minute | Short and violent - 10 seconds flat out, then off. | time | Bible Sect.7, L1658 | Time-based, well under the 8 min cap. Renders directly on Air Bike/Row/Ski. Run: use the 10-20m Walk-Back templates instead. |
| Rower Repeat Sprint | 20-30s sprints every 90s-2min, repeat for 10-15 min total | Full power on the drive, not just fast hands - legs lead. | time | Bible Sect.7, L1659 / Sect.4 L620 | Time-based, ≤8 min per repeat block - clears the cap. Bible bundles rower and ski erg as one option; Air Bike renders the same structure directly. |
| Ski Erg Repeat Sprint | 20-30s sprints every 90s-2min, repeat for 10-15 min total | Same rule as the rower - whole-body effort, not just arms. | time | Bible Sect.7, L1659 / Sect.4 L620 (bundled with rower in source) | Time-based, ≤8 min per repeat block. Same structure renders on Row/Air Bike directly. |

**Regular Bike: no Bible-sourced repeat-sprint dose beyond the derived distance x2 rendering noted per-template above.**


## Change of Direction/Decel

| Name | Structure | Effort Cue | Base Unit | Source | Modality Notes |
|---|---|---|---|---|---|
| Up-Back Shuttle | 30m out, 180 degree turn, 30m back, walk recovery, repeat for 10-15 min after warm-up | Turn should be sharp and controlled, not a slide - plant and go. | distance | Bible Sect.7 Change of direction, L1627-1632 / Sect.4 L606-611 - the only structured COD example the Bible gives at all | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| ⚑ Low-Intensity Deceleration Drills | 2-4 reps x controlled deceleration over 15-20m (jog into a controlled stop) | This is about braking under control, not stopping like you hit a wall. | distance | Bible names this for building-back athletes (L1758) with no exact dose; structure INFERRED | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| ⚑ Deceleration and Landing Work | 3-4 reps of controlled jump-land-stick or run-and-stick drills | Stick the landing - quiet feet, not a crash. | reps | Bible names this (L1739) with no dose; structure INFERRED | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| ⚑ Short COD Circuit | 2-3 rounds: 3-4 direction changes over 20-30m total, walk recovery between rounds | Same rule as the shuttle - control beats speed here. | distance | INFERRED extension of the up-back shuttle for more varied cutting angles - not in the Bible | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| ⚑ 45-Degree Cut Reps | 4-6 reps: 10m in / 45 degree cut / 10m out, full recovery | Plant foot stays under you - if the knee caves, stop the session. | distance | INFERRED, standard COD drill - not in the Bible | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |
| ⚑ COD Finisher (occasional, off-season only) | Up-back shuttle scaled down to 5-8 min total, used as a conditioning-style finisher | This is filler, not the main event - keep it light and occasional. | time | Bible explicitly frames COD as "a small conditioning-style finisher, not a main training priority" (L1625); the 5-8min dose is INFERRED | Run-only by nature (rule 4) — field-sprint/cutting mechanics; no cross-modality rendering applies. |

## Anaerobic

| Name | Structure | Effort Cue | Base Unit | Source | Modality Notes |
|---|---|---|---|---|---|
| MAS 15:15 Blocks | 8 rounds: 15s hard / 15s easy, 2 min rest between blocks, repeat 2-3 blocks | 15 seconds is short enough to go hard - actually go hard. | time | Bible Hard-intervals, L1271 / L1260 / L559; census `MAS 15:15 Blocks`. 15s work = 110% MAS per masIntensityForWorkSeconds (src/utils/masCopy.ts) | Time-based, well under the 8 min cap - renders identically on Run, Bike, Ski, Row, Air Bike. |
| ⚑ Tabata Intervals | 8 rounds: 20s hard / 10s easy (classic protocol) | 20 on, 10 off, eight times - the last two rounds should hurt. | time | census `Tabata Intervals`; Bible never defines exact timing - classic protocol assumed, not sourced | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| ⚑ Inverse Tabata | 8 rounds: 10s hard / 20s easy (flipped ratio) | More rest, so make the 10 seconds actually count. | time | census `Inverse Tabata`; timing assumed, not Bible-sourced | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| Assault Bike Max Effort Accumulation | 6-10 reps x 10-20s hard, easy spin rest between reps | Legs and arms both - don't let the arms do all the work. | time | Bible, L1273 / L561; census `Max Effort Sprint Accumulation` | Time-based, well under the 8 min cap. Native to Air Bike; Row/Ski render the same 10-20s structure directly (Bible names "assault bike/rower/ski" as one group). |
| Ski/Row Short Bursts | 6-10 reps x 10-20s hard, easy paddle/roll rest between reps | Same short-burst rule on the erg - quality reps, not a grind. | time | Bible Hard-intervals work/rest, L1273 (assault bike/rower/ski bundled) | Time-based, well under the 8 min cap - renders identically on Ski, Row, Air Bike; regular Bike is EMPTY (see below). |
| Air Bike 20s Small Dose | 3 reps x 20s flat out, starting every 2 min | Small dose on purpose - this is a top-up, not the main session. | time | Bible in-season small-dose example, L1340; census `Air Bike Sprints` | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| Air Bike 10s Small Dose | 6 reps x 10s, starting every minute | Same idea, shorter and more frequent - stay sharp on every rep. | time | Bible, L1340 | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| ⚑ 10s On/20s Off EMOM | Every minute on the minute: 10s hard, 50s easy, 8-10 rounds | The rest is built in - no excuse for a soft effort. | time / calories | INFERRED standard EMOM-anaerobic structure - not in the Bible | Time-based (or calorie-target within the 10s window on ergs). Renders on all 5 modalities; calorie-target variant is erg-only (Row/Ski/Air Bike/Bike) - Run uses the time-only version. |
| ⚑ 30:30 Short Circuit (anaerobic-leaning) | 30s hard / 30s easy x 8-10 rounds | 30 seconds hard is a different animal to 30:30 easy - hold nothing back. | time | Bible references "30:30x30" as an EASY circuit format (L1341) - this harder anaerobic-leaning version is INFERRED | Time-based, well under the 8 min cap - renders identically across all 5 modalities. Distinguish clearly from the Aerobic Capacity 30:30 template, which is controlled-effort, not max. |
| ⚑ Assault Bike Ramp Bursts | 6-8 reps x 15s max effort, full recovery | Think hill sprint effort, just on the bike. | time | INFERRED - a hill-sprint-effort analogue for off-feet athletes, not in the Bible | Time-based, well under the 8 min cap - renders on Air Bike/Row/Ski directly; regular Bike EMPTY (no sourced short-burst dose). |
| ⚑ Broken 15s Ladder | 15s on / 15s off x 6, rest 90s, repeat for 2-3 sets | Same 15:15 rhythm, just built in waves - hold the standard each wave. | time | INFERRED variation on MAS 15:15 - not in the Bible | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| ⚑ Calorie Burst EMOM | Every minute: max calories in the first 15-20s, rest the remainder, 8-10 rounds | Chase the number, not the clock - go all-out early in the minute. | calories | INFERRED, calorie-based erg variant - not in the Bible | Calorie-based - erg-only rendering (Row, Ski, Air Bike, Bike each have calorie counters). Run has no calorie equivalent - substitute the time-based 10s On/20s Off EMOM instead. |
| ⚑ Short Shuttle Bursts (off-feet analogue) | 8-10 reps x 15-20s max effort, 45s easy | Think of this as a shuttle sprint translated to the erg. | time | INFERRED - not in the Bible | Time-based, well under the 8 min cap - renders on Row/Ski/Air Bike directly; Run uses the actual COD shuttle template instead. |
| ⚑ Bike Sprint Micro-Dose | 6 reps x 10-15s hard on a regular bike, easy spin rest between | Short, sharp efforts - this is a small top-up, not a hard session. | time | INFERRED - regular-bike anaerobic dosing isn't Bible-sourced anywhere | Time-based, well under the 8 min cap - the one Anaerobic template that fills the regular-Bike gap other entries leave EMPTY. |

**Regular Bike: no Bible-sourced short-burst (≤30s) dose except the one INFERRED Bike Sprint Micro-Dose template above.**


## Aerobic Power

| Name | Structure | Effort Cue | Base Unit | Source | Modality Notes |
|---|---|---|---|---|---|
| 4min Hard / 2-3min Easy | 4-5 reps x 4 min hard, 2-3 min easy | Hard means honest pace, not a sprint you can't hold for 4 minutes. | time | Bible Hard conditioning, L557 (⚑ rest-length discrepancy vs L1269's "3 min easy" flat - Sam should confirm intended rest) | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| 4min Hard / 3min Easy | 4-5 reps x 4 min hard, 3 min easy | Same session, Bible's other wording - pick one rest convention and stick with it. | time | Bible, L1269 | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| 1km Repeats | 4-6 reps x 1km, controlled rest up to 3 min | Even splits beat a fast first rep and a crawl on the last. | distance | Bible, L558 / L1270; census `6x1km` / `1km Repeat Intervals` (likely duplicate census entries for the same dose) | Run/Ski/Row: same nominal distance (1km). Bike: 2km. Air Bike: convert via 250m~1min anchor -> ~4 min work (rule 2). |
| MAS Intervals (longer-rep) | MAS running at 100% MAS, 1-4 min reps, standard rest | This is engine work - pace it off your actual MAS, not what feels good on rep 1. | time | Bible, L565 / L1359; census `MAS Training`. Work >30s = 100% MAS per masCopy.ts | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| 200m/400m Repeats | Repeats at controlled-hard pace, standard rest between reps | Hold your pace - don't let rep 1 write a check the last rep can't cash. | distance | Bible, L1261 / L566; census `200m/400m Repeat Runs` (⚑ cross-listed at Grind - the 400m half sits closer to the ~60-90s grind zone) | Run/Ski/Row: same nominal distance. Bike: distance x2. Air Bike: convert via 250m~1min anchor (rule 2). |
| Session-Length Envelope | 20-30 min total hard-conditioning time, using any of the above doses | This is the ceiling for the day, not a target to chase past. | time | Bible, L1274 / L1283 | A session-length envelope, not a single interval - applies across all modalities without triggering the 8min per-interval cap on its own. |
| ⚑ Bike VO2 | 4-5 reps x 3-4 min hard, 2-3 min easy | Same VO2 intent as the run version - legs will fatigue differently, pace accordingly. | time | Bible names "Bike VO2" (L573) with no exact dose; structure INFERRED from the Run 4min-hard template | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| ⚑ 4x4 VO2 | 4 reps x 4 min hard, 3-4 min easy (classic Norwegian 4x4 structure) | Four rounds, same effort every time - round 4 should hurt as much as round 1. | time | census `4x4 VO2`, modality 'mixed'; exact rest not Bible-specified, standard protocol assumed | Time-based, well under the 8 min cap - renders identically across Bike/Ski/Row/Air Bike (census tags this 'mixed'); Run uses the 4min-Hard templates above instead. |
| ⚑ Ski Intervals (hard) | 4-6 reps x 3-5 min hard, 2-3 min easy | Full-body effort - let the legs drive, not just the arms. | time | Bible names "Ski intervals" (L575) with no exact dose | Time-based - capped at ≤6-8 min per interval per rule 3 (this dose sits within the cap already). |
| ⚑ Erg EMOM | Every minute: structured hard-work portion (~40s work / 20s rest assumed), repeat 10-15 rounds | The clock is the rest - don't waste the front of the minute. | time | Bible, L576; exact per-minute split INFERRED (standard EMOM assumed) | Time-based, well under the 8 min cap - renders identically on Ski, Row, Air Bike (Bible names this cross-modality); Bike also fits. |
| ⚑ Row Intervals (hard) | 4-6 reps x 3-5 min hard, 2-3 min easy | Same rule as ski - legs first, then back, then arms. | time | Bible names "Rower intervals" (L574) with no exact dose | Time-based - capped at ≤6-8 min per interval per rule 3 (this dose sits within the cap already). |
| Assault Bike Hard Intervals | 4-6 reps x 3-4 min hard, 2-3 min easy | Long enough to hurt properly - hold the pace, don't just survive it. | time | Bible, L572 | Time-based - capped at ≤6-8 min per interval per rule 3 (this dose sits within the cap already). |
| ⚑ 30s Hard / 30-60s Easy (upper Anaerobic/Aerobic-Power boundary) | 8-12 reps x 30s hard, 30-60s easy | Long enough that pure sprint won't hold - settle into a hard, honest pace. | time | Bible, L1272 (⚑ cross-listed from Anaerobic - 30s+ bouts sit at the anaerobic/aerobic-power boundary, duration split is Sam's call to confirm) | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| ⚑ Off-Feet MetCon (VO2 reading) | 15-20 min mixed-modality hard effort, structure open within the time cap | Keep moving with intent the whole time - this is engine work under fatigue, not a sprint. | time | Bible, L577 / L1266 / L1316; census `MetCon` (⚑ cross-listed at Grind - Sam's call on primary home) | Time-based - total session time is 15-20min, but must be broken into ≤8min work intervals with rest for Ski/Row/Air Bike per rule 3; Run/Bike can run it closer to continuous. |

## Aerobic Capacity

| Name | Structure | Effort Cue | Base Unit | Source | Modality Notes |
|---|---|---|---|---|---|
| 30:30 Controlled Tempo Blocks | 30s on / 30s easy, 10-16 rounds | Controlled, not max - you should be able to hold a conversation in three words by the end, not one. | time | Bible, L1228; census `30:30 Tempo Blocks` - moved here from the dropped Tempo row per Sam's amendment | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| 1min On / 1min Easy Tempo | 8-12 rounds | Same idea, longer rhythm - settle into it. | time | Bible, L1229; census `Tempo Intervals (1min on / 1min easy)` | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| Cruise Intervals | Controlled repeat efforts at a strong-but-sustainable pace, standard rest | This should feel comfortably hard, not a race. | time | Bible, L1221; census `Cruise Intervals` | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| ⚑ Controlled Shuttles | Repeated shuttle-style tempo efforts at a moderate pace, standard rest | Controlled means controlled - this isn't the COD shuttle at max effort. | distance | Bible names this (L1222) with no exact dose - structure INFERRED | Run-native (shuttle format). Other modalities: render as the 30:30 or 1min-on/1min-easy templates above instead. |
| ⚑ Repeat 100s/200s at Controlled Pace | 8-12 reps x 100-200m at controlled tempo pace, short rest | Same pace every rep - that's the actual test here. | distance | Bible names this (L1223) with no exact dose - structure INFERRED | Run/Ski/Row: same nominal distance. Bike: distance x2. Air Bike: convert via 250m~1min anchor (rule 2). |
| ⚑ Footy-Style Run-Throughs | 6-10 reps of controlled-pace run-throughs mimicking game bursts, short rest | Think game-speed rhythm, not a track session. | distance | Bible names this (L1224) with no exact dose - structure INFERRED | Run-native (footy-specific running rhythm). Not meaningfully rendered on other modalities - Sam's call on whether to leave those EMPTY. |
| 3-5min Moderate Blocks | 3-5 reps x 3-5 min at moderate-hard pace, easy recovery between | Moderate-hard, not hard-hard - this is the tempo zone, not VO2. | time | Bible, L1238 | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| 3x8min Easy-Moderate Blocks | 3 reps x 8 min easy-moderate, 2 min rest | Steady, not surging - find a pace you could hold for the full 8. | time | Bible, L522; census `Bike/Row/Ski Tempo Intervals` | Time-based, exactly at the 8min cap boundary - clears it on Ski/Row/Air Bike but leaves no margin; Sam may prefer 6min for those three modalities specifically. |
| 4x6min Blocks | 4 reps x 6 min easy-moderate, 1-2 min rest | Same tempo intent, slightly shorter blocks. | time | Bible, L523 | Time-based, within the preferred ≤6min band for Ski/Row/Air Bike - clears the cap comfortably on all 5 modalities. |
| Controlled 10-20min Blocks (Run/Bike only) | 1-2 continuous blocks of 10-20 min at controlled tempo pace | Hold the pace, don't let it drift into 'easy' by minute 15. | time | Bible, L1231 | Run/Bike ONLY per the 8min interval cap (rule 3). Ski/Row/Air Bike must substitute the 3x8min or 4x6min block templates above instead of this one. |
| 2min On / 1min Easy | 6-8 rounds | The rest is short on purpose - this should build, not fully recover. | time | Bible, L1230 | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| ⚑ Ski Erg Tempo Blocks | 3 reps x 8min-equivalent effort (or 4x6min), capped at ≤6-8 min per interval | Same tempo rule, erg version - full-body rhythm, not just arms. | time | Bible, L1231, bounded by the off-feet cap (L1319 / L4102) | Ski-specific rendering of the 3x8min/4x6min templates above - capped hard at ≤8min, prefer ≤6min per rule 3. |
| ⚑ Row Tempo Blocks | 3 reps x 8min-equivalent effort (or 4x6min), capped at ≤6-8 min per interval | Long enough to find rhythm, short enough to stay honest on pace. | time | Bible, L1231, bounded by the off-feet cap (L1318 / L4102) | Row-specific rendering of the 3x8min/4x6min templates above - capped hard at ≤8min, prefer ≤6min per rule 3. |
| ⚑ Assault Bike / Air Bike Tempo Intervals | 2min on / 1min easy, or 30:30 controlled effort | Moderate, not max - the sprint name on this one is misleading. | time | Bible, L1226-1230; census `Assault Bike Intervals` / `Air Bike Sprints` (⚑ likely duplicate census names for near-identical doses) | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |

## Flush

| Name | Structure | Effort Cue | Base Unit | Source | Modality Notes |
|---|---|---|---|---|---|
| 8-12min Easy Flush (Run) | Continuous easy pace, 8-12 min | Should finish feeling better than you started, full stop. | time | Bible finisher variety, L1500; census `Flush Run` | Time-based, well under the 8 min cap on Run/Bike; Ski/Row/Air Bike within the cap too but see the modality-specific continuous-block templates below. |
| ⚑ Long Run (steady continuous run) | 35-60 min continuous easy-moderate | Steady the whole way - if you're racing the last 10 minutes, you started too easy. | time | census `Long Run` (tier B-high - flagged tier mismatch; Sam's amendment places its class here on pace/intent) | Run/Bike ONLY per the 8min interval cap (rule 3) - this is a long continuous block, not available as a single piece on Ski/Row/Air Bike. |
| Long Nasal Run | Continuous run, nasal-breathing-paced (self-limiting effort) | If you have to open your mouth to breathe, you're going too hard. | time | Bible, L510; census `Long Nasal Run` | Run/Bike per the duration guide below; nasal-pacing itself doesn't translate to erg work, so Ski/Row/Air Bike should use the Easy continuous-block templates instead. |
| ⚑ Tempo Run (easy-pace reading, per Sam's amendment) | Continuous easy-moderate run, duration per the standard flush/aerobic-base guide | Despite the name, this is an easy-pace day - save the hard tempo work for Aerobic Capacity. | time | census `Tempo Run`, reassigned here per Sam's amendment; no independent Bible dose text | Run/Bike per the duration guide; Ski/Row/Air Bike substitute the 8-10min continuous-block templates below (cap-bounded). |
| Easy Run / Walk-Jog | 15-30 min easy continuous or run/walk mix | Walk-jog is a legitimate choice here, not a cop-out. | time | Bible, L508-509 | Run-native (walk/jog mix); other modalities render as their own easy-continuous templates instead of a literal walk-jog equivalent. |
| Controlled Easy Grass Run | 15-30 min easy continuous on grass | Softer surface, same easy intent. | time | Bible, L511 | Run-only by surface definition - not applicable to other modalities. |
| Short Flush (15-25min) | Continuous or light-interval easy work, 15-25 min | In and done - this is a top-up, not a session. | time | Bible duration guide, L1189 / L527 | Run/Bike for the full continuous duration; Ski/Row/Air Bike must break this into ≤8min (prefer ≤6min) blocks with rest per rule 3. |
| Normal Easy Aerobic (25-40min) | Continuous or light-interval easy work, 25-40 min | Comfortable pace the whole way - 3-6 out of 10 effort. | time | Bible duration guide, L1190 / L528 | Run/Bike ONLY as a single continuous piece per rule 3; Ski/Row/Air Bike render this as rotating ≤8min blocks (see 3x8min Easy Mixed Erg Blocks below). |
| Longer Aerobic Base (35-60min) | Continuous or light-interval easy work, 35-60 min | Longest version of the easy day - still easy the whole way. | time | Bible duration guide, L1191 / L529 | Run/Bike ONLY per rule 3; not available as a continuous piece on Ski/Row/Air Bike at this length. |
| ⚑ Duration Menu (30/40/50/60min) | Continuous easy pace, athlete/coach picks 30, 40, 50 or 60 min | Pick a number and hold the pace, don't chase distance. | time | PROGRAMMING_DESIGN_SESSION D12 example - Sam's own wording, distinct convention from the Bible's overlapping ranges above | Run/Bike ONLY per rule 3 at these durations. |
| Easy Bike | Continuous easy pace, 15-40 min | Bike is the safest easy option - legs turn over, nothing gets pounded. | time | Bible Recovery + Easy aerobic sections; census `Easy Bike` | Bike-native; renders directly, no cap issue (Bike is exempt from the 8min interval cap per rule 3). |
| ⚑ Zone 2 Bike | 20-40 min at a controlled, sustainable HR/effort zone | You should be able to hold a full conversation the whole ride. | time | Bible, L516; exact zone boundaries not given - standard Zone 2 framing INFERRED | Bike-native; no cap issue. |
| Single Continuous Block, 8-10min max (Ski/Row) | One continuous easy block, 8-10 min | This is the one place a straight continuous piece is allowed on the erg - keep it short and easy. | time | Bible off-feet cap, L1319 / L1318 / L4102; census `Easy Ski` / `Easy Row` - the explicit boundary exception to the "no long continuous erg block" rule | Ski/Row-specific - this is the cap-compliant continuous option for those two modalities (Air Bike gets no equivalent per the Bible's explicit "assault bike sprints called recovery" exclusion, L501). |
| 3x8min Easy Mixed Erg Blocks | 3 reps x 8 min easy, 2 min rest, rotating bike/ski/row | Rotate through the ergs so nothing gets boring or overloaded. | time | Bible recovery example, L497 | Sits exactly at the 8min cap - clears it for Ski/Row/Air Bike but with no margin; this is the standard way Flush duration is delivered on off-feet modalities without breaking rule 3. |
| ⚑ Light Circuits | Easy low-intensity circuit, cross-modality | Keep the intensity low even though it's a circuit - this isn't a competitive format. | time | census `Light Circuits`; Bible's "easy circuits" language (L1341) reads mixed-equipment, not bike-exclusive | Time-based, well under the 8 min cap - renders across Bike/Ski/Row/Air Bike as a rotation; Run not applicable (this is an equipment-circuit format). |

**Air Bike: EMPTY across every template. The Bible's Recovery section explicitly lists "Assault bike sprints called recovery" as a bad example (L501) - a genuinely easy air-bike spin isn't addressed either way. Sam's call on whether to leave this EMPTY or explicitly strike the combination.**


## Grind

| Name | Structure | Effort Cue | Base Unit | Source | Modality Notes |
|---|---|---|---|---|---|
| ⚑ Footy Fartlek | Random-effort fatigue-simulation run, 15-20 min total | Random on purpose - footy doesn't give you a rhythm, so this shouldn't either. | time | Bible, L1262 / L568; census `Footy Fartlek` - the format is Bible-named, its placement in this row is INFERRED (no Bible section covers "Grind") | Run-native. Time-based - total session ≤20min; if rendered off-feet, break into ≤8min blocks per rule 3. |
| ⚑ 400m Repeats (Grind reading) | 4-6 reps x 400m hard, short-moderate rest | This one should genuinely hurt by rep 3 - that's the point of this row. | distance | census `200m/400m Repeat Runs`, Bible L1261/L566 - cross-listed from Aerobic Power; the ~60-90s duration is why it's read as Grind here | Run/Ski/Row: same nominal distance (400m). Bike: 800m. Air Bike: convert via 250m~1min anchor -> ~96s work (rule 2). |
| ⚑ Hill Sprint Repeats (fatigue-resistance use) | 6-10 reps x hill sprint, short recovery jog-down | Same hill, different job - this time it's about surviving rep 8, not looking pretty on rep 1. | distance | Bible, L1550 / L1738 - cross-listed from Acceleration; the repeated-fatigue framing (vs crisp low-rep Acceleration use) is INFERRED | Run-only (hill terrain) - no cross-modality rendering. |
| ⚑ Off-Feet MetCon | Mixed-modality sustained hard effort, 15-20 min | Keep moving with real intent the whole time - this is where fitness meets willpower. | time | Bible, L577 / L1266 / L1316; census `MetCon` - cross-listed from Aerobic Power; Sam's call on whether MetCon's true home is VO2 (Aerobic Power) or fatigue-resistance (Grind) | Time-based - total session 15-20min, broken into ≤8min work blocks with rest for Ski/Row/Air Bike per rule 3; Bike can run closer to continuous. |
| ⚑ 60-90s Max Sustained Effort (erg) | 4-6 reps x 60-90s all-out, full recovery between reps | This is the exact zone the Bible means by 'grind for up to 1 min' - it should feel unpleasant by 45 seconds in. | time | INFERRED - anchored to L1483's "grind for up to 1 min", the only textual basis for this entire row | Time-based, well under the 8 min cap - renders identically across Ski, Row, Air Bike, Bike; Run uses the 400m Repeats template above instead. |
| ⚑ 1-Minute Effort Ladder | 3-4 reps x 60s all-out, 3-4 min full recovery between reps | One minute, everything you've got - then really recover before the next one. | time | INFERRED - same L1483 anchor as above | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| ⚑ Descending Rest Grind | 5 reps x 45s hard, recovery dropping from 90s down to 30s across reps | The work stays the same, the rest disappears - that's the test. | time | INFERRED, standard fatigue-accumulation protocol - not in the Bible | Time-based, well under the 8 min cap - renders identically across all 5 modalities. |
| ⚑ Shuttle Grind (running) | Repeated up-back shuttles at high effort for 8-10 min continuous, minimal rest | This is the shuttle's ugly cousin - less about the cut, more about surviving it. | time | INFERRED - COD-adjacent but dosed for fatigue, not mechanics; not in the Bible | Run-only (shuttle/COD terrain) - no cross-modality rendering. |
| ⚑ Bodyweight Grind Circuit | 4-5 rounds of a short bodyweight circuit (e.g. burpees, mountain climbers, squat jumps) at a sustained hard pace, minimal rest | No equipment excuse for this one - just sustained honest effort. | time | INFERRED, standard MetCon-style circuit - not in the Bible | Modality-agnostic bodyweight work - doesn't route through the Run/Bike/Ski/Row/Air Bike rendering rules at all; usable as a no-equipment substitute for any Grind template above. |
| ⚑ Long Hill Repeats | 4-6 reps x 40-60s hill effort at a hard-sustained (not max-sprint) pace, walk-down recovery | Not a flat-out sprint - a hard, honest grind up the hill. | time | INFERRED - distinguishes from the sprint-focused Hill Sprint Repeats above by using a longer, sub-maximal-but-sustained effort; not in the Bible | Run-only (hill terrain) - no cross-modality rendering. |

**Regular Bike: EMPTY. No census, Bible, or plausible-inferred dose reads as bike-specific "grind" - MetCon is the closest fit but is explicitly mixed-modality, not bike-exclusive.**


## NOT COVERED

- **The template-vs-grid architecture question itself is Sam's call, not a settled fact**: this sheet implements the template-as-stimulus / modality-as-rendering-rule direction as briefed, but it is a rebuild, not an incremental patch — the earlier grid draft is left in place, unedited, for comparison rather than deleted.
- **Grind remains an open question**: every template in that row is inferred against one undosed line (L1483). Sam should either give the row an explicit duration/intensity definition or fold it back into Anaerobic/Aerobic Power.
- **The 8-minute cap is encoded per-template, not verified against a running app constant** — `CONDITIONING_META`/session-builder code has no explicit 8-minute cap today (the Bible's own number is a 10-minute cap, L1319/L4102, 'prefer 4-8min'); this sheet's cap is Sam's new instruction, not yet wired into `exerciseTags.ts` or the generation pipeline.
- **Cross-modality distance/time conversions (rule 2) are largely un-run through the app's actual unit-conversion or display logic** — this sheet states the rendering rule per template; it does not verify any calculator or UI surface renders it that way today.
- **Load/intensity prescriptions beyond structure** (target HR zones, RPE targets, pace calculators, MAS-percentage tables beyond the Anaerobic row's citation): out of scope.
- **Generation-code wiring**: read-only sorting/drafting pass only. No changes to `exerciseTags.ts`, `CONDITIONING_META`, `masCopy.ts`, or any generation/session-builder code.
- **Device/UI verification**: read-only spreadsheet generation — no app screens touched, nothing to device-test here.
