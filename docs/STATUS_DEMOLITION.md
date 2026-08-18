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

---

## SLICE 2 — LANDED: §18 IS A PURE BOUNDARY. THE REPAIR SYSTEM IS GONE.

`1,924 deletions / 242 insertions` across 18 files. Two files physically deleted.

### THE MUTATION INVENTORY, AND WHAT HAPPENED TO EACH

| # | mutation §18 could perform | repair kind | class | disposition |
| --- | --- | --- | --- | --- |
| 1 | replace an authored session with **Rest** | `optional_work_removed_for_rest` | **C** — not authorised | DELETED |
| 2 | **move work** onto another day | `core_work_stacked_on_existing_stress_day` | **A** — scheduler owns days + spacing | DELETED |
| 3 | **relocate** a craft violation | `craft_violation_relocated` | **A** — scheduler | DELETED |
| 4 | **re-place** displaced strength | `displaced_strength_relocated` | **A** — scheduler sites, composer fills | DELETED |
| 5 | **add conditioning** after authorship | `core_conditioning_presented` | **A** — conditioning specialist | DELETED |
| 6 | author a **whole replacement week** | `regenerated_candidate` | **C** — a second weekly authority | DELETED |
| 7 | author a **fallback week** | `safe_fallback_candidate` | **C** — fallback to a retired planner | DELETED |
| 8 | **lower the contract** until the week passes | (`withDisplacedCapacityReduction`) | **C** — conform-back rewriting | DELETED |
| 9 | reduce **power dose** | `weekly_power_budget` | **B** — belongs to the power specialist | **RETAINED, named** |
| 10 | place/withdraw the **optional offer** | `offer_presented` / `offer_withdrawn` | **B** — optional-session specialist | **RETAINED, named** |
| 11 | **expire** obsolete derived work | `obsolete_derived_work_expired` | **B** — derived-provenance owner | **RETAINED, named** |
| 12 | apply a stored **athlete removal** | `athlete_removal_typed_reduction` | disclosure, written by the replan owner | RETAINED |
| 13 | **disclose** a craft violation | `craft_violation_disclosed` | pure explanation | RETAINED |

**9, 10 and 11 are class B and are NOT yet moved.** Sam's own rule says the
capability is built and guarded in the correct owner FIRST and only then deleted
here. They are named in the surviving `Section18WeekRepairKind` union with that
status written beside them, so they cannot be forgotten. **§18 is not yet
mutation-free and this report does not claim it is.**

### WHAT WAS PHYSICALLY DELETED

| file | lines | why |
| --- | --- | --- |
| `src/rules/wholeWeekRepairEngine.ts` | 144 | the breadth-first candidate search itself |
| `src/__tests__/wholeWeekRepairEngineTests.ts` | 280 | its subject is the deleted engine |

Deleted **in place** (function bodies removed, file retained):

- `section18AcceptedWeekGateway.ts` **1804 → ~1060 lines.** 14 functions, 611
  lines: the five repair generators, their shared mutator `replaceDay`, the
  expander `localRepairCandidates`, and the helpers `mergeCoreWork`,
  `explicitRestStub`, `relocateStrengthTemplate`, `withDisplacedCapacityReduction`,
  `authorityForDisplacement`, `hasMainStrength`, `profileAvailableDayNumbers`.
  Plus the regenerate → fallback cascade in `runSection18AcceptedWeekGateway`.
- `postGenerationConstraintValidation.ts` — `buildSection18ProductionFallbackCandidate`, **329 lines**.
- `programStore.ts` — `legacyMigrationFallbackProfile` (49) and the `buildFallback` wiring.
- Gateway INPUTS deleted, each a licence to author: `strengthTemplates`,
  `maxRepairAttempts`, `regenerate`, `safeFallback`.
- `Section18WeekAcceptanceStatus` **5 → 2**: `accepted | impossible`. The three
  removed (`repaired`, `regenerated`, `fallback`) each named a week the validator
  had built itself.

### OBSOLETE TESTS DELETED

| file / cell | why |
| --- | --- |
| `wholeWeekRepairEngineTests.ts` (whole file) | subject = deleted engine |
| craft tier C3, C4 | "the search MOVES the badly placed session"; "the repaired week…" |
| craft tier M6, M10 | mutation witnesses asserting a repair HAPPENS |
| gateway 31, 48, 49, 50, 51 | the regenerate → fallback cascade |
| diagnostics cells 4, 9 | drove the deleted search as their vehicle |

Cells REWRITTEN to the current contract rather than deleted: gateway 30 ("repair
loops terminate" → "a refused week is refused in ONE assessment"), craft G3, G4.

### PROOF

- **zero production executions/imports of the repair system.** Every surviving
  mention of a deleted symbol is PROSE; measured symbol by symbol. The two
  remaining type-importers (`fixtureMutationTransaction`,
  `homeGameMutationController`) had their outcome type collapsed to `'accepted'`.
- **`test:compile` is IDENTICAL to base** — product 35, devtools 51, tests 383,
  the same 7 pre-existing file/scope pairs. Not one new error in any scope.
- **§18 input week equals the week it validates** — `canonicalWorkouts` is now
  `assembleWithFactDays(offered.workouts)`, the input, rather than a search result.
- Stale comments naming the deleted engine were CORRECTED, not left: a comment
  claiming a repair path exists is how the next agent rebuilds one.

### NOT MEASURED YET

**Worlds newly refusing.** Baseline is 155 of 405 suites failing at `6da38cee`
(`scratchpad/BASELINE-FAILS-6da38cee.txt`). The after-sweep is owed, in a clean
tree at this commit — my first attempt ran in the tree I was still editing and
was discarded, for the second time this mission.

Agent: demolition

---

## ⚠ CORRECTION — §18 IS **NOT** VALIDATION-ONLY, AND MY OWN TABLE UNDER-COUNTED

**Sam, 2026-08-19:** *"§18 is NOT yet validation-only while power trimming,
optional-session placement and stale-session clearing remain."* He is right, and
the accounting was worse than he had reason to think.

**The slice-2 table said 8 deleted + 3 class-B retained + 2 retained-disclosure
= 13. Re-measured against the code, the true count is 14 and the retained
MUTATING set is FIVE, not three.** Two errors of mine:

1. **`finaliseSection18SafetyWeek` was missing from the table entirely.** It runs
   at `section18AcceptedWeekGateway.ts:803` and rewrites the week.
2. **`athlete_removal_typed_reduction` was filed as "written by the replan
   owner", i.e. not §18's.** That is half true and the half that matters is
   false: §18 calls `applyUserRemovalConstraintsToWeek` ITSELF, at lines 345 and
   786, and that call mutates the week.

**So §18 still performs FIVE mutations.** The claim "§18 validates and refuses"
is true of the repair SEARCH and false of the boundary as a whole. It stays
false until the five below are moved.

### THE COMPLETE TABLE — ALL 14 MUTATIONS

| # | mutation | exact old function / path | status | approved current owner | prod callers of that path | replacement status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | replace an authored session with Rest | `repairOptionalRestCandidates` — gateway:715 | **DELETED** | scheduler (owns day purpose) | 0 | n/a — class C, never authorised |
| 2 | move work onto another day | `repairByStackingCandidates` — gateway:784 | **DELETED** | weekly scheduler | 0 | owner already has it |
| 3 | relocate a craft violation | `repairCraftViolationCandidates` — gateway:857 | **DELETED** | weekly scheduler | 0 | owner already has it |
| 4 | re-place displaced strength | `repairDisplacedStrengthCandidates` — gateway:955 (+`relocateStrengthTemplate`, `authorityForDisplacement`) | **DELETED** | scheduler sites, composer fills | 0 | owner already has it |
| 5 | add conditioning after authorship | `repairCoreConditioningShortfallCandidates` — gateway:1284 | **DELETED** | conditioning specialist | 0 | owner already has it |
| 6 | author a whole replacement week | `input.regenerate()` cascade — gateway:1650 | **DELETED** | scheduler + composer | 0 | class C — a second weekly authority |
| 7 | author a fallback week | `input.safeFallback()` + `buildSection18ProductionFallbackCandidate` (329 lines) | **DELETED** | scheduler + composer | 0 | class C — retired-planner fallback |
| 8 | lower the contract until the week passes | `withDisplacedCapacityReduction` — gateway:1177 | **DELETED** | none — conform-back rewriting | 0 | class C, never authorised |
| 9 | **trim power dose** | `weeklyPowerBudget` — gateway:493, called :817 | **RETAINED** | **power/strength specialist** (`powerExercisePool`, `powerPrimerPolicy`) | **2** (both inside the gateway) | **NOT STARTED** |
| 10 | **place / withdraw the optional session** | `presentDeclaredOffer` — `section18OfferPlacement.ts`, called :847 | **RETAINED** | **scheduler / accepted-action owner** | **2** (both inside the gateway) | **NOT STARTED** |
| 11 | **clear stale derived sessions** | `buildDerivedSessionExpiryCandidates` — `derivedSessionProvenance.ts`, called :791 | **RETAINED** | **accepted-state / lifecycle owner** | **7** (also `fixtureMinimalReplan:1075`) | **NOT STARTED** |
| 12 | **apply stored athlete removals** | `applyUserRemovalConstraintsToWeek` — `userRemovalConstraints.ts`, called :345 and :786 | **RETAINED** | **accepted-state transaction** (the only mutation boundary) | **9** | **NOT STARTED** — was mis-filed in the slice-2 table |
| 13 | **rewrite the week for safety** | `finaliseSection18SafetyWeek` — `section18SafetyFinaliser.ts`, called :803 | **RETAINED** | **composer + specialists** (safety belongs in authoring) | **4** (also `postGenerationConstraintValidation:1006`) | **NOT STARTED** — **omitted from the slice-2 table entirely** |
| 14 | disclose a craft violation | inline, gateway | **RETAINED** | §18 itself | 1 | **CORRECT AS IS** — an explanation, not a change |

**Only row 14 is legitimate under the target contract.** Rows 9-13 are the
remaining work, in Sam's stated order: power trimming → power specialist;
optional-session placement → scheduler/accepted-action owner; stale-session
clearing → accepted-state lifecycle owner; and the two I under-reported,
removal application → accepted-state transaction, and safety rewriting →
composer.

### §18 COMPLETION CONDITION — MEASURED, NOT CLAIMED

| condition | state |
| --- | --- |
| accepts a finished week as input | ✅ |
| returns acceptance or typed refusal only | ✅ `accepted \| impossible` |
| cannot return or mutate a workout/week | ❌ — `canonicalWorkouts` is the week AFTER rows 9-13 |
| cannot move / replace / add / remove / trim / clear | ❌ — trims (9), adds+removes (10), clears (11), removes (12), rewrites (13) |
| zero production imports/executions of repair helpers | ✅ proven symbol by symbol |
| input week byte-identical before and after validation | ❌ — not yet true, and NOT claimed |

Agent: demolition
