# Programming Quality Design Session — Phase 4.1 (Sam, started 2026-07-23)

Status: IN PROGRESS. Sam's decisions recorded as they land; each becomes a
Bible/rules-kernel invariant (tests-first) in Phase 4.2. Per L7 nothing
here is a default — every entry is Sam's explicit call.

Agenda (from MASTER_PLAN 4.1):
1. Weeks 2–3 across a block — density + progression (G1)  ← current
2. Session-ordering rules (G2 — box squat/back squat bookends)
3. Swap-candidate rules (G3 — category/intent-respecting pools)
4. Off-season week structure (G5 structure quality)
5. Exercise cue/notes voice + authored source (G4)
6. Repeat-week disposition (F7 — keep/demote/hide)
7. Anchor-ratio review (deadlift 1.0 starting point)
8. Full-toggle methodology (top-of-range vs floor reps)

## Decisions

### D3 — Swap candidate rules (G3) — Sam, 2026-07-23

- **STRICTEST pools: a swap must do the same job for the same body part.**
  Copenhagen plank → only other groin/adductor strength work; deadlift →
  only other heavy hinge lifts. "The program stays intact — an athlete
  can always bin an exercise or add a new one if they want."
- Short lists are acceptable by design; bin/add is the escape hatch, swap
  is never allowed to change the exercise's purpose.
- Maps onto D2's pattern taxonomy: swap pool = same movement pattern +
  same slot role (main/secondary/single-leg/accessory/prehab).
- IMPLEMENTATION PREREQUISITE (found 2026-07-24, Abductor Machine
  divergence): the pool system has NO muscle-group concept (PoolEntry =
  name+loadRatio; "blocks" are comments; getSlotSiblings returns whole
  role arrays, and two of its three callers are §18 progression
  transfer). D3's strictest same-job-same-part rule requires a real
  muscle-block/grouping mechanism — designed and built WITH the Phase
  4.3 swap-candidate work, covering coach swap + progression transfer.
  Until then: Abductor Machine ships unpooled (tags/cue/video only, not
  auto-programmed), joins the pool when the mechanism lands.
- OPEN: conditioning swap strictness (asked next).

### D6 — Exercise cues (G4) — Sam, 2026-07-23

- Format CONFIRMED as current: two short cues (primary = mechanics,
  secondary = intent/control), ≤12 words, no full sentences; videos carry
  the detailed how-to.
- Provenance fix: full review pass by Sam via docs/CUE_REVIEW_2026-07-23
  .xlsx (145 rows: 135 authored pairs + 10 pool exercises with no
  authored cue, flagged rows first). Sam edits the yellow columns and
  returns; a terminal applies his edits to exerciseCues.ts verbatim
  (tests: cue-rule conformance + no pool exercise without authored cue).
  File then carries "authored by Sam" provenance; future additions need
  his sign-off.

### D17 — Mobility & Prehab flow menus (Sam, 2026-07-27, AUTHORED)

Sam's composable flow rules — the app selects the specific exercises
from the matching pools/muscle-tags; counts are law:

- **Lower days (general):** 2 hip mobility + 2 hip prehab
- **Lower SQUAT days:** 2 hip mobility + 1 hip prehab + 1 knee prehab
- **Lower HINGE days:** 1 hip mobility + 1 hamstring-or-low-back
  mobility + 1 hip prehab + 1 hamstring prehab
- **Any UPPER day:** 1 shoulder mobility + 1 upper-body mobility +
  2 shoulder prehab
- Resolution order: hinge rule > squat rule > general lower; the app
  chooses the specific exercises and slots (rotation for variety).
  Category mapping via muscle metadata: hip prehab = groin/adductor +
  hip/glute entries; knee prehab = the TKE/Spanish-squat/step-down
  crew; hamstring prehab = hamstring-light pool; shoulder prehab =
  shoulder-health pool; upper mobility = t-spine/lat/chest/dead-hang.
- Flow stays never-load-bearing (D13); conditioning-only and recovery
  days have no flow (v1).
- CONFIRMED (Sam): **full-body days = 1 hip mobility + 1 shoulder
  mobility + 1 hip prehab + 1 shoulder prehab.**
- **FLOW DOSING (Sam, 2026-07-27):** mobility items = 2 sets ×
  30–60 sec (per side where applicable); prehab items = 2 sets ×
  10–20 reps. Universal across the flow — covers most things; an
  exercise whose curated prescription differs (e.g. a hold-based
  prehab) keeps its curated dose.
- D17 is now AUTHORED-COMPLETE — the final authoring item in the
  programming system.

### D15 amendments + D16 deloads (Sam, 2026-07-25)

- **TT-day gym pairing refined:** full-body strength CAN share a day
  with team training (morning gym / evening track is normal). The rule
  is an EXERCISE-SELECTION FILTER on TT days, not a pairing ban: avoid
  high-soreness picks (RFE split squats, Nordics, back squats, heavy
  RDLs) and heavy low-back/groin loading — but athletes "aren't made
  of glass": low-rep RDLs fine, box squat fine, especially at 2–3
  lifts. Implemented via existing tags (doms/eccentric/injury-map) +
  dose cap, not a name list.
- **D16 — Deload law:** OFF-SEASON: weeks 1–2 everything-optional rule,
  weeks 3–4 transition rule, THEN 3–4-week deload cycles begin.
  PRE-SEASON: scheduled 3–4-week deloads, definitely. IN-SEASON: NO
  scheduled deloads — fatigue management + readiness awareness only
  (games and byes self-regulate).
- **Process ruling (Sam): the Bible gets AMENDED when new rulings
  supersede it** — contradictions are removed, not accumulated. A
  BIBLE AMENDMENT PASS is now a scheduled unit: apply every recorded
  ruling (8-min erg cap over the old 10, conditioning taxonomy +
  framework, run floor/cap, no sleds, midline, D1–D16) into
  LFA_PROGRAMMING_BIBLE.md with a changelog; Sam signs the diff.

### D15 — Weekly assembly rules (Sam, 2026-07-25) — PRINCIPLES, not fixed templates

- Inputs: athlete's actual TT nights (they MOVE — pre-season TT is often
  Mon/Wed because cricket owns Tue/Thu grounds), available days, phase,
  game/fixture. The assembler places sessions by rule:
  1. TT nights are anchors wherever they fall; attach upper work to a
     TT night when gym-after-training works (e.g. Upper Pull + TT).
  2. Hard running/top-end pairs with UPPER days; LOWER days pair with
     off-leg conditioning (Bible law). Hinge day never meets sprints.
  3. Lower exposures spaced; rest follows dense clusters; prefer
     doubles + full off-days over one-session-per-day (Bible).
  4. Fewer days ⇒ full-body consolidation (2 gym days = full-body ×2,
     Mon/Wed in-season). Weekend available ⇒ volume slots; weekend
     unavailable ⇒ compress into weekdays, same pairings.
- In-season splits (Sam): 2 days = full-body Mon+Wed · 3 days = Lower
  Mon, Upper Pull+TT, rest, Upper Push+TT · 4 days = + optional
  accessories/prehab Wed + optional Gunshow Fri · everyone may take an
  optional Gunshow G-1.
- SKIP RULES: move-forward relocates only to legal days, else honestly
  gone; missed/skip recorded, week continues, NEXT WEEK NEVER MORTGAGED.
  PATTERN ABSORPTION: a missed upper pattern folds into the remaining
  same-region session as a normal-sized combined day (key lifts in,
  accessories out; never 12–14 lifts; never cross-region).
- BYE WEEK: athlete chooses "Freshen up" (default) or "Push on" —
  applies to the REMAINDER of the week whenever declared; push-on adds
  one lower stimulus + extra OFF-LEG conditioning (RUNNING CAPS AT 3
  DAYS/WEEK — standing rule, pairs with the 2-run floor) and the bye
  Saturday hosts a hard high-speed session (150s @2:00, 400s, aerobic
  power) where the body expects game intensity.
- Canonical reference weeks (assembler must reproduce, not hardcode):
  Sam's pre-season ideal — Mon Upper Pull+TT · Tue Lower · Wed TT ·
  Thu rest · Fri Upper + hard conditioning/top-end · Sat Lower +
  off-leg conditioning · Sun rest. Weekend-unavailable variant — Mon
  TT · Tue Full Body · Wed TT · Thu Lowers · Fri Uppers + hard
  conditioning.

### D14 — MAS via 2 km time trial (Sam, 2026-07-25)

- **Onboarding gains a 2 km time-trial screen** (min/sec roller, sits
  with the squat/bench strength questions). 2 km chosen over 3 km: AFL
  club standard — many athletes know their time cold.
- **Skippable**: "Not sure / haven't tested" default; MAS defaults by
  experience level so every MAS-based session still renders.
- MAS stored on-device; %MAS intensities in run templates render as
  per-athlete paces/rep distances (the personalisation layer for
  time-first conditioning).
- **Re-test loop (roadmap)**: the app prescribes a 2 km TT as a real
  aerobic-power session every ~6–8 weeks, recalibrating MAS and feeding
  the Journal's fitness trend.
- Builds with the conditioning wiring (Step 2/3 of Sam's order).

### D13 flow-rule language (Sam, 2026-07-25)

- The future flow/primer curation session uses Sam's composable rule
  format, executable because of the muscle/role/level metadata:
  **"<session type>: flow = N × <category> + N × <category>"** —
  e.g. "any upper push session: 2 shoulder mobility + 2 shoulder
  prehab". Sam writes the sentences; they become enforced selection
  rules. (Regression addendum: Banded Bicep Curl → everyone
  (regression), 2026-07-25.)

### D13 addendum — the ten template rulings (Sam, 2026-07-25)

All ten spec questions ruled: 6 badges (second heavy lift reuses Main
Lift) · Team Training = non-badged banner · Recovery days keep their
own simple template · combined-day conditioning = one badged row
expanding in place; conditioning-only days follow phase order · midline/
prehab after accessories · **flow = mobility + prehab (any muscle
group), but IMPORTANT prehab lives in the session itself — the app
assumes athletes skip the flow, so the flow is never load-bearing** ·
per-session-type flow menus = future Sam curation session (e.g. upper
push: dead hangs, pec stretch, external rotations, scap pull-ups) ·
spec's v1 mapping ships meanwhile · no flow on conditioning-only days
(v1) · soft cosmetic checkmark, never logged · SessionTier "CORE"
homonym excluded from the Midline rename.

### D13 — Session template: one list, role badges, mobility on top (Sam, 2026-07-25)

- **The session is ONE list.** No separate boxes for trunk/support,
  recovery add-ons, or the power block — every exercise renders in the
  single session list, each carrying a **role badge/icon**: power, main
  lift, accessory, midline, prehab, conditioning.
- **One optional "Mobility & Prehab flow" sits at the TOP**, collapsed —
  tap to pop it open. Includes session-appropriate primers (e.g.
  external rotations on upper days).
- **TERMINOLOGY: "midline" replaces "trunk/core"** everywhere —
  athlete-facing copy, badges, pool display names, docs (internal type
  keys may keep their ids; words the athlete sees say midline).
- Internal counting fences (power not-a-finisher etc.) are unchanged —
  this is a render/composition ruling, not an accounting change.
- Experience convention for the muscle sheet: "everyone (regression)" =
  auto-programmed for new-to-training only; others via injury/equipment/
  self-pick.

### D12 revision 2 — templates-as-stimulus (Sam, 2026-07-25, supersedes grid)

- **Architecture: template = the stimulus; modality = a rendering
  rule.** Time-first prescriptions (self-scale across athlete speeds);
  distance allowed for short/speed work; calories for EMOM-class.
- **8 quality rows** (GRIND FOLDED INTO ANAEROBIC — Sam): Acceleration ·
  Top End Speed · Repeat Sprint · COD/Decel · Anaerobic · Aerobic
  Power · Aerobic Capacity · Flush.
- **Modality rules:** Run/Ski/Row share distances; Bike = ×2; Air Bike
  time-based via 250 m ≈ 1 min; work intervals >8 min = Run/Bike only
  (Ski/Row/Air Bike hard cap 8 min, prefer ≤6 — supersedes Bible's old
  10-min line); sprint-family (Accel/Top End/COD) run-only. NO SLEDS.
- **TEMPLATE SCHEMA (Sam):** every template must carry — work period ·
  rest period · sets/rounds (reps where relevant) · intensity · a
  work:rest ratio correct for the quality · total session time.
  Cleanup pass (Sam + Cowork) enforces the schema after Sam's first
  table pass, validating each template against quality-appropriate
  W:R and total-time bands.
- Cleanup-pass note (Sam): FLUSH templates are largely near-duplicates —
  consolidate to a small distinct set (likely: short easy spin/jog,
  medium continuous, long nasal, easy erg alternates) on the second
  pass.

### D12 — Conditioning taxonomy: the russian-doll grid (Sam, 2026-07-25) [SUPERSEDED by revision 2 above]

- **Conditioning reorganises into a locked GRID, same philosophy as the
  exercise vocabulary:** modality (Run / Bike / Ski / Row / Air Bike) ×
  session goal (finisher / long intervals / short intervals / hard
  intervals / continuous) × a Sam-curated menu of 5–10 dose variants
  per cell (e.g. hard intervals: "20:40 × 4, 1 min rest, repeat X min";
  continuous: 30/40/50/60 min; long intervals: "3 × 8 min, 2 min rest").
- Selection is russian-doll: modality → goal → dose. The existing 36
  census conditioning formats and the Bible's conditioning menus
  reorganise INTO the grid — no format survives outside it.
- Interlocks with: D4 (swaps change modality, never goal), the 2-run
  weekly floor, and the conditioning triple classification.
- Builds in Phase 4.3 alongside the muscle-block mechanism. Sam curates
  the cell menus the same way he curated exercises.

### D11 — Muscle blocks: no same-muscle stacking + visible muscles (Sam, 2026-07-24)

- **Rule: a session must not stack multiple exercises targeting the
  same muscle block** (e.g., groin squeeze + adductor machine +
  Copenhagen plank in one session) — the accessory/prehab analogue of
  D2's one-main-per-pattern law. Enforced at generation AND swap once
  the muscle-block mechanism (D3 prerequisite) lands in Phase 4.3.
- **Muscles worked shown on the exercise card** ("works: glutes, outer
  hip") — athlete-facing, helps injury awareness; built on the same
  mechanism, ships with 4.3 if cheap there, else immediately after.
- Priority: FIRST item of the Phase 4.3 programming pass, alongside the
  swap-pool mechanism it shares.

### D10 — Injury vs team-training/game credit (Sam, 2026-07-24)

**Principle (Sam, verbatim intent): "It's a dialogue between S&C coach
and athlete — not trying to prescribe rehab for injuries, that's for
the physio. Just figure out what they can and can't do, and prescribe
it."** The app never diagnoses, never treats — it asks, records, and
programs the work that's still safe and useful.

- **The app never assumes; it asks.** Default: an injury pauses
  AFFECTED-region work only — team nights and games keep their
  conditioning/sprint credit (a shoulder doesn't stop him running).
- When severity/region genuinely threatens participation (≈6+/10 or
  region-relevant): the injury flow asks, in Sam's words: "Can you
  still train and play?" → no → "Will you be doing any work on those
  days?" → yes → "Want me to prescribe a session that fits?"
- Every answer is a recorded typed fact; credit withdrawal + matching
  requirement reduction are ONE atomic authored decision; replacement
  session generated respecting the injury, transaction-owned,
  disclosed, cascade-undoable.
- Same questions asked by the coach chat — same door (added to
  COACH_ACCEPTANCE_CONTRACT).

### D7 — Repeat-week (F7) — Sam, 2026-07-23

- **HIDE for launch.** Button removed from the UI in the Phase 1.6
  dead-affordance/hide sweep; the repeat_week machinery stays (post-v1
  return possible).

### D8 — Anchor ratios — Sam, 2026-07-23

- **Good enough for launch.** No review pass now; athletes correct
  weights fast and progression rebases off their edits (D1). Full ratio
  review → post-launch backlog (POST_V1_ROADMAP).

### D9 — Rep prescriptions: single middle number (Sam, 2026-07-23)

- **Prescriptions change from ranges to the MIDDLE number, for now**
  ("change these to be middle of the range instead of range" — 3×8–12
  becomes 3×10). Assume-prescribed logging then reads exactly what was
  prescribed (Part 3 logging model: 3×10 done = 3×10). Bible rep RANGES
  remain the generation source; display/logging uses the midpoint.
  Supersedes the old "full-toggle top-of-range vs floor" question.
- Lands with Phase 4.3 generation conformance work.

### G6 confirm (Sam, 2026-07-23)

- Pre-season: team sessions count toward conditioning, app tops up 1–3
  standalone depending on team nights — per Bible line 164 ("that's in
  the Bible"). The G6 fix unit implements the Bible rule in the typed
  contract; prompt text derives from the contract.

### SESSION STATUS: Phase 4.1 design session COMPLETE (2026-07-23).
All agenda items decided (D1–D9). Phase 4.2 = encode as Bible/kernel
invariants tests-first; Phase 4.3 = generation fixes to conformance.

### D6c — Cue review pass COMPLETE (Sam, 2026-07-23)

- Sam authored/edited ~48 cue pairs; full verbatim changeset in
  docs/CUE_CHANGESET_2026-07-23.md (139 final entries, 8 deletions,
  4 renames, 8 strength/prehab pool additions). Word cap relaxed 12→18;
  Sam's words verbatim; conditioning cues kept as edited; Light Circuits
  kept; canonical name "Tib Raises" everywhere; Clap Push-Ups and
  Bottoms-Up KB Carry dropped; Bottoms-Up KB Press → shoulder prehab.
- Correction recorded: "not in pools" flag conflated the two strength
  pool files with selectability — conditioning names are selectable via
  the conditioning system and needed no pool action.

### D6b — Session duration KILLED (Sam, 2026-07-23)

- The orphaned gym-session-duration question ("useless" — Sam) is
  REMOVED, not wired in: delete SessionDurationScreen + the
  sessionDurationMinutes field from onboarding data and the generation
  contract (client + edge function both stop expecting it; it currently
  ships blank). Team-training duration (the wired question) is untouched.
- Goes in the Phase 1.6 dead-affordance/orphan sweep unit, tests-first
  (generation contract test updated both sides — pairs with the G6 fix).

### D6a — Pool removal (Sam, 2026-07-23)

- **Zercher Carry removed from the app** ("should not be a lift") — Sam
  deleted it from the cue review sheet; the cue-apply unit must remove it
  from exercisePoolsStrength.ts (carry pool) + exerciseTags.ts + any
  references, tests-first.

### D5 — Off-season structure (G5) — Sam, 2026-07-23

- **The Bible's off-season subphase table (docs/LFA_PROGRAMMING_BIBLE.md
  ~4423–4440) is CONFIRMED correct and authoritative.** No new design.
- G5 is a CONFORMANCE defect: generation must be held to the table
  (tests-first invariants), plus the Phase 1 game-day fixture-carryover
  fix. The dogfood week resembled a mangled early-off-season
  "everything optional" week with an illegal game day.
- EXPLICIT INVARIANT (Sam, 2026-07-23, prompted by the finding-#3
  coverage-validator clash): **early off-season (weeks 1–2): no layer
  may require, promote, or nag a compulsory session — zero completed
  sessions is a valid, honest week.** Same optional-only-mode law as
  illness_recovery/bye_recovery; any mode-unaware requirement enforcer
  found fighting it is a defect of this class.

### Process correction (Sam's call, mid-session)

Bible-first: for every remaining agenda item, check the Bible before
asking Sam. Session output splits into (a) conformance invariants for
what the Bible already answers, (b) Bible amendments for genuine gaps
Sam fills here (D2 ordering + contrast gate, D3 swap strictness), and
(c) product mechanics the Bible deliberately doesn't cover (D4, F7,
full-toggle, custom builder). Audit table in session transcript:
D1 consistent with Bible line 729 (athlete-driven jumps, block-end
progression w/ variation); D3 consistent with Bible's pain-swap
hierarchy (pain → injury door; non-pain → strictest same-job).

### D4 — Conditioning swaps (G3 cont.) — Sam, 2026-07-23

- **Ask why first** (one tap, plain words) — the reason picks the list:
  - "Don't have the gear" → same session, different modality; intent +
    effort identical, dose adjusted for the machine.
  - "Staying off my feet" → off-feet modalities only (bike/row/ski),
    effort preserved.
  - "Just prefer something else" → same intent, any modality.
  - Anything that smells like pain → routes to the injury door, never a
    swap.
- **Intent (easy/tempo/hard) is NEVER changeable via swap** — same law as
  strength: swaps never change the job.
- **Preference is REMEMBERED**: when an athlete swaps by preference, the
  app records the modality preference and future generation uses it
  ("this athlete does hard conditioning on the bike"). Systemic home:
  athlete prefs feeding generation (ergModality/equipment prefs prior
  art) — not a per-week patch.
- Open note (not decided): whether "staying off my feet" should also be
  treated as a readiness signal — parked.

### D3a — Custom exercise builder (Sam's idea, PARKED post-launch)

Sam's concept (from a prior GPT chat, endorsed with adjustments): athletes
add their own exercises with enough metadata that the app knows what it's
allowed to do with them. Two paths — (1) "variation of an existing
exercise" (MAIN path: inherits category/pattern/stress/session-fit from
the base exercise) and (2) "completely new" (guided questions: trains
what, pattern, tracking, equipment, stress, where usable). Key safety
setting: "Can LFA program this automatically?" defaulting to
manual-add-only, athlete can graduate it to swap-eligible / programmable.
Stored per-user ("My Exercises" alongside LFA exercises in swap lists).

Cowork review notes (2026-07-23):
- Verdict: worth building, POST-LAUNCH (Phase 8 / POST_V1_ROADMAP). The
  GPT sequencing caution ("build the classifier first") is largely
  ALREADY SATISFIED — exercise tags/pools, pattern taxonomy, counting
  fences, exposure contract and §18 gates exist. D2/D3's formalised
  pattern+role taxonomy is the last piece custom exercises plug into.
- Rider 1: a custom exercise must NEVER silently satisfy a Bible
  requirement — it carries a counting fence like the power block; it
  can't count as (e.g.) the heavy squat exposure unless explicitly
  classified and validated as one.
- Rider 2: custom exercises are athlete-owned provenance (planEntryId
  guard prior art) — §18/repair may never rewrite or resolve them away.
- Rider 3: per Sam's existing copy rule, avoid "rehab" language —
  "prehab/robustness", "injury-friendly".

### D2 — Session ordering (G2) — Sam, 2026-07-23 (IN PROGRESS)

- Canonical order: **power → main → secondary → accessories → finisher.**
- EXCEPTION — contrast training, for **`consistent`/`advanced` athletes
  only** (Sam's words: "consistent or advanced"): a heavy lift supersets
  with an explosive lift of the SAME pattern (heavy bench → explosive
  push-up; heavy squat → vertical jump). This is the existing contrast
  power kind + 'contrast' pairType; the pairing sits at the MAIN slot,
  not appended.
- CODE GAP vs this decision: current powerPrimerPolicy allows contrast
  for any non-beginner (a `developing` 1–2yr athlete can get contrast in
  late off-season). Sam's gate = min training age `consistent` for
  contrast. Tighten policy + pool spec accordingly (tests-first).
- **Anti-G2 rule: ONE main per pattern per session.** Never two heavy
  lifts of the same movement pattern (deadlift + RDL = two heavy hinges
  = illegal; box squat + back squat = two heavy squats = illegal).
- **Lower-session heavy-slot ladder** (fill order): heavy squat pattern →
  heavy hinge pattern → single-leg knee-dominant → single-leg
  hip-dominant → accessories. "You'd be better served doing a squat and
  a hinge; if both exist, think single-leg knee-dominant and single-leg
  hip-dominant; then accessories."
- D2 COMPLETE.

### D1 — Weeks 2–3 across a block (G1) — Sam, 2026-07-23

- A block is a **3-week phase**.
- **Load progression is athlete-owned.** The app prescribes the SAME
  weight each week across the block by default; an app-suggested load
  progression may come at the END of the block (phase rollover).
- **If the athlete adds weight themselves, following weeks update from
  that move** — the athlete's logged load becomes the new baseline for
  the remaining weeks. (Aligns with the existing logged-data preference
  in strength progression: real logged reps/sets/load, conservative.)
- **Skeleton: identical all block** (confirmed) — weeks 2–3 repeat week
  1's exact movements; only loads/athlete edits change. Variety arrives
  at phase rollover, not mid-block.
- **Density target: 5–7 exercises band, session-dependent** — lower/
  upper/full-body sessions may sit at different counts within the band;
  the invariant is the band plus week-over-week constancy (week N count
  == week 1 count for every session of the block).
