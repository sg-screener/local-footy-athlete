# THE LR-29 REPLAY UNIT — THE MEASURED DEPENDENCY LIST (2026-08-07)

**This is the deliverable the kickoff doc's opening law demands, and it is the
whole of what was ordered.** Nothing here is built. The unit itself is
RE-SLOTTED by Sam to build after day-first UI, before beta; it remains the
measured payer of `main`'s declared `fixture-identity` reds.

Companion to `docs/REPLAY_UNIT_KICKOFF_2026-08-07.md`. Read that first for the
class sentence and the four refuted routes; this document answers its five open
questions with measurements instead of readings-of-source.

**World:** `main` at `fc4013cc`, instrument on `scratch/lr29-dependency-list`.

---

## 0. THE INSTRUMENT, AND THE CHECK THAT MAKES IT BELIEVABLE

Open question 1 cannot be answered by reading the ten call sites. A call site
shows a contract was FETCHED, never which of its sixteen fields was CONSULTED —
a reader that wants `protocolVersion` and a reader that wants the accumulator
look identical at the door. So the door hands back a **recording Proxy** and the
answer arrives by construction, the same shape as the ownership census's
store-seam Proxy that found the 16-field surface in the first place.

**A Proxy can perturb what it measures** — the wrapper is not reference-equal to
the contract it wraps, so any reader doing an identity comparison sees a
different world. **So the arm was priced against the control set before a single
reading was believed:**

| arm | failure set |
|---|---|
| control (`main`, `fc4013cc`) | **2 of 156** — `program-control-durable`, `fixture-identity` |
| both tapes live | **2 of 156** — the same two suites |

**Identical. The instrument does not perturb, and the readings below stand.**
Had it moved, the instrument would have been the finding and every number here
void.

Counts are OCCURRENCES over all 156 suites, with distinct weeks beside them —
the unit is a (reader, field) read, not a domain noun.

---

## 1. Q1 — WHICH READERS NEED THE ACCUMULATED CONTRACT? **MEASURED.**

| reader | door calls | weeks | distinct fields read | `authorisedReductions` reads |
|---|---:|---:|---:|---:|
| `sessionResolver.tierFourEntry` | 91,365 | 23 | 16 | **270,090** |
| `visibleProgramReadModel.weekHasAcceptedContract` | 45,057 | 18 | **0** | 0 |
| `acceptedEffectiveWeek.rebase` | 26,018 | 22 | 16 | **112,353** |
| `postGenerationConstraintValidation.finaliseLiveDateCandidate` | 10,554 | 6 | 15 | 41 |
| `programStore.validateHydratedWeeks` | 7,265 | 22 | 16 | **46,589** |
| `acceptedStateTransaction.validateAcceptedWeeks` | 4,983 | 22 | **0** | 0 |
| `acceptedStateTransaction.contractForAcceptedWeek` | 1,328 | 12 | 15 | **1,328** |
| `programStore.safetyContractForDate` | 483 | 7 | **2** | 0 |
| `postGenerationConstraintValidation.legacyLedgerSuppression` | 38 | 6 | **0** | 0 |
| `postGenerationConstraintValidation.validateLiveWeekOverlayWrite` | 12 | 2 | 15 | 12 |

### The three findings that change the unit's shape

**(a) THREE OF TEN READERS READ NO FIELD AT ALL.**
`weekHasAcceptedContract`, `validateAcceptedWeeks` and `legacyLedgerSuppression`
fetch a contract 50,078 times between them and consult **zero** of its fields.
They are asking one question — *does a declaration exist for this week* — and
**an existence predicate satisfies all three.** They need neither the base nor
the accumulated contract, and they need not be threaded through any replay.
That is 50,078 of the door's 187,103 calls, retired by a boolean.

**(b) ONE READER NEEDS TWO FIELDS.** `programStore.safetyContractForDate` reads
`identity` (872) and `safety` (1,670) and nothing else, ever, in any of 156
suites. It never touches the accumulator. Its dependency is the SAFETY rung
alone.

**(c) THE ACCUMULATOR HAS FOUR REAL CONSUMERS, NOT SIX.** See §2 — three of the
apparent consumers are clones, and the instrument can tell the difference.

### THE INSTRUMENT'S OWN LIMIT, STATED BEFORE IT IS USED

**A uniform read count across every field is a CLONE, not consumption.**
`finaliseLiveDateCandidate` reads 15 fields exactly 41 times each;
`validateLiveWeekOverlayWrite` reads 15 fields exactly 12 times each;
`contractForAcceptedWeek` reads 14 fields exactly 16 times each. A spread or a
structured clone touches every field once per call and says nothing about which
field the reader needs. **For those three the field tape measures copying, and
cannot answer Q1.**

Only NON-UNIFORM counts show genuine selective consumption. Four readers show
it: `sessionResolver.tierFourEntry`, `acceptedEffectiveWeek.rebase`,
`programStore.validateHydratedWeeks`, `programStore.safetyContractForDate` —
plus `contractForAcceptedWeek`, whose `authorisedReductions` count (1,328)
stands **83× above** its uniform clone floor of 16 and is therefore real
consumption on top of a clone.

**So the accumulator's measured consumers are FIVE:** `tierFourEntry`,
`rebase`, `validateHydratedWeeks`, `contractForAcceptedWeek`, and — pending the
clone question — possibly the two remaining cloners. **Resolving those two is a
named sub-measurement the unit owes itself**, and it is cheap: tape the clone
site rather than the door.

---

## 2. Q2 — WHERE DOES THE COMPOSED WEEK EXIST WHEN EACH READER ASKS?
### **PARTLY MEASURED, AND THE ANSWER ALREADY EXISTS IN THE TREE.**

Route 4's finding was that the declaration DOOR is the wrong place to derive,
because it is called from hydration and stored-shape validation as well as live
reads, so no single world exists to derive against. **That is confirmed by the
source column below** — every reader but one is answered from more than one
rung, and four are answered from `none` as well.

**But the moment the unit needs already exists and already runs.**
`quiescentBoot.rebuildDerivedWorld()` (`src/store/quiescentBoot.ts:304`) holds
`beginLedgerReplay()`, wipes the derived surfaces to empty — **including
`exposureContractsByWeek: {}` and `weekScopedOverlays: {}`, which is exactly the
stored declaration the unit wants unread** — and rebuilds from inputs. And
`gatherDeriveInputs()` (`src/utils/deriveVisibleWeek.ts:85`) already enumerates
the whole input set in one call: profile, marked days, readiness, coach
constraints, coach injury, **the decision ledger**, results, and the stored
program surfaces.

**This is the single largest dependency finding in this list: the replay unit is
not starting from nothing.** The boot already replays; the question the unit
actually inherits is narrower and sharper than the kickoff doc frames it —
*does the boot replay currently reconstruct `authorisedReductions`, or does it
lose them?* **NOT MEASURED. It is the unit's first measurement**, and it is one
tape, not a build.

### The source census — which rung answered, all 156 suites

| reader | overlay | covering_microcycle | none |
|---|---:|---:|---:|
| `sessionResolver.tierFourEntry` | 10,320 | 80,624 | 421 |
| `visibleProgramReadModel.weekHasAcceptedContract` | 18,218 | 24,873 | 1,966 |
| `acceptedEffectiveWeek.rebase` | 18,703 | 7,315 | 0 |
| `finaliseLiveDateCandidate` | 6 | 35 | 10,513 |
| `programStore.validateHydratedWeeks` | 4,838 | 1,462 | 965 |
| `acceptedStateTransaction.validateAcceptedWeeks` | 2,918 | 1,900 | 165 |
| `contractForAcceptedWeek` | 727 | 601 | 0 |
| `programStore.safetyContractForDate` | 188 | 283 | 12 |
| `legacyLedgerSuppression` | 6 | 24 | 8 |
| `validateLiveWeekOverlayWrite` | 6 | 6 | 0 |

**A RUNG IS DEAD AND CAN BE DELETED FOR FREE.** `current_microcycle` — the third
branch, carried because three sites "already had it" — **answered ZERO times
across all 156 suites and all ten readers.** It is not rare; it is never. The
unit can drop that rung and the `currentMicrocycle` parameter with it, and the
door's precedence collapses from three rungs to two. *(This confirms an earlier
recorded observation rather than discovering it — recorded as confirmation, not
as a find.)*

**A CORRECTION TO A CARRIED CLAIM.** `validateLiveWeekOverlayWrite` was recorded
in three prior passes as firing **0×**. It fires **12 times over 2 weeks** here.
The claim was true when measured and is not true now; anything that rested on
its inertness needs re-checking.

---

## 3. Q3 — IS THE DECISION LEDGER SUFFICIENT TO REPLAY THE DECISION-AUTHORED
## IDENTITY? **MEASURED, AND THE ANSWER IS NO.**

**The ledger's entire vocabulary is six kinds** (`src/types/decisionLedger.ts`):
`plan_change`, `fixture_add`, `fixture_remove`, `fixture_move`, `reversal`,
`migrated_day_placement`.

**It has exactly three production writers:**

| writer | site | kinds it appends |
|---|---|---|
| program control | `planChangeProducer.ts:2396` | `plan_change` (landed only — refusals never reach it) |
| fixture mutation | `fixtureMutationTransaction.ts:639` | `fixture_add` / `fixture_remove` / `fixture_move` |
| the one-time migration | `preRebuildEnvelopeMigration.ts:188,212` | `migrated_day_placement` |

**The class sentence's piece (2) names three things the ledger cannot express.**
The kickoff doc says the decision-authored identity is *"bye-build and
practice-match table selection, illness authoring, in-week authorised changes"*.
Of those, only **in-week authorised changes** have a ledger kind (`plan_change`).
**Illness authoring has no kind. Injury, readiness and phase shift have no kind.**
The type file says so itself in a comment — *"R3 adds fact decisions (phase
shift, injury, illness, readiness) as new union members"* — and **R3's fact
decisions were never added.**

Those facts are authored through separate transactions that do not touch the
ledger: `injuryEpisodeTransaction.ts`, `injuryEpisodeCommand.ts`,
`temporarySourceFactTransaction.ts`, `readinessStore.ts`, and the calendar
store's marked days.

**THE DEPENDENCY THIS CREATES, STATED PLAINLY.** "Replay the decision ledger
onto the base contract" is **not a sufficient description of the unit**. The
replay's input set is **the ledger PLUS the fact stores**, and `gatherDeriveInputs`
already treats it that way — it gathers marked days, readiness, coach
constraints and coach injury alongside `decisions`. The unit must either (i)
consume both, or (ii) first extend the ledger vocabulary with R3's fact
decisions so there is one input. **That is a design fork, and it is the largest
open decision in this list.** Route 4 is not evidence against (i): route 4
supplied facts *at the door*, and its refutation was about the PLACE, not the
inputs.

---

## 4. Q4 — THE THREE CLASS B CELLS. **MEASURED UNDER THE ARM.**

They are invisible in the control world — they only fail under the flip. Priced
today on `main` at `fc4013cc`, `LFA_FLIP_DOOR=1`, four witness suites through
the sweep runner:

| suite | control | flip arm |
|---|---|---|
| `test:fixture-identity` | **RED** | **GREEN** |
| `test:phase-structure` | GREEN | **RED** |
| `test:derived-week-lawfulness` | GREEN | **RED** |
| `test:program-control-durable` | RED | RED (unchanged) |

**THE PAYER CLAIM IS RE-CONFIRMED, NOT CARRIED.** `fixture-identity` — the red
this merge knowingly put on `main` — **goes green under the arm today**. The
replay unit is measurably its payer, re-measured on the merged tree rather than
quoted from a prior pass.

`phase-structure` cell 8 remains **characterised by text and not mechanised**,
now across four passes. It is the oldest un-diagnosed item on this work and the
unit should treat it as a first-class deliverable rather than a straggler.

---

## 5. Q5 — DOES THE PARITY GATE SURVIVE? **ANSWERED FROM ITS OWN TERMS.**

The declared entry `stored_declaration_costs_mondays_power_row`
(`src/__tests__/derivedWeekLawfulnessProof.ts:245`) carries its own retirement
condition: *"the accepted week carries no stored `exposureContractV2`, so
nothing at read can answer from it."*

**That condition is met by this unit by construction**, and the entry retires
**PAID, not MOVED** — already measured: the comparison stays non-vacuous
(payload survives, 5/7/5 materialised days) and goes byte-equal. The gate's
left-hand side then needs re-aiming from *stored vs derived* to *no read answers
from storage*, which is a rewrite of the gate's premise, not of its assertions.

`test:derived-week-lawfulness` going RED under the arm (§4) is that entry firing
as designed, not a new defect.

---

## 6. THE DEPENDENCY LIST, AS A LIST

Ordered by what blocks what.

1. **Does the boot replay reconstruct `authorisedReductions`?** One tape at
   `rebuildDerivedWorld`. **Blocks everything** — if it already does, the unit
   is far smaller than priced.
2. **The ledger-vs-facts design fork** (§3). Blocks any build. Needs a ruling,
   not a measurement.
3. **The two unresolved cloners** (`finaliseLiveDateCandidate`,
   `validateLiveWeekOverlayWrite`) — tape the clone site, not the door.
4. **The existence predicate** for the three field-less readers — the one piece
   that is safely separable and free.
5. **Delete the dead `current_microcycle` rung** — measured zero, free.
6. **`safetyContractForDate`'s two-field dependency** — the narrowest reader,
   the natural first conversion.
7. **`phase-structure` cell 8** — mechanise it or declare it.
8. **Re-aim the parity gate's premise** — lands with the unit, not before.

---

## NOT COVERED — honestly

- **Nothing was built, and nothing landed on `main` but this document.** The
  instrument lives on `scratch/lr29-dependency-list` and is flag-inert.
- **The field tape cannot distinguish need from copying for two readers** (§1),
  and that is stated as a limit rather than rounded away.
- **Whether the boot replay reconstructs the accumulator is NOT measured** — it
  is item 1 of the list precisely because it is unknown, and it is the item most
  likely to change the unit's size in either direction.
- **No device evidence.** Everything here is harness measurement.
- **Suite reach is not coverage.** The counts are occurrences across whichever
  suites happen to exercise each door; a reader with 12 calls is not proven rare
  in the app, only rare in the harness.
- **`legacyLedgerSuppression` at 38 calls and `validateLiveWeekOverlayWrite` at
  12 are thin.** Conclusions drawn about them rest on very few observations.
- **The three field-less readers were measured as field-less, not proven
  field-less by construction** — a reader that consults a field only in a branch
  no suite reaches would read as zero here.
- **L12 — what catches the NEXT defect of this class:** the door's field tape
  should become a standing gate, not a one-off instrument. The class of defect
  this list exists to prevent is *"a dependency discovered one at a time, each
  discovery invalidating the plan built on the last"* — five sightings on this
  work. A gate that fails when a reader starts consulting a field it did not
  consult before is the mechanised form of this document, and it costs one
  assertion over the tape.
