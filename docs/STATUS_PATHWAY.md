# STATUS — seat `pathway`

**One name, one file, one writer.** Started 2026-08-23. `ls docs/STATUS_*.md`
before first commit: `pathway` was free (`primer` taken, per Sam's opening line).

**MY ORDER, from Sam directly (2026-08-23):** audit the app against R-130 and
`docs/FEMALE_PATH_BRIEF_2026-08-23.md`, then plan the build. **No code.** Four
deliverables: the change map, a slice order with athlete-visible acceptance per
slice, the open questions with recommendations, and the male-path
did-not-move proof.

---

## 2026-08-23 — THE AUDIT. THREE CORRECTIONS TO THE BRIEF, EACH VERIFIED.

### ⚠ 1. THE G−1 GUNSHOW ALLOCATION THE BRIEF POINTS AT IS DEAD CODE, AND THE LIVE GENERATOR PLACES NO GUNSHOW FOR ANYONE

The brief's §2 sends the builder to `utils/coachingEngine.ts`'s remaining-days
loop (`slot.offset === -1` → `composedOptionalKind: 'gunshow'`,
`coachingEngine.ts:1342-1359`). That branch is inside `buildWeeklyPlan`
(`:876`), whose **only caller (`buildCoachingPlan`) was deleted in `1bd79e1b`
("WS-12: BURN THE BOATS")**. Verified three independent ways:

1. **Caller census:** the only `buildWeeklyPlan` references in `src/` are its
   definition and comments (`coachingEngine.ts:266,6480`,
   `weeklyExposureContractBuilders.ts:348`, `weekStructureValidator.ts:211`).
2. **The committed golden:** `stageBGenerationDifferential/snapshot.golden.json`
   records `"gunshowSessions": 0` in **every week of all 15 scenarios**,
   including `in_season_game_week`.
3. **The charter suite says so on `main`:** `test:session-type-charter` E2 red —
   *"the charter says the generator places prehab, gunshow and no generated
   week contains one"* (baseline below). R-129's registry entry already records
   E1/E2/F2 as pre-existing.

**WHY:** demolition area 3, Sam 2026-08-19 — *"Reading/drawing a program must
not author, persist, restore, repair or rewrite it."* `applyGameProximity`
(which conjured the G−1 `arms_pump` Gunshow at draw time) was deleted, and the
deletion note (`utils/sessionResolver.ts:1018-1036`) assigns the rebuild to
**the weekly scheduler** and says plainly *"nothing is rebuilt here."* The live
producer of `CoachingPlan.weeklyPlan` is `rules/scheduleToCoachingPlan.ts:84`,
which never stamps `composedOptionalKind`.

**CONSEQUENCES FOR R-130:**
- Change 1 (*"the generator never places a Gunshow"* for females) is **already
  behaviourally true — for everyone**. What the female path changes is the
  CLAIM (the charter row), plus keeping it true when the G−1 rebuild lands.
- Change 2 (Primer on female G−1) is **the first rebuild of the demolished G−1
  placement**, and it must be built at the scheduler layer (the ruled owner),
  NOT by resurrecting `buildWeeklyPlan`'s branch.
- The male G−1 Gunshow is a **known open rebuild**, not the status quo Sam
  believes it is (R-129: *"G-1 keeps the Gunshow"* was written about the ruled
  state, not the live one). → Question 1 to Sam.

### 2. THE ACCESSORY MIX DOES NOT LIVE WHERE THE BRIEF SAYS

Brief §3 points at `data/exercisePoolsStrength.ts` slot×role keys. The pools
are the CANDIDATES; the **counts** live in `rules/sessionSlotCoverage.ts`'s
slot tables, consumed one-row-per-slot by `rules/composeWeek.ts:1280`:

- `LOWER_SLOTS` (`:99-101`): `squat, hinge, single_leg_knee, single_leg_hip,
  accessory_or_core` — ONE combined accessory/core row.
- `UPPER_SPLIT_PUSH_SLOTS` (`:130-135`): `horizontal_push, vertical_push,
  push_accessory_1, push_accessory_2, triceps, shoulders, core`.
- `UPPER_SPLIT_PULL_SLOTS` (`:136-139`): pulls + `pull_accessory_1/2, biceps,
  traps, core`.
- `UPPER_FULL_SLOTS` (`:104-106`): 5 slots, `arm_or_shoulder`, **no core**.
- Full-body A/B (`:160-166`): one `accessory_or_core` each.

Doses come from `composeWeek.ts:922` (`doseFor`, tables `:894-910`). Core
(midline) rows draw from `TRUNK_ANTI_ROTATION_POOL`
(`data/exercisePools.ts:283-302`), athlete-facing word "Midline". Glute work
exists in `isolation_lower`'s `glute` group. `SLOTS_FOR_KIND`
(`sessionSlotCoverage.ts:205-218`) is the join. `composeWeek` already receives
`profile` (`generateProgram.ts:1236`), so the path fact reaches it without new
threading. `strengthSessionVariants.ts` and `sessionBuilder.SESSION_SLOTS` are
NOT involved in strength-day contents (naming/derived-session machinery only).

### 3. THE BRIEF'S ⚠4 COLLISION DISSOLVES — VERIFIED, NO RULING NEEDED

`rules/consecutiveCoreDayPolicy.ts` counts consecutive **high-stress DAYS**
(core-tier sessions + team days) in the pre-season placement scorer — sole
production caller `coachingEngine.ts:3118-3142`, keyed on
`candidateStress(...) === 'high'`. It says nothing about trunk exercises inside
a session. Putting midline rows on upper days adds no day and changes no day's
stress class, so nothing collides. No repo rule governs trunk-work frequency
across days (`test:midline` is terminology-only; `test:slot-coverage` pins no
core count).

### BASELINES RECORDED ON `main` @ `fe79e73b` (this seat, today)

- `test:session-type-charter`: **40 pass / 3 fail** — E1 (generator places
  recovery uninvited), E2 (prehab + gunshow generator claims unearned), F2.
  Pre-existing; also recorded at R-129's registry entry.
- Golden snapshot: `gunshowSessions: 0` throughout; 15 scenarios.
- `test:athlete-door-matrix` standing baseline per R-129 entry: 416/15.
- Full sweep baseline: NOT taken yet — the building seat takes it in a
  worktree before slice 1 (see proof protocol).

---

## THE CHANGE MAP — EVERY PLACE, WHAT IT DOES TODAY, WHAT IT BECOMES

**A. The answer (onboarding + storage + copy)**

| # | place | today | becomes |
| --- | --- | --- | --- |
| A1 | `types/domain.ts` `OnboardingData` (`:168-243`) | no gender/sex field anywhere in `src/` | `gender?: AthleteGender` (`'male' \| 'female'`). Two-space indent, WITH `?:` — `test:onboarding-field-influence` hard-codes that convention (`onboardingFieldInfluenceTests.ts:148-149,174-178`); requiredness is enforced by the step registry, not the type |
| A2 | `utils/onboardingSteps.ts` | 20 steps, registry drives progress/resume/refusal/review | add `'Gender'` to the union + one entry EARLY (recommend: directly after `Name`), `visible: always`, `satisfied: filled(data.gender)`. Generation then refuses an unanswered gender for free (`generateProgram.ts:497-501,525-529` via `missingRequiredProfileFields`) |
| A3 | `screens/onboarding/GenderScreen.tsx` | — | new; modelled on `GymExperienceScreen.tsx` (tile list, `commitAndAdvance` on tap, hideFooter). Durable-write-then-advance comes free from `useOnboardingStepCommit` |
| A4 | `types/navigation.ts:39-63`, `navigation/OnboardingNavigator.tsx:70-96`, `NameScreen`'s `navigate` | navigator order is HAND-ORDERED, not registry-derived | param + `<Stack.Screen>` + re-point the two navigates around the new screen |
| A5 | `screens/onboarding/reviewRows.ts:209-344` | one `ReviewRowSpec` per answer; row shown iff step visible | one row, section `About You`. `test:onboarding-presentation` [8]/[9]/[10] enforce it both directions |
| A6 | signed copy — `rules/signedCopy.ts`, `rules/projectionCopy.ts` (or a small new registry module) | onboarding screens today render RAW literals counted against `ATHLETE_VISIBLE_GAP_CEILING = 580`, a shrink-only ratchet (`signedCopyExtractionTests.ts:612`) | register `What is your gender?`, `Male`, `Female` (+ the review row label) BEFORE the screen ships — R-130 signed copy; pattern: `rules/gameFeedback.ts:15-46`. Copy-sheet batch row in `docs/COPY_SHEET_RULINGS_2026-07-30.md`; if a new module authors the words, add it to `AUTHORING_MODULES` (`copyRulingsBindingTests.ts:108-172`) |
| A7 | field-influence bookkeeping | (a) programming consumer OR (b) declaration, never both (`onboardingFieldInfluenceTests.ts:161-170`) | slice 1: declare in `rules/onboardingFieldInfluence.ts` with an R-130 ruling string; slice 2: REMOVE the declaration when the charter/engine consumes it |
| A8 | immutability | every post-onboarding edit surface is an explicit field list (`rules/profileSetupChange.ts:50-155`, `utils/coachProgramEdit.ts:2047-2058`, etc.) — gender leaks NOWHERE by default. Two whole-object writers exist: `profileProgramTransaction.applyProfileChange` blind spread (`:108-116`) and the accepted-profile compatibility mirror (`profileStore.ts:663-749`), the latter guarded only against UN-answering, not changing | no edit surface gains the field (immutability = absence of writer, the repo's shape). ADD one gate cell: no setup/coach patch builder ever carries `gender`, and the mirror-refusal question of changed-answered-values gets a cell or a recorded decision. Full reset (`resetCoach.ts:530`) re-runs onboarding and wipes it — correct: new athlete, new answer |
| A9 | fixtures/seeds | `dev/e2e/devE2EStandardProfile.ts:3-65`, `DEV_TEST_ONBOARDING_DATA`, `COMPLETE_IN_SEASON_PROFILE`, `samExport8Profile()`, stage-b `scenarios.ts:91-250`, `resetCoach.ts:271-277` dev seed — none carry gender; every suite that generates will hit `missing_required_profile` once the step lands | all stamped `gender: 'male'` (male ≙ today, and it IS the byte-identity control). `LAW-test-worlds-are-generated-or-real` (`lawRegistry.ts:361`) is the precedent for why seeds must gain required fields |

**B. The switch (charter + placement)**

| # | place | today | becomes |
| --- | --- | --- | --- |
| B1 | `rules/sessionTypeCharter.ts` | `placedBy` is ONE static answer per type for the whole app; primer row's own comment records this exact future order (`:393-398`) | **the design decision of the job**: the placement answer becomes per-path IN THE CHARTER'S OWN SHAPE (e.g. `placedBy` keyed by path, male column = today's ruled answers verbatim). Gunshow: male `['generator','athlete']` (ruled, still in placement debt until the G−1 rebuild — see Q1), female `['athlete']`. Primer: male `['athlete']`, female `['generator','athlete']`. Debt entries + `CHARTER_DEBT_CEILING` move in the SAME commit (ratchet direction 4) |
| B2 | `utils/coachingEngine.ts` `CoachingInputs` (`:172-247`) + `onboardingToCoachingInputs` (`:7534`) | carries profile-derived scalars; no path fact | one new field (e.g. `athletePath`). This is the programming consumer that satisfies A7's flip. NOTE `coachingEngine` edits load `.claude/rules/coach-and-plan-edits.md` — the fix-the-layer law; the field is data threading, not a phrase branch |
| B3 | `rules/weeklyScheduler.ts` / `rules/scheduleToCoachingPlan.ts` (`ConnectorInput` carries `coachingInputs` + plural `gameDays`) | live path never stamps `composedOptionalKind`; G−1 placement is on the demolition rebuild list, owner = scheduler | female + in-season + **single**-game week (`gameDays.length === 1`) + G−1 otherwise empty → one `tier:'optional'` allocation stamped `composedOptionalKind:'primer'`. Multi-game → none (R-130). Bye/away (no fixture) → no G−1 → none, same as gunshow's old fixture-relative law. Optional + `required:false` counting means the placed Primer cannot break the rest quota or the week's shape — the charter's counting row already guarantees the non-goal |
| B4 | `data/defaultProgram.ts:2431-2470` | the composed-optional materialiser is BINARY: `composedOptional === 'gunshow' ? 'arms_pump' : 'prehab_accessories'` — a `'primer'` marker today would build PREHAB | three-way: `'primer'` → `buildDerivedSession('primer', …)` (the R-129 builder, already marker-stamping via `COMPOSED_OPTIONAL_KIND_BY_TYPE`, already exempt from `finaliseWorkoutAfterMutation` via the `:642` early return, already taxonomy/timeline/load-entry/checklist-wired). The placeholder-row guard at `:1168-1170` already covers marked days |
| B5 | `rules/g1LandingAsk.ts:344-372,425-465` | routes `take_the_gunshow` / `accessories_only` build `arms_pump` for everyone; `profile` is already threaded into `placeSessionForRoute` but unused by these branches | per Q3's answer: female → build `'primer'` instead (recommended), male unchanged |
| B6 | `src/__tests__/sessionTypeCharterTests.ts` | Group E generates two programs from ONE profile shape (`samExport8Profile`), classifies via `charterTypesOf` — which has **no primer branch** (a generator-placed Primer would be `unclassifiable`, E3 red); `deviates()` reads one global `placedTypes` set | per-path observation (generate male + female worlds), a `primer` branch keyed on the TYPED marker (never the name — R-129 lesson 4), E1/E2/F-ratchet per path |
| B7 | `src/__tests__/primerSessionTests.ts:474` | asserts the female flip is a FUTURE order | flips to assert the landed state |

**C. The mix (female accessory tables)**

| # | place | today | becomes |
| --- | --- | --- | --- |
| C1 | `rules/sessionSlotCoverage.ts` slot tables + `SLOTS_FOR_KIND` | one table set for the whole app | a FEMALE table set beside it (exact contents = Q2's signed answer), selected by path; male constants byte-untouched. `WEEKLY_COVERAGE_SET` / oracle answers become path-aware only where the tables differ |
| C2 | `rules/composeWeek.ts` `:1267-1269` (table pick), `doseFor` `:894-922` | — | path-aware table pick; dose rows for any new slot. Profile already in scope |
| C3 | `src/__tests__/sessionSlotCoverageTests.ts` | Sam's acceptance cells pin the male tables | female acceptance cells signed the same way (Sam signs the table, the cells hold it) |

**D. The proof surfaces** — `stageBGenerationDifferential/scenarios.ts` (female
scenarios appended LAST, additive-golden discipline the file itself documents at
`:232-237`), plus the fixture stamps in A9. Simulator passes per slice.

---

## BUILD ORDER — VERTICAL SLICES, EACH WITH WHAT SAM SEES ON HIS PHONE

**Slice 1 — the question.** A1-A7, A9 (all fixtures stamped male), copy signed
first (A6). **Phone:** fresh install asks *"What is your gender?"* with two
buttons, `Male` · `Female`, right after the name; the answer shows on the
review screen; onboarding cannot finish without it; nothing offers to change it
afterwards. **Instrument:** stage-b differential vs the COMMITTED golden must
be byte-identical (the male stamp is the control proving male ≙ today).

**Slice 2 — the switch does something.** B1-B4, B6, B7, A7 flip, A8 gate cell.
**Phone (female test profile):** the day before the game shows an optional
**Primer** — bolt, 10 rows in Sam's order, tick boxes, no weight controls
(all inherited from R-129); a two-game week shows none; the Add menu still
offers Gunshow AND Primer. **Phone (male profile):** week unchanged,
byte-identical golden.

**Slice 3 — the mix.** C1-C3 per Q2's signed numbers; female scenarios appended
to the differential (golden grows additively; male bytes untouched).
**Phone (female):** an upper strength day carries midline (core) rows where the
arm/shoulder isolation rows were; a lower day carries one more glute/lower
accessory. **Phone (male):** identical.

**Slice 4 — close-out.** B5 per Q3, full proof protocol run (below), simulator
pass on BOTH paths, registry updated from `WRITTEN` with what is WORKING and
which suites hold it.

Every slice: control-and-candidate measured in a worktree on the same tree
(shared-checkout law), suites named by FAILURE SETS not totals.

---

## QUESTIONS FOR SAM — ANSWERED 2026-08-23, REGISTERED AS **R-130a**

Sam answered all three in one message: **(1) males stay as they are, gunshow
returns later as its own order; (2) the proposed female mix is signed;
(3) the G−1 landing ask offers females the Primer.** Plus: the onboarding step
matches the existing steps' style. The section below is kept as the record of
what was asked and why.

## THE QUESTIONS AS ASKED — with recommendations (all three recommendations taken)

REGISTRY-GREP: R-130, R-129, R-052, R-020, R-105, R-110, R-118, R-120, the
2026-08-19 demolition ruling (area 3), the away/travel gunshow entry. Q1 exists
BECAUSE of a measured fact that post-dates R-130's premise; Q2 and Q3 are
inside R-130's scope but under-determined by his words.

1. **The male Gunshow (new fact).** The app does not auto-place the Gunshow
   before games for ANYONE right now — it was removed on 2026-08-19 by Sam's
   own "reading must not author" demolition, rebuild pending. R-130 and R-129
   both assume males get it. **Recommend: leave males exactly as they are for
   this job** (his own acceptance test — byte-identical male worlds — demands
   it) and restore the male G−1 Gunshow as its own later order if he wants it;
   the placement mechanism built in slice 2 makes that a one-row change.
2. **The exact female mix.** R-130 rules the direction, not the numbers.
   **Recommend, as a signable table:** upper days — the arm/shoulder isolation
   rows (triceps + shoulders on push day, biceps + traps on pull day; the one
   arm-or-shoulder row on the combined upper day) become midline + one
   glute/lower accessory; lower days — one extra glute-biased lower accessory
   row. Session lengths unchanged.
3. **The day-before-game ask.** When an athlete moves a session onto G−1 the
   app offers *"take the Gunshow"*. **Recommend: for females that offer
   becomes the Primer** (Gunshow stays in the Add menu, per his own ruling).

---

## THE MALE-PATH PROOF — HOW "NOTHING MOVED" IS MEASURED, NOT CLAIMED

**The instrument is `test:stage-b-generation-differential`** — already the
repo's byte-identity harness: deterministic generation (date-seeded, no RNG;
double-run identity asserted BEFORE the golden is consulted), pinned clock/TZ,
volatile keys scrubbed, a committed 2.96 MB golden over 15 scenarios, strict
`golden === current` with first-divergence reporting.

1. **Entry control (slice 1):** stamp every fixture `gender:'male'`, change
   nothing else, run the differential — **must equal the committed golden
   byte-for-byte**. That single run proves "male answer ≙ today's app" at the
   front door.
2. **Every slice:** the existing 15 scenarios' bytes never move. Female
   scenarios are APPENDED (the file's own additive-golden discipline), so any
   male-side drift shows as a diff inside the frozen region, not a rewrite.
3. **End-to-end control:** worktree run of `scripts/sweep.sh` on `main` vs
   candidate; compare **failure NAME sets** per suite, not totals. Expected
   deltas are enumerated in advance (charter suite reshaped per-path, primer
   test flip, new cells) — anything else is a defect. Door matrix holds 416/15
   with no NEW red names. Typecheck ratchet equal to control.
4. **Known-red honesty:** charter E1/E2/F2 are red on `main` today (recorded
   above); the candidate states its own expected charter verdict rather than
   inheriting a green it never had. `test:scenarios`/`test:qa` are pass-count
   instruments only (no TZ pin, live timestamps — not byte-comparable).
5. **On glass:** male profile simulator pass — week screen, empty G−1, Add menu
   (Gunshow above Primer, R-120 order) — unchanged; female pass shows slices
   2-3's items. The athlete-read surface is the primary proof (R-129's law),
   the golden is the breadth.

**Probe files: none. Nothing in `src/` changed by this seat. One suite was RUN
read-only for the baseline.**

---

## 2026-08-23, AFTERNOON — R-130a RECEIVED; THE PROOF INSTRUMENT WAS BROKEN ON `main` AND IS REPAIRED

**Sam answered all three questions (R-130a):** males stay as they are (gunshow
returns later as its own order), the proposed female mix is signed, the G−1
landing ask offers females the Primer. Onboarding step must match the existing
steps' style.

### ⚠ THE DIFFERENTIAL WAS RED ON CLEAN `main`, AND THE CAUSE WAS A SECOND GAME-ANCHOR OWNER

Before slice 1, the baseline run failed: **~75k of 76k golden lines diverged on
an untouched tree** (verified in a clean worktree at `b501b665`, exit 1 — my
first read had piped through `tail`, which masked the exit code). First
divergence: the modes census lost `in_season_game_week` for `in_season_bye_build`
— **every in-season scenario was building a BYE world.**

**ROOT CAUSE, one line:** `rules/weeklySchedulerInputs.ts` fell back to
`dayNumber(profile.gameDay)` — the LEGACY field — where the rest of the app
reads `storedGameAnchor` (usualGameDay first; the one-owner rule of
`rules/gameAnchor.ts`, Sam 2026-08-12). The differential's in-season scenarios
(and any real athlete anchored only by `usualGameDay`, e.g. via phase shift)
got bye weeks from the live scheduler path while `onboardingToCoachingInputs`
said `hasGame: true` for the same profile. The regression became load-bearing
when burn-the-boats made the scheduler path the sole planner; the differential
had not been run since — **the golden was 17 days stale (last regen 2026-08-06)**.

**FIX + MEASUREMENT (commit `3ebd5662`):** both reads now go through
`storedGameAnchor`. A/B in the worktree (fix on vs off): charter 40/3,
qa 148/37, scenarios 53/12 — **failure-name sets byte-identical**, so the fix
moves nothing but usualGameDay-anchored worlds. Golden regenerated in the clean
worktree with only the fix applied: determinism double-run PASS, all 8 modes
back. **That golden is the R-130 male baseline** — the residual Aug-06→Aug-23
movement is seventeen days of ruled work and is not re-adjudicated here.

### SLICE 1 — BUILT, SUITES IN FLIGHT

- `rules/onboardingGenderCopy.ts` — the four strings registered FIRST (question,
  Male, Female, review label), batch 36 in the copy sheet doc.
- `types/domain.ts` `AthleteGender` + `gender?:` (the `?:` convention the
  influence gate pins; requiredness lives in the step registry).
- `utils/onboardingSteps.ts` — `Gender` step directly after `Name`,
  `visible: always`, satisfied only by the two literal answers.
- `screens/onboarding/GenderScreen.tsx` — GymExperience's exact shape
  (OnboardingLayout, SelectableTile, commit-on-tap, 250ms advance), every word
  from the signed sheet. Navigator + param list + `NameScreen` re-pointed.
- `reviewRows.ts` — one row, About You, value via `genderAnswerText`.
- Central fixtures stamped `gender: 'male'`: `devE2EStandardProfile`,
  stage-b `baseProfile`, `samDeviceExport8Fixture`, `COMPLETE_IN_SEASON_PROFILE`.

**FIELD-INFLUENCE NOTE, so nobody reads it as gamed:** the gate's textual
consumer match is satisfied by `rules/onboardingGenderCopy.ts`; the REAL
programming consumer (charter/scheduler/composer) lands in slice 2 of this same
task, with an engine-door refusal in the `generationSeasonPhaseOrThrow` shape —
no default-for-the-unrecorded.

**GENERATION-DOOR FACT for slice 2:** generation refuses per-field via
`*OrThrow` doors only; `missingRequiredProfileFields` is diagnostics. So the
gender refusal at the engine door is slice-2 work, and inline test profiles
missing the stamp will surface THERE, not in slice 1.
