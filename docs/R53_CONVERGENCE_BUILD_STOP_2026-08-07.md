# R5.3 CONVERGENCE BUILD — STOP AT BOTH STEPS — 2026-08-07

Executes `docs/FOUR_LEG_CONVERGENCE_RULING_2026-08-07.md` (committed as
authored at `26b89746`). **NOTHING BUILT into the main build, nothing
merged.** Scaffold `scratch/r53-pricing-7` (`21cc5a19`).

Both of the ruling's build steps were measured before building, and
both premises are refuted — in a useful direction. The basis question
is now ANSWERED, and the two blockers have names.

## Step 1 — the basis is CHOSEN, but it is not leg (iii)'s to pay

The ruling ordered leg (iii) to build first and pay cell 7's basis
mismatch. Measured, those are two separate things.

**The basis, chosen by measurement as ordered.** `LFA_BASIS=visible`
re-derives the contract against the week that is JUDGED
(`visibleWorkouts`) rather than the week it was composed from, so one
basis stands on both sides of `rebaseAcceptedEffectiveWeek`:

| basis | deletion (all four legs) | lawfulness |
|---|---|---|
| current (composed derive / visible judge) | 21/24 | 12/12 |
| `composed` (judge the composed week) | 21/24 | 12/12 |
| **`visible` (derive against the judged week)** | **22/24 — cell 7 GREEN** | 12/12 |

Full witness set with all four legs and `BASIS=visible`: lawfulness
12/12, gateway 91/0, whole-week repair 14/14, phase structure 11/11,
action walker 20/0, day-precedence 6/0, typecheck 459 none regressed,
accepted-state 22/23 · 8/10 · 10/10, deletion **22/24** (22, 23),
move 21/1, fixture-identity 3 red, derived-repair 4/0. **No row worse.**

**But the attribution separates the two.** Measured independently:

| configuration | athlete-session move | deletion |
|---|---|---|
| flags off (baseline) | 22/0 | 24/24 |
| `BASIS=visible` ALONE | **22/0** | **24/24** |
| leg (iii)+provenance, no basis change | **21/1** | 24/24 |
| leg (iii)+provenance + `BASIS=visible` | **21/1** | 24/24 |

So: **the basis fix is free and is not leg (iii)'s**, and **leg (iii)
alone owns a witness regression that no other leg pays** —
`athlete-session-move` cell 19, *"clearing one of two same-week
adjustments preserves the unrelated active move"*, failing with *"Move
would silently destroy session `w2:monday:none:strength`"*. It is
present in every priced configuration on this branch, including all
four legs, and it was never separately attributed until now. Leg (iii)
alone also leaves `derived-week-lawfulness` at 8/12 (baseline 6/12,
all-legs 12/12) — it needs leg (ii) to finish.

**Why nothing landed.** The basis fix is a genuine correctness change
but it is INERT with the legs off: `deriveWeekContract` returns its
argument unchanged unless leg (iii) is on, so the second derivation is
the first. Landing it alone is unreachable code. Landing leg (iii) with
it lands move-19 red. Neither is a build.

## Step 2 — refuted again WITH leg (iii) real, and the dependency is named

The ruling predicted the stale-contract correction would survive by
leg (iii), "because the derived contract is fixture-aware by
construction". Measured with leg (iii) real, the basis chosen, and both
candidate scopes (`exposureContractV2` only, and the v1 contract too):

| scope | fixture-identity | deletion |
|---|---|---|
| `v2` only | 5/6 | **14/24 · 0/5 · 0/3** |
| `both` | 5/6 | **14/24 · 0/5 · 0/3** |

Identical, and the eighteen failures are ONE repeated error, which
makes them a SEED failure rather than eighteen findings:
`bye-build hard conditioning template missing from both the rebuilt
week and the accepted week`.

**The dependency, named.** With the published contract present and
absent, the derived identity is IDENTICAL —
`in_season_bye_build` / `anchorState: bye` on both sides. The only
difference is content:

```
without leg (v): 1:Lower Body Strength  2:Team Training + Upper Pull
                 3:Prehab & Accessories 4:Team Training + Upper Push
                 5:Gunshow              6:Hard Conditioning
with    leg (v): … same five …          (day 6 absent)
```

**The published `exposureContractV2` is load-bearing for the freed
day's CONTENT, not for the week's identity** — and identity is the only
thing leg (iii) derives. That is why leg (iii) cannot replace it, and
it is a different question from the one the ruling answered. The ruling
already anticipated the shape ("likely dies with the fact-door work,
not here"); this measurement confirms it and says which day and which
session.

## What this leaves

- **The basis question is settled** — `visible`, by measurement, and it
  pays cell 7. It ships with leg (iii), not before it.
- **Leg (iii)'s blocker is move cell 19**, newly attributed and owned by
  no other leg. It must be diagnosed before leg (iii) can build first.
- **Step 2's blocker is the freed day's content**, not its identity.
- Cell 22's pre-authorised re-pin is NOT taken — leg (i) has not landed,
  and the ruling forbids re-pinning before the retirement.
- Cell 23 remains undiagnosed, as ruled.

## Standing

**STOP.** Nothing built into the main build, nothing merged. Both
tracked debts (hydration snapshot-vs-live pin; the 146/172-stamp
`todayISO` clock fix) remain owed and NOT started. The queued
snapshot-to-reference unit remains queued. The parallel-gate stage 1
remainder is untouched. The run home is not begun. STOP at R5 close.
