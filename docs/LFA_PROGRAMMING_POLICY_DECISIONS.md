# LFA Programming Policy Decision Report

**Status:** Sam’s approved policy recorded. The Section 18 phase-planner ownership slice is implemented on `main` in commit `49073d393c19571b39fecf53051f3e3c5fdea452`; historical pre-implementation evidence is retained below and labelled as such.
**Bible authority:** `docs/LFA_PROGRAMMING_BIBLE.md` Section 18, approved 14 July 2026, supersedes older contradictory examples.
**Evidence date:** 14 July 2026.
**Fixed scenario weeks:** Monday 13 July, 20 July, 27 July, 3 August and 10 August 2026.

## Final approval summary — 14 July 2026

Sam approved the phase frequencies, anchor credit, genuine sprint definition, readiness/injury/equipment precedence, deload structure, strength-pattern default, full-rest definition and hard-day limits recorded in Bible Section 18. Sam then resolved the final five questions: practice matches, bye-recovery conditioning, off-season progression, multi-pattern credit/balance and field-action power credit. The original scenario outputs below remain historical evidence of production behaviour before the Section 18 phase-planner implementation; approval of a policy did **not** approve those conflicting outputs.

The five formerly open decisions are now locked:

1. Practice-match weeks use S3 with 1–2 TT and S3–4/default3 with 0 TT, plus the approved 0–2 TT conditioning top-ups.
2. Bye recovery uses exactly 2 lighter lifts and the approved 0/1/2+ TT light-conditioning table.
3. The first Off-season block is early/early/mid/mid without a Week 4 deload; late Off-season then continues until the user changes phase.
4. Multi-pattern credit requires meaningful main-strength work, with equal or near-equal weekly main-lift balance by default.
5. Field activity never receives automatic formal power-primer credit; power has no required weekly numeric minimum.

**No coaching-policy decisions remain unresolved as of 14 July 2026.**

## Section 18 phase-planner implementation record — 14 July 2026

Commit `49073d393c19571b39fecf53051f3e3c5fdea452` implements the approved phase-planner ownership boundary without changing the phase clock or Section 18 safety finaliser. The Programming Bible remains the coaching authority; this section records how the approved policy now survives production paths.

### Ownership order

For every mode, production now resolves the canonical phase/subphase, reads the required/default/preferred/maximum table, applies typed constraints, selects the phase-owned target, credits qualifying anchors, allocates core work, then adds optional work. Selection occurs before weekday allocation. Weekday geometry, recovery placeholders, gunshow/accessories and optional flush work cannot choose the target or rewrite it to match a deficient week.

The detailed conditioning identities are:

| Identity | Production meaning and ledger treatment |
| --- | --- |
| `required_core` | App conditioning required after qualifying anchor credit to meet the mode's required core minimum. Counts as core and retains required intensity. |
| `planner_selected_core` | Additional core conditioning selected within the approved phase table. Counts as core. |
| `optional_flush` | Optional light flush. Excluded from core totals and cannot repair a core shortfall. |
| `optional_recovery_aerobic` | Optional recovery aerobic work permitted by bye-recovery or early-off-season policy. Excluded from core totals, non-hard, and cannot replace strength or rest. |
| `legacy_unknown` | Compatibility identity only. It cannot be silently promoted to core credit. |

The detailed identity is preserved from allocation into the canonical workout. The unchanged safety finaliser may consume an aggregate `core` projection, but that compatibility projection does not erase `required_core` versus `planner_selected_core` ownership or admit optional work to the core ledger.

### Implemented phase selections

| Mode | Normal phase-owned selection and constrained behaviour |
| --- | --- |
| In-season game | S3 when safe; S2 only with typed constraint ownership. Core C3 is game/TT credit plus 0/1/2 app core for 2/1/0 TT. Required game-week app intensity and G-3-or-earlier placement are retained. |
| Bye build | Normally S3/C3/sprint1. Strong readiness, sufficient availability and low TT may select S4. S2 is valid only with a typed constraint. App C is 3/2/1/0 for 0/1/2/3 TT. |
| Bye recovery | Exactly two lighter strength sessions, no power and no compulsory hard app conditioning. Light recovery aerobic is 1–2 programmed/one optional/none additional for 0/1/2+ TT. |
| Early off-season | Core S0/C0. Planner-selected S2–3 and C1–2 remain optional, within S3/C3 maxima, with zero valid and no required sprint or power. |
| Mid off-season | Normally S4, selected core C3 within the approved C3–4 range, sprint1 and no more than one hard conditioning exposure. Three available days may produce typed S3/C3; beginner uses S2/C2–3/safe sprint1. |
| Late off-season | Normally S4/C4/sprint1. A second sprint is permitted only within the controlled-volume maximum of two. Later blocks remain late until the athlete changes phase. |
| Pre-season | Minimum S3/C3, default and maximum S4/C4. Qualifying TT replaces app conditioning only. Pure TT never receives strength credit or fallback main-strength rows. Progression continues across blocks. |
| Practice match | S3 by default for 0–2 TT. PM plus TT/app work produces core C3, with 0/1/2 app core for 2/1/0 TT. PM-2 flush remains optional and lower strength stays early enough. |

Constraint paths use typed reductions for availability, readiness, injury, participation, training age, deload, spacing, full pause and equipment infeasibility. A reduction records its domain and must survive canonical generation. Equipment substitution before reduction, the general weekly power budget and full-rest ledger remain separately owned policy/implementation slices; this phase-planner commit neither weakens nor claims to close those boundaries.

### Anchor, strength and cross-path ownership

Normal unrestricted TT and normal game/practice-match participation receive conditioning credit. Sprint credit additionally requires genuine high-speed participation. Anchor identity alone never receives main-strength credit: a TT day counts as strength only when a separate deliberate app-authored main-strength contribution is present. Games and practice matches never count as strength.

Squat, hinge, push and pull credit requires a meaningful main-lift contribution. The allocator restores missing safe patterns, balances meaningful counts and excludes accessories, gunshow and pure TT from main-strength credit.

Initial generation, edge Week 1, deterministic fallback, rebuild, rollover and persistence/rehydration preserve the phase-owned contract and typed conditioning identity. Repeat Week compares the source and target phase-table signature—mode plus selected strength, conditioning and sprint targets. If the signature differs, it regenerates from the target phase table; if it matches, source prescriptions may remain, but target anchors, constraints and final validation still win.

## Historical audit result

Forty-five representative weeks were run through the real local production pipeline before the Section 18 phase-planner implementation. Every week was accepted by the then-current exposure validator and reported no unresolved shortfall. That was **not** proof that every week followed the Bible: the validator checked the code-owned contract, did not generally enforce exposure maxima, and could accept a final week that exceeded a reduced target or was misclassified.

| Primary row classification | Count |
| --- | ---: |
| Bible clear, code correct | 11 |
| Valid phase-specific exception | 3 |
| **Clear agreements (the two rows above)** | **14** |
| Bible clear, code incorrect | 12 |
| Bible and code conflict internally | 5 |
| **Bible/code conflicts (the two rows above)** | **17** |
| Bible unclear at audit time, code made a policy choice | 14 |
| **Total scenarios** | **45** |

The highest-risk findings at audit time were:

1. A canonical **Team Training** workout can contain `DB Bench Press`, so the final ledger counts it as main strength. Healthy pre-season weeks with team training therefore achieve 5 lifts against a Bible and contract target of 4; the beginner week achieves 4 against a reduced target of 2.
2. Low-readiness and lower-body-injury reductions can be correct in the contract but not survive into the final canonical week. The final week can exceed the reduced strength target, restore a prohibited squat pattern, or retain power primers.
3. Limited or bodyweight/no-cardio equipment makes all app conditioning “infeasible”, even when running, walking or a bodyweight conditioning substitution could be available. This reduces off-season conditioning to 0 and pre-season conditioning to team-training anchors only.
4. A healthy in-season Week 4 does not automatically become bye recovery. In-season automatic deload resolution always remains a build week, while the recovery contract exists behind readiness/injury/deload or an explicit `byeMode` that normal coaching inputs do not expose.
5. Recovery cards were counted as full-rest days, although approved policy defines them as active recovery. Practice-match code could also reduce pre-season conditioning to 1, below the approved minimum of 3.

The phase-planner implementation closes the TT-as-strength, target-selection, optional-as-core, practice-match frequency, pattern-repair and canonical reduction-survival defects described above. Equipment substitution, general weekly power-budget policy and full-rest ledger ownership remain separately tracked; the historical rows below are not a statement that every original defect remains current.

## Executive decision checklist

### 1. In-season

- [x] [Set exact strength minimum, preferred range and normal selection for game weeks](#in-season-policy-decisions).
- [x] [Set additional conditioning when there are 0, 1 or 2 team sessions plus a game](#in-season-policy-decisions).
- [x] [Confirm fixed anchors and make declared availability govern additional app sessions](#in-season-policy-decisions).
- [x] [Confirm that “no-game in-season” means bye build or bye recovery](#in-season-policy-decisions).

### 2. Bye weeks

- [x] [Choose how a healthy athlete selects bye build versus bye recovery](#bye-policy-decisions).
- [x] [Set bye-build strength at required 2, normal 3, conditional 4](#bye-policy-decisions).
- [x] [Set the 3-exposure conditioning target and 0–3 TT top-up table](#bye-policy-decisions).
- [x] [Confirm that gunshow/accessory work never replaces required strength or conditioning](#bye-policy-decisions).
- [x] [Confirm recovery-mode strength, sprint, full-rest and team-training treatment](#bye-policy-decisions).
- [x] [Set the 0/1/2+ TT light-conditioning table for bye recovery](#bye-policy-decisions).

### 3. Early off-season

- [x] [Define what “all sessions optional for the first 1–2 weeks” means operationally](#early-off-season-policy-decisions).
- [x] [Set the preferred and maximum optional strength and aerobic work](#early-off-season-policy-decisions).
- [x] [Confirm that early off-season has no required running or sprint exposure](#early-off-season-policy-decisions).

### 4. Mid off-season

- [x] [Set exact strength and conditioning minimum, preferred range and normal selected target](#mid-off-season-policy-decisions).
- [x] [Confirm four available days normally produce 4 lifts while three days may produce 3](#mid-off-season-policy-decisions).
- [x] [Set beginner frequency and prefer only 1–2 eligible power primers](#mid-off-season-policy-decisions).

### 5. Late off-season

- [x] [Set build-week strength and conditioning frequencies](#late-off-season-policy-decisions).
- [x] [Keep the first block early/early/mid/mid, then continue late off-season until the user changes phase](#late-off-season-policy-decisions).
- [x] [Confirm late-off-season deload frequency versus dose changes](#late-off-season-policy-decisions).

### 6. Pre-season

- [x] [Set pre-season minimum 3, default 4 and maximum 4 for strength and core conditioning](#pre-season-policy-decisions).
- [x] [Confirm that qualifying team training receives conditioning credit but never strength credit](#pre-season-policy-decisions).
- [x] [Set exact practice-match strength and conditioning policy for 0–2 accompanying team sessions](#pre-season-policy-decisions).
- [x] [Confirm early/mid/late pre-season progression continues across blocks](#pre-season-policy-decisions).

### 7. Deloads

- [x] [Set which phases automatically deload on Week 4](#deload-policy-decisions).
- [x] [Preserve frequency where possible and reduce dose/intensity first](#deload-policy-decisions).
- [x] [Confirm that one sprint exposure normally remains at controlled dose](#deload-policy-decisions).

### 8. Readiness, injury and equipment

- [x] [Define what low/cooked readiness reduces and remove power](#constraint-policy-decisions).
- [x] [Define affected-pattern, sprint and team-training rules for injuries](#constraint-policy-decisions).
- [x] [Require substitution before frequency reduction for limited equipment](#constraint-policy-decisions).
- [x] [Define when a constrained week must repair, regenerate or safely reject](#constraint-policy-decisions).

### 9. Strength-pattern policy

- [x] [Default push, pull, squat and hinge to every healthy relevant week, with a two-week fallback only when genuinely constrained](#strength-pattern-policy-decisions).
- [x] [Set injury-safe required and prohibited patterns](#strength-pattern-policy-decisions).
- [x] [Credit only meaningful multi-pattern main work and require near-equal weekly balance by default](#strength-pattern-policy-decisions).

### 10. Conditioning and sprint credit

- [x] [Define a genuine sprint/high-speed exposure](#conditioning-and-sprint-credit-decisions).
- [x] [Give team training sprint credit only for expected and completed high-speed work](#conditioning-and-sprint-credit-decisions).
- [x] [Confirm game and practice-match credit and no unnecessary top-up after the floor is met](#conditioning-and-sprint-credit-decisions).
- [x] [Confirm field actions never receive automatic formal power-primer credit](#conditioning-and-sprint-credit-decisions).

### 11. Rest and hard days

- [x] [Set minimum/preferred full-rest days and a normal maximum of 4 programmed hard days](#rest-and-hard-day-policy-decisions).
- [x] [Define recovery/flush workouts as active recovery, not full rest](#rest-and-hard-day-policy-decisions).
- [x] [Prefer compatible stress stacking over spreading hard work across the week](#rest-and-hard-day-policy-decisions).

## How to read the evidence

### Global definitions

| Term | Meaning in this report | Implementation after `49073d393c19571b39fecf53051f3e3c5fdea452` |
| --- | --- | --- |
| Required minimum | The floor the week must satisfy unless an authorised reduction changes it. | Contract v2 stores it separately from the selected target; allocation and final effective-week validation reject an unresolved shortfall. |
| Preferred range | A coaching preference, not a compulsory floor or cap. | The phase planner may select within it only after constraints; it is never inferred from weekday geometry or optional work. |
| Permitted maximum | The highest normally safe exposure count. | Contract v2 records and observes phase maxima. The phase selection is clamped before allocation and maximum breaches remain visible findings. |
| Planner-selected optional work | Work the planner may add if availability, goals and safety allow. | Early-off-season and recovery aerobic work remains explicitly optional/non-core and does not rewrite the core target. |
| Core conditioning identity | Core app work is either `required_core` or `planner_selected_core`. | Both count as core; required intensity survives canonical construction. `optional_flush` and `optional_recovery_aerobic` are excluded. |
| Team-training credit | A qualifying team session counts as conditioning and receives sprint credit only for genuine high-speed participation. | TT anchor identity never counts as strength. Pure TT canonical fallback rows cannot manufacture a main-strength exposure. |
| Game/practice-match credit | Normal participation counts as conditioning, sprint/high-speed and hard-day anchor credit. | The target mode credits the anchor before app top-ups. Neither game nor practice match counts as strength. |
| Authorised reduction | A typed reason that explicitly lowers a normal target. | The domain/reason survives allocation and canonical generation; final output that contradicts it is invalid. |
| Dose/intensity change | Sets, reps, duration, speed, load or effort change while exposure frequency stays the same. | The Bible explicitly uses this distinction for pre-season progression and normally for deload sprint exposure. |
| Exposure-frequency change | The number of weekly strength, conditioning or sprint exposures changes. | This should occur only when the phase policy or an explicit authorised reason permits it. |
| Anchor | A real-world team session, game or practice match that must remain in the effective week. | Anchors are unioned into selected days. A declared 3-day week can therefore finish with more than 3 active days. |
| Final effective ledger | Counts from the final visible canonical workouts, after recurring team/game anchors and session classification. | It uses typed core/optional conditioning ownership and meaningful main-lift evidence, not display names or planner intent alone. |

The contract has no weekly numeric power minimum. Power is currently **eligibility-only**: the policy decides whether a safe primer may be inserted, then the workout builder may add one. Team training and games do not receive explicit power credit.

### Authorised reduction reasons currently available

The exact typed reasons in production are:

`insufficient_availability`, `low_readiness`, `injury_restriction`, `equipment_infeasibility`, `game_load_protection`, `practice_match_load`, `bye_recovery_mode`, `deload_policy`, `spacing_safety_conflict`, `training_age_limit`, `full_pause`, and `explicit_user_override`.

The report records only reasons actually emitted in each run. Repeated reasons in the raw contract have been collapsed to one label here.

### Bible policies applied

These short references keep the scenario tables readable. They are summaries, not replacements for the Bible.

| Ref | Current Bible policy |
| --- | --- |
| B-GLOBAL | Section 18 is final authority for approved exposure policy. Required, preferred/default, maximum and optional work are distinct. Gunshow/accessories never count as main strength. Fixed anchors remain; declared availability governs additional app sessions. |
| B-PLANNER | Select the canonical phase target after typed constraints and before weekday allocation. Credit qualifying anchors, allocate `required_core` then `planner_selected_core`, add optional work last, preserve ownership through canonical validation, and regenerate Repeat Week from the target table when its signature differs. This reference applies to every scenario row. |
| B-IS | Strength is 2 required, 2–3 preferred, 4 maximum, with all four patterns where possible. Conditioning top-ups are: 2TT+game 0; 1TT+game 1 hard on G-3 or earlier; 0TT+game 2 medium-to-hard on G-3 or earlier. Sprint minimum is 1 with genuine anchor credit only. |
| B-BYE | Normal/high readiness defaults to build; low/cooked, meaningful injury or explicit choice selects recovery. Build normally selects 3 lifts (required 2, preferred 3–4, max 4), targets 3 meaningful conditioning exposures including TT, and requires 1 genuine sprint. Recovery uses exactly 2 lighter lifts, no power and minimum2/preferred3 full-rest days. Recovery conditioning is 1–2 light sessions with 0TT, 1 optional light session with 1TT, and no additional work with 2+TT. |
| B-OSE | First 1–2 weeks: everything optional and zero sessions valid. Strength 0 / 2–3 / 3; conditioning 0 / 1–2 light / 3; no hard conditioning, power or required sprint/running; prefer 3–4 full-rest days. |
| B-OSM/L | Mid: S3/4/4, C3/3–4/5 with max 1 hard, sprint min 1, power 1–2 preferred. Late: S3/4/4, C3/4/5 with 1–2 hard, sprint 1/1–2/2, power 1–2 preferred. Both default to all four patterns and prefer 2 full-rest days. |
| B-PS | Across early/mid/late: strength and core conditioning are minimum 3, default 4, maximum 4. TT counts only toward conditioning, never strength. Sprint minimum is 1 with participation-qualified credit. Pre-season progression continues across blocks. |
| B-DELOAD | Pre-season automatically deloads every fourth week. The first Off-season block is early/early/mid/mid and explicitly does not deload at Week 4; later late-off-season blocks may use the fourth-week deload policy. Preserve frequency where possible, reduce dose first, preserve one controlled sprint and remove power. |
| B-CONSTRAINT | Low readiness removes power and reduces dose first. Injury records safe and prohibited patterns and removes affected work. TT credit requires qualifying participation. Equipment substitution precedes reduction. A final week contradicting its reduction is invalid and must repair/regenerate or safely fall back. |
| B-PATTERN | Default all four patterns every healthy relevant week with equal or near-equal meaningful main-lift counts. Multi-pattern credit requires a meaningful main contribution to each pattern; token accessories never credit it. Restore missed safe patterns; prohibited injury patterns never receive credit. |
| B-REST | Recovery/flush is active recovery, not full rest. Phase rest targets are explicit in Section 18. Normal programmed hard-day maximum is 4; 5 is allowed only through unavoidable anchors. Prefer compatible stress stacking. |

### Baseline minimum, preference, maximum and optional-work comparison

This table deliberately does not turn a preferred range into a requirement. “Bible max” means the normal stated ceiling before an explicit user override or authorised safety/feasibility decision. “Not fixed” is a decision gap, not permission for unlimited work.

| Mode | Main strength: production required / preferred | Conditioning: production required / preferred | Sprint: production required / preferred | Bible normal maximums | Planner-selected optional/current target behaviour |
| --- | --- | --- | --- | --- | --- |
| In-season game | 2 / 2–3 | 3 total from qualifying anchors plus approved top-ups | 1 / 1 | S4; normal programmed hard days 4 | Planner defaults to S3 when safe and reduces to S2 only with typed ownership. App C is 0/1/2 after 2/1/0 TT plus game; optional flush never credits core C. |
| Bye build | 2 / normally 3, preferred 3–4 | 3 total / 3 | 1 / 1 | S4; normal programmed hard days 4 | Approved app C is 3/2/1/0 after 0/1/2/3 qualifying TT. Gunshow never credits S/C. |
| Bye recovery | exactly 2 lighter / exactly 2 | No hard app C. 0TT: program 1–2 light; 1TT: optional 1 light; 2+TT: no additional | Preserve 1 unless explicitly reduced | No power; hard-day max 4; rest min2/prefer3 | Light aerobic/flush work is recovery-focused and cannot replace strength or preferred rest. |
| Early off-season | 0 / 2–3 | 0 / 1–2 light | 0 / 0 | S3; C3; no hard C | All work remains optional and non-compulsory; zero is valid. |
| Mid off-season build | 3 / 4 | 3 / 3–4 | 1 / 1 | S4; C5; max1 hard C; power prefer1–2 | Normally select S4 with at least four available days; beginner is S2/C2–3/safe sprint1. |
| Late off-season build | 3 / 4 | 3 / 4 | 1 / 1–2 | S4; C5; sprint2; 1–2 hard C; power prefer1–2 | Normally select S4 and cover all patterns. |
| Healthy pre-season build | 3 / default 4 | 3 total / default 4 | 1 / 1 | S4; core C4; normal programmed hard days4 | TT never credits S. Qualifying TT replaces only the matching amount of app core C; flush is non-core. |
| Practice match | 2TT: S3; 1TT: S3; 0TT: S3–4/default3 | Core C3 from anchors plus 0/1/2 app after 2/1/0TT | 1 / 1 | Normal PM credits C1/sprint1/hard1; allow1–2 early primers/max2; hard max4; rest prefer2 | Planner selects S3 by default and fills C3 from PM/TT plus the approved app remainder. TT/PM never credit strength; optional flush/gunshow never fill core requirements. |
| Deload | Preserve phase S frequency where possible | Preserve phase C frequency where possible; late off-season may reduce by 1 | Preserve 1 controlled exposure | First early/mid block W4 never auto-deloads; pre-season remains min3/default4; no power | First-block off-season W4 remains mid build; later late-block reductions and pre-season deloads retain the canonical phase table with typed reductions. |

Contract v2 records `permittedMaximum` separately from required, default, preferred and selected targets. Phase selection is clamped before allocation, and the effective-week observer reports any maximum breach. The legacy compatibility contract remains available to existing consumers but no longer owns the Section 18 phase-table maximum.

### Production paths inspected

| Stage | Production source | What it owns |
| --- | --- | --- |
| Section 18 policy contract | `src/rules/weeklyExposureContractV2.ts` | Canonical phase/mode required, default, preferred and maximum tables; phase-owned selection; core/optional conditioning identities; anchor and safety policy. |
| Compatibility contract construction | `src/rules/weeklyExposureContractBuilders.ts` | Projects the same selected phase target into existing allocation consumers and applies typed availability/readiness/injury/training-age/spacing reductions. |
| Planner and allocation boundary | `src/utils/coachingEngine.ts` | Resolves the canonical mode, selects targets before weekdays, credits anchors, allocates required and planner-selected core work, adds optional work last, repairs patterns and rejects unresolved allocation shortfalls. |
| Allocation/effective validation | `src/rules/weeklyExposureContract.ts` and `src/rules/section18EffectiveWeekEvaluator.ts` | Keeps optional conditioning out of core totals, validates required/selected targets, observes maxima and reductions, and builds the final effective ledger. |
| Canonical generation | `src/services/api/generateProgram.ts`, `src/data/defaultProgram.ts` and `src/rules/section18WorkoutEvidence.ts` | Rebuilds planned intent into visible workouts, preserves detailed conditioning ownership, prevents pure TT fallback strength and counts only meaningful main-lift evidence. |
| Final visible week | `src/utils/sessionResolver.ts` | Resolves recurring team training and game/practice-match anchors into the visible schedule. |
| Repeat Week | `src/utils/repeatWeek.ts` | Compares source/target phase-table signatures; regenerates from the target table when they differ and always applies target anchors/contracts. |
| Phase/week mode | `src/rules/offseasonSubphase.ts`, `src/rules/preseasonSubphase.ts`, `src/rules/deloadWeekRules.ts` | Resolves early/mid/late and build/deload semantics. |
| Readiness/injury/power/equipment | `src/rules/trainingAgePolicy.ts`, `src/rules/powerPrimerPolicy.ts`, `src/rules/conditioningFeasibility.ts` and injury policy modules | Applies constraint-specific eligibility and reductions. |

The API path may use edge-authored Week 1 content while later weeks use deterministic fallback. Both routes now consume the same phase-owned target, preserve typed ownership through canonical construction and converge on final Section 18 validation. The fixed-date historical evidence below used `generateProgramLocally`; no remote AI output is treated as policy authority.

## Scenario notation

- Setup: `D` = declared available days; `TT` = team-training sessions; `G` = game; `PM` = practice match; `N/H/L` = normal/high/low readiness; `Full/Ltd/BW` = full gym/limited/bodyweight-no-cardio; `Exp/Beg` = experienced/beginner; injury number is severity out of 10.
- Strength: `required / preferred / selected target → final`; patterns are `Sq` squat, `Hg` hinge, `Pu` push and `Pl` pull.
- Conditioning: `required / preferred / selected target → final`; credits are `TT + G/PM + A` (additional app exposure).
- Sprint: `required / selected target → final`; the credit breakdown uses the same anchors. `A0` means no app top-up.
- Power: always eligibility-only (`E`); the number is the final number of primers.
- Rest/hard: `R final (required; preferred)` and `H final (preferred/permitted)`.
- Sam decision cells now reference the approved Section 18 policy. Empty Sam notes cells remain intentionally available for later annotation.

The **Status and risk** column preserves the historical audit classification from before approval. The **Sam decision** column and Bible Section 18 are the current authority. A historical “unclear” label is not an unresolved policy unless the decision cell explicitly says unresolved.

### Exact scenario identity and dates

`Build` and `deload` below are the effective week kind. The production mode is shown exactly as stored in the exposure contract.

| Scenario IDs | Fixed Monday | Phase | Exact subphase | Exact production mode | Week kind |
| --- | --- | --- | --- | --- | --- |
| IS-G-2TT-6D; IS-G-0TT-5D; IS-G-1TT-4D; IS-G-2TT-3D; IS-G-LOW-2TT; IS-G-BEGINNER | 2026-07-13 | In-season | `game_week` | `in_season_game_week` | build |
| IS-BB-0TT-6D; IS-BB-1TT-5D; IS-BB-2TT-6D; IS-BB-3TT-7D | 2026-07-13 | In-season | `bye_build` | `in_season_bye_build` | build |
| IS-BR-DELOAD-0TT | 2026-08-03 | In-season | `bye_build` | `in_season_bye_build` | build |
| IS-BR-LOW-2TT | 2026-07-13 | In-season | `bye_recovery` | `in_season_bye_recovery` | build |
| OS-EARLY-7D-HIGH; OS-EARLY-3D | 2026-07-13 | Off-season | `early_offseason` | `early_offseason` | build |
| OS-MID-6D-HIGH; OS-MID-4D; OS-MID-3D; OS-MID-LOW; OS-MID-LOWER-INJ; OS-MID-UPPER-INJ; OS-MID-FULL-PAUSE; OS-MID-LIMITED; OS-MID-BODYWEIGHT; OS-MID-BEGINNER | 2026-07-27 | Off-season | `mid_offseason` | `mid_offseason` | build |
| OS-LATE-DELOAD | 2026-08-03 | Off-season | `late_offseason` | `late_offseason` | deload |
| OS-LATE-BUILD-EXPLICIT | 2026-08-03 | Off-season | `late_offseason` | `late_offseason` | build |
| OS-LATE-B2-W1 | 2026-08-10 | Off-season | `late_offseason` | `late_offseason` | build |
| PS-EARLY-0TT; PS-EARLY-1TT; PS-EARLY-2TT; PS-EARLY-3TT | 2026-07-13 | Pre-season | `early_preseason` | `early_preseason` | build |
| PS-MID-2TT-5D; PS-MID-0TT-4D; PS-MID-0TT-3D; PS-PM-2TT; PS-PM-0TT; PS-MID-LOW; PS-MID-LOWER-INJ; PS-MID-UPPER-INJ; PS-MID-LIMITED; PS-MID-BODYWEIGHT; PS-MID-BEGINNER | 2026-07-20 | Pre-season | `mid_preseason` | `mid_preseason` | build |
| PS-LATE-DELOAD | 2026-08-03 | Pre-season | `late_preseason` | `late_preseason` | deload |
| PS-LATE-BUILD-EXPLICIT | 2026-08-03 | Pre-season | `late_preseason` | `late_preseason` | build |
| PS-B2-W1-RESETS-EARLY | 2026-08-10 | Pre-season | `early_preseason` | `early_preseason` | build |

## In-season evidence

### In-season game-week scenarios

Applicable Bible: **B-GLOBAL, B-IS, B-REST, B-PATTERN**, plus **B-CONSTRAINT** where shown.

| ID | Setup and audit-time production behaviour | Main strength and patterns | Conditioning | Sprint/high speed | Power | Rest / hard days | Authorised reductions; unresolved | Status and risk | Sam decision | Sam notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IS-G-2TT-6D | 6D, 2TT, Sat G, N, healthy, Full, Exp. Standard game-week structure. | 2 / 2–3 / 3→3; Sq,Hg,Pu,Pl | 3 / 3–3 / 3→3; 2TT+1G+0A | 1 / 1→3; 2TT+1G+A0 | E; 2 | R3 (1;1–2), H4 (4/5) | None; none | **Bible clear, code correct.** Freshness and anchors are respected. | **Approved 14 July 2026 — Bible Section 18.** |  |
| IS-G-0TT-5D | 5D, 0TT, Sat G, N, healthy, Full, Exp. Adds 2 aerobic components. | 2 / 2–3 / 3→3; all 4 | 3 / 3–3 / 3→3; 0TT+1G+2A | 1 / 1→1; G only | E; 2 | R3, H2 (4/5) | None; none | **Bible unclear; code chose—user decision required.** Exact top-up and desired hard-day load with no TT are not stated. | **Approved 14 July 2026 — Bible Section 18.** |  |
| IS-G-1TT-4D | 4D, 1TT, Sat G, N, healthy, Full, Exp. Adds 1 app conditioning exposure and selects 2 lifts. | 2 / 2–3 / 2→2; all 4 | 3 / 3–3 / 3→3; 1TT+1G+1A | 1 / 1→2; TT+G | E; 2 | R4, H3 (4/5) | None; none | **Bible clear, code correct.** Minimum effective strength and total conditioning are met without extra sprint. | **Approved 14 July 2026 — Bible Section 18.** |  |
| IS-G-2TT-3D | Declared 3D, but Tue/Thu TT and Sat G are unioned into the week. Final structure matches the 6D game week. | 2 / 2–3 / 3→3; all 4 | 3 / 3–3 / 3→3; 2TT+1G+0A | 1 / 1→3; 2TT+G | E; 2 | R3, H4 (4/5) | None; none | **Bible unclear; code chose—user decision required.** Availability semantics are ambiguous; anchors can exceed the declaration without a reduction or rejection. | **Approved 14 July 2026 — Bible Section 18.** |  |
| IS-G-LOW-2TT | 6D, 2TT, Sat G, low/“cooked”, healthy, Full, Exp. Strength target falls to 2; primer remains. | 2 / 2–3 / 2→2; all 4 | 3 / 3–3 / 3→3; anchors only | 1 / 1→3; anchors only | E; **1** | R3, H4 (4/5) | No typed low-readiness reduction emitted; none | **Bible clear, code incorrect.** The Bible says cooked work becomes optional/lighter; the final week still has four hard days and a power primer. | **Approved 14 July 2026 — Bible Section 18.** |  |
| IS-G-BEGINNER | 6D, 2TT, Sat G, N, healthy, Full, beginner. Training-age policy limits lifts and removes power. | 2 / 2–3 / 2→2; all 4 | 3 / 3–3 / 3→3; anchors only | 1 / 1→3; anchors only | E; 0 | R3, H4 (4/5) | `training_age_limit` is reflected in selection but not emitted in this contract; none | **Bible clear, code correct.** Two main lifts and no power are a defensible beginner application. | **Approved 14 July 2026 — Bible Section 18.** |  |

### Example final effective schedules

| ID | Monday → Sunday |
| --- | --- |
| IS-G-2TT-6D | Lower Body Strength; TT + Upper Pull; Recovery; TT + Upper Push; Gunshow; Game; Recovery |
| IS-G-0TT-5D | Upper Pull + aerobic; Lower Body + aerobic; Recovery; Upper Push; Gunshow; Game; Recovery |
| IS-G-1TT-4D | Lower Body; TT + Upper Body; Full rest; Recovery; Gunshow; Game; Recovery |
| IS-G-2TT-3D | Lower Body; TT + Upper Pull; Recovery; TT + Upper Push; Gunshow; Game; Recovery |
| IS-G-LOW-2TT | Lower Body; TT; Recovery; TT + Upper Body; Gunshow; Game; Recovery |
| IS-G-BEGINNER | Lower Body; TT; Recovery; TT + Upper Body; Gunshow; Game; Recovery |

### In-season no-game support

Production has no third generic “in-season no-game” contract. Sam approved that every no-game in-season week must resolve to **bye build** or **bye recovery**.

### In-season policy decisions

| Decision needed | Audit-time code-owned choice | Sam decision | Sam notes |
| --- | --- | --- | --- |
| Game-week strength | Requires 2, prefers 2–3, and selects 2 or 3 from availability. | **Approved:** required 2, preferred 2–3, maximum 4; cover all four patterns where possible and restore a missed pattern later where safe. |  |
| Game-week total conditioning | Requires exactly 3; every TT and game receives credit; the app fills the balance. | **Approved:** 2TT+game adds 0 core; 1TT+game adds 1 hard core on G-3 or earlier; 0TT+game adds 2 medium-to-hard core on G-3 or earlier. Flushes are optional/non-core. |  |
| Game-week sprint | Requires 1; every TT and game receives credit; no app top-up after credit. | **Approved:** minimum 1 genuine exposure; only qualifying TT/game participation credits it; no unnecessary app top-up. |  |
| Availability semantics | Team and game anchors are added even when they are outside the declared selected days. | **Approved:** TT/game are fixed anchors; declared availability governs additional app sessions. |  |
| Cooked week | Strength frequency could fall, while the audit-time readiness wiring could still retain power and the normal anchor-driven hard load. | **Approved:** remove power, reduce app dose first, preserve 2 lifts only when safe, and emit `low_readiness` if frequency falls. |  |
| No-game meaning | Only bye build/recovery are supported. | **Approved:** every no-game in-season week is bye build or bye recovery. |  |

## Bye-week evidence

### Bye build and recovery scenarios

Applicable Bible: **B-GLOBAL, B-IS, B-BYE, B-REST, B-PATTERN**, plus **B-CONSTRAINT** for recovery selection.

| ID | Setup and audit-time production behaviour | Main strength and patterns | Conditioning | Sprint/high speed | Power | Rest / hard days | Authorised reductions; unresolved | Status and risk | Sam decision | Sam notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IS-BB-0TT-6D | Healthy bye build, 6D, 0TT, N, Full, Exp. Selects 2 lifts and one Saturday VO2/aerobic component. | 2 / 3–4 / 2→2; Sq,Pu,Pl | 1 / 1–2 / 1→1; 0TT+0G+1A | 1 / 1→1; app top-up | E; 2 | R5 (1;1–2), H2 (4/5) | None; none | **Bible unclear; code chose—user decision required.** Bible says a good-readiness bye may add work, but not whether 2 lifts is normal or whether Saturday must be hard. | **Approved 14 July 2026 — Bible Section 18.** |  |
| IS-BB-1TT-5D | Healthy bye build, 5D, 1TT. One app conditioning exposure; 2 lifts. | 2 / 3–4 / 2→2; Sq,Pu,Pl | 2 / 2–2 / 2→2; 1TT+1A | 1 / 1→1; TT, A0 | E; 2 | R4, H3 | None; none | **Bible unclear; code chose—user decision required.** Preferred 3–4 strength is never selected. | **Approved 14 July 2026 — Bible Section 18.** |  |
| IS-BB-2TT-6D | Healthy bye build, 6D, 2TT. Anchors satisfy conditioning and sprint; 2 lifts. | 2 / 3–4 / 2→2; Sq,Pu,Pl | 2 / 2–2 / 2→2; 2TT only | 1 / 1→2; 2TT | E; 2 | R4, H3 | None; none | **Bible unclear; code chose—user decision required.** No extra Saturday conditioning is selected despite the Bible’s bye example. | **Approved 14 July 2026 — Bible Section 18.** |  |
| IS-BB-3TT-7D | Healthy bye build, 7D, 3TT. Anchors supply all conditioning; still only 2 lifts. | 2 / 3–4 / 2→2; Sq,Pu,Pl | 3 / 3–3 / 3→3; 3TT only | 1 / 1→3; 3TT | E; 2 | R3, H4 | None; none | **Bible unclear; code chose—user decision required.** High team load justifies caution, but exact strength target is unstated. | **Approved 14 July 2026 — Bible Section 18.** |  |
| IS-BR-DELOAD-0TT | Healthy 0TT Week 4, intended as recovery probe. Automatic mode remains **bye build**, not deload/recovery. | 2 / 3–4 / 2→2; Hg,Pu,Pl | 1 / 1–2 / 1→1; 1A | 1 / 1→1; 1A | E; 2 | R5, H2 | None; none | **Bible and code conflict internally.** Recovery mode exists, but the normal in-season week-kind resolver cannot select it from Week 4 and ordinary coaching inputs do not expose `byeMode`. | **Approved 14 July 2026 — Bible Section 18.** |  |
| IS-BR-LOW-2TT | Low-readiness bye resolves to recovery. TT anchors remain; one upper lift is combined with TT. | 1 / 1–1 / 1→1; Pu,Pl | 2 / 2–2 / 2→2; 2TT only | 0 / 0→2; 2TT | E; 1 | R5 (2;2–3), H2 (2/4) | `bye_recovery_mode`; none | **Bible unclear at audit time; audit-time code conflicted with approved policy.** Approved recovery requires 2 lighter lifts, no power and participation-qualified sprint credit. | **Resolved:** exactly 2 lighter lifts; with 2+TT no additional C; no power; sprint reduction only by typed recovery/readiness/injury/feasibility reason. | Final approval: 14 July 2026. |

Gunshow/accessory work is present in build schedules but contributes **0** main strength and **0** conditioning. It cannot satisfy or replace either required exposure in the current ledger. This matches the addendum’s classification rule.

### Example final effective schedules

| ID | Monday → Sunday |
| --- | --- |
| IS-BB-0TT-6D | Lower Squat + speed; Gunshow; Recovery; Recovery; Recovery; Upper Body + VO2; Full rest |
| IS-BB-1TT-5D | Lower Squat + speed; TT; Gunshow; Recovery; Upper Body + aerobic; Full rest; Full rest |
| IS-BB-2TT-6D | Gunshow; TT + Upper Body; Recovery; TT; Recovery; Lower Squat; Full rest |
| IS-BB-3TT-7D | TT + Upper Body; Gunshow; TT; Recovery; TT; Lower Squat; Recovery |
| IS-BR-DELOAD-0TT | Lower Hinge + speed; Gunshow; Recovery; Recovery; Recovery; Upper Body + aerobic; Full rest |
| IS-BR-LOW-2TT | Recovery; TT + Upper Body; Recovery; TT; Recovery; Recovery; Full rest |

### Bye policy decisions

| Decision needed | Audit-time code-owned choice | Sam decision | Sam notes |
| --- | --- | --- | --- |
| Mode selection | Explicit `byeMode`, deload, low readiness, moderate-or-worse injury or full pause selects recovery; otherwise build. Ordinary generation inputs do not expose a healthy athlete’s explicit choice. | **Approved:** normal/high defaults to build; low/cooked, meaningful injury or explicit recovery choice selects recovery. |  |
| Build strength | Requires 2, prefers 3–4, but tested weeks select 2 regardless of 0–3 TT. | **Approved:** required 2, preferred 3–4, normally select 3; select 4 only with strong readiness, enough availability and low TT load. |  |
| Build conditioning | Requires all TT plus 1 app exposure only when TT ≤1; with 2–3 TT, anchors are sufficient. | **Approved:** 3 meaningful total; app top-up for 0/1/2/3 TT is 3/2/1/0. With 2TT, prefer a harder Saturday exposure. |  |
| Build sprint | Requires 1; TT satisfies it; 0TT receives one app top-up. | **Approved:** minimum 1 genuine exposure; qualifying TT may satisfy; 0TT requires app sprint. |  |
| Recovery strength | Requires exactly 1. | **Approved:** exactly 2 lighter sessions, either two full-body or upper/lower. |  |
| Recovery conditioning | Requires team-training anchors only; no extra app exposure. | **Approved:** no hard app C; 0TT programs 1–2 light aerobic/flush sessions; 1TT allows 1 optional light session; 2+TT needs no additional C. | Final approval: 14 July 2026. |
| Recovery sprint | Required target is 0, though TT still produces final sprint credit. | **Approved:** no added sprint after genuine TT credit; reduce below the floor only with explicit recovery reason. |  |
| Recovery/rest | Requires 2 full-rest days, prefers 2–3, prefers 2 hard days and permits 4. | **Approved:** no power; minimum 2 full-rest days, prefer 3; reduce TT participation where appropriate. |  |
| Optional work | Gunshow is optional and contributes to neither required ledger. | **Approved:** accessories/gunshow are optional and never replace required S/C. |  |

## Off-season evidence

### Early off-season scenarios

Applicable Bible: **B-GLOBAL, B-OSE, B-REST, B-PATTERN**.

| ID | Setup and audit-time production behaviour | Main strength and patterns | Conditioning | Sprint/high speed | Power | Rest / hard days | Authorised reductions; unresolved | Status and risk | Sam decision | Sam notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OS-EARLY-7D-HIGH | Week 1, 7D, high readiness, healthy, Full, Exp. Planner selects 3 lifts and **5** aerobic components; selected work becomes contract target. | 0 / 2–3 / 3→3; all 4 | 0 / 1–2 / **5→5**; 5A | 0 / 0→0 | E; 0 | R2 (2;2–3), H1 (2/4) | None; none | **Bible and code conflict internally.** Work is called optional, yet 3/5 becomes enforced and conditioning exceeds its preferred range. | **Approved 14 July 2026 — Bible Section 18.** |  |
| OS-EARLY-3D | Week 1, 3D, N, healthy, Full, Exp. Selects 2 lifts and one easy aerobic exposure. | 0 / 2–3 / 2→2; Hg,Pu,Pl | 0 / 1–2 / 1→1; 1A | 0 / 0→0 | E; 0 | R4, H0 | None; none | **Bible clear, code correct.** No running/sprint is required; the light work fits the optional intent if “selection” does not make it compulsory to the athlete. | **Approved 14 July 2026 — Bible Section 18.** |  |

#### Example final effective schedules

| ID | Monday → Sunday |
| --- | --- |
| OS-EARLY-7D-HIGH | Upper Push + aerobic; Gunshow; Continuous Aerobic; Recovery; Long Aerobic Intervals; Lower Squat + aerobic; Full Body + aerobic |
| OS-EARLY-3D | Full Body; Full rest; Continuous Aerobic; Full rest; Upper Push; Full rest; Full rest |

### Early off-season policy decisions

| Decision needed | Audit-time code-owned choice | Sam decision | Sam notes |
| --- | --- | --- | --- |
| Meaning of optional | The contract floor is 0, but selected optional work is promoted to a mandatory target for validation. | **Approved:** everything is optional and zero is valid; selected work must remain non-compulsory. |  |
| Normal strength selection | Planner selected 2 with 3D and 3 with 7D. | **Approved:** required 0, preferred 2–3 lighter, maximum 3; no power. |  |
| Conditioning amount | Preferred is 1–2, but 7D can select and enforce 5. | **Approved:** required 0, preferred 1–2 light aerobic, maximum 3. |  |
| Running/sprint | No required sprint; tested schedules contained no running/sprint exposure. | **Approved:** no required sprint/running; optional easy running only by athlete choice when fresh. |  |
| Hard conditioning | No explicit hard-conditioning permission is encoded beyond modality/intensity selection. | **Approved:** no hard conditioning; prefer 3–4 full-rest days. |  |

### Mid off-season scenarios

Applicable Bible: **B-GLOBAL, B-OSM/L, B-REST, B-PATTERN**, plus **B-CONSTRAINT** where shown.

| ID | Setup and audit-time production behaviour | Main strength and patterns | Conditioning | Sprint/high speed | Power | Rest / hard days | Authorised reductions; unresolved | Status and risk | Sam decision | Sam notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OS-MID-6D-HIGH | Week 3, 6D, high readiness, healthy, Full, Exp. Selects 4 lifts, 3 conditioning and 1 speed top-up. | 3 / 3–4 / 4→4; all 4 | 3 / 3–4 / 3→3; 3A | 1 / 1→1; 1A | E; 4 | R3 (2;2), H3 (4/5) | None; none | **Bible unclear; code chose—user decision required.** Four lifts is within the Bible range, but the exact normal target and four power primers are unstated. | **Approved 14 July 2026 — Bible Section 18.** |  |
| OS-MID-4D | Week 3, 4D, N, healthy, Full, Exp. Stacks work to achieve 4 lifts and 3 conditioning. | 3 / 3–4 / 4→4; all 4 | 3 / 3–4 / 3→3; 3A | 1 / 1→1; 1A | E; 4 | R3, H3 | None; none | **Bible unclear; code chose—user decision required.** Availability permits 4, but Bible does not say 4 is the normal selected target. | **Approved 14 July 2026 — Bible Section 18.** |  |
| OS-MID-3D | Week 3, 3D, N, healthy, Full, Exp. Three stacked strength/conditioning days. | 3 / 3–4 / 3→3; all 4 | 3 / 3–4 / 3→3; 3A | 1 / 1→1; 1A | E; 3 | R4, H2 | None; none | **Bible clear, code correct.** Meets the stated starting range and sprint floor with safe stacking. | **Approved 14 July 2026 — Bible Section 18.** |  |
| OS-MID-LOW | Low/“cooked”, healthy, Full, Exp. Contract reduces S to 2, C to 1 and sprint to 0, but final canonical week counts 3 lifts and 3 lower power primers. | 2 / 2–3 / 2→**3**; all 4 | 1 / 1–3 / 1→1; 1A | 0 / 0→0 | E; **3** | R3, H2 | `low_readiness`; none | **Bible and code conflict internally.** Final workouts exceed the reduced strength target and retain power despite the cooked state. | **Approved 14 July 2026 — Bible Section 18.** |  |
| OS-MID-LOWER-INJ | Healthy readiness, lower-body injury 7/10, Full, Exp. Contract removes squat/hinge and sprint, but final canonical week restores a squat session. | 2 / 2–3 / 2→**3**; **Sq**,Pu,Pl | 3 / 3–4 / 3→3 | 0 / 0→0 | E; 2 upper | R3, H1 | `injury_restriction`; none | **Bible and code conflict internally.** A severe affected pattern returns after planning; accepted validation does not catch the overshoot/pattern breach. | **Approved 14 July 2026 — Bible Section 18.** |  |
| OS-MID-UPPER-INJ | Upper-body injury 7/10, Full, Exp. Push is removed; safe lower/pull work and conditioning continue. | 3 / 3–4 / 3→3; Sq,Hg,Pl | 3 / 3–4 / 4→4 | 1 / 1→1 | E; 2 lower | R3, H2 | `injury_restriction`; none | **Bible clear, code correct.** Unaffected work continues and the affected push pattern is removed. | **Approved 14 July 2026 — Bible Section 18.** |  |
| OS-MID-FULL-PAUSE | Red-flag/full pause. Six recovery cards and one full-rest card; all training targets zero. | 0 / 0–3 / 0→0 | 0 / 0–3 / 0→0 | 0 / 0→0 | E; 0 | R7 (2;2), H0 | `full_pause`; none | **Bible clear, code correct.** Affected training stops and the week is fully non-training. | **Approved 14 July 2026 — Bible Section 18.** |  |
| OS-MID-LIMITED | Healthy, limited/home equipment and no recognised cardio modality. Four lifts remain; all conditioning is reduced to 0. | 3 / 3–4 / 4→4; all 4 | **0 / 0–3 / 0→0** | 1 / 1→1; app speed | E; 4 | R3, H3 | `equipment_infeasibility`; none | **Bible clear, code incorrect.** Feasibility is treated globally; running/walking/bodyweight substitutions are not attempted before deleting conditioning. | **Approved 14 July 2026 — Bible Section 18.** |  |
| OS-MID-BODYWEIGHT | Healthy, bodyweight/no-cardio equipment. Same frequency result as limited equipment. | 3 / 3–4 / 4→4; all 4 | **0 / 0–3 / 0→0** | 1 / 1→1 | E; 4 | R3, H3 | `equipment_infeasibility`; none | **Bible clear, code incorrect.** Available substitution space is collapsed into “no app conditioning”. | **Approved 14 July 2026 — Bible Section 18.** |  |
| OS-MID-BEGINNER | Beginner, Full. Training-age limit reduces strength to 2 while conditioning remains 3; no combined sessions. | 2 / 2–3 / 2→2; all 4 | 3 / 3–4 / 3→3 | 1 / 1→1 | E; 2 | R2, H1 | `training_age_limit`; none | **Bible unclear; code chose—user decision required.** The Bible asks training-age adaptation but does not state this exact frequency/hard-exposure cap. | **Approved 14 July 2026 — Bible Section 18.** |  |

#### Example final effective schedules

| ID | Monday → Sunday |
| --- | --- |
| OS-MID-6D-HIGH | Upper Push + aerobic + speed; Gunshow; Lower Hinge; Gunshow; Upper Pull + tempo; Lower Squat + aerobic; Full rest |
| OS-MID-4D | Upper Push + aerobic + speed; Lower Squat + aerobic; Full rest; Upper Pull + tempo; Full rest; Lower Hinge; Full rest |
| OS-MID-3D | Lower Hinge + aerobic + speed; Full rest; Full Body + aerobic; Full rest; Lower Squat + aerobic; Full rest; Full rest |
| OS-MID-LOW | Full Body; Gunshow; Aerobic Flush; Gunshow; Lower Hinge; Lower Squat; Full rest |
| OS-MID-LOWER-INJ | Upper Push; Gunshow; Upper Pull; Gunshow; Tempo Intervals; Lower Squat; Full rest |
| OS-MID-UPPER-INJ | Lower Hinge; Gunshow; Upper Pull; Gunshow; Tempo Intervals; Lower Squat; Full rest |
| OS-MID-FULL-PAUSE | Recovery; Recovery; Recovery; Recovery; Recovery; Recovery; Full rest |
| OS-MID-LIMITED | Upper Push; Lower Hinge; Recovery; Upper Pull; Lower Squat; Full rest; Full rest |
| OS-MID-BODYWEIGHT | Upper Push; Lower Hinge; Recovery; Upper Pull; Lower Squat; Full rest; Full rest |
| OS-MID-BEGINNER | Lower Hinge; Long Aerobic Intervals; Continuous Aerobic; Recovery; Tempo Intervals; Full Body; Full rest |

### Mid off-season policy decisions

| Decision needed | Audit-time code-owned choice | Sam decision | Sam notes |
| --- | --- | --- | --- |
| Required/preferred/selected strength | Requires 3, prefers 3–4, selects up to 4 from availability; beginner/constraints can reduce it. | **Approved:** 3/4/4; normally select 4 with at least 4 available days, 3 with only 3; cover all patterns. |  |
| Required/preferred conditioning | Requires 3, prefers 3–4, though another Bible statement allows 3–5. | **Approved:** 3/3–4/5; mostly aerobic, maximum 1 hard, remainder easy-to-moderate. |  |
| Power frequency | Eligible experienced athletes can receive a primer on every main lift; no weekly cap/minimum is stated in the Bible. | **Approved:** eligibility-based; prefer 1–2 primers weekly, not one per lift. |  |
| Beginner | Hard cap is 2 core strength sessions and 3 hard exposures; combined sessions are disabled. | **Approved:** S2, C2–3, one safe sprint; reduce complexity and dose. |  |
| Readiness | Low readiness reduces frequency in the contract, not only dose, but canonical workouts can exceed it. | **Approved:** remove power, reduce dose first, preserve frequency when safe; typed reason required for frequency reduction. |  |

### Late off-season and deload scenarios

Applicable Bible: **B-GLOBAL, B-OSM/L, B-DELOAD, B-REST, B-PATTERN**.

| ID | Setup and audit-time production behaviour | Main strength and patterns | Conditioning | Sprint/high speed | Power | Rest / hard days | Authorised reductions; unresolved | Status and risk | Sam decision | Sam notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OS-LATE-DELOAD | Production treated first-block Week 4 as late and automatically deloaded. It kept 4 lifts, reduced conditioning 3→2, lowered intensity and removed primers. | 3 / 3–4 / 4→4; all 4 | 2 / 2–3 / 2→2 | 1 / 1→1 | E; 0 | R3 (1;1–2), H3 (4/5) | `deload_policy`; none | **Historical valid exception; now conflicts with approved policy.** First-block Week 4 must remain mid off-season and must not automatically deload. | **Resolved:** first block W4 is mid build; no automatic deload. Later late blocks may use the approved deload policy. |  |
| OS-LATE-BUILD-EXPLICIT | Same fixed first-block Week 4 forced to build. Production labelled it late; output had 4 lifts, 3 conditioning, 1 sprint and 4 primers. | 3 / 3–4 / 4→4; all 4 | 3 / 3–4 / 3→3 | 1 / 1→1 | E; 4 | R3, H3 | None; none | **Bible unclear at audit time; now resolved.** Build week is correct but its approved subphase is mid, not late; 4 primers also exceeds the approved 1–2 preference. | **Resolved:** first-block Week 4 remains mid build with mid-off-season policy. |  |
| OS-LATE-B2-W1 | Block 2 Week 1 on 10 Aug. Off-season resolver uses global week number, so it remains late rather than resetting early. Output matches late build. | 3 / 3–4 / 4→4; all 4 | 3 / 3–4 / 3→3 | 1 / 1→1 | E; 4 | R3, H3 | None; none | **Bible unclear at audit time; now resolved.** Remaining late after the first block matches approved subphase ownership. | **Resolved:** first block W1–2 early/W3–4 mid with no W4 deload; all later blocks remain late until the user changes phase. | Final approval: 14 July 2026. |

#### Example final effective schedules

| ID | Monday → Sunday |
| --- | --- |
| OS-LATE-DELOAD | Upper Push + tempo + speed; Gunshow; Lower Hinge; Gunshow; Upper Pull + aerobic; Lower Squat; Full rest |
| OS-LATE-BUILD-EXPLICIT | Upper Push + aerobic + speed; Gunshow; Lower Hinge; Gunshow; Upper Pull + tempo; Lower Squat + aerobic; Full rest |
| OS-LATE-B2-W1 | Upper Push + aerobic + speed; Gunshow; Lower Hinge; Gunshow; Upper Pull + tempo; Lower Squat + aerobic; Full rest |

### Late off-season policy decisions

| Decision needed | Audit-time code-owned choice | Sam decision | Sam notes |
| --- | --- | --- | --- |
| Build frequency | 3 required/3–4 preferred strength, 3 required/3–4 preferred conditioning, 1 sprint; planner selects 4/3/1 when feasible. | **Approved:** S3/4/4; C3/4/5 with 1–2 hard; sprint 1/1–2/2; power prefer 1–2; all patterns and 2 rest days. |  |
| Week 4 deload | Production deloads the first Off-season Week 4. | **Approved:** do not deload first-block W4; later late blocks may deload every fourth week while preserving S, allowing C minus1 when required, preserving controlled sprint and removing power. | Final approval: 14 July 2026. |
| Block progression | Off-season subphase uses global week number and therefore does not reset at a new block. | **Approved:** first block is early/early/mid/mid without W4 deload; then start a late block and remain late indefinitely until the user explicitly switches to Pre-season. | Final approval: 14 July 2026. |

## Pre-season evidence

### Healthy build scenarios and team-training variation

Applicable Bible: **B-GLOBAL, B-PS, B-REST, B-PATTERN**.

| ID | Setup and audit-time production behaviour | Main strength and patterns | Conditioning | Sprint/high speed | Power | Rest / hard days | Authorised reductions; unresolved | Status and risk | Sam decision | Sam notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PS-EARLY-0TT | Week 1, 6D, 0TT, N, healthy, Full, Exp. Four lifts and four app conditioning components. | 4 / 4–4 / 4→4; all 4 | 4 / 4–4 / 4→4; 0TT+4A | 1 / 1→1; app top-up | E; 4 | R3 (2;2), H3 (4/5) | None; none | **Bible clear, code correct.** Exact healthy 4/4/1 baseline is met. | **Approved 14 July 2026 — Bible Section 18.** |  |
| PS-EARLY-1TT | Week 1, 6D, 1TT. Contract plans four main lifts, but the pure TT canonical workout includes `DB Bench Press` and counts as a fifth lift. | 4 / 4–4 / 4→**5**; all 4 | 4 / 4–4 / 4→4; 1TT+3A | 1 / 1→1; TT, A0 | E; 4 | R2, H3 | None; none | **Bible clear, code incorrect.** TT correctly replaces one conditioning exposure but incorrectly manufactures an extra strength exposure. | **Approved 14 July 2026 — Bible Section 18.** |  |
| PS-EARLY-2TT | Week 1, 6D, 2TT. One combined TT+strength day plus one pure TT day; pure TT is again counted as strength. | 4 / 4–4 / 4→**5**; all 4 | 4 / 4–4 / 4→4; 2TT+2A | 1 / 1→2; 2TT, A0 | E; 4 | R2, H4 | None; none | **Bible clear, code incorrect.** Final ledger exceeds the normal maximum of 4. | **Approved 14 July 2026 — Bible Section 18.** |  |
| PS-EARLY-3TT | Week 1, 7D, 3TT. Anchors supply 3 conditioning/sprint exposures; final ledger counts 5 lifts and 5 hard days. | 4 / 4–4 / 4→**5**; all 4 | 4 / 4–4 / 4→4; 3TT+1A | 1 / 1→3; 3TT, A0 | E; 4 | R2, H5 (4/5) | None; none | **Bible clear, code incorrect.** Strength exceeds 4; the validator accepts it because maxima are not generally enforced. | **Approved 14 July 2026 — Bible Section 18.** |  |
| PS-MID-2TT-5D | Week 2, 5D, 2TT, N, healthy, Full, Exp. Two TT anchors, four genuine lifts, two app conditioning components. | 4 / 4–4 / 4→4; all 4 | 4 / 4–4 / 4→4; 2TT+2A | 1 / 1→2; 2TT | E; 4 | R3, H4 | None; none | **Bible clear, code correct.** 4/4 baseline and anchor credit are coherent. | **Approved 14 July 2026 — Bible Section 18.** |  |
| PS-MID-0TT-4D | Week 2, 4D, 0TT. Four stacked lift/conditioning days. | 4 / 4–4 / 4→4; all 4 | 4 / 4–4 / 4→4; 4A | 1 / 1→1; app top-up | E; 4 | R3, H4 | None; none | **Bible clear, code correct.** Baseline is met within availability by stacking. | **Approved 14 July 2026 — Bible Section 18.** |  |
| PS-MID-0TT-3D | Week 2, 3D, 0TT. Explicit availability reduction changes 4/4 to 3/3; all patterns still appear. | 3 / 3–4 / 3→3; all 4 | 3 / 3–4 / 3→3; 3A | 1 / 1→1 | E; 3 | R4, H3 | `insufficient_availability`; none | **Valid phase-specific exception.** A typed feasibility reduction transparently explains departure from 4/4. | **Approved 14 July 2026 — Bible Section 18.** |  |
| PS-LATE-BUILD-EXPLICIT | Week 4 forced to build, 2TT. Contract is 4/4; final strength is 5 because pure TT contains bench work. | 4 / 4–4 / 4→**5**; all 4 | 4 / 4–4 / 4→4; 2TT+2A | 1 / 1→2; 2TT | E; 4 | R2, H4 | None; none | **Bible clear, code incorrect.** Canonical TT classification breaches the 4-strength maximum. | **Approved 14 July 2026 — Bible Section 18.** |  |
| PS-B2-W1-RESETS-EARLY | Block 2 Week 1 on 10 Aug. Pre-season resolver uses week-in-block, so subphase resets from late to early. Final strength also counts 5. | 4 / 4–4 / 4→5; all 4 | 4 / 4–4 / 4→4; 2TT+2A | 1 / 1→2 | E; 4 | R2, H4 | None; none | **Bible unclear; code chose—user decision required.** Primary issue is subphase reset policy; the secondary 5th-strength defect remains a known conflict. | **Approved 14 July 2026 — Bible Section 18.** |  |

#### Example final effective schedules

| ID | Monday → Sunday |
| --- | --- |
| PS-EARLY-0TT | Upper Push + aerobic + speed; Lower Squat + aerobic; Upper Pull + tempo; Recovery; Recovery; Lower Hinge + aerobic; Full rest |
| PS-EARLY-1TT | Upper Push + aerobic + speed; TT; Lower Hinge + aerobic; Recovery; Upper Pull + tempo; Lower Squat + aerobic; Full rest |
| PS-EARLY-2TT | Lower Hinge + aerobic + speed; TT + Upper Push; Recovery; TT; Upper Pull + tempo; Lower Squat + aerobic; Full rest |
| PS-EARLY-3TT | TT + Upper Push; Lower Squat + aerobic; TT + Upper Pull; Recovery; TT; Lower Hinge + aerobic; Recovery |
| PS-MID-2TT-5D | Lower Squat + aerobic; TT + Upper Pull; Recovery; TT + Upper Push; Lower Hinge + aerobic; Full rest; Full rest |
| PS-MID-0TT-4D | Upper Push + aerobic + speed; Lower Squat + aerobic; Full rest; Upper Pull + tempo; Full rest; Lower Hinge + aerobic; Full rest |
| PS-MID-0TT-3D | Upper Push + aerobic + speed; Full rest; Lower Body + aerobic; Full rest; Upper Pull + tempo; Full rest; Full rest |
| PS-LATE-BUILD-EXPLICIT | Lower Squat + aerobic; TT + Upper Pull; Recovery; TT; Upper Push + tempo; Lower Hinge + aerobic; Full rest |
| PS-B2-W1-RESETS-EARLY | Lower Hinge + aerobic + speed; TT + Upper Push; Recovery; TT; Upper Pull + tempo; Lower Squat + aerobic; Full rest |

### Practice-match and deload scenarios

Applicable Bible: **B-GLOBAL, B-PS, B-DELOAD, B-REST, B-PATTERN**.

| ID | Setup and audit-time production behaviour | Main strength and patterns | Conditioning | Sprint/high speed | Power | Rest / hard days | Authorised reductions; unresolved | Status and risk | Sam decision | Sam notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PS-LATE-DELOAD | Automatic Week 4 deload, 2TT, healthy. Contract reduces C4→3 but keeps S4; final strength counts 5 due pure TT. Power removed. | 4 / 4–4 / 4→**5**; all 4 | **3 / 3–4 / 3→3**; 2TT+1A | 1 / 1→2; 2TT | E; 0 | R2, H4 | `deload_policy`; none | **Bible clear, code incorrect.** It both breaches strength max and changes pre-season conditioning frequency despite the clarified 4/4 baseline. | **Approved 14 July 2026 — Bible Section 18.** |  |
| PS-PM-2TT | Week 2 with 2TT and Sat PM. Explicit practice-match load reduces 4/4 to 3/3; anchors supply all conditioning/sprint. | 3 / 3–4 / 3→3; all 4 | 3 / 3–4 / 3→3; 2TT+1PM | 1 / 1→3; 2TT+PM | E; 2 | R3, H4 | `practice_match_load`; none | **Historical valid exception; now policy-confirmed.** S3 and C3 from 2TT+PM match approved policy, subject to genuine participation and power timing. | **Resolved:** S3; no extra core C; retain an early lower; allow1–2 early primers/max2; prefer2 rest; hard max4. | Final approval: 14 July 2026. |
| PS-PM-0TT | Week 2, 0TT, Sat PM. Practice-match rule collapses S to 2 and C to the PM only. | 2 / 2–3 / 2→2; Hg,Pu,Pl | **1 / 1–4 / 1→1**; PM only | 1 / 1→1; PM | E; 2 | R4, H1 | `practice_match_load`; none | **Audit-time code conflicted with approved policy.** Approved 0TT+PM is S3–4/default3 and requires 2 app core C on PM-3 or earlier. | **Resolved:** S3–4/default3; PM C1 plus 2 medium-to-hard app C; genuine sprint credit; optional PM-2 flush is non-core. | Final approval: 14 July 2026. |

#### Example final effective schedules

| ID | Monday → Sunday |
| --- | --- |
| PS-LATE-DELOAD | Lower Squat; TT + Upper Pull; Recovery; TT; Upper Push + aerobic; Lower Hinge; Full rest |
| PS-PM-2TT | Lower Body; TT + Upper Push; Recovery; TT + Upper Pull; Gunshow; Practice Match; Recovery |
| PS-PM-0TT | Full Body; Gunshow; Full Body; Gunshow; Recovery; Practice Match; Recovery |

### Constrained pre-season scenarios

Applicable Bible: **B-GLOBAL, B-PS, B-CONSTRAINT, B-REST, B-PATTERN**.

| ID | Setup and audit-time production behaviour | Main strength and patterns | Conditioning | Sprint/high speed | Power | Rest / hard days | Authorised reductions; unresolved | Status and risk | Sam decision | Sam notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PS-MID-LOW | 2TT, low/“cooked”, healthy, Full, Exp. Contract reduces S4→2 and C4→3; team anchors remain. Two primers remain. | 2 / 2–4 / 2→2; all 4 | 3 / 3–4 / 3→3; 2TT+1A | 1 / 1→2; 2TT | E; **2** | R2, H3 | `low_readiness`; none | **Bible clear, code incorrect.** The Bible permits a deload but cooked status should not retain normal power primers; readiness ownership is split. | **Approved 14 July 2026 — Bible Section 18.** |  |
| PS-MID-LOWER-INJ | 2TT, lower-body injury 7/10. App lower patterns and app sprint are removed, but both TT anchors still receive sprint credit. | 2 / 2–4 / 2→2; Pu,Pl | 4 / 4–4 / 4→4; 2TT+2A | 1 / 1→2; 2TT | E; 2 upper | R3, H2 | `injury_restriction`; none | **Bible clear, code incorrect.** Severe lower-body restriction and automatic TT sprint credit are incompatible unless actual safe participation is confirmed. | **Approved 14 July 2026 — Bible Section 18.** |  |
| PS-MID-UPPER-INJ | 2TT, upper-body injury 7/10. Push removed; lower/pull work, conditioning and TT continue. | 3 / 3–4 / 3→3; Sq,Hg,Pl | 4 / 4–4 / 4→4; 2TT+2A | 1 / 1→2; 2TT | E; 1 lower | R2, H4 | `injury_restriction`; none | **Bible clear, code correct.** Safe unaffected work remains and affected push is removed. | **Approved 14 July 2026 — Bible Section 18.** |  |
| PS-MID-LIMITED | 2TT, healthy, limited equipment/no recognised cardio modality. Final strength counts 5; conditioning falls to TT only. | 4 / 4–4 / 4→**5**; all 4 | **2 / 2–4 / 2→2**; 2TT+0A | 1 / 1→2; 2TT | E; 4 | R2, H4 | `equipment_infeasibility`; none | **Bible clear, code incorrect.** No substitution is attempted; final strength also exceeds 4. | **Approved 14 July 2026 — Bible Section 18.** |  |
| PS-MID-BODYWEIGHT | 2TT, healthy, bodyweight/no-cardio equipment. Same result as limited equipment. | 4 / 4–4 / 4→**5**; all 4 | **2 / 2–4 / 2→2**; 2TT+0A | 1 / 1→2; 2TT | E; 4 | R2, H4 | `equipment_infeasibility`; none | **Bible clear, code incorrect.** Feasible running/bodyweight alternatives are not distinguished from machine infeasibility. | **Approved 14 July 2026 — Bible Section 18.** |  |
| PS-MID-BEGINNER | 2TT, healthy beginner, Full. Contract reduces strength to 2, but pure TT bench classification makes final strength 4. | 2 / 2–4 / 2→**4**; all 4 | 4 / 4–4 / 4→4; 2TT+2A | 1 / 1→2; 2TT | E; 2 | R2, H3 | `training_age_limit`; none | **Bible and code conflict internally.** Final canonical classification defeats the training-age contract. | **Approved 14 July 2026 — Bible Section 18.** |  |

#### Example final effective schedules

| ID | Monday → Sunday |
| --- | --- |
| PS-MID-LOW | Upper Body; TT; Recovery; TT; Aerobic Flush; Lower Body; Full rest |
| PS-MID-LOWER-INJ | Upper Push + aerobic; TT; Recovery; TT; Recovery; Upper Pull + aerobic; Full rest |
| PS-MID-UPPER-INJ | Upper Pull + aerobic; TT; Recovery; TT; Upper Pull + tempo; Lower Body + aerobic; Full rest |
| PS-MID-LIMITED | Lower Squat; TT + Upper Pull; Recovery; TT; Upper Push; Lower Hinge; Full rest |
| PS-MID-BODYWEIGHT | Lower Squat; TT + Upper Pull; Recovery; TT; Upper Push; Lower Hinge; Full rest |
| PS-MID-BEGINNER | Upper Body + aerobic; TT; Recovery; TT; Continuous Aerobic; Lower Body + aerobic; Full rest |

### Pre-season policy decisions

| Decision needed | Audit-time code-owned choice | Sam decision | Sam notes |
| --- | --- | --- | --- |
| Healthy no-game baseline | Contract correctly fixes 4 strength and 4 total conditioning in early/mid/late. | **Approved:** S and core C minimum 3, default 4, maximum 4 across early/mid/late; default to 4 when feasible. |  |
| TT conditioning credit | Every TT replaces one app conditioning exposure. | **Approved:** only normal unrestricted full TT credits one core C; app work fills the remainder to target 3 or 4. |  |
| TT strength credit | Contract gives none, but canonical fallback content can accidentally create it. | **Approved:** TT never counts as strength; optional gunshow/accessories also do not count. |  |
| Sprint | Floor is 1; every TT/PM receives credit and prevents app top-up. | **Approved:** floor 1; TT credits only expected and completed high-speed work; modified/restricted TT does not. |  |
| Practice match | With 2TT the audit-time target was 3/3; with 0TT it was 2/1. | **Approved:** 2TT+PM S3/C3; 1TT+PM S3 plus1 app C; 0TT+PM S3–4/default3 plus2 app C. Keep an early lower, reduce nearby dose, allow1–2 early primers/max2 and prefer2 rest. | Final approval: 14 July 2026. |
| Subphase rollover | Pre-season uses week-in-block and resets to early on every block Week 1. | **Approved:** progression continues across blocks; do not reset every block. |  |

## Cross-phase policy decisions

### Deload policy decisions

| Question | Bible | Audit-time production | Sam decision | Sam notes |
| --- | --- | --- | --- | --- |
| Automatic phases | Deload about every 4 weeks or when readiness warrants. | Production automatically deloads first-block Off-season Week 4 and pre-season Week 4. | **Approved:** pre-season every fourth week; no automatic deload in first early/mid Off-season block; later late blocks may deload; in-season through bye recovery/readiness/injury. |  |
| Strength frequency | Pre-season 4/4 baseline is frequency-stable; general deload wording emphasises lighter work. | Off-season keeps selected 4; pre-season contract keeps 4, although canonical TT can make 5. | **Approved:** preserve frequency where possible; pre-season minimum 3/default 4; keep off-season strength stable where possible. |  |
| Conditioning frequency | Pre-season addendum says progression should not delete the 4-conditioning baseline; off-season is not numerically settled. | Off-season 3→2; pre-season 4→3. | **Approved:** pre-season minimum 3/default 4; off-season may reduce by one when required. |  |
| Sprint | Preserve one at reduced dose unless safety/feasibility reduces it. | Off-season preserves app sprint; pre-season TT anchors preserve it. | **Approved:** preserve one controlled genuine exposure unless explicitly reduced. |  |
| Power | Eligibility-only; no explicit deload statement. | Removed on automatic deload. | **Approved:** remove primers. |  |
| Dose/intensity | Deload should chiefly lower dose/intensity. | Off-season evidence applied about 85% intensity and reduced conditioning; pre-season removed power and reduced conditioning. | **Approved:** reduce sets, volume, duration, load and intensity first. |  |

### Constraint policy decisions

| Constraint | Bible intent | Audit-time production choice/evidence | Decision required | Sam decision | Sam notes |
| --- | --- | --- | --- | --- | --- |
| 3-day availability | Get as close as safely possible; explicit feasibility reduction may lower the baseline. | Pre-season emits `insufficient_availability` and makes 4/4 become 3/3. Team/game anchors can separately expand the effective week past declared days. | Define whether anchors are outside availability and when stacking/rejection is required. | **Approved:** anchors remain fixed; availability governs extra app work; use typed reduction when required safe work cannot fit. |  |
| Low/cooked readiness | Make sessions optional/lighter for a week; readiness can trigger deload. | Frequency reduces in contract, but power and canonical overshoot can remain. | Specify frequency versus dose, power eligibility, and required anchor participation. | **Approved:** remove power and extra app work, reduce dose first, preserve frequency when safe; typed reason if frequency falls. |  |
| Lower injury 7/10 | Stop affected work, continue unaffected work, seek appropriate advice. | Contract can remove lower patterns/app sprint, but canonical squat or automatic TT sprint credit can remain. | Define TT participation/credit and exact prohibited patterns at each severity. | **Approved:** record safe/prohibited patterns, remove affected work/sprint, and credit TT only for qualifying participation; final generation may not restore it. |  |
| Upper injury 7/10 | Remove affected upper work and retain safe lower/conditioning. | Tested weeks removed push and retained squat/hinge/pull, conditioning and sprint anchors. | Confirm whether pull is safe by injury site rather than a generic upper restriction. | **Approved:** restriction is pattern/site-specific; continue only unaffected safe work. |  |
| Full pause/red flag | Stop training and advise escalation. | All training targets become zero; recovery-only cards remain. | Confirm whether recovery cards should be visible or the week should be empty. | **Approved:** no training; recovery-only guidance/advice may remain visible but never counts as training. |  |
| Limited equipment | Substitute safe modalities and keep useful work where possible. | `equipment_infeasibility` can globally set app conditioning to zero. | Define modality-specific feasibility and substitution order before frequency reduction. | **Approved:** substitute running, walking, bodyweight, hills, ergs or safe mixed work before reducing frequency. |  |
| Bodyweight/no cardio | Running/walking/bodyweight work may still be feasible. | Same global conditioning deletion as limited equipment. | Define whether surface, weather and injury—not a machine tag—own running feasibility. | **Approved:** use any safe feasible substitution; reduce only when none exists. |  |
| Beginner | Adapt complexity, volume, load and exposure safely. | Strength is capped at 2 core sessions; 3 hard exposures; no combined sessions; pre-season TT misclassification defeats the cap. | Confirm beginner frequency by phase and whether frequency or only prescription differs. | **Approved for mid off-season:** S2, C2–3, safe sprint1 with lower complexity/dose; all other phase caps still apply. |  |
| Advanced | Progress with training age while respecting phase maxima. | No higher explicit weekly minimum; eligible experienced athletes receive more power primers. | Confirm whether advanced changes dose/intensity only or may change frequency. | **Approved:** the phase required/default/maximum table applies; training age never overrides its maximum. |  |
| Reject versus reduce | Safety and explicit reductions outrank target completion. | Validator accepts any authorised reduced contract, even if the final week overshoots; no scenario rejected. | List conditions that must reject generation rather than silently reduce or accept. | **Approved:** do not store contradictions, restored prohibited work, unresolved red flags or unplaceable safe requirements; repair/regenerate, then safe fallback/settings review. |  |

### Strength-pattern policy decisions

Approved Bible Section 18 defaults to all four patterns in every healthy relevant week. A rolling two-week balance is only a fallback when spacing, availability, readiness or injury genuinely prevents weekly coverage. The phase-planner implementation now has one ownership boundary:

- Healthy in-season, mid/late off-season and pre-season contracts request squat, hinge, push and pull.
- A full-body, lower or upper session credits multiple patterns only when each has a meaningful main-strength contribution.
- Allocation repairs a missing safe pattern by broadening or rebalancing a later safe session.
- Injury reductions record allowed/prohibited patterns before repair, and canonical generation cannot restore prohibited work.
- Accessories, gunshow and pure TT never receive main-strength or pattern credit.

| Decision needed | Sam decision | Sam notes |
| --- | --- | --- |
| Must all four patterns appear in every healthy in-season game week, or over a rolling period? | **Approved:** default to weekly coverage; two-week balance only when genuinely constrained. |  |
| Must all four appear every healthy off-/pre-season week, or may a 3-session week balance them across a block? | **Approved:** weekly in pre-season and mid/late off-season; use full-body structures in 3-session weeks; two-week fallback only when constrained. |  |
| What is the phase-specific minimum for lower patterns versus upper patterns? | **Approved:** healthy relevant weeks default to push, pull, squat and hinge; injury records required safe and prohibited patterns. |  |
| Does one exercise/session satisfy only its dominant pattern or every classified pattern? | **Resolved:** credit every pattern with a meaningful main-strength contribution; token accessories and injury-prohibited work receive no credit. Default to equal or near-equal meaningful main-lift counts across all four patterns each week. | Final approval: 14 July 2026. |
| Should an injury policy express both required safe patterns and explicitly prohibited affected patterns? | **Approved:** yes; final generation must not restore prohibited patterns. |  |

### Conditioning and sprint credit decisions

The currently clarified baseline is retained in all questions below: **one genuine sprint/high-speed exposure each week except early off-season; anchors may satisfy it; do not add an unnecessary app top-up once the floor is met.**

| Decision needed | Audit-time production choice | Risk if not decided | Sam decision | Sam notes |
| --- | --- | --- | --- | --- |
| Genuine sprint/high speed | Any TT, game or PM automatically counts; an app speed session counts. | A low-speed skills session can falsely satisfy the floor. | **Approved:** actual high-speed running, not skills, tempo or low-speed COD. |  |
| TT conditioning credit | Every TT counts as one total conditioning exposure. | Short/light/modified TT receives the same credit as a full 90-minute session. | **Approved:** normal unrestricted full TT credits C1; modified/restricted participation does not automatically qualify. |  |
| TT sprint credit | Every TT counts as one sprint/COD exposure. | Injured or modified participants can receive credit for work they did not do. | **Approved:** credit only when high-speed work is expected and completed. |  |
| Game/PM credit | Each counts as one conditioning, running, sprint/COD and hard-day anchor. | A heavily restricted player or very short appearance is not distinguished. | **Approved:** normal participation credits C1, sprint1 and hard1; reduced participation requires explicit adjustment. |  |
| Additional app conditioning | Engine fills the contract total after anchor credit; bye build uses a separate formula. | Different TT counts can produce unexpectedly different app work without a Bible-owned table. | **Approved:** fill only the remainder using the Section 18 phase tables; optional flush never credits core C. |  |
| Sprint top-up | Added only when credited anchors are below the floor. | Correct only if anchor credit is genuine. | **Approved:** no unnecessary top-up after genuine floor credit. |  |
| Surface/equipment | App conditioning feasibility currently depends on recognised cardio modalities; app sprint can remain. | Running can be deleted or retained for the wrong reason. | **Approved:** substitute safe running/walking/bodyweight/hills/erg/mixed work before reduction. |  |
| Power credit | TT/game actions receive no power credit; power is only an app primer. | Production must still use field fatigue/hard load for spacing without claiming numeric primer credit. | **Resolved:** TT/game/PM never automatically credit formal power; no numeric weekly minimum; reduce/remove app primers under high field load. | Final approval: 14 July 2026. |

### Rest and hard-day policy decisions

| Phase/mode | Audit-time full-rest rule | Audit-time hard-day rule | Evidence concern | Sam decision | Sam notes |
| --- | --- | --- | --- | --- | --- |
| In-season game/build bye | Require 1, prefer 1–2 | Prefer 4, permit 5 | Final “full rest” count treats recovery cards as non-training days; a 0TT game week had only 2 hard days. | **Approved:** minimum 1/prefer 2; normal programmed hard max 4; 5 only unavoidable anchors. |  |
| Bye recovery | Require 2, prefer 2–3 | Prefer 2, permit 4 | TT anchors can consume both hard days even while sprint target is 0. | **Approved:** minimum 2/prefer 3; qualifying TT remains an anchor; no power. |  |
| Early off-season | Require 2, prefer 2–3 | Prefer 2, permit 4 | The 7D optional week had 5 conditioning exposures but only 1 classified hard day. | **Approved:** prefer 3–4 full-rest days; no hard conditioning. |  |
| Mid off-season | Require/prefer 2 | Prefer 4, permit 5 | Stacking often produces only 2–3 hard days despite 3–4 strength plus 3 conditioning. | **Approved:** prefer 2 rest; max 1 hard C; normal programmed hard max 4. |  |
| Late off-season | Require 1, prefer 1–2 | Prefer 4, permit 5 | The phase shift reduces required rest from 2 to 1 without explicit Bible wording. | **Approved:** prefer 2 rest; 1–2 hard C; normal programmed hard max 4. |  |
| Pre-season | Require/prefer 2 | Prefer 4, permit 5 | A 3TT week reaches the permitted 5; recovery cards count toward full rest. | **Approved:** prefer 2 rest; normal programmed hard max 4; 5 only unavoidable anchors. |  |
| Practice match | Require/prefer 2 | Prefer 4, permit 5 | The 0TT PM week has only 1 hard day because its extra work is classified below hard threshold. | **Approved:** normal PM is hard1; reduced participation adjusts it; pre-season prefers 2 rest and max4 programmed hard days. |  |

Questions to settle:

| Decision needed | Sam decision | Sam notes |
| --- | --- | --- |
| Is a day containing a visible recovery workout a full-rest day, or only an active-recovery day? | **Approved:** active recovery, not full rest. |  |
| Are hard-day numbers targets, preferred ranges or only maxima? | **Approved:** default shape 4 hard plus 1 moderate; 3 hard is valid when constrained; normal programmed maximum 4. |  |
| Is 5 ever a normal permitted value, or should the Bible’s “4 max” govern? | **Approved:** 5 only through unavoidable anchor load, never deliberate app programming. |  |
| Do all TT sessions and games count as hard regardless of actual load/participation? | **Approved:** only normal hard participation; reduced participation requires adjustment. |  |
| When should compatible strength/conditioning be stacked to protect full days off? | **Approved:** prefer compatible stacking over spreading hard work across all days. |  |

## Historical conflict register and approved disposition

This register preserves what the audit found before Sam approved Section 18. Older wording in the “clear Bible rule” column is historical evidence, not current authority.

### Bible clear, code incorrect at audit time (12)

| Scenario | Clear Bible rule | Audit-time conflict | Policy owner |
| --- | --- | --- | --- |
| IS-G-LOW-2TT | Cooked/readiness weeks should deload or make work optional/lighter. | Power primer and normal four hard anchor days remain without a typed readiness reduction. | Bible owns readiness result; power/readiness wiring implements it. |
| OS-MID-LIMITED | Substitute safe feasible conditioning before deleting it. | App conditioning becomes 0. | Bible owns substitution order. |
| OS-MID-BODYWEIGHT | Running/walking/bodyweight work may remain feasible. | App conditioning becomes 0. | Bible owns substitution/feasibility. |
| PS-EARLY-1TT | Healthy pre-season maximum/target is 4 main-strength exposures. | Final ledger is 5. | Bible owns frequency; canonical TT content/classifier implements it. |
| PS-EARLY-2TT | Same. | Final ledger is 5. | Same. |
| PS-EARLY-3TT | Same. | Final ledger is 5. | Same. |
| PS-LATE-DELOAD | Healthy pre-season 4/4 frequency is retained through phase progression; deload should chiefly alter dose. | Final is S5/C3. | Bible owns frequency/deload. |
| PS-LATE-BUILD-EXPLICIT | Healthy pre-season strength is 4. | Final ledger is 5. | Bible/canonical classification. |
| PS-MID-LOW | Cooked work should be optional/lighter. | Two power primers remain. | Bible owns readiness/power eligibility. |
| PS-MID-LOWER-INJ | Severe affected lower work should stop unless safe participation is confirmed. | Two TT sessions automatically receive sprint/high-speed credit. | Bible owns injury/credit qualification. |
| PS-MID-LIMITED | Healthy 4 conditioning should use substitutions before frequency reduction. | Final conditioning is TT-only 2; strength is also 5. | Bible owns frequency/substitution. |
| PS-MID-BODYWEIGHT | Same. | Final conditioning is TT-only 2; strength is also 5. | Same. |

### Bible and code conflict internally at audit time (5)

| Scenario | Internal conflict | Why validator did not reject |
| --- | --- | --- |
| IS-BR-DELOAD-0TT | Recovery mode exists, but normal in-season Week 4 cannot select it and ordinary generation inputs do not expose the explicit healthy choice. | The generated build contract is internally satisfiable. |
| OS-EARLY-7D-HIGH | Required floor is 0 and preferred conditioning is 1–2, but planner promotion makes 5 conditioning exposures the enforced target. | Validator enforces selected target, not the meaning of “optional” or the preferred maximum. |
| OS-MID-LOW | Reduced strength target is 2, but final ledger is 3 and power remains. | Validator checks `achieved >= target`; overshoot passes. |
| OS-MID-LOWER-INJ | Contract removes squat/hinge and targets 2 lifts; final week restores squat and reaches 3. | No excluded-pattern or maximum check catches it. |
| PS-MID-BEGINNER | Training-age contract targets 2 lifts, but final TT classification produces 4. | Overshoot passes; no strength maximum is enforced. |

### Bible unclear at audit time; approved disposition

| Scenarios | Approved disposition |
| --- | --- |
| IS-G-0TT-5D | Add 2 medium-to-hard core conditioning sessions on G-3 or earlier; game supplies sprint only with qualifying participation. |
| IS-G-2TT-3D | TT/game remain fixed; declared availability governs only additional app sessions. |
| IS-BB-0TT-6D, IS-BB-1TT-5D, IS-BB-2TT-6D, IS-BB-3TT-7D | Normally select 3 lifts. Total C target is 3; app top-up for 0/1/2/3 TT is 3/2/1/0. |
| IS-BR-LOW-2TT | Exactly 2 lighter lifts, no power, rest minimum2/prefer3 and participation-qualified TT/sprint credit. With 0/1/2+TT, light app C is 1–2 programmed/1 optional/none required. |
| OS-MID-6D-HIGH, OS-MID-4D | Normally S4 with ≥4 available days; C3–4; sprint1; only 1–2 power primers. |
| OS-LATE-BUILD-EXPLICIT | S3/4/4, C3/4/5, sprint1/1–2/2, 1–2 power primers and 2 preferred full-rest days. |
| OS-LATE-B2-W1 | First block is early/early/mid/mid without W4 deload; all later blocks remain late until the user explicitly switches phase. |
| OS-MID-BEGINNER | S2, C2–3, safe sprint1; reduce complexity and dose. |
| PS-B2-W1-RESETS-EARLY | Pre-season progression continues across blocks and must not reset early each block. |
| PS-PM-0TT | 0TT+PM is S3–4/default3 and PM C1 plus2 app core C on PM-3 or earlier. 1TT+PM is S3 plus1 app C; 2TT+PM is S3 with no app C. |

## Build, rebuild, Repeat Week and rollover validation record

These checks validate the implementation record; they are not policy authority. The policy authority remains Programming Bible Section 18.

- `npm run test:week-rebuild`: **61 passed**.
- `src/__tests__/repeatWeekTests.ts` through the repository TypeScript test runner: **35 passed**.
- `npm run test:block-rollover`: **37 passed**.

| Operation | Observed source-of-truth behaviour | Policy drift/risk |
| --- | --- | --- |
| Initial local build | Selects the phase-owned target, allocates core before optional work, creates canonical workouts, resolves visible anchors, then validates the effective ledger. | Required/default/preferred/maximum and typed reductions have one Contract v2 owner. |
| Week 1 versus Weeks 2–4 | Edge-authored Week 1 and deterministic fallback consume the same selected phase contract and canonical ownership. | Content provenance may differ; Section 18 ownership and validation do not. |
| Rebuild | Regenerates the target week and its phase contract, then revalidates canonical output. | The target phase table and typed reductions remain authoritative. |
| Repeat Week | Compares source and target signatures formed from mode plus selected S/C/sprint targets. Different signatures regenerate target-phase workouts; equal signatures may retain source prescriptions. | Target anchors, constraints, contract and final validation always win. Source targets never overwrite a different target phase table. |
| Rollover | Regenerates the next block from the continuously progressing phase clock and target table. | Pre-season continues across blocks. Off-season is early/early/mid/mid, then remains late until the athlete changes phase. |

## Complete historical classification index

This index proves that every representative row had one primary discovery classification before approval. It is retained for audit traceability; Section 18 and the Sam decision cells supersede its previously unclear policies.

| Classification | Scenario IDs | Count |
| --- | --- | ---: |
| Bible clear, code correct | IS-G-2TT-6D; IS-G-1TT-4D; IS-G-BEGINNER; OS-EARLY-3D; OS-MID-3D; OS-MID-UPPER-INJ; OS-MID-FULL-PAUSE; PS-EARLY-0TT; PS-MID-2TT-5D; PS-MID-0TT-4D; PS-MID-UPPER-INJ | 11 |
| Valid phase-specific exception | OS-LATE-DELOAD; PS-MID-0TT-3D; PS-PM-2TT | 3 |
| Bible clear, code incorrect | IS-G-LOW-2TT; OS-MID-LIMITED; OS-MID-BODYWEIGHT; PS-EARLY-1TT; PS-EARLY-2TT; PS-EARLY-3TT; PS-LATE-DELOAD; PS-LATE-BUILD-EXPLICIT; PS-MID-LOW; PS-MID-LOWER-INJ; PS-MID-LIMITED; PS-MID-BODYWEIGHT | 12 |
| Bible and code conflict internally | IS-BR-DELOAD-0TT; OS-EARLY-7D-HIGH; OS-MID-LOW; OS-MID-LOWER-INJ; PS-MID-BEGINNER | 5 |
| Bible unclear at audit time; code made a policy choice | IS-G-0TT-5D; IS-G-2TT-3D; IS-BB-0TT-6D; IS-BB-1TT-5D; IS-BB-2TT-6D; IS-BB-3TT-7D; IS-BR-LOW-2TT; OS-MID-6D-HIGH; OS-MID-4D; OS-LATE-BUILD-EXPLICIT; OS-LATE-B2-W1; OS-MID-BEGINNER; PS-B2-W1-RESETS-EARLY; PS-PM-0TT | 14 |
| **Total** |  | **45** |

## Evidence boundaries

- Programming Bible Section 18 remains the policy authority. This report records both the approved decisions and the later phase-planner implementation boundary; tests and generated coverage reports are validation evidence only.
- All schedules are the final effective visible week, not raw planner notes.
- The scenario runner used fixed dates and production functions; its temporary evidence file lived outside the repository and is not part of the product.
- No remote AI generation was used, so this report does not claim that arbitrary edge-generated prose will reproduce the exact workout names above. The shared contract/canonical/ledger path was inspected.
- Historical “no unresolved shortfall” statements describe the pre-implementation validator and do not override the implementation record above or the Bible.
- Combinations that are not meaningful were not fabricated: off-season has no game/TT policy scenario; in-season has no early/mid/late subphase; a practice match belongs to pre-season game-load handling; full pause makes readiness/equipment variations irrelevant.

## Final approval record

The approved answers are authoritative in Programming Bible Section 18. All five formerly open items were resolved on 14 July 2026, and no coaching-policy decisions remain unresolved. Commit `49073d393c19571b39fecf53051f3e3c5fdea452` implements the phase-owned target, typed conditioning ownership, anchor credit, meaningful strength evidence and cross-path preservation described in the implementation record. Equipment substitution, general power-budget and full-rest-ledger work remain separate boundaries and are not silently treated as resolved by this record.
