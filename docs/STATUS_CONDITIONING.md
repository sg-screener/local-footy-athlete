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
