# STATUS — seat `conditioning`

Opened 2026-08-17. Base `1248be77`. Branch `feat/conditioning-completion`,
built in an isolated worktree so the shared checkout is never switched.

Mission: CONDITIONING COMPLETION — one canonical producer, real sessions, real
recovery response.

---

## THE FIRST TRACE — 2026-08-17

Instrument: `scripts/probe-noclub-conditioning-trace.ts`. It wraps three LIVE
seams (`scheduleWeek`, `materialiseAuthoredSessions`, `validateGeneratedWeek`)
and prints what each one saw. It builds no second plan.

World: 4 gym days (Mon Tue Thu Fri), **no club**, Full Gym, Saturday game,
block 1 week 1, `todayISO 2026-07-13`.

### Pre-season, no club — what the scheduler AUTHORISED

| day | owner | conditioning | category | clause |
| --- | --- | --- | --- | --- |
| Mon | strength `lower` | `off_leg` | `aerobic_base` | WC-111 |
| Tue | strength `upper` | `running` | `tempo` | WC-111 |
| Wed | rest_or_recovery | — | — | WC-042 |
| Thu | strength `upper` | — | — | WC-111 |
| Fri | rest_or_recovery | — | — | WC-042 |
| Sat | game | — | — | WC-050 |
| Sun | rest_or_recovery | — | — | WC-042 |

**Two app conditioning exposures. The approved source asks for four.**

### What the specialist SUPPLIED

| day | template | quality | intensity |
| --- | --- | --- | --- |
| Mon | Continuous Aerobic Run | `aerobic_capacity` | 65–80% MAS |
| Tue | 30:30 Controlled Tempo Blocks | `aerobic_capacity` | 65–80% MAS — controlled, NOT max |

**Both `aerobic_capacity`. No hard conditioning exists in the week.**

### In-season, no club

Identical shape plus **Wed `sprint_high_speed` / `sprint` / WC-135 standalone**,
which materialises `10 m Acceleration Reps` (`acceleration`, 95–100%). So the
in-season no-club **sprint** exposure IS placed at HEAD, on G-3, correctly.

> ⚠ **A PRIOR CONCLUSION THAT NO LONGER HOLDS.** My own note
> ([[the-ladder-and-two-gates-one-fixture]]) recorded *"a clubless pre/in-season
> athlete has NO legal week at ANY count — `sprint_high_speed_required_minimum:0`"*,
> measured at `3b5b59d0`. **WC-135 has since landed and that clause no longer
> fires on this world.** The 180-world refusal census at `1248be77` shows the
> surviving refusal families are **not** no-club-specific (10 club worlds vs 10
> no-club in family 1; 8 vs 8 in family 2). The remaining no-club defect is a
> SILENT shortfall, not a refusal.

---

## ROOT CAUSE — ONE READER MISSING, ONE MAP TOO SMALL

**1. The per-phase conditioning contract is WRITTEN AND NEVER READ.**

`weeklyProgrammingContract.ts` already carries `PhaseOverlay.conditioningTarget`
with the authored numbers:

| overlay | conditioningTarget | sprintExposureRequired | runningRequired |
| --- | --- | --- | --- |
| `PRESEASON_OVERLAY` (WC-133) | **4–4** | true | true |
| `INSEASON_OVERLAY` (WC-134) | 3–5 | false | true |
| `early_optional` (WC-130) | **0–3** | false | **false** |
| `transition` (WC-131) | 3–4 | false | true |
| `normal_build` (WC-132) | 3–5 | **true** | true |

`grep` for readers of `conditioningTarget`, `sprintExposureRequired`,
`OFFSEASON_OVERLAYS`, `PRESEASON_OVERLAY`, `INSEASON_OVERLAY` outside that one
file returns **nothing**. Three exported constants, zero importers.

Meanwhile `weeklyScheduler.ts:661` budgets from the GLOBAL number:

```ts
let appConditioningBudget = Math.max(
  0, GLOBAL_RULES.conditioning.min - anchorConditioningDays);   // min = 3, ALL PHASES
```

**So pre-season is budgeted 3 where the approved source says 4**, and the
early-off-season 0–3 ceiling is not consulted at all. This is the repo's known
`canOverride` shape: a field written and read zero times.

**2. The category map cannot NAME a hard quality.**

`weeklyScheduler.ts:695-700` picks the category purely from upper/lower:

```ts
conditioning: PURPOSE_IS_LOWER[purpose] ? 'off_leg' : 'running'
conditioningCategory: CATEGORY_FOR_CONDITIONING[...]
```

and `CATEGORY_FOR_CONDITIONING` has exactly four entries:

    off_leg -> aerobic_base   running -> tempo
    aerobic -> aerobic_base   sprint_high_speed -> sprint

**`vo2` and `glycolytic` are in the `ContractConditioningCategory` union, in
`AthleteConditioningCategory`, and are fully served by the specialist** —
`poolForCategory` maps `vo2 -> aerobic_power` (9 authored templates) and
`glycolytic -> anaerobic` (9 authored templates). **The scheduler simply has no
route that ever names them.** That is why 100% of authored conditioning is
`aerobic_capacity`, and why the Block Two "conditioning difficult / conditioning
easy" rules have no hard session to act on.

**Neither gap is in the specialist, the templates, or the materialisation
boundary. All three are correct and complete. The producer that is incomplete is
the SCHEDULER'S conditioning authorship.**

---

## OWNERSHIP — before

    scheduler authors: count = GLOBAL_RULES.conditioning.min (3, every phase)
                       category = f(upper|lower) only  ->  {aerobic_base, tempo}
                       sprint   = WC-135, in-season no-club only
    specialist picks : the exact template within that category   [CORRECT]
    templates        : 55 authored doses                          [CORRECT]

## MEASUREMENTS AT BASE `1248be77`

- 180-world refusal census: **140 built, 40 refused**, 3 families — none no-club
  specific. Saved: `census-BEFORE.json`.
- Pre-season no-club: **2 app conditioning exposures against a target of 4**.
- Hard conditioning in the corpus so far: **0 sessions** of `aerobic_power`,
  `anaerobic` or `cod_decel` quality reachable by any scheduler route.

---

## SESSION 1 BUILD — WC-136, and the deficit it exposed

`PhaseOverlay` gained `hardConditioning`; the contract gained
`overlayForPhase` and `hardConditioningQualityFor`; `weeklyScheduler` reads
both. Pre-season 4 gym days no club went from **2 exposures, both
`aerobic_capacity`** to **3 app exposures + the game anchor = 4**, with
`Classic 4×4` (`aerobic_power`, 90–100% MAS) on the **upper** day at G-4.

### WORLD TABLE — 180-world census, lost and gained SEPARATELY

| | before `1248be77` | after |
| --- | ---: | ---: |
| built | 140 | 137 |
| refused | 40 | 43 |
| refusal families | 3 | 4 |

**LOST — 3 occurrences, 3 distinct worlds. GAINED — 0.**

    Pre-season/2d/noclub/Full Gym/w2         core_conditioning_required_minimum 3 vs 2
    Pre-season/2d/noclub/Bodyweight Only/w2  core_conditioning_required_minimum 3 vs 2
    Pre-season/2d/noclub/Dumbbells/w2        core_conditioning_required_minimum 3 vs 2

### ⚠ THE OPEN DEFECT — A HARD DAY IS DROPPED IN EVERY WORLD

Measured, not inferred, on `Pre-season/2d/noclub`:

| stage | what it says about Tuesday |
| --- | --- |
| `scheduleWeek` | `off_leg` / `vo2` / `component`, demand `coreConditioning: 3` |
| `materialiseAuthoredSessions` | `Classic 4×4`, `aerobic_power`, `unmaterialised: -` |
| `validateGeneratedWeek` input | **nothing** — no `conditioningBlock`, `section18Evidence.conditioningRole: 'none'`, no `conditioningCategory` |

**The specialist does not refuse. The day is stripped between the coaching plan
and the assembled week**, and it happens in the 4-day world too — that week
simply has a spare exposure to absorb it, so only the 2-day week falls below
the minimum. **The 3 lost worlds are the symptom; the drop is universal.**

Three hypotheses were tested and REFUTED, so none of them is the cause:

1. the specialist refusing `vo2` on an `off_leg` day — it returns `Classic 4×4`
   for `offFeet: true` and `offFeet: false` alike;
2. the legacy name builder having no entry — `buildConditioningTemplate`
   returns rows for all 9 authored names probed, hard ones included;
3. `buildConditioningBlock` rejecting `high-intensity` — it is flavour-agnostic
   and returns `undefined` only for an empty row list.

**NEXT, AND IT IS ONE INSTRUMENTED RUN:** wrap
`assembleAuthoredWeek.adapterContributionFrom` and print the `vo2` day. That
function deletes `conditioningCategory` and `section18Evidence` and forces
`hasCombinedConditioning: false` whenever the adapter day has no
`conditioningBlock` (`assembleAuthoredWeek.ts:179`), which matches the measured
symptom field for field. If it is the site, the question is whether the
composer or the adapter owns conditioning on a combined day — and that is a
BURN-THE-BOATS decision, not a shim.

---

## SESSION 2 — THE LEGACY AUTHORITY IS GONE, AND ONE RED IS OPEN

### The disappearing session, traced to its owner

The assembly boundary was INNOCENT. Instrumented, the `vo2` day reaches
`adapterContributionFrom` intact on weeks 1–3 and arrives **already empty** on
week 2 of the two-day world. The owner is `coachingEngine`'s post-validation
**sprint-rescue**: it took a conditioning slot the scheduler had authored,
cleared eight conditioning fields, and hung a speed block on the wreckage.

**DELETED — 206 lines, no shim, no fallback, no compensating count.** Its job
moved to `weeklyScheduler.appSprintDay`, which places the sprint in every phase
the overlay marks `sprintExposureRequired`, on a FREE day, before conditioning
is authored — so there is nothing left to retrofit.

### World table — LOST AND GAINED SEPARATELY

| corpus | base `1248be77` | after | lost | gained |
| --- | ---: | ---: | ---: | ---: |
| refusal census, 180 worlds | 140 built | **140** | **0** | 0 |
| conditioning census, 198 worlds | 157 built | **157** | **0** | 0 |

Refusal reasons among the still-refused are **byte-identical** to base.

The three worlds lost in session 1 are recovered. A further 8 were lost and
recovered inside session 2 (`2 gym days that are BOTH club nights, no
fixture`), in a no-game shape the 180-world refusal census cannot see because
that corpus always carries a Saturday fixture — **found by my own non-vacuity
cells, not by the census.**

### What the athlete now receives

| | base | after |
| --- | --- | --- |
| authored categories reaching the athlete with no session | 0 | 0 |
| pre-season worlds with a HARD session | **0 of 17** | **15 of 17** |
| in-season GAME weeks with hard | 0 | **0** (correct) |
| in-season BYE weeks with hard | 0 | **1 of 1 per shape** |
| late off-season worlds with hard | **0 of 17** | **13 of 17** |
| qualities delivered | `aerobic_base, sprint, tempo` | `+ vo2` |

### Mutation receipts — `test:conditioning-phase-authorship`, 42 cells

| mutation | result |
| --- | --- |
| M1 `requiresNoGameWeek` → false | 40/42, 2 red |
| M2 conditioning allowed onto club nights | 40/42, 2 red |
| M3 the 48-hour gate removed | 41/42, 1 red |
| M4 budget → phase-blind global minimum | 41/42, 1 red |
| M5 late off-season authors no hard quality | 39/42, 3 red |
| M6 the app sprint never placed | 41/42, 1 red |
| **M7 the readiness floor removed** | **42/42, 0 red — SURVIVES** |
| M8 shortfall may not leave the gym days | 39/42, 3 red |

**M7 IS REPORTED, NOT HIDDEN.** Sweeping 47 built low-readiness worlds on the
mutated tree produced **0 carrying hard conditioning** — the readiness owner
upstream already strips it, so no cell can red on that line. The clause is kept
as deliberate defence in depth, on the same argument
`materialiseAuthoredSessions` makes for re-refusing G-2 lower power, and the
code says so rather than claiming a receipt it does not have.

**Three guards were VACUOUS in the first pass** and the mutations said so —
M2, M3 and M7 all reddened nothing. Each was "a gate no world can reach":
a zero-budget world for the club-night rule, an earliest-first day order that
never enters the 48-hour window with a Saturday fixture, and an upstream owner
already doing the readiness job.

### Gates

| gate | base | after |
| --- | --- | --- |
| `test:compile` | product 35 | **product 35, identical** |
| `test:weekly-scheduler` | 84/84 | **89/89**, registry 43/43 guarded |
| `test:conditioning-phase-authorship` | — | **42/42** (new) |
| `test:conditioning-templates` | — | 95/95 |
| `test:conditioning-dose` | — | 12/0 |
| `test:conditioning-balance-repair` | — | 11/0 |
| `test:conditioning-progression-inputs` | — | 8/0 |
| `test:block-two-progression` | — | 37/0 |
| `test:block-two-difficult-missed` | — | 88/0 |
| `test:block-two-boot-preservation` | — | 20/0 |
| `test:block-two-screen-delivery` | — | 35/0 |
| `test:quiescent-boot` | — | 5/0 |
| `test:conditioning-rotation` | **178/58** | 178/58 — unchanged |
| `test:ladder-wide` | **13/14** | 13/14 — unchanged |
| `test:worn-world-boot` | **0/5** | 0/5 — unchanged |
| **`test:section18-v2`** | **134 pass / 1 fail** | **133 pass / 2 fail — ONE NEW RED, MINE** |

### ⚠ THE OPEN RED — BLOCKS MERGE

`test:section18-v2`, cell *"generated Contract v2 independently satisfies every
planner-selected core target"*. Base fails 1 cell (*"healthy generated TT
resolves to normal unrestricted participation"*); this branch fails that one
**and** the core-target cell.

World: **Pre-season, 6 gym days, club Tue/Thu, no fixture, Elite conditioning.**
Not yet diagnosed. The most likely mechanism, stated as a hypothesis and NOT as
a finding: §18's `deriveConditioningRoles` may not count a `vo2` day toward
`conditioning.core` the way it counts an `aerobic_base` day, so authoring the
hard quality moves an exposure out of the core tally. **Measure
`observation.contract.conditioning.core` for that profile before changing
anything** — and if the hypothesis holds, the owner is §18's role derivation,
not the scheduler.

### NOT COVERED in session 2

- **The three printed weeks are NOT produced yet.** `scripts/print-week.ts`
  exports what is needed; the three worlds are chosen and measured, but the
  markdown is unwritten.
- **Block Two conditioning progression** — *"conditioning easy → progress by
  exactly one authored template step"* is NOT built. The recovery half
  (*"reduce/remove hard conditioning first"*, *"never add in low recovery"*) is
  built and guarded; the progression half is not.
- Persistence/relaunch identity of the new prescriptions is **not** re-proven.
- Suites `test:conditioning-identity`, `test:conditioning-equipment-consistency`,
  `test:standalone-conditioning-ownership`, `test:block-two-ladder`,
  `test:block-two-extra-session`, `test:section18-planner` produce **no totals
  line on base either** — they die at import. Not run, not mine, not fixed.

---

## SESSION 3 — THE §18 RED IS CLOSED. TWO ITEMS ARE NOT DONE.

### Item 1 — DONE, diagnosed at the producer

Contract for `Pre-season / 6 gym days / club Tue+Thu / no fixture`:

| tree | week | categories | achieved | shortfall |
| --- | --- | --- | ---: | ---: |
| base | 1–4 | `d1:aerobic_base` | 3 | 0 |
| branch (before) | 1–3 | `d1:vo2 d6:aerobic_base` | 4 | 0 |
| branch (before) | **4** | `d6:aerobic_base` | 3 | **1** |
| branch (after) | **4** | `d1:aerobic_base d6:aerobic_base` | 4 | **0** |

**Week 4 is the scheduled block deload.** The scheduler authored a hard session
into it; the deload machinery downstream stripped that session; the scheduler's
demand still counted it. Fixed by giving the scheduler `weekKind` and refusing
to AUTHOR hard work in a deload, so nothing downstream has to remove one.
**§18 untouched, no baseline reset, no fallback.** `test:section18-v2` returns
to **134 passed / 1 failed — identical to base**.

**This also resolved the M7 objection.** The gate is now ONE question with two
arms — scheduled deload OR declared low readiness — and the deload arm is
reachable and is what closed this red. It is no longer a redundant second
authority.

### Item 4 — DONE

`docs/printed-weeks/7-no-club-pre-season.md`, `8-no-club-in-season.md`,
`9-later-off-season.md`, produced by the EXISTING printer (three scenarios
added, no second harness).

⚠ **THEY DO NOT MEET THE MISSION'S OWN BAR.** The sessions carry quality,
intensity and the authored effort cue, but the DOSE prints as `1 × 1` / `4 × 1`
— the templates' `workPeriod`, `restPeriod`, `setsRounds`, `workToRest` and
`totalSessionTime` never reach the page. This is the pre-existing
projection-owned defect P2 (*144 of 2,688 rows*), not something this unit
introduced, but it defeats *"Sam must be able to judge the actual conditioning
sessions, doses and spacing."* **Sam can judge the SPACING and the CHOICE of
session from these files; he cannot judge the dose.**

### Items 2 and 3 — NOT DONE

**Item 2's machinery already exists and is already wired.**
`decideBlockBoundaryConditioning` + `applyBlockBoundaryConditioning` fire on
`history.reduces`, replace every hard category with `EASIER_AEROBIC_CATEGORY`,
and re-select through `selectConditioningTemplate` — the authored owner.
**It was unreachable for exactly the reason this mission names: nothing ever
generated a hard category, so `HARD_CONDITIONING_CATEGORIES.has(...)` was never
true.** It is reachable now. **What is missing is the PROOF** — a real block-1
→ feedback → block-2 rollover guard, with its mutation. Not written.

**Item 3 is not built, and it has a blocker that must be ruled on.**
*"Advance conditioning by exactly ONE authored template step"* has no authored
step to take: `ConditioningTemplate` carries name, quality, dose and
properties, and **no ordering**. Nothing in the sheet says one template is a
step harder than another. The only authored ordering available is the
framework's governing table, which orders QUALITIES by intensity
(`aerobic_capacity → aerobic_power → anaerobic`), and the overlay's own ordered
`hardConditioning.qualities`. **Reading "one template step" as "one quality
rung along the framework's own table" is a defensible design decision but it is
a DECISION, and inventing a step order inside the sheet is what the mission
forbids.** `conditioningProgressionRules` cannot be used — it is marked for
deletion and invents doses.

### Gates at `ca9e563e`

| gate | base | after |
| --- | --- | --- |
| `test:compile` | product 35, 6 pairs worse | **identical** |
| `test:section18-v2` | 134/1 | **134/1 — identical** |
| `test:weekly-scheduler` | 84/84 | **89/89** |
| `test:conditioning-phase-authorship` | — | **42/42** |
| `test:conditioning-templates` | — | 95/95 |
| `test:conditioning-dose` | — | 12/0 |
| `test:block-two-progression` | — | 37/0 |
| `test:block-two-difficult-missed` | — | 88/0 |
| `test:block-two-boot-preservation` | — | 20/0 |
| `test:quiescent-boot` | — | 5/0 |
| `test:ladder-wide` | 13/14 | 13/14 — unchanged |

### World tables — final, lost and gained SEPARATELY

| corpus | base | after | LOST | GAINED | reason changes |
| --- | ---: | ---: | ---: | ---: | ---: |
| refusal census, 180 worlds | 140 built | **140** | **0** | 0 | **0** |
| conditioning census, 198 worlds | 157 built | **157** | **0** | 0 | **0** |

### ~~MERGE RECOMMENDATION — DO NOT MERGE~~ — SUPERSEDED, see session 4.

---

## SESSION 4 — WC-137, BOTH ROLLOVERS PROVEN. **MERGE.**

### Sam's ruling on what "one step harder" means — built as stated

`src/rules/conditioningDoseStep.ts`. A step stays INSIDE the quality and inside
the sheet's own numbers: `nextAuthoredDose` reads the authored `setsRounds`,
`workPeriod` and `restPeriod` ranges through `parseConditioningDose` and
returns the next authored value, smallest first.

| rule | where it lives |
| --- | --- |
| 1 — in-season may hold | `decideBlockBoundaryConditioningAdvance` refuses In-season |
| 2 — smallest authored increase, same quality | `nextAuthoredDose`, sets → duration → rest |
| 3 — easy aerobic → tempo after REPEATED easy | **NOT BUILT — see below** |
| 4 — aerobic power never auto-becomes anaerobic | **structural** — the stepper is handed the session's own template and can only return a bigger dose OF THAT TEMPLATE |
| 5 — no valid next dose → hold and report | three typed reasons; `applyBlockBoundaryConditioningAdvance` changes nothing |

**Rule 3 is deliberately unbuilt, and says so at the code that would host it.**
*"Repeated"* is the blocker: the app records whether THIS block was easy and
nothing records whether the one before it was. Building it on a single easy
block would be a different rule from the one ruled. It is a *"may"*, so leaving
it costs the athlete a permission and never a required exposure.

⚠ **The app already prescribes the MIDPOINT of an authored range**
(`headlineSets` uses `doseMidpoint`), so Sam's *"low-end → normal dose"* rung is
spent before feedback exists. Stated in the module rather than left as a trap.

### The two rollover proofs — `test:conditioning-rollover`, 21 cells

Every cell generates block 1, writes the athlete's feedback about THAT block,
generates block 2 and reads it. **Block 1 genuinely containing a hard session is
asserted before any response is** — that precondition is what this whole mission
created, and without it both proofs are vacuous.

| proof | result |
| --- | --- |
| hard + poor recovery → no hard survives, exposure RETAINED, authored replacement, strength load NOT raised | PASS |
| conditioning easy + strength difficult → exactly the next authored dose, never beyond the authored max, strength does not progress | PASS |
| in-season holds for freshness | PASS |
| everything-easy does NOT reach this ladder | PASS |
| reduce outranks advance, and nothing is stepped on a brutal block | PASS |

### Mutation receipts — all six red

| mutation | result |
| --- | --- |
| N1 reduce never fires | 19/21, 2 red |
| N2 advance never fires | 20/21, 1 red |
| N3 in-season hold removed | 20/21, 1 red |
| N4 `strengthEasy` gate removed | 20/21, 1 red |
| N5 authored maximum uncapped | 20/21, 1 red |
| N6 reduce no longer outranks advance | 20/21, 1 red |

**Three were vacuous first and the FIXTURE was the fault, not the code.**
N4: the strength verdict is only read on a day carrying no conditioning answer,
and the fixture put a conditioning RPE on every date — `strengthEasy` could
never be true. N5: the cell compared applied sets against the stepper's own
answer, so uncapping moved both sides together. N6: *"nothing hard survives"*
missed the advance quietly stepping the EASED session.

### Gates at merge

| gate | base `1248be77` | branch |
| --- | --- | --- |
| `test:compile` | product 35, 6 pairs worse | **identical** |
| `test:section18-v2` | 134 / 1 | **134 / 1 — identical** |
| `test:ladder-wide` | 13/14 | 13/14 — identical |
| `test:block-state`, `test:block-rollover` | no totals (die at import) | identical — not run, not mine |
| `test:weekly-scheduler` | 84/84 | **89/89** |
| `test:conditioning-rollover` | — | **21/21** (new) |
| `test:conditioning-phase-authorship` | — | **42/42** (new) |
| `test:conditioning-templates` | — | 95/95 |
| `test:conditioning-dose` · `-balance-repair` · `-progression-inputs` | — | 12/0 · 11/0 · 8/0 |
| `test:section18-safety` | — | 37/0 |
| `test:block-two-progression` · `-difficult-missed` · `-boot-preservation` · `-screen-delivery` | — | 37/0 · 88/0 · 20/0 · 35/0 |
| `test:quiescent-boot` | — | 5/0 |

### World tables — final

| corpus | base | branch | LOST | GAINED | reason changes |
| --- | ---: | ---: | ---: | ---: | ---: |
| refusal census, 180 worlds | 140 built | **140** | **0** | 0 | **0** |
| conditioning census, 198 worlds | 157 built | **157** | **0** | 0 | **0** |

No baseline, ratchet or allow-list was reset.

### MERGE RECOMMENDATION — **MERGE**

All four items hold. Two knowingly-unfinished things, neither a blocker and
both Sam's call, not a defect to hide:

1. **Rule 3** needs a repeated-easy signal the app does not record.
2. **The printed weeks still show `1 × 1`** instead of the authored work/rest.
   Sam ruled this to projection cleanup and out of scope here.

## LEDGER — outside this mission, untouched

- **`test:compile` is RED on `main` at `1248be77`**, identically: 6 file/scope
  pairs in `src/__tests__/bibleConformance/observations/*`, all rooted in a
  missing `../support/coachingPlanForTests` module that is absent at HEAD.
  Product scope is 35 errors before and after this change. Not mine, not fixed.
- **A hand-built `generationConstraints` argument to `generateProgramLocally`
  is SILENTLY DISCARDED.** `buildGeneratedMicrocycles` branches on
  `args.activeConstraints` being truthy and the entry point defaults it to
  `[]`, which is truthy. Measured: passing a `readiness: { deloaded: true }`
  constraint yields `lowReadiness=false, gcReadiness=null` at the scheduler.
  Any suite driving readiness that way is testing a healthy athlete.
  `src/__tests__/section18ContractV2Tests.ts:428` does exactly this.
- **An athlete with NO club night AND NO fixture refuses at base in every
  phase**, and four off-season gym days trip `main_strength_permitted_maximum`
  at base. Both cost me three red cells before I control-ran on a second
  worktree at `1248be77`. Pre-existing, unrelated to conditioning.

---

## SESSION 5 — PRINTED-WEEK CORRECTION. **1 of 3 DONE. DO NOT MERGE.**

Branch `fix/printed-week-coaching`, base `bb4a1c70`, UNMERGED.

### Finding 1 — FIXED AND VISIBLE

Traced contract → stored → projection:

| stage | Saturday |
| --- | --- |
| stored program | `workoutType=Game`, `tier=core`, `authoredDay.anchor="game"` |
| exposure contract | anchor `practice_match-6`, claims conditioning + sprint + hardDay |
| resolved day | **`source=rest`, NO WORKOUT** ← the loss |
| printed | `Rest Day` |

`sessionResolver.ts:1251` gated the visible fixture stub on
`seasonPhase === 'In-season'`. A PRE-SEASON athlete with a declared fixture saw
a Rest Day while the contract counted the anchor toward four exposures — **an
invisible anchor satisfying the weekly contract.**

**The control that named it:** scenarios 3 and 8 (both in-season) print
`Game Day` from the same read path. Only pre-season did not.

Fixed by asking whether the PHASE HAS FIXTURES. The app already knew a
pre-season fixture is a practice match and already had the signed word for it.
Off-season stays out. **Saturday now prints `Game Day`.**

### Finding 2 — FIXED AT THE GENERATOR, NOT VISIBLE ON THE PAGE

*"Can render off-feet"* is not *"is an off-leg session"*, and **every authored
template lists `run`** — so the existing filter was satisfied by
`Continuous Aerobic Run` (run or BIKE ONLY) while `Steady Blocks` and
`Steady 5 min Blocks` (all four machines) sat unpicked.

`preferRichestOffLeg` ranks by the count of machines the athlete can use,
declared once and read by BOTH choosers (`selectConditioningTemplate` and
`offFeetAlternative`). A preference, never a refusal.

    STORED, after: day=1 cat=aerobic_base offFeet=true
                   rows=["Steady Blocks (3×8 min or 4×6 min)"]

⚠ **THE PRINTED WEEK STILL SAYS `Continuous Aerobic Run`.** A read-path owner
between the stored program and the page re-chooses, and **I did not find it.**
`offFeetAlternative` was the candidate; fixing it did not move the page.
`sessionResolver`'s live calls were traced showing `offFeet=true` reaching the
selector, and the selector asked directly returns `Steady Blocks` — so the
override is downstream of selection, not in it. **That is where the next
session starts.**

### Finding 3 — NOT STARTED

The later off-season printer fixture still declares a Tuesday club night. It
must be rebuilt with zero club nights and the resulting week checked for the
four-day strength skeleton, hard running on an upper day, off-leg lower-day
conditioning and sane spacing.

### Gates — all identical to base `bb4a1c70`

| gate | base | branch |
| --- | --- | --- |
| `test:compile` | product 35, 6 pairs | **identical** |
| `test:conditioning-phase-authorship` | 42/42 | 42/42 |
| `test:conditioning-rollover` | 21/21 | 21/21 |
| `test:weekly-scheduler` | 89/89 | 89/89 |
| `test:conditioning-templates` | 95/95 | 95/95 |
| `test:section18-v2` | 134/1 | 134/1 |
| `test:ladder-wide` | 13/14 | 13/14 |

### World tables — lost and gained separately

| corpus | base | branch | LOST | GAINED | reason changes |
| --- | ---: | ---: | ---: | ---: | ---: |
| refusal census, 180 worlds | 140 | **140** | **0** | 0 | **0** |
| conditioning census, 198 worlds | 157 | **157** | **0** | 0 | **0** |

### RECOMMENDATION — **DO NOT MERGE**

The three printed weeks do not yet match the rules: finding 2 is not visible to
the athlete and finding 3 is untouched.
