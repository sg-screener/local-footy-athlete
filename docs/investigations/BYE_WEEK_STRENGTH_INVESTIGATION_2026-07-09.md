# Bye-Week Strength Volume Investigation — 2026-07-09 (READ-ONLY)

Scope: the S4/E1 "6 strength-classified sessions" finding surfaced in Phase 4A.
No code changed. QA harness re-run at current HEAD to confirm live numbers.
Codex's finisher skip/duration work untouched.

Verdict up front: **it is NOT truly 6 main strength days.** It is 5 real
strength exposures + 1 optional accessory day miscounted as main strength at
the QA/allocation layer, graded too harshly because the validator's existing
`byeWeek` flag is never passed by any caller. Three distinct causes, one small
generation gap on top.

---

## 1. What the bye-week scenario actually generates (S4 and E1 — identical output)

Profile: In-season, no game, 6 days Mon–Sat, team training Tue+Thu (Hard),
readiness high → Core 3, Optional 2, Recovery 1.

| Day | Session (focus) | Tier | Source | Stress | Kernel units | Main strength? | Optional/accessory? |
|---|---|---|---|---|---|---|---|
| Mon | Lower body strength | core | bye branch step "regular core" (coachingEngine.ts ~1074-1089) | HIGH | lower_strength | YES | no |
| Tue | Team training + Upper body - push emphasis | core (promoted) | bye branch team pre-seed (~1044-1067) + universal team-day label pass (~4094) | HIGH (hard TT) | team_training + upper_strength | YES (the upper unit) | no — but it's a stacked add-on, not a standalone gym day |
| Wed | Lower body strength | core | **NOT the bye branch.** Raw branch emitted Upper-pull here; the region-adjacency pass Strategy 3 (enforceAdjacentRegionLimit, ~5310) flipped the middle of the Tue-Wed-Thu upper-upper-upper run to "Lower body strength" | HIGH | lower_strength | YES | no |
| Thu | Team training + Upper body - pull emphasis | core (promoted) | same as Tue | HIGH (hard TT) | team_training + upper_strength | YES (the upper unit) | no |
| Fri | Upper body hypertrophy / trunk & accessory work | optional | getOptionalFocus() in-season string (~5338) | LOW/MED | **upper_strength at QA/allocation layer; gunshow_prehab in live-local resolution** | **the disputed 6th** | YES — resolves live to "Gunshow": Bicep Curls, Tricep Pushdowns, Face Pulls, Calf Raises, Pallof Press (defaultProgram.ts:613,636-643). Zero main lifts. |
| Sat | Lower body strength + conditioning emphasis (no game this week - build capacity) | core | bye branch Saturday "bonus" block (~1114-1123) | HIGH | lower_strength only — **the conditioning half carries NO metadata** (no hasCombinedConditioning / conditioningCategory on the allocation) so no conditioning unit is ever counted, and live-local names it plain "Lower Squat" | YES | no |
| Sun | (off) | — | bye branch forces Sunday recovery/off | — | — | — | — |

Kernel counts (QA, confirmed by re-run): mainStrength **6**, hardDays **5**
(Mon/Tue/Wed/Thu/Sat), conditioningExposures **2** (the two team days only).
Findings: `[strong] cap_maxMainStrengthSessions_over 6>4`,
`[soft] cap_maxHardDays_over 5>4` (non-bye wording), `[info] cond under 2<3`.

## 2. Why it reaches 6

6 = 5 genuine strength exposures (3 lower standalone + 2 upper stacked on team
days) + 1 miscount:

- The 3 lower days are real: Mon (branch), Sat (deliberate bonus), Wed
  (adjacency flip side-effect — the branch itself only intended 1 early lower).
- Tue/Thu team-day uppers legitimately count per Bible 17.A ("upper strength +
  team training = 1 hard day, 2 exposures").
- Fri is the miscount. So it is **not** 6 proper strength days; live-local
  resolution actually produces 5 main strength + 1 gunshow.

## 3. How the kernel classifies each day

See table. The Fri instability is the interesting one:

- QA/allocation layer: the workout stub's NAME is the focus string. GUNSHOW_RX
  (`/…accessor…/`) matches → nameLooksGunshow → taxonomy uses name-only
  inference — but the canonical REGION fallback added 2026-07-08
  (sessionTaxonomy.ts:190-191, `/\bupper[- ]body\b/`) fires on "Upper body
  hypertrophy…" and returns `upper_strength`, overriding the gunshow branch
  (line 317 requires `!isStrengthSession`). This is why the finding is "newly
  visible" — before the region-name fix, Fri classified as gunshow.
- Live-local layer: fallbackNameForPlanEntry renames the day "Gunshow"
  (no region token) → `gunshow_prehab`. Correct.

Same session, two different categories depending on which layer named it —
the same duplicate-classifier/lossy-name bug class as the sessionNaming and
S6 'accessor' fixes.

## 4. Is Friday really main strength?

No. Its live content is pure gunshow tier (curls/pushdowns/face pulls/calves/
pallof). Per Bible 17.A "Gunshow, accessories, mobility, recovery do NOT
count" — it should be gunshow/accessory and NOT count toward the 4-strength
cap, **unless** a session actually contains main-lift work (exercise-proof),
which this one never does.

## 5. Does the bye branch intentionally add strength?

Yes, twice — once deliberately, once accidentally:

- Deliberate: coachingEngine.ts:965-1123, philosophy comment "No game = freed
  recovery window. Use it to build, not coast." Saturday becomes a core lower
  "bonus" day; Sunday forced off.
- Accidental: the adjacency pass (Strategy 3 focus-flip) converts the planned
  Wed upper into a 3rd lower because Tue/Wed/Thu would otherwise be 3
  consecutive upper days and the team days can't move.

Also relevant: the validator ALREADY has bye-week softening (weekFlags.byeWeek
— +1 cap overshoot → info; 5 hard days → info) **but no production or QA call
site passes it** (weekPlanQA.ts:833, logAllocationWeekValidation, and
coachRevisionOverrideWriter all omit weekFlags). weekLogBuilder.ts:78 already
derives `byeWeek` but nobody feeds it to the validator.

## 6. Are there too many lower exposures?

Leaning yes, and the balance is off:

- 3 lower standalone vs 2 upper (both stacked on team days, i.e. ~30-min
  add-ons) + 1 accessory upper. Squat/hinge subtype is NOT alternated — the
  bye branch emits generic `strengthPattern: 'lower'` and live-local fallback
  names all three "Lower Squat" (pool rotation varies exercises but the branch
  gives no hinge guarantee; H2 same-subtype spacing lives only in the
  off/pre-season scorer).
- Conditioning: effectively ZERO app conditioning (2 counted exposures are
  team training). Saturday's promised "conditioning emphasis" is words in a
  focus string with no metadata — a bye week ends up with LESS conditioning
  than a game week, contradicting the branch's own "build capacity" intent.

## 7. What the correct bye rule should be (proposed Bible wording, needs Sam sign-off)

- A bye week may train more than a game week: up to 5 hard days acceptable
  (upper edge, not target), 6+ never.
- Main strength stays capped at 4; a bye week may sit at 4 (vs the in-season
  typical 3). +1 overshoot on bye = info, not strong.
- Optional hypertrophy/gunshow/accessory days do NOT count toward the main
  strength cap unless they contain real main-lift work (exercise-proof).
- The bye "bonus" should restore balance and capacity, not stack a 3rd lower:
  prefer 2 lower + 2 upper main exposures + a REAL conditioning component
  (metadata-carrying, per Bible finisher rules §10 distinction).

---

# Report

## A. Root cause

Three stacked causes, no single bug:

1. **Classification** (the "6"): taxonomy's canonical region-name fallback
   overrides the gunshow guard for accessory-named sessions whose focus string
   contains a region word. Fri optional counts as `upper_strength` at the
   allocation/QA layer while its actual content is gunshow tier.
2. **Validator wiring** (the "strong"): `weekFlags.byeWeek` exists and grades
   correctly, but no caller passes it, so bye weeks are graded as ordinary
   in-season weeks.
3. **Generation** (the real-volume question): the bye branch + adjacency flip
   produce 3 standalone lower days with no hinge/subtype control, and
   Saturday's conditioning emphasis carries no conditioning metadata → zero
   app conditioning.

Not a stale QA scenario — S4/E1 are valid worlds and reproduce at HEAD.

## B. Files involved

- `src/rules/sessionTaxonomy.ts` (region-name fallback vs GUNSHOW_RX, lines ~179-216, 296-308)
- `src/rules/weekStructureValidator.ts` (byeWeek grading exists ~404-476; logAllocationWeekValidation lacks weekFlags param ~585)
- `src/__tests__/weekPlanQA.ts` (validator call without weekFlags, ~833)
- `src/utils/coachRevisionOverrideWriter.ts` (logWeekValidation without profile/weekFlags, ~151)
- `src/utils/coachingEngine.ts` (bye branch 965-1123; adjacency Strategy 3 ~5310; getOptionalFocus ~5338)
- `src/utils/weekLogBuilder.ts` (byeWeek already derived, :78)
- `src/data/defaultProgram.ts` (Gunshow fallback name/content 604-643 — behaves correctly today; reference only)

## C. Generation vs classification vs validator

- Classification issue: YES (Fri miscount, layer-dependent).
- Validator issue: YES (bye flag never wired; severity inflated strong vs info).
- Generation issue: PARTIAL (5 real strength exposures = exactly at Sam's
  5-hard-day upper edge, defensible for bye; but 3×lower imbalance, no hinge
  control, and the empty Saturday conditioning promise are real gaps).
- Stale QA scenario: NO.

## D. Proposed fix options (smallest systemic first)

- **Fix 1 — taxonomy truth (smallest, systemic):** in sessionTaxonomy, when
  `nameLooksGunshow` and the session has no strength-proving exercises, do not
  let the region-name fallback produce a main-strength category — classify
  gunshow_prehab. Exercise-proof main lifts still win (a "gunshow" containing
  bench presses counts as strength). Fixes every accessory-named session
  globally, S4/E1 count 6 → 5. Kernel is findings-only → zero live behaviour
  change.
- **Fix 2 — wire byeWeek (small, systemic):** add `weekFlags` plumbing to
  logAllocationWeekValidation + weekPlanQA + coachRevisionOverrideWriter,
  computing `byeWeek = seasonPhase === 'In-season' && no game this week`
  (do NOT reuse weekLogBuilder's bare `games===0`, which would also flag all
  off-season weeks and suppress their under-training nags). S4/E1 then read:
  mainStrength 5 vs 4 = +1 on bye → info; 5 hard days on bye → info.
- **Fix 3 — bye-branch generation (needs Sam's ruling, defer):** cap bye-week
  standalone lower at 2 (adjacency flip should prefer FB or push/pull re-space
  over minting a 3rd lower), and make Saturday's conditioning emphasis real by
  setting hasCombinedConditioning + conditioningCategory on the allocation so
  it flows through finisherEligibility as a conditioning COMPONENT (Bible §10),
  not a finisher. **Touches the code Codex is currently in — do not start
  until finisher slices land.**

Recommended: approve Fix 1 + Fix 2 now (measurement honesty first — same
doctrine as the S6 resolution); rule on Fix 3 after Codex's finisher work.

## E. Tests to add

1. Taxonomy: "Upper body hypertrophy / trunk & accessory work", wt=Strength,
   no exercises → gunshow_prehab (not upper_strength).
2. Taxonomy: gunshow-named session WITH bench press in exercises → upper_strength.
3. Taxonomy regression: "Lower Body Strength" region-name (no exercises) still
   → lower_strength (don't break the 2026-07-08 fix).
4. Validator: in-season no-game week, 5 main strength, byeWeek flag → info;
   6 → strong; same week without flag → strong (grading unchanged for
   game weeks).
5. QA fidelity: S4/E1 expected counts mainStrength=5, plus assertion that the
   QA validator call passes byeWeek for no-game in-season scenarios.
6. (With Fix 3 only) bye branch: ≤2 standalone lower, Saturday allocation
   carries conditioning metadata, week conditioningExposures ≥3.

## F. Behaviour risk

- Fix 1: rules-kernel only (log/QA counts change, no scheduling change). Risk:
  under-counting a real strength day whose name contains "accessory" AND whose
  exercise list is empty at classification time — allocation-level stubs are
  exactly the layer where we WANT the optional tier not to count, so this is
  the desired direction. Watch: recorded QA baselines (S4/E1 strongs disappear
  → update the known-findings ledger).
- Fix 2: log-only severity changes; must scope byeWeek to in-season to avoid
  suppressing off-season under-training findings. QA output text changes.
- Fix 3: real generated-week changes in-season bye (S4/E1/E3-adjacent);
  interacts with finisher eligibility and Saturday content — needs Simulator
  verification and must wait for Codex.

## G. Codex-implementable?

- Fix 1 + Fix 2 + tests 1-5: YES, after approval — isolated from finisher
  skip/duration files (sessionTaxonomy, weekStructureValidator call sites,
  weekPlanQA). No conflict with Codex's current work.
- Fix 3: NOT yet — same territory as the finisher implementation
  (coachingEngine tail passes / eligibility). Sequence it after Codex lands.
