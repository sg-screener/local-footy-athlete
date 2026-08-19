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

---

## THE CLEAN 405-SUITE COMPARISON — ONE SUITE MOVED, AND IT WAS RIGHT TO MOVE

Both arms swept in untouched worktrees: baseline `wt-control` @ `6da38cee`,
after `wt-after` @ `b4b19d45`. Sets in `scratchpad/BASELINE-FAILS-6da38cee.txt`
and `scratchpad/AFTER-S18-FAILS-b4b19d45.txt`.

| | suites | failing |
| --- | --- | --- |
| baseline `6da38cee` | 405 | **155** |
| after the §18 demolition `b4b19d45` | 405 | **156** |

**NEWLY FAILING (1):** `test:bible-anchors`
**NEWLY PASSING (0):**

**1,924 deletions moved exactly one suite.** No world newly refuses — the
`impossible` count did not move at all, which is itself a finding: the repair
search was not rescuing weeks in any swept world.

⚠ **A HARNESS LIE ON THE WAY.** `pgrep -f "sweep.sh after-s18"` matched MY OWN
monitor loop, whose command line contains that string, so the sweep read as
"STILL RUNNING" for ~11 minutes after it had finished. Match the process
(`^bash scripts/sweep.sh`), never the pattern you are searching with.

### THE ONE FAILURE, RESOLVED AT ITS OWNER

`last_high_stress_g3` — Sam's Bible law: *"last additional high stress is
G-3"* — cited three sites. One was
`postGenerationConstraintValidation.distanceBeforeFixture`, which lived **inside
`buildSection18ProductionFallbackCandidate`**, the §18 fallback-week builder.
Deleting that builder took the citation with it.

**The LAW is current and approved. Its IMPLEMENTATION there was legacy** — a
second authority applying a scheduling law while authoring a replacement week,
downstream of the scheduler that had already chosen the days.

Measured before deciding: `rules/weeklyScheduler.ts` **already enforces G-3**,
at `sprintDayIsLegal` and throughout `appSprintDay` (`daysUntilNextGame >= 3`,
"never inside G-3", WC-135/WC-138). The current owner has the capability.

So the citation MOVED to the live owner rather than being dropped:
`rules/weeklyScheduler.ts` / `sprintDayIsLegal`, with the `BIBLE_ANCHOR` marker
at the decision. **`test:bible-anchors` 274/274.** MUTATION-PROVEN: removing the
marker reds exactly that cell; tree restored byte-identical from my own backup.

This is Sam's rule 5 executed — the current behaviour was extracted to its owner
before the superseded remainder stayed deleted — and the anchor registry doing
precisely the job it exists for: it caught a Bible law losing a site.

Agent: demolition

---

## MOVE 1, STEP 1 — THE POWER BUDGET IS OUT OF §18's FILE (ownership cut NOT yet done)

`rules/weeklyPowerBudget.ts` — 208 lines — now owns `weeklyPowerBudget`,
`withPowerReduction` and `powerReductionReason`, lifted verbatim from
`section18AcceptedWeekGateway.ts:457-616`.

**§18 STILL CALLS IT.** This step moves the CODE, not the AUTHORITY, and the two
are deliberately separate commits: a behaviour change hiding inside a relocation
is the defect class this repo fights, so the relocation is proven inert first
and the ownership cut is measured on its own.

**PROVEN INERT:**

| instrument | pre-move (`b4b19d45`) | after the move |
| --- | --- | --- |
| `test:compile` | product 35 / devtools 51 / tests 383 | **identical** |
| `test:craft-tier` | 18 passed, 14 failed | **identical** |
| `test:section18-v2` | 134 passed, 1 failed | **identical** |
| `test:section18-gateway` | throws at import (red at base) | **identical throw** |

⚠ **AND ONE ASSUMPTION WAS WRONG BEFORE IT COMPILED.** I wrote the new module's
import as `./powerExercisePool` for `budgetedPowerSession`, `powerRows` and
`withoutPowerRows`. They live in `./sessionRowCounting`. Checked rather than
assumed, before the first compile.

**STILL OWED FOR MOVE 1:** apply the budget on the AUTHORING side so the
specialist never authors beyond it; guard it there and mutation-prove the guard;
cut the §18 call; delete the now-dead import. Until that lands, mutation row 9
of the 14-row table is still RETAINED and §18 still trims power.

Agent: demolition

---

## ⚠ CORRECTION — "ZERO NEWLY REFUSED WEEKS" WAS AN UNSUPPORTED CLAIM

**Sam, 2026-08-19:** *"Do not claim 'zero newly refused weeks' from the
405-suite failure comparison alone. State the instrument and unit."* He is right.
**A suite comparison's unit is the SUITE, not the world.** A suite can stay green
while the worlds beneath it swap built for refused, and 155→156 says nothing
about weeks. The claim was true, but I had not measured it.

### THE INSTRUMENT — `scripts/world-census.ts`

Walks the same world grid as `ladderCoverageWideCensusTests.ts` — same profile
base, same 3 phases × 5 day-counts × club/no-club × 3 kits × 2 weeks, the same
`generateProgramLocally` call — and emits **one line per world**:

```
<world id>	<built|refused>	<typed refusal family>	<delivered sessions>
```

The refusal family is the typed one (`error.name` + `code`/`failureSignature`),
never the free-text message, which carries ids and would diff on noise.

### THE RESULT — 180 DISTINCT WORLDS, IDENTICAL

| | pre-demolition `6da38cee` | current tip `c1d3d466` |
| --- | --- | --- |
| distinct world ids | 180 | 180 |
| built | **140** | **140** |
| refused | **40** | **40** |
| per-world diff | — | **byte-identical** |

`diff` of the two files is EMPTY: every world id, every built/refused status,
every typed refusal family and every delivered session count matches.

**So the claim now stands, on the right instrument and unit:** removing §18's
repair system — 1,924 deletions — changed the outcome of **no world**. Not one
week newly refuses, not one loses a session. The repair search was not rescuing
anything in any of the 180 worlds.

That is also the strongest evidence yet that the search was pure overhead: it
existed to fix weeks, and across the whole grid it fixed none.

Files: `scratchpad/census-PRE-6da38cee.tsv`, `scratchpad/census-POST-c1d3d466.tsv`.

Agent: demolition

---

## MOVE 1 — POWER TRIMMING. DONE, WORLD-IDENTICAL, AND **NOT** MUTATION-PROVEN

### WHAT LANDED

- `rules/weeklyPowerBudget.ts` owns the decision; `generateProgramLocally`
  applies it **after the candidate is authored and before §18 sees it**.
- The §18 call is **CUT** — `grep weeklyPowerBudget( src/rules/section18AcceptedWeekGateway.ts`
  returns nothing but prose.
- Guard `test:weekly-power-budget`, 6 cells, in the bible chain.
- `test:compile` identical to base (35 / 51 / 383).
- **Per-world census identical**: 180 worlds, 140 built / 40 refused, same typed
  refusal families, same delivered session counts as `6da38cee`.

### ⚠ THREE FINDINGS, AND TWO OF THEM ARE AGAINST MY OWN WORK

**1. THE GUARD IS NOT MUTATION-PROVEN, SO IT IS NOT YET A GUARD.** Restoring the
§18 trimmer — twice, including with its disclosure re-armed — leaves all six
cells GREEN. The reason is the finding: **`finaliseSection18SafetyWeek` runs
BEFORE the trimmer and has already stripped the excess power**, so the trimmer
saw `removed = 0` and did nothing. **The code I cut from §18 was already inert in
that position.** The cut is correct and the census proves it harmless, but no
cell distinguishes the two trees, and a green cell that survives its mutant is a
claim, not a proof. **Stated rather than dressed up.**

**2. §18 STILL REMOVES POWER ROWS — via row 13, not row 9.** Measured: given 3
budgeted power sessions against a budget of 2, §18 returns 2.
`section18SafetyFinaliser` filters `row.role !== 'power'` and carries a
`power_removed` action. **So Sam's step 6, "prove §18 cannot alter power rows",
is NOT ACHIEVABLE UNTIL MOVE 5 LANDS.** Moves 1 and 5 are coupled; neither of us
had spotted that. Cell `[2c]` records it and reds the day it stops being true.

**3. GENERATION PROGRAMMES NO POWER AT ALL.** Across the full 70-world census, on
**both** the pre-demolition tip and this one: **zero worlds carry a single power
row**, while 50 of 70 declare `plannerSelectedWeeklyBudget: 2`. Pre-existing,
identical in the control tree, **not caused by this move** — and it makes cell
`[1]` vacuous, which cell `[3]` records rather than hides. This belongs to the
composer/power specialist and is the largest open athlete-visible gap this
mission has surfaced.

**ONE MEASURED DIFFERENCE THE CENSUS DID NOT COVER:** at `6da38cee` the stored
microcycle contract carried NO `power.plannerSelectedWeeklyBudget`
(`{"n/a": 70}`); it now carries `{"0": 20, "2": 50}`. The field is stamped at
authoring instead of inside the validator. Nothing athlete-visible changed — the
census pins id, status, refusal family and delivered sessions — but the stored
contract is not byte-identical, and saying "identical" without this line would
be false.

Agent: demolition

---

## THE POWER GAP — DIAGNOSED. AUTHORISED POWER DISAPPEARS AT BOUNDARY 3.

**It is never stripped. It is never CREATED.**

| # | boundary | power state (In-season, 4d, full gym, no club) |
| --- | --- | --- |
| 1 | scheduler / contract authorisation | **`eligible: true`, budget 2, `removalReason: null`, `prohibitedPower: false`** — AUTHORISED |
| 2 | power specialist decision | `materialiseAuthoredSessions` → `decidePowerPrimer` runs (generateProgram:588, :1012) and owns `power_refused_lower_body_on_g2` |
| 3 | **composer / materialisation** | ⚠ **`materialiseComposedWeek` CONTAINS THE WORD "power" ZERO TIMES.** It emits no power row |
| 4 | pre-§18 authored week | 0 power rows. Row roles present: `conditioning, undefined` — **no strength row carries a role at all** |
| 5-7 | safety finaliser / accepted / visible | 0, because there was never anything to carry |

**THE CAUSE — A CAPABILITY STRANDED WHEN ITS AUTHORITY MOVED.** Power belongs to
strength. When strength moved to the composer, power did not go with it:
`materialiseAuthoredSessions` still DECIDES the primer, but `assembleAuthoredWeek`
lays the COMPOSER's rows onto every strength day, and the composer's materialiser
knows nothing about power. **The primer is decided and then overwritten.**

Off-season is a true negative and must stay: `eligible: false`,
`removalReason: early_offseason`, `prohibitedPower: true` — the Bible prohibits
power in early off-season weeks 1-2. **In-season and Pre-season are both
authorised with budget 2 and deliver zero.**

**THIS ALSO EXPLAINS TWO EARLIER RESULTS.** The 180-world census was identical
across the §18 demolition, and my power guard's mutants both survived — because
in every generated world there has never been a single power row for any of it
to act on. The §18 trimmer and the safety finaliser's `power_removed` path have
been dead-in-effect the whole time; only a hand-stamped fixture ever reached them.

**NOT YET BUILT.** The fix is composer-side delivery of the approved primer, then
removal of the safety-finaliser power rewrite and the residual §18 paths. The
existing specialist already carries Sam's G-2 rule, so the rules are not re-derived.

Agent: demolition

---

## POWER IS DELIVERED — 0 → 96 WORLDS. AND IT COSTS FOUR WORLDS A REFUSAL.

### THE TRACE THAT FOUND IT (real in-season world, probes on the production path)

The specialist was never broken. Traced live, it chose: **Monday lower 2×3**,
**Tuesday upper 2×3**, and on the **G-2 Thursday an UPPER primer 1×3 reasoned
"G-2 tiny neural prime"** — Sam's rule obeyed exactly, lower refused, upper kept.
`scheduleToCoachingPlan` carried all three onto the plan.

**Then nothing placed them.** The only power-row builder lived in
`defaultProgram.buildPowerRow`, private to the adapter — and the adapter authors
no strength on composer-owned days. The decision was made correctly, carried
correctly, and thrown away.

### THE CONNECTION

`buildPowerRow` is now **exported and CONSUMED** by `materialiseComposedWeek` —
not re-implemented. The deload dose uses the existing `deloadPowerDose`. The
composer chooses no exercise, no dose and no day; it places what the specialist
decided, pre-lift, on the composer's own strength day.

### CENSUS — EXPLICIT UNITS

| unit | before | after |
| --- | --- | --- |
| distinct generated worlds | 180 | 180 |
| distinct athlete setups | 90 | 90 |
| worlds AUTHORISED for power | 96 | 96 |
| **worlds RECEIVING power** | **0** | **96** |
| **power rows delivered** | **0** | **192** |
| authorised-but-undelivered | 96 | **0** |
| built / refused | 140 / 40 | **136 / 44** |
| delivered sessions | — | 422 |

Budget never exceeded in any world. Early off-season remains power-free
(`eligible: false`, `early_offseason`) — a true negative, preserved.

### ⚠ THE COST — FOUR WORLDS NOW REFUSE, AND IT IS MY BUG, NOT AN HONEST REFUSAL

```
Pre-season/4d/club/Bodyweight Only/w1     Pre-season/4d/noclub/Bodyweight Only/w1
Pre-season/4d/club/Bodyweight Only/w2     Pre-season/4d/noclub/Bodyweight Only/w2
```

Typed refusal: `main_strength_planner_selected_target — expected 3, actual 2`.

**SINGLE-VARIABLE EXPERIMENT, and it is unambiguous:** disabling only the primer
placement makes the world BUILD; restoring it REFUSES. Placing the primer costs
that week one main-strength exposure.

**This is NOT the "honest new refusal" Sam sanctioned** — that sanction covers
weeks exposed by deleting repair. This is a regression introduced by my
placement, and it must be fixed at the composer before merge. **My first
hypothesis was wrong and is recorded as refuted:** restricting placement to days
that already carry strength rows did NOT clear it, so the cause is not a
power-only day.

**NEXT, and not yet done:** find why a leading `role: 'power'` row costs a
main-strength exposure — the suspect is session identity/evidence being
re-derived from rows, where `exerciseOrder: 0` puts power first. **NOT MERGEABLE
until those four worlds build.**

### GUARD

`test:weekly-power-budget`, 6 cells, green. Cell [3] **inverted itself**: it
existed to record that no world programmed power, and it reddened the instant
delivery started, naming the count — so it is now the positive assertion.
**MUTATION-PROVEN:** disconnecting materialisation reds cell [3]; tree restored
byte-identical.

Agent: demolition

---

## ⚠ DEMOLITION PHASE — SAM'S RULING 2026-08-19: DELETE ALL LEGACY FIRST

> *"STOP FIXING INTERMEDIATE PRODUCT BUGS. Intermediate failures, refusals,
> missing power, broken classifications and worse test counts are allowed during
> demolition. Record them, but do not stop demolition to repair them."*

**From here the process changes.** No fix-as-you-delete, no world-count recovery,
no full 405-suite gate between deletions. Structural checks only, commit in
recoverable chunks, and everything broken goes on the REBUILD LIST below.

### THE POWER TRIMMER IS DELETED, AND ITS FIRST LIVE ACT WAS DESTRUCTIVE

Proven by probes on the production path, not inferred:

```
[CANDIDATE ] day=4  power:-  main_strength:push  strength_accessory:-
[POSTBUDGET] day=4  (EMPTY)
```

`weeklyPowerBudget` did not merely take the third primer off Thursday. Its strip
path re-finalises the day (`finaliseWorkoutAfterMutation(withoutPowerRows(...))`,
`restoreMissingPlanPatterns: false`) and **DESTROYED THE WHOLE DAY, main lift
included.** Main-strength exposures fell 3 → 2 and four worlds were refused.

**It had been dormant only because no generated week had ever contained a power
row.** Its first live action was to delete an authored strength session.

**DELETED.** The allowance is now a PLACEMENT limit in the composer — place at
most N — so nothing is ever stripped and nothing re-finalises an authored day.

### ⚠ THE FIRST-ROW CLASSIFIER HYPOTHESIS IS REFUTED, AND I AM NOT DELETING IT

Sam's mid-turn order was to delete the order-dependent classifier **if the trace
confirms it**. **The trace refutes it.** `validateGeneratedWeek` counts main
strength by scanning EVERY row for `role === 'main_strength'` with a declared
pattern — no first-row read, no row-zero inference, no ordering dependence.
Probes confirmed the composer, the merge and the candidate all carried three
declared main-strength days; the loss happened later, in the trimmer.

**So there is no first-row heuristic here to delete.** Deleting a
correctly-ordered-independent classifier because a hypothesis predicted one would
have removed working code and hidden the real cause.

### REBUILD LIST — capabilities temporarily missing, to be rebuilt from contract

| capability | approved contract / ruling | state |
| --- | --- | --- |
| **Power delivery to eligible athletes** | Power is part of strength work; only on a scheduler-authorised strength day; lower prohibited on G-2, upper legal; allowance must be delivered unless a typed safety reason prevents it | **BROKEN — 0 of 96 authorised worlds receive power.** The composer places it correctly (proven: 96/96, 192 rows), but the allowance now reads `contract.power.plannerSelectedWeeklyBudget`, which the DELETED trimmer used to stamp. The stamp must be rebuilt at the specialist. |
| **Power allowance stamping on the contract** | Section 18 A phase-owned selected target | **BROKEN** — was written by the trimmer inside §18 |
| §18 power disclosure `weekly_power_budget` | — | deleted with the trimmer, not to be rebuilt |

Census at this commit: 180 worlds, 90 setups, **140 built / 40 refused**
(back to the pre-power baseline), 434 delivered sessions, **0 power rows**.

Agent: demolition

---

## AREA A COMPLETE — §18 IS VALIDATION-ONLY. ALL FIVE MUTATION STAGES DELETED.

`section18AcceptedWeekGateway.ts`: **1804 → 875 lines** (929 deleted).

| stage | what it did | now |
| --- | --- | --- |
| repair search + 5 generators | Rest substitution, stacking, relocation, conditioning injection, candidate authoring | deleted (slice 2) |
| regenerate / safeFallback cascade | tried three more weeks | deleted (slice 2) |
| `withDisplacedCapacityReduction` | lowered the contract until the week passed | deleted (slice 2) |
| `weeklyPowerBudget` | trimmed power — **destroyed an authored day** | **deleted, file gone** |
| `applyUserRemovalConstraintsToWeek` | applied stored athlete deletions | **deleted** → accepted-state transaction |
| `buildDerivedSessionExpiryCandidates` | cleared stale derived sessions | **deleted** → lifecycle owner |
| `finaliseSection18SafetyWeek` | rewrote the week for safety; still stripped power | **deleted** → composer + specialists |
| `presentDeclaredOffer` | placed/withdrew the optional session | **deleted** → scheduler |
| read-time removal in `resolveFinalVisibleSection18Week` | applied deletions while PROJECTING | **deleted** (area D) |

**FILES DELETED:** `rules/weeklyPowerBudget.ts`, `__tests__/weeklyPowerBudgetTests.ts`.

`test:compile` shows only the 7 pre-existing baseline pairs — no new error in any
scope.

### REBUILD LIST — added by area A

| capability | contract | owner to rebuild at |
| --- | --- | --- |
| Applying stored athlete deletions | a deletion is an accepted-state input, not a render filter | accepted-state transaction |
| Clearing stale derived sessions | derived work expires when its source fact does | accepted-state / lifecycle |
| Safety rewriting of a week | §18 safety policy | composer + specialists (at authoring) |
| Optional-session placement/withdrawal | 1B offer survival rulings, Sam 2026-08-06 | scheduler |
| Power allowance stamping + delivery | Section 18 A phase-owned target; power is strength work | power specialist + composer |

Agent: demolition

---

## AREAS E/G/H — ELEVEN SUPERSEDED MODULES DELETED, WITH THEIR OBSOLETE TESTS

Each proven at **zero production importers** (`scratchpad/tools/imports.js`,
which resolves real specifiers rather than grepping the word) AND given a named
current owner before deletion — the Finding 0 rule, so the mobility-pairing class
of built-but-unwired work is never swept up.

| deleted module | area | current owner |
| --- | --- | --- |
| `utils/trainAroundEngine.ts` | E | injury prohibitions on the contract + `injurySessionClassifier` |
| `utils/blockAdjuster.ts` | F | `applyAdjustmentEvents` / decision ledger own `dateOverrides` |
| `utils/weeklyCoachUpdate.ts` | D | `programControlActions` + `CoachStatusScreen` |
| `store/preRebuildEnvelopeMigration.ts` | **G** | none — a one-time migration for athletes installing over the pre-rebuild world. **No production users exist.** |
| `utils/recoveryAddonBuilder.ts` | E | placement retired by ruling; generation places no add-ons |
| `store/injuryEpisodeCommand.ts` | F | `injuryEpisodeTransaction` (5 prod importers) |
| `screens/home/homeGameMutationController.ts` | E | `fixtureMutationTransaction` |
| `utils/section18ProgramObservation.ts` | H | the §18 evaluator, called directly |
| `utils/coachInjuryTargetResolver.ts` | F | `pendingInjuryResolver` (live, CoachScreen) |
| `utils/capacityAnswerGap.ts` | H | `profileStore` + `postGenerationConstraintValidation` via `canScoreCapacity` |
| `components/TrunkSupportSection.tsx` | H | none — zero importers anywhere |

**OBSOLETE TESTS DELETED (7, 3,175 lines)** — subject is the deleted module:
`trainAroundEngineTests`, `weeklyCoachUpdateTests`,
`preRebuildEnvelopeMigrationTests`, `recoveryAddonAttachmentTests`,
`injuryEpisodeCommandTests`, `capacityRenderSafetyTests`,
`coachInjuryContractTests`. Six `package.json` scripts deregistered; the bible
chain is intact at 402 suites.

⚠ **AND A BULK DELETION I CAUGHT AND REVERSED.** Matching tests by IMPORT rather
than by SUBJECT first removed 16 further suites whose subject is a LIVE owner —
`fixtureMutationTransactionTests`, `programBlockRolloverTests`,
`section18ContractV2Tests`, `weekRebuildIntegrationTests`, `readinessSignalTests`
and others. They merely imported a dead module. **All 16 were restored.** They
now carry dangling imports and are RECORDED as broken rather than deleted:
losing a live owner's guard is not "deleting an obsolete test", and the rebuild
phase needs them.

Agent: demolition

---

## ⚠ INSTRUMENT TRAP — `imports.js` WITH A RELATIVE ROOT REPORTS **ZERO FOR EVERYTHING**

Caught on the first census of this session, before any deletion.

```
node tools/imports.js .    store/quiescentBoot  ->  importers=0 (prod/script=0)
node tools/imports.js $WT  store/quiescentBoot  ->  importers=26 (prod/script=5)
```

`ROOT` is used with `path.join`/`path.relative`, so a relative `.` silently
resolves nothing and **every file looks dead**. It does not warn and it does not
exit non-zero — it prints a clean, confident zero.

**The census that triggered it returned `importers=0` for ten modules including
`quiescentBoot` (the live boot owner) and `appHydrationGate` (mounted by
`RootNavigator`).** Acting on that output would have deleted the app's boot path
under a "zero production imports" proof. The tell was that the answer was zero
for *everything*, including files I already knew were live — a census where
nothing is reachable is measuring nothing.

**ALWAYS pass an ABSOLUTE root, and always keep one known-live module in the
argument list as a positive control.** A deletion instrument that cannot show a
non-zero is not evidence. Same class as [[a-green-gate-is-a-claim]].

---

## AREA B/G — THE HYDRATION INGRESS CLASSIFIER IS DELETED (zero production execution)

**Surviving owner:** `readStoredWorldOrResetClean` (`store/unreadableWorldResetDoor.ts`
→ `rules/unreadableWorldReset.ts`), live at boot ingress in
`programStore.ts:419`. Sam, 2026-08-10: a stored world the current code cannot
read is **RESET CLEAN** and the athlete is told. That is the whole of "can this
envelope be read", and it is the canonical accepted-state loading Sam's order
says to PRESERVE — it is preserved untouched.

**Proof the target was superseded, on two independent grounds:**

1. **Zero production callers.** `classifyProgramHydrationIngress`,
   `requireProgramHydrationIngress` and `dropRetiredWeekOverlaysAtHydration` were
   referenced by NOTHING outside tests and one stale comment. `programStore`
   imported the module for exactly one live symbol — the version constant — plus
   a type it never used.
2. **The suites that drove it say so themselves.** `slice4PersistenceProbe`:
   *"nothing reads a stored program back at all (`partialize` persists inputs
   only)"*. Both remaining callers hand-rebuilt a function deleted on 2026-08-14
   out of two pieces in order to keep asserting on it.

| deleted | lines | why |
| --- | --- | --- |
| `store/programHydrationIngress.ts` | 379 | pre-release legacy/canonical envelope classifier; zero production execution |
| `__tests__/hydrationUpgradePathTests.ts` | 325 | SUBJECT is the deleted upgrade path — hydrating a previous-build store |
| `__tests__/fixtures/previousBuildStore-49c8579.json` | 45 | obsolete seed, zero code readers (named only in the deleted test's prose) |

**PRESERVED, and deliberately:** `previousBuildStore-1e9c822.json` is still read
by the LIVE `hydrationRefusalQuarantineTests` — matching fixtures by name would
have taken a live suite's payload with it. `programHydrationProjection.ts` stays:
its name says hydration but its live caller is
`canonicaliseAcceptedStateCandidate`, on the ACCEPTANCE boundary.

`PROGRAM_STORE_PERSISTENCE_VERSION` moved to `programStore.ts`, the store that
writes it. With no second reader there is no one left to agree with about it.

**Two live suites detached, not deleted** — the ⚠ lesson from areas E/G/H holds:
`programHydrationOwnershipTests` and `slice4PersistenceProbe` are about LIVE
owners and merely imported the dead one. Their classifier cells (1, 13, 18) were
its implementation tests and went with it; cell 15's incidental classification
assert was dropped.

### PROOF

```
test:compile   control 3f97cc67 = 32 file(s) over baseline
               after   B-1      = 32 file(s) over baseline     DIFF: IDENTICAL
test:program-hydration-ownership
               control 3f97cc67 = passed 7/17  failures 10
               after   B-1      = passed 4/14  failures 10
```

Cells run 17 → 14, passes 7 → 4 — **exactly the three deleted classifier cells,
and not one failure moved.** The suite's hardcoded `/17` denominator was updated
to `/14` in the file's own stated-number convention; leaving it would have made
the suite misreport its own size.

**REBUILD LIST — nothing added.** A path with zero production execution loses no
athlete capability when deleted. The retired-overlay filter
(`dropRetiredWeekOverlaysAtHydration`) is the only behaviour that went, and the
law it served — repeat-week has no writer — is now held by there being no writer
at all, which `storedStateWriterAuditTests` still asserts across the tree.

Agent: demolition
