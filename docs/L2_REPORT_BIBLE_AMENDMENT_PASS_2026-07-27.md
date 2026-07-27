# L2 Report — Bible Amendment Pass (2026-07-27)

Unit: apply every recorded ruling that supersedes `docs/LFA_PROGRAMMING_BIBLE.md`
into the Bible in place, per Sam's standing process ruling (D16, 2026-07-25):

> **the Bible gets AMENDED when new rulings supersede it — contradictions are
> removed, not accumulated.**

**Status: DOCS ONLY. Branch `docs/bible-amendment-pass-2026-07-27`, NOT merged.**
Sam signs the diff summary in §3 before this goes to `main`. No code, no tests,
no generation behaviour changed by this unit — the Bible is the source that
*future* units encode, and several amendments below describe law the code does
not yet implement (§6).

Sources read: `PROGRAMMING_DESIGN_SESSION_2026-07-23.md` (D1–D16 + addenda),
`CONDITIONING_FRAMEWORK_SAM_2026-07-25.md` (authored-final),
`CONDITIONING_TEMPLATES_FINAL_2026-07-25.md`/`.xlsx`,
`SAM_EXECUTION_ORDER_2026-07-25.md`, `POWER_EXERCISE_POOL_SPEC_2026-07-23.md`.

---

## 1. Shape of the change

One file: `docs/LFA_PROGRAMMING_BIBLE.md`, 4712 → 4814 lines.
288 insertions, 186 deletions across 24 substantive amendments plus one
document-wide terminology rename.

Two kinds of edit, kept deliberately distinct:

- **Superseded text removed and replaced.** Where a ruling contradicts a line,
  the old line is gone — not annotated, not footnoted. That is the whole point
  of the pass.
- **Gaps filled.** D2 session ordering, D15 weekly assembly and D10's injury
  dialogue had no Bible text at all. Those are additions, and they are marked as
  additions in the table so Sam can see what is new law versus corrected law.

The Bible's own precedence machinery (§17 wins over earlier, §18 wins over
everything) meant three amendments had to land in **two** places to actually
take effect — the erg cap, the running cap and the deload law all had a copy
inside §17/§18 that would otherwise have silently overridden the §1/§6 fix.
Those are called out in the table.

---

## 2. A contradiction found while doing this

The Bible's second line said *"use Section 17 Addendum as the final authority"*.
Section 18 opens by declaring that **it** wins over any earlier conflicting
frequency, deload, rest-day, hard-day, injury or equipment rule. The header
pointer has been wrong since §18 landed on 14 July.

Amended to: §18, then §17, then earlier sections — plus a line naming the two
authored-final conditioning documents as the owners of conditioning doses.
This is in the diff table as row 1 and needs Sam's nod like anything else.

---

## 3. DIFF SUMMARY — for Sam's sign-off

`ADD` = new law, the Bible was previously silent. `SUPERSEDE` = old text deleted.

### 3.1 Authority and process

| # | Old line | New law | Source |
|---|---|---|---|
| 1 | Header: "use Section 17 Addendum as the final authority" | SUPERSEDE. Order is §18 → §17 → earlier sections. Conditioning doses owned by the framework + templates docs. | §18's own precedence claim; conditioning framework |

### 3.2 Conditioning — the framework, the law, the properties

| # | Old line | New law | Source |
|---|---|---|---|
| 2 | *(silent)* | ADD §6 "Conditioning framework authority": the framework doc + the 55-template sheet own all doses; the Bible states law and placement only; where an earlier list disagrees, those two files win. | Conditioning framework (authored-final) |
| 3 | *(silent)* | ADD **THE CLASSIFICATION LAW** — intensity classifies, W:R is only a property. A ratio outside a band is a property, not a misfiling. Explicit ban on building a validator/gate that reclassifies on ratio. | Sam's 2026-07-25 amendment |
| 4 | *(silent)* | ADD the eight quality rows (Acceleration, Top End Speed, Repeat Sprint, COD/Decel, Anaerobic, Aerobic Power, Aerobic Capacity, Flush), GRIND folded into Anaerobic; the governing quality table; the sprint-family 1:12 exemption; the ≤4–5 min short-intermittent set-length rule. | D12 rev 2 + framework |
| 5 | *(silent)* | ADD the template schema (work · rest · sets/rounds · intensity · W:R · total time) and the six template properties (FINISHER ROLE ONLY · FALLBACK ONLY · COD availability gate · MID-SESSION MIXING · SET LENGTH ≤4–5 min · NO SKI/ROW flywheel rule). | D12 rev 2 + templates FINAL |
| 6 | *(silent)* | ADD Sam's local-footy emphasis: anaerobic power and RSA beat large volumes of brutal lactate work; capacity earlier, aerobic power + footy shuttles as the season approaches. | Framework |
| 7 | *(silent)* | ADD the MAS / 2 km time-trial layer: skippable onboarding TT, MAS defaults by experience, %MAS renders as per-athlete paces, 6–8-weekly re-test as a real aerobic-power session. | D14 |
| 8 | Easy aerobic "Simple guide": short flush 15-25 / normal 25-40 / longer 35-60 / 3x8 min ergs | SUPERSEDE. Doses come from the Flush tab and the low end of Aerobic Capacity. %MAS/HRmax bands stated instead. | Templates FINAL |
| 9 | Tempo: the 6-item running list, the 5-item erg list, the 1:1 / 2:1 / 3:1 work-rest list | SUPERSEDE. Those shapes are authored templates on the Aerobic Capacity and Aerobic Power tabs. | Templates FINAL |
| 10 | Hard intervals: the 9-item example list, the 6-item work/rest list | SUPERSEDE. Split explicitly across Aerobic Power (1–5 min, 90–110% MAS) and Anaerobic (15–60 s, 3–8 min total hard work), with the set-length rule attached. | Framework + templates FINAL |
| 11 | "Good in-season / pre-season / off-season conditioning" format lists | SUPERSEDE. Replaced with quality-row guidance per phase, including the COD/Decel availability gate (no-team-training weeks only, cut first). | D12 rev 2 + templates FINAL |
| 12 | "Preferred finisher variety" 9-item dose list | SUPERSEDE. The FINISHER ROLE ONLY property governs: only a finisher-role template may be a finisher, and it is never the session itself. | Templates FINAL |
| 13 | *(silent)* | ADD to the simple rules: running sits between 2 and 3 days a week; a layer that invents its own conditioning dose is a defect. | D15 + framework |

### 3.3 Erg cap — 8 minutes replaces 10

| # | Old line | New law | Source |
|---|---|---|---|
| 14 | §6 Rower: "Don't program more than 10 minute rounds" | SUPERSEDE. HARD CAP 8 min on any single work interval, 4–6 preferred; anything longer is Run or Bike. | D12 rev 2 |
| 15 | §6 Ski: same 10-minute line | SUPERSEDE, same law. Plus the NO SKI/ROW flywheel exclusion for sub-10-second work added to the Air Bike entry. | D12 rev 2 + framework |
| 16 | §17 B: "No continuous RowErg or SkiErg block should be longer than 10 minutes" | SUPERSEDE. 8 min hard cap, 4–6 preferred, Air Bike included. **This copy had to change or §17 would have overridden §6.** | D12 rev 2 |

### 3.4 Running — floor 2, cap 3

| # | Old line | New law | Source |
|---|---|---|---|
| 17 | §1 pre-season: "Running limited to 4 times per week" | SUPERSEDE. Capped at 3, floored at 2. | D15 standing rule |
| 18 | §1 in-season bye: "keep to 4 or less per week" | SUPERSEDE. The standing 3-day cap. | D15 |
| 19 | §6 easy aerobic: "With max 4 running sessions…" | SUPERSEDE. "With running capped at 3 days a week…" | D15 |
| 20 | §17 B: "No more than 4 running exposures per week programmed by the app" | SUPERSEDE. Floor 2 / cap 3 running days; anchors count toward the cap (2 TT + game = 3, which is why in-season rarely needs added running); floor disapplied in early off-season and bye recovery; everything above the cap goes off-feet. **§17 copy — same override reason as row 16.** | D15 + §18 B early-off-season law |
| 21 | §17 F strong warning: "More than 4 running exposures" | SUPERSEDE → "More than 3 running days". | D15 |

### 3.5 Deload law

| # | Old line | New law | Source |
|---|---|---|---|
| 22 | §1 pre-season: "once every 4 weeks or so deload… I've always liked 3-4 weekly cycles" | SUPERSEDE. Pre-season runs SCHEDULED 3–4-week deload cycles. Definite. | D16 |
| 23 | §1 off-season: the same "once every 4 weeks or so" line | SUPERSEDE. Three stages: weeks 1–2 optional block (no deload — nothing is compulsory), weeks 3–4 transition (week 4 does not deload), 3–4-week cycles from week 5. | D16 |
| 24 | §1 in-season: *(silent — the in-season list had no deload rule)* | ADD. NO scheduled in-season deloads; games and byes self-regulate; backing off only via bye recovery or a readiness/injury call. | D16 |
| 25 | §18 F: "Pre-season automatically deloads every fourth week" + the automatic fourth-week off-season policy | SUPERSEDE. 3–4-week cycles both phases; in-season no-scheduled-deload made explicit. **§18 copy — would have overridden §1 otherwise.** | D16 |

### 3.6 Weekly assembly (D15) — all new

| # | Old line | New law | Source |
|---|---|---|---|
| 26 | *(silent)* | ADD §2 "Weekly assembly rules": inputs (TT nights MOVE — pre-season is often Mon/Wed because cricket owns Tue/Thu); the four placement rules (TT nights are anchors; hard running pairs with UPPER, LOWER pairs with off-leg, hinge never meets sprints; space lower exposures and prefer doubles + full off-days; fewer days ⇒ full-body consolidation). | D15 |
| 27 | *(silent)* | ADD the in-season splits: 2 days = full body Mon+Wed · 3 days = Lower Mon, Upper Pull+TT, rest, Upper Push+TT · 4 days = + optional accessories Wed + optional Gunshow Fri · optional Gunshow at G-1 for everyone. | D15 |
| 28 | *(silent)* | ADD the TT-day **exercise-selection filter** — full-body strength CAN share a TT day (morning gym / evening track is normal). Avoid high-soreness picks and heavy low-back/groin loading; athletes aren't made of glass, low-rep RDLs and box squat are fine at 2–3 lifts. Applied via existing tags + a dose cap, never a name list. | D15 amendments |
| 29 | *(silent)* | ADD skip rules + pattern absorption: move-forward only to legal days else honestly gone; NEXT WEEK IS NEVER MORTGAGED; a missed upper pattern folds into the remaining same-region session, key lifts in / accessories out, never 12–14 lifts, never cross-region. | D15 |
| 30 | *(silent)* | ADD the bye-week choice ("Freshen up" default / "Push on", applying to the REMAINDER of the week) and the hard high-speed bye Saturday. | D15 |
| 31 | *(silent)* | ADD Sam's two canonical reference weeks (pre-season ideal, weekend-unavailable variant) marked explicitly as targets the assembler must reproduce, not hardcode. | D15 |

### 3.7 Session ordering and composition (D2 / D13) — all new

| # | Old line | New law | Source |
|---|---|---|---|
| 32 | *(silent — the Bible had no ordering rule)* | ADD §4 canonical order: power → main → secondary → accessories → finisher, midline/prehab after accessories. | D2, D13 addendum |
| 33 | *(silent)* | ADD **ONE MAIN PER PATTERN PER SESSION** — deadlift + RDL illegal, box squat + back squat illegal — and the lower-session heavy-slot ladder (heavy squat → heavy hinge → SL knee-dominant → SL hip-dominant → accessories). | D2 |
| 34 | §5 contrast: "useful… for experienced athletes" (loose) | SUPERSEDE/TIGHTEN. Contrast requires training age `consistent` or `advanced`; `developing` gets a primer, never contrast; contrast draws from the same pool and gates as the primer. | D2 (explicit code-gap call) |
| 35 | *(silent)* | ADD the D13 composition law: the session is ONE list with role badges (power/main lift/accessory/midline/prehab/conditioning), second heavy lift reuses Main Lift; one collapsed Mobility & Prehab flow at the TOP that is NEVER load-bearing; TT as non-badged banner; recovery days keep their own template; combined-day conditioning expands in place; no flow on conditioning-only days. | D13 + D13 addendum |

### 3.8 Power pool, sleds, med balls, experience gating

| # | Old line | New law | Source |
|---|---|---|---|
| 36 | §5 power: "Medicine ball throw variations if available", "Medicine ball chest pass if available", "Medicine ball slam/throw if available" | SUPERSEDE. Med-ball work is retired from LFA entirely; the power block is bodyweight-first and never depends on a med ball. | Power pool spec + locked exercise list |
| 37 | *(silent)* | ADD the power pool entries — depth jump, lateral jump, lateral bounds, kneeling jump — plus block-stable selection (same pick all block, rotates at rollover, athlete override persists for the block). | Power pool spec |
| 38 | *(silent)* | ADD the per-entry gates: depth/bounds min `developing` (depth also needs a knee-height box), kneeling min `consistent`, in-season pool narrows to vertical + lateral jump, pogo takes the slot when reduced, equipment substitutes and never forces. | Power pool spec |
| 39 | §5 calf examples: "sled pushes" | SUPERSEDE. Removed; **NO SLEDS** stated. | Framework standing rules |
| 40 | §5 contrast pairings: "Heavy sled push -> short acceleration", "Heavy row -> med ball slam/throw if available" | SUPERSEDE. Both removed. | Framework + locked list |
| 41 | §7 acceleration: "Hill sprints or sled pushes can be used carefully" | SUPERSEDE → "Hill sprints can be used carefully. NO SLEDS." | Framework standing rules |
| 42 | *(silent)* | ADD §11: ONE experience ladder for the whole app (new → developing → consistent → advanced), no second beginner/experienced representation; the two gates riding on it; the "everyone (regression)" convention (auto-programmed for new-to-training only). | Power pool spec + D13 |

### 3.9 Reps and injury

| # | Old line | New law | Source |
|---|---|---|---|
| 43 | §5: *(the full-toggle top-of-range vs floor question was never written into the Bible; ranges were the only prescription form)* | ADD. Ranges stay the generation source; the athlete is shown a SINGLE MIDDLE NUMBER (3×8–12 → 3×10), and assume-prescribed logging reads exactly that. Explicitly supersedes the top-of-range/floor toggle. | D9 |
| 44 | *(silent)* | ADD §8 "Injury is a dialogue, not a diagnosis": THE APP NEVER ASSUMES, IT ASKS. An injury pauses AFFECTED-REGION work only — **team nights and games KEEP their conditioning and sprint credit**. At ≈6/10 or region-relevant, the three-question flow ("Can you still train and play?" → "Will you be doing any work on those days?" → "Want me to prescribe a session that fits?"). Credit withdrawal + requirement reduction are ONE atomic authored decision. Coach chat uses the same door. | D10 |

### 3.10 Terminology

| # | Old line | New law | Source |
|---|---|---|---|
| 45 | "trunk" and the muscle-group sense of "core", 75 lines document-wide | SUPERSEDE → **midline**. | D13 |
| 46 | §4 Gunshow: "A replacement for missing core strength work" | SUPERSEDE → "missing **main** strength work". This line was genuinely ambiguous between the two senses of "core"; rewritten rather than renamed. | D13 addendum (homonym rule) |

**The homonym is deliberately untouched.** `core session`, `core exposure`,
`required_core`, `planner_selected_core`, `Core sessions should be protected`,
`"core" or compulsory sessions`, and the title `0. Core LFA principles` all mean
*compulsory*, not *midline*, and were excluded by line from the rename — per
D13's SessionTier "CORE" homonym exclusion. Verified by grep after the rename:
every surviving `core` is the compulsory sense.

---

## 4. Changelog

A dated `19. Amendment changelog` section now closes the Bible, restating Sam's
process ruling and listing all 46 amendments with the superseded text named. It
is the permanent record; this report is the sign-off artefact.

---

## 5. NOT COVERED by this unit

Per Process Law L2, everything in scope-adjacent territory that this unit did
**not** do:

- **D3 (strength swap strictness) and D4 (conditioning swap "ask why first")
  are NOT in the Bible.** They were on the design session's own list of genuine
  Bible gaps, but were not on this unit's instruction. D3 additionally has an
  unmet implementation prerequisite (the muscle-block mechanism). Recommend a
  second short amendment pass once Sam has signed this one.
- **D1 (3-week block, athlete-owned load progression, identical skeleton,
  5–7 exercise density band) is NOT amended in.** D1 was audited as already
  consistent with Bible line ~729; nothing contradicted, so nothing removed. The
  density band and the week-over-week constancy invariant are still unstated.
- **D5, D7, D8, D11, D12's grid revision, D3a** — not touched. D5 confirmed the
  existing off-season table as correct (no amendment needed); D7/D8 are product
  mechanics; D11's no-same-muscle-stacking rule waits on the same muscle-block
  mechanism as D3; D3a is parked post-launch.
- **No code, no tests, no gates run.** This is a docs-only unit, and the code
  still encodes the *previous* Bible in at least one place I confirmed:
  `src/__tests__/rulesKernelTests.ts:419` asserts
  `BIBLE_WEEKLY_CAPS.maxRunningExposures === 4`, and `sessionResolver.ts:1464`
  reads that constant. That test will need to change when the cap-3 law is
  encoded — it is currently green *because* it encodes the superseded rule.
  Several other amendments here (erg cap 8, one-main-per-pattern, the 2-run
  floor) are law the code does not enforce at all. Encoding them is a separate
  tests-first unit and must not be assumed to be done.
- **Line-number references elsewhere will drift.** Other docs cite Bible line
  numbers (e.g. the design session's "~4423–4440" for the off-season table,
  G6's "Bible line 164"). Those are historical records of a conversation and
  have not been rewritten; anything above the §1 insertion point has moved by
  roughly +30 lines and the off-season table by ~+100.
- **The 55 doses are not in the Bible and deliberately never will be.** If Sam
  wants the Bible to be readable standalone without the sheet open, that is a
  different call and I have not made it for him.

---

## 6. Known tension I did not resolve unilaterally

The 2-run **floor** and §18 B's early-off-season row are in tension: §18 B says
early off-season requires no sprint and no running at all. I resolved it by
scoping the floor — the floor does not apply in early off-season or bye
recovery, and elsewhere a healthy week below 2 running days needs an authorised
typed reduction reason. That scoping is **my** reading of how Sam's standing
rule composes with his existing §18 law, not a recorded ruling. If he wants the
floor absolute, or wants it to apply only from mid off-season onward, it is a
one-line change to §17 B.

Second, smaller: the framework's running cap is expressed in **days**, while
§17 B's old cap was expressed in **exposures** — and so does the code
(`BIBLE_WEEKLY_CAPS.maxRunningExposures`). I have written the new law as days
throughout and made the anchor arithmetic explicit (2 TT + game = 3). If Sam
meant exposures, the in-season maths changes and so does the counter's meaning.

---

## 7. What Sam needs to do

Read §3. Any row he rejects, I revert that row only — the amendments are
independent. On approval this merges to `main` `--no-ff`; nothing else in the
repo depends on it, so there is no device pass and no gate to wait for.
