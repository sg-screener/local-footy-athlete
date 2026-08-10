# ITEM 1(a) CENSUS — THE CUT IS NOT A DELETION, AND THE PATH IT REPLACES DOES NOT EXIST

**LOOP CHECK:** `order-cites-a-mechanism-that-is-not-there` — **sighting 5 today**
(`test:athlete-action-walker`, `AGENTS.md "Test Standard"`, *"Training Bible, Move
rules"*, *"the sweep rule"*, and now *"the clean-reset path"*). **COMPRESS: this is
one class and it now has one answer — the registry's `ruledAt` resolver, already
named as the next guard to build. An order, like a law row, is a CLAIM ABOUT A
SOURCE, and the cheapest way to stop being wrong about sources is to resolve them
before acting.** Fifth sighting in a day means the compression is overdue, not
optional.

Seat inbox item 1(a), 2026-08-10, ordered first *"because it is the only one with a
live consequence"*. Censused before removal, per `LAW-census-before-retirement`. **No
code was cut.** Three findings, each with a receipt, and the third is a stop.

## FINDING 1 — THE MODULE IS NOT WHERE THE ORDER SAYS

The order names `migrateHydratedStatePowerBlocks` and
`legacyPowerBlockMigration.ts`, and cites `programStore.ts:1656,1582`.

- The module is **`src/rules/legacyPowerBlockMigration.ts`** (195 lines), not
  `src/utils/`. Its six throw sites are exactly as cited (`:130,137,143,150,157,164`),
  plus the error class at `:52`.
- **`programStore.ts:1656` is not a throw — it is the CALL.** The function is defined
  at `:1589`.
- **`programStore.ts:1582` is a DIFFERENT throw** with a different owner:
  `assertNoUnmigratedPowerBlock`, a **WRITE-side** guard called once, at `:1947`,
  refusing to *publish* a program still carrying a legacy block. It is not part of
  the read-path migration and cutting one does not imply cutting the other.

## FINDING 2 — THE FUNCTION CARRIES A SECOND, UNRELATED LIFT

`migrateHydratedStatePowerBlocks` is not only the power migration. It also runs
`liftGeneratorRecoveryToRest` and `isGeneratorPlacedRecovery`, and its own comment
says so in capitals: **"TWO LIFTS, ONE INGRESS"**, with a deliberate scoping note
that the recovery lift runs on the PLAN only and must not visit `dateOverrides` or
`weekScopedOverlays`.

**Deleting the function wholesale would silently delete the recovery lift**, which
nothing in the order mentions and which has its own ruling. The cut is surgical —
remove the `migrateStoredPowerBlock(s)` calls, keep the recovery lift and its
scoping — not a file deletion. Named here so nobody discovers it mid-cut.

## FINDING 3 — THE STOP: THE CLEAN-RESET PATH DOES NOT EXIST

The order says *"Replace with the clean-reset path"* and *"a stored world the current
code cannot read is RESET CLEAN and the athlete is told"*.

**There is no such path.** `grep` over `src/` excluding `__tests__` for
`AsyncStorage.clear`, `persist.clearStorage`, `clearStorage`, `removeItem`,
`resetToCleanWorld`, `cleanReset`, `unreadable_world` returns **ZERO product
files**. Only test harnesses clear storage.

So item 1(a) is not a deletion. It is **a deletion PLUS a new door PLUS an
athlete-facing surface** (*"and the athlete is told"* has no screen). That is a
BUILD — and the same order says, in its own last line, **"nothing new is BUILT while
the chain is red."** The order contradicts itself, and the contradiction is load-
bearing: doing (a) as written means either building while red, or deleting the throw
and leaving an unreadable world to fail silently somewhere later, which is worse than
the loud failure it replaces.

**RECOMMENDATION, and it is a ruling ask, not a preference.** Take (b) first —
retiring the V1 exposure contract needs no new door, closes
`LAW-L15-one-write-format` on a real instance, and is the item whose answer Sam
actually asked for (*"what are the 2 answers to how hard can this week be?"*). Then
(a) as a **two-commit unit**: the clean-reset door and its telling first, as the one
sanctioned build during the red because it IS the guard for *"a stored world the code
cannot read"*; the deletion second.

## WHAT THE METHOD CANNOT DO WHILE THE CHAIN IS RED

The order prescribes *"the full chain between cuts. If any cut reds something, STOP"*.
**That is not executable as written.** `test:bible` now ends on `test:law-registry`,
which is red BY DESIGN until every law has a guard, so the chain's exit code says
"red" before any cut is made and cannot answer *"did this cut red something?"*.

**The substitute, and it is the repo's own instrument:** compare against a
`scripts/sweep.sh` FAILURE SET, not an exit code. A baseline sweep at `4609b181` was
started for exactly this and its result belongs beside the first cut.

## NOT COVERED

The `useHomeScreen` census for cut (c) and the 13-module coach tree census for cut
(d) are **not started** — this pass censused (a) only. Nothing here says whether cut
(b) is clean; its own census is the next act. **No test was run against a cut,
because no cut was made.**
