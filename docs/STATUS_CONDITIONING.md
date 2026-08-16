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
