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

## LEDGER — outside this mission, untouched

- **`test:compile` is RED on `main` at `1248be77`**, identically: 6 file/scope
  pairs in `src/__tests__/bibleConformance/observations/*`, all rooted in a
  missing `../support/coachingPlanForTests` module that is absent at HEAD.
  Product scope is 35 errors before and after this change. Not mine, not fixed.
