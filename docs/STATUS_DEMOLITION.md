# STATUS — seat `demolition`

**Mission:** FULL BURN-THE-BOATS DEMOLITION (Sam, 2026-08-19). Delete every
superseded production authority and leave one current system implementing Sam's
approved logic.

**Branch:** `demolition/burn-the-boats`, cut from the clean tip of
`feat/athlete-can-see-it` (`6da38cee`).
**Rollback tag:** `pre-full-burn-boats-2026-08-19` → `6da38cee`.
**Worktrees:** `scratchpad/wt-demo` (work), `scratchpad/wt-control` (untouched
control at `6da38cee`, used for every baseline comparison).

---

## THE RULE I AM WORKING TO (Sam, mid-mission, 2026-08-19)

> Deletion is based on AUTHORITY, not file age, filename or line count.

Before a file is deleted, one of these is PROVEN:

1. zero production execution/imports; or
2. its authority has been fully replaced by a named current owner; or
3. it actively competes with and rewrites a named current owner.

No bulk deletion by filename, folder, regex or age. A file holding BOTH current
and legacy behaviour has its current half extracted first.

---

## ⚠ FINDING 0 — "UNREACHABLE" IS NOT "LEGACY" IN THIS REPO

Measured with a transitive import walk from `App.tsx`
(`scratchpad/tools/reach.js`) plus a precise importer census
(`scratchpad/tools/imports.js`, which resolves real `from`/`require` specifiers
rather than grepping for the word):

```
TOTAL src files            1121
REACHABLE from App.tsx      547
UNREACHABLE (all)           574
UNREACHABLE non-test         34
```

**Every one of those 34 has ZERO production importers.** But reading their
headers splits them in two, and the split is the finding:

**(a) BUILT BUT NEVER WIRED — Sam's own current work. DO NOT DELETE.**
`rules/mobilityPairing.ts` (his seven signed rules, and his 2026-08-13 *"WE
SPENT FUCKING DAYS ON THIS — WHY IS IT NOT IN THE APP YET"*),
`rules/weeklyCompleteness.ts` ("THE ONE COMPLETENESS OWNER", his 2026-08-16
ruling), `rules/weekPreferenceShape.ts`, `rules/sessionTypeCharter.ts`,
`data/timeTrialSession.ts`, `utils/masCopy.ts`, `rules/lawRegistry.ts` (LAW
ZERO's own register — deliberately not production).

**A deletion pass keyed on reachability would have deleted the mobility pairing
work Sam is angry is missing.** That is why rule 4 above is answered per file,
by hand, from the header and the importer census — never by the graph alone.

**(b) GENUINELY SUPERSEDED — candidates for deletion, each still to be proven
individually against rule 4:** `utils/trainAroundEngine.ts`,
`utils/blockAdjuster.ts` (the old `dateOverrides` layer),
`utils/weeklyCoachUpdate.ts`, `store/preRebuildEnvelopeMigration.ts` (a one-time
migration for athletes who install over the old world — explicitly in scope for
"no migration for nonexistent production users"), `utils/recoveryAddonBuilder.ts`
(the retired placement pass), `store/injuryEpisodeCommand.ts`,
`screens/home/homeGameMutationController.ts`, `utils/section18ProgramObservation.ts`,
`utils/coachInjuryTargetResolver.ts`, `utils/capacityAnswerGap.ts`,
`components/TrunkSupportSection.tsx`.

---

## BASELINE — MEASURED IN AN UNTOUCHED CONTROL TREE

⚠ **My first baseline sweep was CONTAMINATED and was thrown away.** It ran in
the same worktree I was editing, so suites after my first edit measured a
modified tree. A control run must see the same tree. The kept baseline runs in
`wt-control`, detached at `6da38cee`, never edited.

| instrument | at `6da38cee` | note |
| --- | --- | --- |
| `test:compile` | **FAILS**, 7 file/scope pairs worse than baseline; product scope 35 errors | red on the branch tip ITSELF, before I touched anything |
| `test:law-registry` | 12 passed, 2 failed; 135 rows, 114 guarded, **21 UNENFORCED** | the two reds are `LR-18 has no registry row` and the deliberate `NO LAW IS UNENFORCED` |
| `test:exercise-rotation` | 91 passed, 2 failures (hinge advance / second hinge) | pre-existing |
| `scripts/sweep.sh` 405 suites | **RUNNING — not yet complete** | full failure set owed |

---

## SLICE 1 — LANDED: A REPLAY MAY NEVER RE-AUTHOR A BLOCK

Completion condition **"zero boot/restart writes to accepted exercise choices"**.

Seat `visible` diagnosed this on 2026-08-18 and deliberately did not fix it
(`docs/STATUS_VISIBLE.md` §7). The device trace: `blockSelectionHistoryStore`
slot `squat`, block `2026-07-13`, went `Back Squat` → `FRONT SQUAT` across a
restart. `quiescentBoot.ts:570` regenerated on every launch with
`recordSelections: true`; a live `today_only` exclusion made the composer pick
Front Squat and the boot **recorded that pick as the block's history**.
`recordBlockSelections` replaces a block's rows by design, so the original was
destroyed — gone from `currentProgram` AND from the selection history, which is
the input every future generation reads. Three separate rebuilds all faithfully
reproduced the wrong answer because that is what the stored input now said.

**A reversible, dated decision was laundered into a permanent generation INPUT.**

**THE FIX IS AN OWNERSHIP CORRECTION, NOT A SWITCH.** `recordSelections` became
`'author' | 'replay' | false` and all five production callers state which they
are:

| caller | door | value |
| --- | --- | --- |
| `weekRebuild:650` | rollover | `'author'` |
| `profileProgramTransaction:205` | onboarding / profile change | `'author'` |
| `acceptedStateTransaction:2071` | acceptance | `'author'` |
| `quiescentBoot:570` | boot | `'replay'` |
| `temporarySourceFactTransaction:534` | a dated fact re-deriving | `'replay'` |

A `'replay'` records a block **nobody has recorded yet** and may never replace
one. `temporarySourceFactTransaction` was the same defect class pointed at a
different fact — a TEMPORARY fact authoring a PERMANENT selection — and is fixed
by the same distinction rather than by a second special case, which is the
systemic-fix rule.

**GUARD:** `test:block-selection-authority`, 5 cells, in the bible chain, row
`LAW-a-replay-never-reauthors` in the registry.

**MUTATION-PROVEN TWO WAYS**, tree restored byte-identical from my own backup
after each (never `git show HEAD:… >`):

- letting a replay re-author again → reds cell 1, **and reproduces the exact
  device pair**: `recorded Front Squat, expected Back Squat`;
- the blunt fix (`replay` never records) → reds cell 3 and nothing else.

⚠ **THE FIXTURE CAUGHT ITSELF, TWICE.** The first cut wrote `exerciseName` where
`ExerciseExclusion` declares `exercise`, so the exclusion was inert — the CONTROL
cell failed and exposed it. And a `today_only` scope was rejected as a control
because `composeWeek` correctly keeps dated answers out of the recorded base
(`LAW-temporary-equipment-never-permanent`); the control uses the harder
`until_changed` case, which is genuinely entitled to move the record.

**BLAST RADIUS, against `wt-control`:**

| instrument | base | after slice 1 |
| --- | --- | --- |
| `test:compile` | 7 pairs worse, product 35 | **identical** — 7 pairs, product 35 |
| `test:law-registry` | 12/2, 135 rows, 114 guarded, 21 UNENFORCED | 12/2, 136 rows, 115 guarded, **21 UNENFORCED (unchanged, did not rise)** |
| `test:exercise-rotation` | 91 pass / 2 fail | **identical** — same two failures |
| `test:block-selection-authority` | did not exist | 5 pass / 0 fail |

**NOT COVERED:** nothing seen on glass; the physical-device re-run of the
original trace is not repeated; the 405-suite comparison is owed once the
baseline sweep completes.

Agent: demolition

---

## ⚠ FINDING 1 — §18 IS A SECOND PROGRAMMING AUTHORITY, AND IT IS ~800 LINES

Sam's contract: *"§18 — Validation/refusal only. It may accept or refuse the
finished result. It may not author, repair, replace or rearrange the program."*

`section18AcceptedWeekGateway.ts` (1804 lines) imports
`searchWholeWeekRepairCandidates` from `wholeWeekRepairEngine.ts` (144 lines) and
runs a **candidate search**: it generates repaired versions of the week, scores
them, and picks one. Five repair GENERATORS live inside the validator:

| line | generator | what it authors |
| --- | --- | --- |
| 715 | `repairOptionalRestCandidates` | replaces authored sessions with Rest |
| 784 | `repairByStackingCandidates` | rearranges work onto other days |
| 857 | `repairCraftViolationCandidates` | rewrites content to satisfy craft rules |
| 955 | `repairDisplacedStrengthCandidates` | re-places strength the scheduler sited |
| 1284 | `repairCoreConditioningShortfallCandidates` | adds conditioning after authorship |

`replaceDay` (710) is their shared mutator. 79 `repair`-shaped references in the
gateway. This is live production — the baseline sweep log shows it acting:
`[WorkoutCanonicalisation] Generated workout finalised … collapsed_to_rest`.

**Four of the mission's named deletion areas are this one mechanism:** "replaces
authored sessions with Rest", "adds conditioning automatically after authorship",
"repairs missing patterns by restoring original rows", "treats §18 as an author".

**THIS IS THE NEXT SLICE AND IT IS NOT SMALL.** Removing repair means the
gateway REFUSES what it used to silently fix, so the weeks it was covering for
become visible as scheduler/composer defects. That is the point — Sam: *"A large
blast radius proves the legacy path was still an authority."* It is not a
coaching question needing his ruling: his contract already decides it.

**NOT MEASURED YET:** how many currently-accepted weeks depend on a repair to
pass. That census comes before the deletion, not after.

Agent: demolition
