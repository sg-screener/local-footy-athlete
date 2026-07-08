# Root-Cause Report — Off-Season 4-Day Baseline & QA Scenario Validity

Date: 2026-07-08 · Investigation only, zero code changed. Every claim below was
verified against the current working tree, including live probe runs of
`buildCoachingPlan` for the exact Simulator persona.

---

## A. Plain-English root cause

**The generator is not broken. The name tag is.**

For an off-season athlete on 4 days with no team training, the engine builds
exactly the week the Bible wants:

```
Upper Push  →  Lower Hinge  →  Upper Pull  →  Lower Squat
```

Verified live for four different preferred-day permutations, including your
exact Simulator days (Mon/Tue/Thu/Fri):

```
Mon  Upper body - push emphasis (bench, OHP, dips) + tempo finisher (10-15min)
Tue  Hip-dominant lower (RDL, hip thrust; nordic) + easy off-feet aerobic (bike/row/ski, 15-20min)
Thu  Upper body - pull emphasis (rows, pull-ups, face pulls) + tempo finisher (10-15min)
Fri  Lower body - squat emphasis (squat, lunge, leg press; leg extension) + easy off-feet aerobic (bike/row/ski, 15-20min)
```

So why did your screen say "Full Body Strength" twice? The display-name
resolver infers movement patterns by regex over the **whole focus string,
including the finisher text**. The pull probe is `/\brow\b/` — and it matches
"bike/**row**/ski" inside the off-feet finisher. A lower day + a false "pull"
hit = lower + upper patterns = "Full Body Strength". Both lower days carry
that erg finisher, so both got renamed. Reproduced exactly:

```
"Hip-dominant lower (RDL…) + easy off-feet aerobic finisher (bike/row/ski…)"
    → patterns=[hinge, pull] → "Full Body Strength"     ← the bug
"Hip-dominant lower (RDL…)"                (finisher text removed)
    → patterns=[hinge]       → "Lower Hinge"            ← correct
```

This is a bug class we already met: Phase 1 fixed "easy bike/row" false-matching
the pull probe — but only in the **rules taxonomy** (`CONDITIONING_TEXT_RX`
gate, sessionTaxonomy.ts:91). The **naming layer** has its own duplicate
string-inference and never got the gate. Two classifiers, one patched, one not.
QA stayed green because the harness and validator classify through the *fixed*
taxonomy and never call the display-name function at all — the broken layer is
the one layer QA doesn't look at.

The conditioning monotony is a separate, real issue (see Q4), and two QA
personas are invalid (see Q6/Q7). But there is **no strength-generation bug**.

---

## B. Evidence — file/line references

| Claim | Evidence |
|---|---|
| Approved off-season core-4 structures are 2U+2L | `src/utils/coachingEngine.ts:1414-1419` — `['U-pu','L-sq','U-pl','L-hi']` etc. |
| Engine actually places 2U+2L for the Simulator persona | Live probe of `buildCoachingPlan` via `onboardingToCoachingInputs`, 4 day-permutations, all produced U-push/L-hinge/U-pull/L-squat |
| Display name computed by regex over full focus string | `src/utils/sessionNaming.ts:141-181` (`resolveSessionDisplayName` → `inferMovementPatterns(input.focus)`) |
| Pull probe matches "row" in finisher | `src/utils/sessionNaming.ts:65` — `['pull', /\bpull\b|\brow\b|…/]` |
| lower+upper patterns → "Full Body Strength" | `src/utils/sessionNaming.ts:104` |
| Focus passed in WITH finisher text at workout build | `src/data/defaultProgram.ts:1301` and `:1452` — `resolveSessionDisplayName({ …, focus: planEntry?.focus })` |
| Same bug class already fixed in taxonomy only | `src/rules/sessionTaxonomy.ts:87-92` — comment explicitly warns sessionNaming's probes aren't built for conditioning text |
| Finisher labels hardcoded, one string per category | `buildCondLabel`, `src/utils/coachingEngine.ts:~2961-2990` ("20min zone 2", "bike/row/ski, 15-20min", "10-15min tempo") |
| Off-season forces off-feet conditioning | `standaloneTempoOffFeet`, `src/utils/coachingEngine.ts:~1851-1865` — `if (seasonPhase !== 'Pre-season') return true` |
| Lower/hinge/full days forced to easy aerobic finisher | pairing gate in `finisherEligibility`, `src/utils/coachingEngine.ts:~1931-1936` |
| No skip-finisher logic; floor only | `MIN_COND_FLOOR = 2` (off-season), S+C scoring attaches to all 4 slots — probe shows `combined=true` on every day |
| Standalone conditioning HAS rotation; finishers don't | `docs/conditioning-rotation-design.md` (5 rotation axes) vs deterministic `buildCondLabel` |
| S5/S7 contradict sweep world model | `src/__tests__/scenarioQA/sweep.ts:63` — "Off-season never has team training (most clubs)" vs `weekPlanQA.ts:646-679` |
| QA never asserts on display names | `weekPlanQA.ts:399-424` builds stub workouts from `s.focus`; no call to `resolveSessionDisplayName` anywhere in the harness |

---

## Answers to the numbered questions

### Q1 — Why Upper / Full Body / Upper / Full Body?

It doesn't. The engine chooses **Upper Push / Lower Hinge / Upper Pull / Lower
Squat** — i.e. your preferred "Lower / Upper / Lower / Upper" balance, just
ordered upper-first. The Full Body labels are cosmetic mislabels of the two
lower days (root cause above). An earlier theory that the H1
consecutive-high-stress rule was suppressing lower days was tested and
disproved by the live probes — the 2U+2L shape survives every day-pattern
tried.

### Q2 — Does a true Lower Body candidate exist off-season?

Yes. `L-sq` and `L-hi` are first-class candidates and appear in every approved
off-season core-4 structure (coachingEngine.ts:1414). Nothing suppresses them —
they were both placed in your week. They just displayed under the wrong name.

### Q3 — Are the "Full Body" sessions giving enough lower stimulus?

They ARE the lower sessions. Pattern audit of the generated week:

| Pattern | Where it appears |
|---|---|
| Squat / knee-dominant | Fri: squat, lunge, leg press, leg extension |
| Hinge / hip-dominant | Tue: RDL, hip thrust, nordic (hamstring accessory) |
| Single-leg | Fri: lunge (the dedicated lower template also carries a mandatory unilateral slot) |
| Calves | Not in the focus headlines — depends on accessory pool fill; worth a separate content pass if you want guaranteed calf exposure |
| Trunk | Not a headline slot on these days; the true FB template carries a loaded-carry slot, but no true FB day was generated |
| Push | Mon: bench, OHP, dips |
| Pull | Thu: rows, pull-ups, face pulls |

**Verdict: lower-body work is adequate and badly labelled**, not thin. Squat
and hinge each get a dedicated day; push/pull balanced; single-leg present.
(For reference, a *real* Full Body template = squat + horizontal push +
horizontal pull + hinge + carry — if two of those had actually replaced the
lower days you'd have lost ~43% of lower volume and all guaranteed unilateral
work. That is not what happened.)

### Q4 — Why does every session get a similar aerobic/tempo finisher?

Four stacked causes, in order of blame:

1. **Template pools too small — the biggest one.** Combined-day finishers have
   NO pool and NO rotation. `buildCondLabel` emits exactly one hardcoded string
   per category. Standalone conditioning has a well-designed 5-axis rotation
   (category/template/feel/modality/variant); finishers got none of it.
2. **Off-feet fallback overfiring by design.** `standaloneTempoOffFeet` returns
   true for any non-pre-season phase, so all off-season conditioning reads
   bike/row/ski regardless of readiness or running budget.
3. **finisherEligibility restrictive by design (4A/4B).** Lower/hinge days →
   easy aerobic only; sprint banned; vo2 downgrades to tempo. In a 4-day
   off-season week the only reachable categories are tempo (uppers) and easy
   aerobic (lowers). Note your week was actually tempo ×2 + easy aerobic ×2 —
   category variety exists but the labels/templates make everything read the
   same.
4. **No "skip finisher" option.** Every core strength day gets an add-on; the
   only rule is a floor (≥2), never a ceiling or a "week already covered" skip.

The "20min straight erg" wording comes from two hardcoded strings: "aerobic
base finisher (20min zone 2)" and "easy off-feet aerobic finisher (bike/row/ski,
15-20min)". It's the default because it's the *only* aerobic finisher template
that exists.

### Q5 — Does the Bible ban long straight row/ski/erg work?

**The Bible file is not in the repo.** What exists: encoded fragments in
`src/rules/*` comments (Section references) and
`CONDITIONING_SESSION_INVENTORY.md`. I searched all of it — **no rule about
avoiding long straight erg prescriptions exists anywhere in the codebase.**
The inventory actually lists "Long Nasal Run 35-45min easy (rotates
run/bike/row/ski)" as the core base builder. If the Bible text says to avoid
20min-straight erg defaults, that rule was never encoded — please supply the
exact wording so it can become a rules-kernel entry instead of folklore.

### Q6 — QA scenario table (weekPlanQA.ts:607-794)

Role/position: not set by any scenario (engine defaults apply). Injuries: none
except S14. "Readiness" below = conditioningLevel / recentTrainingLoad proxy.
All scenarios run the same shared assertion set (11 structural rules + Bible
validator report-only findings); rows note the scenario-specific extras.

| Label | Human meaning | Phase | Days | Team nights | Game | Readiness | Key expectation |
|---|---|---|---|---|---|---|---|
| S1 | In-season baseline, Sat game | In | 5 (Mon-Fri) | 2 (Tue/Thu, Hard) | Sat | Good / Very consistent | G-1 light, 72h lower rule |
| S2 | In-season, Sunday game | In | 6 (Mon-Sat) | 2 (Tue/Thu) | Sun | Good / Very consistent | game-window shifts with Sun game |
| S3 | In-season, Friday night game | In | 5 (no Fri) | 2 (Tue/Thu) | Fri | Good / Very consistent | G-1/G-2 land midweek correctly |
| S4 | In-season bye week | In | 6 | 2 (Tue/Thu) | — | Good / Very consistent | bye rules; known strong finding (6 strength-classified sessions, backlog) |
| S5 | Off-season, 5 days, team Tue+Thu | Off | 5 | **2** | — | Good / Very consistent | ⚠️ see Q7 |
| **S6** | **Off-season, 4 days, no team — YOUR Simulator case** | Off | 4 (Mon/Wed/Fri/Sat) | 0 | — | Good / Pretty consistent | off-season conditioning floor ≥2; generates correctly (2U+2L) |
| **S7** | **Off-season, 6 days, team Mon+Wed+Fri** | Off | 6 | **3** (Moderate) | — | Good / Very consistent | ⚠️ invalid — see Q7 |
| S8 | In-season, atypical team days Mon+Wed | In | 5 | 2 (Mon/Wed) | Sat | Good / Very consistent | placement around non-Tue/Thu team days |
| S9 | In-season, one team night | In | 5 | 1 (Tue) | Sat | Good / Very consistent | fills the freed slot sensibly |
| S10 | In-season, 3 consecutive team nights | In | 5 | 3 (Tue/Wed/Thu) | Sat | Good / Very consistent | club-driven congestion; known soft findings accepted per Sam |
| **S11** | **Pre-season, Sat practice match, 5 days** | Pre | 5 | 2 (Tue/Thu, Hard) | Sat | Good / Very consistent | Option B target shape (Mon lower / TT+push / rec / TT+pull / gunshow / game); zero findings |
| S12 | Pre-season, no game | Pre | 5 | 2 (Tue/Thu) | — | Good / Very consistent | clean pre-season build |
| S13 | In-season, only 3 gym days, Sat game | In | 3 (M/W/F) | 2 (Tue/Thu) | Sat | Average / Pretty consistent | minimal-week integrity |
| S14 | In-season, low readiness + injuries | In | 4 | 2 (Tue/Thu) | Sat | Poor / Hardly at all; knee (moderate) + shoulder (mild) | injury/readiness damping |
| E1 | Edit: remove Sat game from S1 | In | 6 | 2 | — | as S1 | rebuild after game removal; known bye strong finding |
| E2 | Edit: move game Sat→Sun | In | 6 | 2 | Sun | as S1 | rebuild after game move |
| E3 | Edit: re-add Sat game to E1 | In | 5 | 2 | Sat | as S1 | round-trip back to S1 shape |

Names are already human-readable in the file — the mystery-label problem is
that Simulator/QA output surfaces only "S6"/"S7", not the description.

### Q7 — Stale/invalid scenarios

- **S7 is invalid, and so is S5.** Both put team training in the off-season.
  The repo's own sweep harness explicitly excludes that combination:
  `scenarioQA/sweep.ts:63` — *"Off-season never has team training (most
  clubs)"*. The Bible text isn't in the repo, but the product's encoded world
  model already says team training belongs to pre/in-season. Verdict: move S7
  to pre-season (making it a second pre-season 6-day persona) and either fix
  S5 the same way or drop its team days. Caveat: recorded Option B/4B
  baselines reference S7's current output — moving it resets those
  expectations, which should be done deliberately, not silently.
- **S11 is deliberate, not stale** — pre-season practice match, your Option B
  target scenario. It does contradict the sweep's blanket "pre-season never
  has a game" comment; rename to "Pre-season, Sat practice match, 5 days" and
  align the sweep comment (practice matches exist; formal fixtures don't).
- **The real QA gap:** no scenario asserts on display names. The harness stubs
  workout names from `s.focus` (weekPlanQA.ts:399-424) and classifies via the
  gated taxonomy — so the naming layer, the one that produced your screenshot,
  has zero coverage.

---

## C. What's actually wrong vs what's just unfinished

| Bucket | Finding |
|---|---|
| **A. Actual generation bug** | None. Strength structure, lower exposure, and balance are correct. |
| **B. Template/content issue** | Real: combined-finisher monotony. One hardcoded template per category, no pool, no rotation, no skip option, no carries/intervals variants. |
| **C. Label/classification issue** | **THE root cause.** sessionNaming infers patterns from finisher text; "row" in "bike/row/ski" → false pull → lower days renamed "Full Body Strength". Bug class fixed in taxonomy (Phase 1) but never in naming. |
| **D. QA scenario problem** | S5 + S7 (off-season team training) contradict the encoded world model; QA has no display-name assertions; scenario descriptions don't surface next to labels in output. |
| **E. Bible rule not implemented** | Long-straight-erg avoidance (if the Bible says it — not encoded anywhere, wording needed from Sam). Off-season "highest recoverable dose" intent — no block/subphase model yet (existing backlog: late-block sprinting, hard-finisher gating). |
| **F. Acceptable temporary limitation** | Uppers→tempo / lowers→easy-aerobic only, off-feet-first off-season: deliberate 4A/4B conservatism pending the block/subphase model and Sam's dose rulings. Not a regression. |

---

## D. Recommended fix order

1. **Slice 1 — label honesty (smallest systemic step, fixes the screenshot's
   worst lies).** Stop inferring patterns from strings for engine-built
   sessions: the engine already knows each day's structural type (`L-hi`,
   `U-pu`…), so emit typed `movementPatterns` on `SessionAllocation` and pass
   them through defaultProgram.ts:1301/1452 into `resolveSessionDisplayName`
   (which already accepts explicit patterns and skips inference). Keep text
   inference only as fallback for AI-named/legacy sessions, gated by the
   shared `CONDITIONING_TEXT_RX` (single classifier, exported from taxonomy).
   Kills the whole false-match class — no regex whack-a-mole.
2. **Slice 2 — QA hardening.** Display-name ↔ taxonomy agreement assertion
   across all scenarios; move S7 to pre-season; fix/drop S5's team days;
   rename S11 to say "practice match"; align the sweep comment.
3. **Slice 3 — finisher variety (needs Sam's Bible rulings first).** Small
   per-category finisher template pool riding the existing rotation axes
   (modality rotation, interval vs steady, varied durations, carries/trunk on
   upper days), plus a "skip finisher when the week is already covered" rule
   and any encoded erg-duration limit. Do NOT start until Sam supplies the
   Bible wording on erg defaults and off-season dose intent.

Out of scope, untouched per instructions: rebuild architecture, coach chat/LLM,
injury/readiness modifiers, Coach Notes, bye-week issue.

## E. Which parts Codex can implement

- **Slice 1: yes** — mechanical spec (typed patterns → naming, shared gate,
  deprecate string inference for engine sessions), clear tests, display-only
  blast radius. Watch item: coach-revision snapshots reference session names;
  a pending proposal created pre-fix could mismatch post-fix labels.
  HomeScreenV2's icon mapper already handles both label sets (lines 776-790).
- **Slice 2: yes** — test-file-only changes, but Sam must approve the S7 move
  first since it rewrites recorded baselines.
- **Slice 3: not yet** — blocked on Bible clarifications; keep with whoever
  holds the Bible context.

## F. Tests to add

1. sessionNaming unit tests: every combined focus variant — lower+off-feet
   finisher must stay "Lower Hinge"/"Lower Squat"; upper+off-feet must stay
   "Upper Push"/"Upper Pull"; true FB focus still → "Full Body Strength";
   AI-name fallback path with conditioning text must not produce strength
   labels.
2. QA harness assertion: for every scenario day, `resolveSessionDisplayName`
   output must agree with the taxonomy classification (no "Full Body" label on
   a day the kernel classifies as lower-only).
3. Off-season 4-day permutation probe as a permanent test: several
   preferred-day sets must all produce 2 upper + 2 lower dedicated days.
4. Regression: finisher text containing row/ski/bike/erg never flips a
   strength label (the Phase 1 taxonomy fix, now asserted at the naming layer
   too).
5. After the S7 move: re-baseline pre-season 6-day expectations explicitly.

---

*Probes used (kept outside the repo, in Claude's scratchpad): a
buildCoachingPlan generation probe over 4 day-permutations, and a
resolveSessionDisplayName probe over the exact generated focus strings.*
