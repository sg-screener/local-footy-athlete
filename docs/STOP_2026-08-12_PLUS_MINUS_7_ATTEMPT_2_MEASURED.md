# STOP — THE ±7 LOSES NOTHING IN DERIVATION, AND FIVE CANDIDATES ARE DEAD

**LOOP CHECK:** *a plausible cause named instead of a measurement taken* —
sighting 4, disposition **COMPRESS**, and this pass is the compression working:
five candidate causes were killed by probes in one sitting, **none of them by an
argument**, and nothing was built. The fifth attempt at this item will start from
one unexplored line rather than a fresh theory.

**HEAD:** `69726846` on `main`. Tree restored; the property is green again
(`regressions=23/23 properties=10/10 mutations=10/10`).

---

## 1. WHAT WAS DONE

Attempt 2, exactly as the order and §7 prescribed: **apply the deletion, measure,
build nothing, revert.**

The craft tier was changed to read a supplied `activeFixtureDates` and fall back
to ±7 **only** when it has no authority — an absent authority is not evidence of
an absent fixture. The gateway passes the field it already threads to the replan
and the provenance rules. `test:craft-tier` went **36/36 green**. The property
that reverted attempt 1 failed in the same place. Then it was reverted.

## 2. THE NUMBERS THAT KILL THE PREMISE OF EVERY ATTEMPT SO FAR

| probe | ±7 REMOVED | HEAD |
| --- | --- | --- |
| `test:craft-tier` | 36/36 | 36/36 |
| the property | **FAILS** | passes |
| resolver mints Sun 19 → Mon 20 `g_plus_1` | **30×** | 23× |
| materialiser sees a Monday carrying it | **4×** | 2× |

**The link is derived MORE often without the ±7, reaches the materialiser MORE
often, and the property still fails.** Three attempts hunted a lost derivation.
**There isn't one.**

## 3. FIVE CANDIDATES, ALL DEAD, ALL BY MEASUREMENT

- `dependency.source` is minted in **one** place — `sessionResolver`, from
  `effectiveGameDatesAround`. The gateway and the replan **copy**. The ±7 feeds
  `validateProgramWeek`, which produces **findings**, and no finding can become a
  dependency source. (§7)
- `repairOptionalRestCandidates` — **0 calls**, both arms.
- `rollingHorizonDependencyClosure` — **0 calls**.
- `programStore`'s accepted-week repair loop — **skips the day**: `equal=true` on
  every call for that date, and three of those calls already carry the dependency
  on both sides.
- The resolver's mint — fires in both arms, more without the ±7.

## 4. WHAT IS LEFT — ONE LINE

`acceptedStateTransaction.ts:2951`:

    for (const projection of repair.projections)
      weekScopedOverlays[projection.weekStart] = projection.overlay;

**The following week's overlay exists iff the rolling horizon repair returned a
projection for it.** Nothing else writes it on this path.

**Attempt 3's first act is one print** — `repair.weekStarts`, each projection's
week, and whether its Monday carries a dependency, in both arms. **If the next
week is missing from `projections` with the ±7 gone, then the ±7 was holding a
week inside the repair horizon** — a far more serious thing than a phantom
neighbour, and it would mean this property has been asserting horizon membership
through a proxy since it was written.

## 5. NORTH STAR

**Toward it, if the suspicion in §4 holds.** A phantom fixture that keeps a week
inside the repair horizon is stored-shaped behaviour standing in for a derived
one — and the property that depends on it is reading an OVERLAY (a store of
differences) as though it were the week.

## 6. NOT COVERED

- **THE ±7 IS STILL THERE.** Nothing was built. This pass bought a diagnosis, not
  a fix, and says so.
- **ITEMS 4 AND 7 ARE NOT STARTED.** Sam asked for 3, 4 and 7; item 3 took the
  pass. Calling the others "in progress" would be the word this repo retired.
- **THE PROBES WERE TEMPORARY AND ARE GONE.** Each was a `console.log` behind
  `LFA_DEP_TRACE=1`, removed with the revert. Attempt 3 re-adds one line, not
  five.
- **ONE SUITE, ONE PROPERTY.** Everything here is measured on
  `test:accepted-state-transactions`. Whether other suites lose the same record
  when the ±7 goes was not measured.
- **A RED THAT IS NOT MINE:** `test:repo-law-guards` now fails on the other
  agent's untracked `docs/superpowers/plans/2026-08-12-my-status-owns-the-modifiers.md`,
  which ships a status checklist with no banner.
