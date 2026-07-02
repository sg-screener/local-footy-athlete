# Conditioning Session Inventory — for Sam's Review

Everything the app can currently write into a program, in plain language.
Two separate lists matter:

- **Generation library** — what the engine can schedule when it builds or
  rebuilds a week (23 session types).
- **Coach-addable registry** — what the AI coach may add/swap ON DEMAND in
  chat (currently only 3, all easy — this is why "add hard conditioning"
  gets refused).

Numbers like "3–5 reps" vary deterministically by date so the same session
isn't identical week to week.

---

## 1. Sprint / Alactic (speed & neural — quality, never fatigued)

| Session | Structure | Notes from the engine |
|---|---|---|
| **Flying Sprints** | 3–5 × (20–30m build + 20–30m max velocity), 2–3min full rest | Field. Top-end speed exposure; explicitly "NOT a fatigue session" |
| **Free Sprint Session** | Free sprints over set distances, quality > volume | Field or hill; mechanics + neural freshness |
| **Max Effort Sprint Accumulation** | Max-output efforts on air/echo bike | Neural + power, no fatigue spillover |

## 2. MAS / High-Intensity Intervals (hard engine work)

| Session | Structure | Notes |
|---|---|---|
| **MAS 15:15 Blocks** | 15s @ ~110% MAS / 15s easy, 3–5 rounds, 2min between | Repeat high-speed efforts under control |
| **Tabata Intervals** | 20s on / 10s off × 4–6 rounds | Bike/row/ski; lactate tolerance |
| **Inverse Tabata** | 10s on / 20s off × 4–6 rounds | Air bike; quality output, lower fatigue |

## 3. Aerobic Power / VO2

| Session | Structure | Notes |
|---|---|---|
| **4x4 VO2** | 4–5 × 4min hard / 2min easy (Norwegian method) | Bike/row preferred; capped ≤45min |
| **1km Repeat Intervals** | 4–5 × 1km, new rep every 6min | Running; pacing discipline; ≤45min |

## 4. Repeat Sprint / Game Conditioning

| Session | Structure | Notes |
|---|---|---|
| **200m/400m Repeat Runs** | Repeats on 2–3min cycle, 20–30min total | Repeat effort under fatigue |
| **Footy Fartlek** | 3 rounds × 3–5 reps (~2min work / 2min rest) | Oval; AFL movement patterns, game sim |

## 5. Aerobic Base / Easy (the "flush" family)

| Session | Structure | Notes |
|---|---|---|
| **Long Nasal Run** | 35–45min easy; rotates run/bike/row/ski + steady vs surges | The core base builder; run weighted highest |
| **Flush Run / Easy Bike / Easy Row / Easy Ski / Easy Swim / Light Circuits** | ~20–30min genuinely easy | Recovery-tier options |

## 6. Special cases

| Session | Structure | Notes |
|---|---|---|
| **Sprint Micro-Dose** | 3–4 short sprints + build-ups, tiny volume | "Rescue" neural exposure when sprint work got squeezed out |
| **Combined S+C finishers** | Shortened 4x4 / Fartlek / Nasal-Run variants, ≤20min | Bolted onto strength days (your "+ Aerobic Base" finishers) |

## 7. Named but NOT built yet (stubs — metadata exists, no session)

Tempo Run · MetCon · 6x1km — the engine knows the names but can't write them.

---

## How the engine currently DECIDES (high level)

Season phase, game proximity (nothing heavy near game day), readiness level,
injury constraints, running-load management (off-feet conversions to erg when
legs need sparing), and no-repeat modality rotation within a week.

## What the AI coach can add ON DEMAND (chat) — the gap

Only: **Easy Zone 2 Bike / Row / Ski Erg** (25min each). Everything above
exists in generation but is invisible to the chat coach. This is why "add
hard conditioning on the bye" was refused.

---

# SAM'S DECISIONS — round 1 (2026-07-03)

**Rules (engine-level):**
- Hard cap: max 4 RUNNING sessions per week, always.
- In-season: running only at team training + game day; optional LIGHT run on
  Monday (furthest from game). Other conditioning goes off-legs.
- Bye weeks: every session EXCEPT the sprint family becomes a legitimate
  coach-addable option (better than defaulting to a 20min flush).
- 4x4 VO2 is NOT bike/row-preferred — running is a first-class modality,
  subject to the running budget above.

**Library changes:**
- 1km Repeat Intervals: widen to 4–6 reps; delete the 6x1km stub (redundant).
- Tempo Run stub: remove for now.
- MetCon: BUILD. Hard conditioning, mostly off-legs, 20–40min, rotating
  ergos / carries / burpees (runs only if running budget allows).
  Draft structure awaiting Sam's tweak.
- NEW — Erg EMOM: 20–40min, every minute on the minute 12–15 cal effort,
  rest = remainder of minute, rotating bike/ski/row/assault.
  Open: per-erg cal targets or flat 12–15?
- NEW CATEGORY — Work Capacity / General Conditioning: MetCon, EMOM, plus
  more sessions Sam will supply. In-season: extra off-leg midweek option.
  Off-season: volume and work-capacity building.

**Still open:**
- Normal-week (non-bye) coach-addable set: easy-only as now, or
  easy + work-capacity?
- MetCon round/station structure sign-off.
- EMOM cal targets per machine.
- Sam's remaining work-capacity session list.

---

# YOUR REVIEW — write straight into this file or tell Claude

1. **Missing sessions?** Anything you program in real life that isn't in
   sections 1–6 (e.g. hills, sleds, boxing rounds, tempo runs, pool)?
2. **Wrong structures?** Any reps/durations/rests above you'd change?
3. **Coach-addable set:** which of the 23 should the chat coach be allowed
   to add/swap on demand? (Suggestion: a curated subset per intensity —
   e.g. 1–2 easy, 1–2 MAS/VO2, 1 game-conditioning, 1 sprint — rather than
   all 23.)
4. **When-rules for on-demand adds:** should the coach refuse hard
   conditioning within X days of a game? Bye weeks unlock what?
5. **Build the stubs?** Tempo Run / MetCon / 6x1km — want them real, and if
   so, your prescriptions.
