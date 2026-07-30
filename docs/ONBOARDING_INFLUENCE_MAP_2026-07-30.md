# The onboarding influence map — every answer, every consumer, its authority

**Sam's commission, 2026-07-30:** the full map of how every onboarding answer
influences the program. **Consolidated, not reinvented** — this sweeps the authored docs
and the code and puts one table where several partial answers were.

**Survey only. No behaviour changed by this document.** It is the signing surface for the
gaps it exposes, and Stage B's onboarding contract.

**How to read the authority column**, and it is the whole point of the exercise:

| Mark | Means |
|---|---|
| **[BIBLE]** | a Bible line says it; the line is quoted |
| **[RULED]** | Sam ruled it outside the Bible; the ruling is named |
| **[MINE]** | an agent chose it, marked as such, visible as a choice |
| **UNAUTHORED** | no line, no ruling, no marking — it just happens |

**The two findings the format is designed to surface**, same discipline as the placement
sheet: **fields with NO consumer** (stored, influences nothing) and **consumers with NO
authority**. Both are named plainly below rather than left to be inferred from silence.

---

## §1 — THE HEADLINE, before the detail

**33 onboarding fields. 8 influence nothing about the program.** Of the 25 that do, **6
influence it through a mechanism nobody authored.**

The three that matter most:

1. **`ageRange` has exactly one consumer in the entire app: the coach prompt.** It
   reaches no rule, no dose, no filter. An athlete tells us their age band and it
   changes nothing they will ever see in a program.
2. **`biggestLimitation` — the weakness answer — was UNAUTHORED until today.** Its whole
   mechanism (`rules/testingBias.ts`) arrived in commit `3d13477 "Add deterministic
   testing bias"`: a subject line, no body, no ruling cited, no changeset. Two of its
   seven answers leaned nothing at all. It is now bound to `:105` (Sam's reading-A
   ruling, same day as this document) — so it moves from UNAUTHORED to [BIBLE] in the
   same pass that found it.
3. **`heightCm` and `weightKg`** reach the load estimator and the coach prompt, and
   nothing else. No Bible line governs how bodyweight sets a starting load; the
   estimator's ratios are [MINE].

---

## §2 — THE MAP

### 2.1 Identity and context

| Field | Consumers | What it changes | Authority |
|---|---|---|---|
| `firstName` | copy surfaces, coach prompt | the athlete's name in text | n/a — not programming |
| `ageRange` | **coach prompt only** | **NOTHING in the program** | **NO CONSUMER** (see §3) |
| `position` | `rules/programmingBias.ts`, `positionRoleBuckets`, 41 rules/data sites | role bucket → small strength/accessory/conditioning leans | **[BIBLE]** §10 "Position / role bucket rules"; the Bible states position bias matters most in off-season (`:3070`) |
| `motivation` | `coachingEngine` (split into `goals`), `recoveryAddonBuilder`, generation prompt `primaryFocus` | goal bias; add-on focus preference | **[BIBLE]** §12 "Goals rules" — but the SPLIT of a comma string into goals is [MINE] |
| `goals` | `rules/programmingBias.ts`, `testingBias` composition | goal-direction lean, capped | **[BIBLE]** §12 |
| `biggestFrustration` | **generation prompt only** (`generateProgram:968`) | free text into the AI prompt | **NO PROGRAMMING CONSUMER** |
| `successVision` | **generation prompt only** (`generateProgram:969`) | free text into the AI prompt | **NO PROGRAMMING CONSUMER** |
| `heightCm` | `loadEstimation`, coach prompt | nothing on its own | **NO RULE** — see `weightKg` |
| `weightKg` | `loadEstimation`, `deloadWeekRules` rounding, snapshots | starting loads for bodyweight-relative lifts | **[MINE]** — the estimator's ratios cite no Bible line |

### 2.2 Season, fixtures and the week's skeleton

| Field | Consumers | What it changes | Authority |
|---|---|---|---|
| `seasonPhase` | 113 rules/data sites; the phase clock owns it | EVERYTHING structural — phase tables, deload ladder, sprint floors, mobility permission | **[BIBLE]** §1, and the phase clock is **[RULED]** (phase-ownership collapse, merged `46fe2df`) |
| `gameDay` / `usualGameDay` | contract anchors, `applyGameProximity`, G-1/G-2/G+1 rules | the week is built around it | **[BIBLE]** §2 "Game day is the main anchor of the week"; G-1/G-2/G+1 each have anchors |
| `teamTrainingDays` / `teamTrainingDaysPerWeek` | contract anchors, conditioning credit, hard-day budget | team nights count as running, sprint and conditioning exposure | **[BIBLE]** §2 "Team training is treated as a real training session" |
| `teamTrainingIntensity` | `coachingEngine` stress classification | team-day stress level | **[MINE]** — the Bible describes team training's load qualitatively; the intensity ANSWER's mapping to a stress tier cites nothing |
| `teamTrainingDuration` | **onboarding review + coach prompt only** | **NOTHING in the program** | **NO CONSUMER** |
| `trainingDaysPerWeek` | availability resolution, phase-planner `availableDayCount` | how many days the contract may use | **[BIBLE]** §2 availability; the SELECTION table is **[RULED]** (§18 phase planner) |
| `preferredTrainingDays` | `daySlots`, top-up candidate days | WHICH days | **[RULED]** — the athlete's declared days are an input, per the north star |
| `trainingDaysUnsure` | onboarding + profile screens, `profileSetupChange` | which onboarding path they took | n/a — not programming |
| `availabilityConstraints` | 12 sites incl. equipment/schedule constraints | date-ranged availability | **[RULED]** — the constraint system |

### 2.3 Capability and capacity

| Field | Consumers | What it changes | Authority |
|---|---|---|---|
| `experienceLevel` | `experienceCrosswalk` → the four-rung ladder, `trainingAgePolicy`, exercise gates | which exercises are offered; beginner dose | **[BIBLE]** §11 + **[RULED]** (the experience crosswalk, Bible amendment 2026-07-27) |
| `conditioningLevel` | `capacityRubric` (with `recentTrainingLoad`), `testingBias` | the CAPACITY score → dose, never structure | **[BIBLE]** §9 — "Both answers are required; there is no default and no unknown tier" |
| `recentTrainingLoad` | `capacityRubric` | same | **[BIBLE]** §9 |
| `squatStrength` / `benchStrength` | `loadEstimation`, `testingBias` bands | starting loads; a small testing lean | **[MINE]** for the bias bands; loads as above |
| `sprintExposure` | `testingBias` (a "no sprint training" answer leans speed) | template preference | **[MINE]** |
| `twoKmTimeTrial` | `data/twoKmTimeTrial` → MAS derivation, `masCopy` | MAS-based conditioning prescriptions | **[RULED]** — "every 2km number Sam ruled" (`data/numericBound.ts`) |
| `biggestLimitation` | `rules/weakPointFocus.ts` → `testingBias` | exercise/template SELECTION only; leans the optional top-ups for a mobility/injury answer | **[BIBLE]** `:105`, as of Sam's reading-A ruling 2026-07-30. **Was UNAUTHORED** — see §1 |

### 2.4 Equipment and place

| Field | Consumers | What it changes | Authority |
|---|---|---|---|
| `trainingLocation` | `inferEquipment`, athlete context | which equipment tags are assumed | **[MINE]** — the location→tags table cites no line |
| `equipment` | 89 rules/data sites; `equipmentAvailability`, every pool filter | which exercises exist for this athlete | **[RULED]** — the equipment lattice and its provenance lock |
| `equipmentSelectionCompleteness` | `equipmentAvailability`, `profileProgramTransaction` | whether to trust the equipment answer | **[RULED]** — the honest-failure ruling |

### 2.5 Injuries

| Field | Consumers | What it changes | Authority |
|---|---|---|---|
| `injuries` | 24 rules/data sites; `injuriesToTags` → every pool filter, `testingBias` robustness lean | which movements are excluded; prehab lean | **[BIBLE]** §8 "Injury is a dialogue, not a diagnosis" + the 1,937-cell injury matrix **[RULED]** |
| — | `sessionBuilder.INJURY_BODY_AREA_MAP` (~30 keys) | body part → injury tag | **UNAUTHORED**, and it disagrees with two other maps — census **LR-27** |

---

## §3 — FINDING 1: fields with NO consumer

**Eight answers the athlete gives that influence nothing about their program.**

| Field | Where it goes | Verdict |
|---|---|---|
| `ageRange` | coach prompt | **the sharpest one.** One consumer, and it is a string in a prompt |
| `teamTrainingDuration` | onboarding review, coach prompt | asked, shown back, never used |
| `biggestFrustration` | generation prompt | free text to the AI, no rule |
| `successVision` | generation prompt | free text to the AI, no rule |
| `heightCm` | load estimator (with weight), coach prompt | influences nothing on its own |
| `firstName` | copy | correctly not programming |
| `trainingDaysUnsure` | onboarding path | correctly not programming |
| `equipmentSelectionCompleteness` | trust gate | correctly not programming — it governs whether another answer is believed |

**The four that need a ruling are the first four.** Each is a question we ask an athlete
during onboarding whose answer cannot change their program. Sam's options are the same
three every time: **give it a consumer**, **stop asking**, or **declare it
context-for-the-coach-only** so the honest state is recorded.

`ageRange` is the one I would raise first. Age plausibly belongs in the capacity rubric
or the experience ladder, and it is currently the only onboarding answer that is *purely*
prompt decoration.

---

## §4 — FINDING 2: consumers with NO authority

**Six mechanisms that change the program with nothing behind them.**

| Mechanism | What it decides | Why it is UNAUTHORED or [MINE] |
|---|---|---|
| `rules/testingBias.ts` direction table | template/exercise leans from strength, conditioning, sprint and limitation answers | originating commit `3d13477` is a subject line — no ruling, no changeset. **The `biggestLimitation` half is now bound to `:105`; the squat/bench/sprint bands are still [MINE]** |
| `loadEstimation` bodyweight ratios | starting loads for every lift | no Bible line sets a load from bodyweight |
| `LOCATION_EQUIPMENT` (`inferEquipment`) | which equipment a location implies | a plausible table nobody signed |
| `teamTrainingIntensity` → stress tier | whether a team night is a hard day | the Bible describes team load qualitatively and names no mapping from this answer |
| `INJURY_BODY_AREA_MAP` and its two siblings | body part → filtered movements | three maps, different coverage — census **LR-27** |
| `motivation` comma-split into `goals` | goal bias inputs | the storage shape is a string; the split is an implementation choice |

**The pattern is worth naming:** every one of these is a **table that turns an answer into
a number or a tag**. The answers are Sam's, the categories are usually Sam's, and the
TRANSLATION between them is where authorship silently stops. That is the same finding the
placement sheet made about composition ("four of the eight place a focus STRING") and the
mobility bundles made about grouping — his exercises, an agent's arrangement.

---

## §5 — WHAT THIS DOCUMENT DOES NOT DO

- **It changes no behaviour.** Survey first, per the commission.
- **It does not rank the gaps.** §3 and §4 are findings, not a plan; the sequencing is
  Sam's.
- **It does not cover the coach prompt's contents.** Several fields reach the AI prompt
  and nothing else; what the prompt then does with them is the coach pipeline, and LR-6
  is a standing stop on that.
- **It does not audit the onboarding SCREENS** — bounds, keyboard, copy. Those have their
  own units and gates.
- **It is a snapshot with a date.** The consumer counts were taken by sweep on
  2026-07-30; a field gaining a consumer does not update this file by itself, which is
  why the two findings name mechanisms rather than counts.

---

## §6 — WHAT I NEED FROM SAM

1. **The four no-consumer questions** (`ageRange`, `teamTrainingDuration`,
   `biggestFrustration`, `successVision`): give each a consumer, stop asking it, or
   declare it coach-context-only?
2. **`ageRange` specifically** — should it reach the capacity rubric or the experience
   ladder? It is the only purely-decorative answer.
3. **The six unauthored translations in §4** — which get ruled, and which get deleted? The
   `testingBias` bands and the load-estimator ratios are the two that move real numbers.
4. **`teamTrainingIntensity` → hard day.** This one decides whether a team night eats the
   week's hard-day budget, which is as structural as anything in the app, and it rests on
   an unmapped answer.
5. **Is a "declared coach-context-only" category acceptable at all?** If yes, it needs a
   home in the code and a gate, so a field cannot drift back into decorative silence.
