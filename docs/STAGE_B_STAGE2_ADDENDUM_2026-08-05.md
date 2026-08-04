# Stage B stage 2 — addendum: the gate split, the dose parse, and where Priority C stands

Appends to `docs/STAGE_B_STAGE2_CHECKPOINT_2026-08-05.md`. Branch
`feat/stage-b-stage2`, `main` untouched at `936bbf7`, UNMERGED.

---

## What landed after the checkpoint

| Commit | What |
|---|---|
| `4a357ef` | Sam's LR-26/LR-27 rulings, committed as authored |
| `96d9a1d` | **LR-26 after-side deleted**; LR-28 + LR-29 filed; LR-27 retired |
| `27e69f9` | the lift cell's cast — typecheck back to baseline |
| `c94d54b` | the Priority C blocker survey |
| `2d33b0c` | **the gate split**, per Sam's ruling (own commit, as directed) |
| `bbfb432` | **the typed dose-string parse at one ingress** |

`test:bible` was **EXIT 0 end to end** at `27e69f9`. Since then: the gate split
(`test:pending-lists` 11/11), the dose parse (`test:conditioning-dose` 12/12,
newly chained), and `test:compile` PASS. **A full-chain run is owed** after the
next commit and before any claim that Priority C is done.

## The gate split — the ruled cost, stated

`isStageBPathLanded(srcDir, path)` answers per path; `isStageBLanded` survives
as the honest summary (landed WHOLE only when both paths are, so nothing can
report the switchover finished while LR-6 holds the coach half). Each pin
carries `path`: **15 athlete, 5 coach**.

**The cost, in the gate's own words as the ruling required:** while the athlete
path is landed and the coach path is not, **five coach doses knowingly survive
as a second dose authority beside Sam's 55 signed templates**. Ruled, not
accidental; it ends when the coach rebuild lifts LR-6.

A new cell stops the split becoming a hiding place: a pin whose `path` does not
match the file it lives in fails, so a symbol cannot be relabelled `coach` to
escape the athlete path's landing.

## The dose parse — one ingress

`src/rules/conditioningDose.ts`. The only place an authored dose string becomes
a number. Reads the **governing** quantity, carries the approximation marker,
keeps `raw` verbatim, and refuses with a typed reason rather than defaulting.
`metres` never become `seconds` — that conversion needs a speed, and the speed
is the athlete's.

**The sheet taught the owner, which is the sweep working as designed:** the
first run refused nine cells for an unknown unit, and Sam's authored word was
`block`. Added as a real unit rather than absorbed at a call site. 211 of 220
authored dose cells parse; the 9 refusals are typed and printed.

It adds **no `conditioningTemplates` import to any consumer file**, so neither
path is landed and every pin stays live.

## %MAS (ruling 4) — done as far as the ruling allows, plus one finding for Sam

The binary `masIntensityForWorkSeconds` is now documented at its site as
**ACCRETED, not authored law**, with the ranges named as the owner of
conditioning intensity and a "do not add a caller" warning. Per ruling 4 it
**dies when MAS wiring lands**, which has not happened — the conflict is still
latent (both representations are display strings; `deriveMas` has no
generation-path consumer). All five live callers are in `sessionBuilder.ts`, an
athlete-path file the switchover rewrites, so the deletion falls naturally
inside that work.

**FINDING FOR SAM — one authored template cites the accreted rule by name.**
`conditioningTemplates.ts:902` carries
`intensity: '110% MAS (15 s work per masIntensityForWorkSeconds, src/utils/masCopy.ts)'`
— and template `intensity` strings are **equality-gated to Sam's signed
workbook**. So either the workbook itself cites a function nobody remembers
authoring, or the citation was added when the typed projection was built and
the equality gate has been holding it in place since. **Which it is decides
whether deleting the binary requires a workbook edit.** Not touched: changing an
equality-gated string without knowing which side is authoritative is exactly the
move the gate exists to prevent.

## What Priority C still needs — the atomic part

The switchover itself is **all-or-nothing for the athlete path**: the moment
`sessionBuilder.ts`, `defaultProgram.ts` or `conditioningRules.ts` imports
`conditioningTemplates`, all **15** athlete pins must be gone in that same
commit or `test:pending-lists` fails. It cannot be done in slices, which is why
it was not begun with partial context.

The 15, by file: `sessionBuilder.ts` ×12, `defaultProgram.ts` ×1,
`speedTemplates.ts` ×1, `coachingEngine.ts` ×1. Each names its superseding
template in the pin, and the gate already checks those templates exist.

**Build order for the next session:** selection (which of the 55 for this
day/quality/equipment) → composition (dose parse → rows, using the owner that
now exists) → delete the 15 in the same commit as the first import → full
bible + differential. The differential prediction must be written BEFORE the
code, per the stage 1 plan's §P discipline — and unlike stages A–D it will
**not** be zero, because the athlete's conditioning sessions change.
