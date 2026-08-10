# CUT (b) — THE V1 GENERATION-TIME FALLBACK IS GONE, AND IT DOES NOT RETIRE V1

**LOOP CHECK:** `order-cites-a-mechanism-that-is-not-there` — **sighting 6**, and the
compression is now BUILT (`test:law-registry` resolves every `ruledAt` as of
`a458b45f`). This sighting is the same shape one level out: the order's premise about
where V1 runs was checked against the tree before cutting, and it was **partly
false**. **The compression extends: an order's premise about CODE is a claim too, and
the census is how it gets resolved.**

Seat inbox item 1(b), 2026-08-10. Sam: *"well fucking delete the old shit here? how
hard is that"*.

## WHAT WAS CUT

`src/services/api/generateProgram.ts`: the **generation-time V1 acceptance arm** —
`if (exposureContract && !exposureContractV2) { … throw }` — and the now-unused
`evaluateEffectiveWeekExposureContract` import.

**Why it was worth cutting, and this half of the order's premise is TRUE and
measured.** V1 **cannot represent two valid credits stacked on one day** (team
training PLUS an app core block); its own comment says so. So on combined days —
which is what the app now builds — **V1 UNDERCOUNTS how hard the week is.** It ran
only when a v2 contract was absent, which is precisely a pre-rebuild saved program.
**A week the current code cannot describe was being accepted by a weaker set of
rules.** It now regenerates instead.

That is the answer to Sam's question 2: *the two answers to "how hard can this week
be?" differ exactly on combined days, and the old one says "easier".*

## WHAT THE ORDER CLAIMED THAT THE CENSUS REFUTES

> *"`weeklyExposureContract` (V1) — RETIRE … V1 runs only
> `if (exposureContract && !exposureContractV2)`."*

**V1 is not retired, and it does not run only there.**

- `evaluateEffectiveWeekExposureContract` has **three other PRODUCT call sites**, all
  in `src/utils/postGenerationConstraintValidation.ts` (`:695`, `:778`, `:1889`).
  **None of them is guarded by `!v2`** — two build a `resolvedContract` and evaluate
  it unconditionally. So the V1 evaluator runs on **current** worlds, not only
  pre-rebuild ones.
- The V1 module `src/rules/weeklyExposureContract.ts` is imported by **16 files**,
  including `weeklyExposureContractV2.ts` itself, `section18SafetyPolicy.ts`,
  `preseasonExposureContract.ts`, `programStore.ts` and `acceptedStateColdStart.ts`.
- The V1 contract is **still persisted** on every microcycle
  (`generateProgram.ts:855`), so the variable is still read here. Retiring the stored
  field is a separate unit **with a migration**, and the north star has an opinion
  about it: a contract is derived, so storing it is presumed wrong.

**THEREFORE `LAW-L15-one-write-format` IS NOT CLOSED BY THIS CUT**, and the order's
instruction to "give it the registry row and let its guard sweep for siblings" is
premature — the row exists and stays UNENFORCED. Claiming otherwise would be exactly
the "reads as covered" failure the registry was built to catch.

## THE REAL REMAINING UNIT, NAMED SO IT IS NOT REDISCOVERED

1. The three unguarded `postGenerationConstraintValidation` sites — decide per site
   whether V1 or V2 is the authority. **This is where the undercount can still
   reach a current world**, and it is not measured.
2. The persisted `exposureContract` field, with its migration.
3. Only then is V1 retirable as a module, and only then does L15 close on it.

## MEASURED

- `test:compile` PASSED, no file regressed.
- Green after the cut: `test:section18-gateway`, `test:exposure-contract-equality`,
  `test:bible-anchors`, `test:stage-b-generation-differential`,
  `test:onboarding-generation-outcome`.
- **Baseline sweep at `4609b181` before the cut: 4 failures of 177** —
  `program-control-durable` and `fixture-identity` (main's declared set),
  `law-registry` (red by design), and `fact-door-inputs` (**pre-existing**, fails
  identically at `75d1e181`, before this session's first commit).
- **POST-CUT SWEEP AT `a458b45f`: 4 failures of 177 — THE SAME FOUR, BY NAME.**
  The failure SET is byte-identical to the baseline, so **this cut moved nothing.**
  That comparison — not the chain's exit code — is what backs the cut, because the
  ordered method ("the full chain between cuts") cannot work while the chain ends on
  a deliberately-red suite.

## NOT COVERED

The sweep compares FAILURE SETS, which is the right unit, but **a suite that was
already failing could have started failing for a NEW reason and the set would not
show it** — the four reds were not diffed line by line. Cuts (c) the V1 home screen
and (d) the frozen coach tree are **not censused**. Nothing here touches item 1(a), which remains a STOP for want of a
clean-reset door. **No device evidence: generation was not run on glass.**
