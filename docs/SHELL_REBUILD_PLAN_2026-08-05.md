# THE SHELL REBUILD PLAN — 2026-08-05

**Status: FOR SAM'S REVIEW. No code rides with this document, and no code is
written until this plan is approved.**

Executes `docs/SHELL_REBUILD_RULING_2026-08-05.md` (Option B, "yes b cut
signed"). Evidence base: `docs/SHELL_REPAIR_VS_REBUILD_SIZING_2026-08-05.md`,
`docs/NORTH_STAR.md`, `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`,
`test:device-pass-2026-08-05-evening` (`e1aa150`, the five declared reds),
`src/data/legacyReckoningCensus.ts` (measured 2026-08-05).

Convergence statement, up front: this plan IS the north-star move. Persisted
state becomes inputs only; `visibleWeek = derive(...)` becomes literally true;
the five publication shapes converge to one. Every slice's boundary report
still answers the convergence question individually.

---

## §1 What survives, what is replaced, what is deleted

**Survives byte-for-byte (the proven engine):**

- `src/rules/` (~27.5k), `src/data/` (~17.1k), `generateProgram.ts` (~2.1k) —
  bible-gated, 138 links, EXIT 0.
- The door VOCABULARY: `planChangeTypes.ts` (11 plan-change kinds),
  `programControlActions.ts` producers, the typed fixture/fact/outcome shapes.
  Door names and call signatures survive; screens keep calling what they call.
- The screens and components (~32k) — they read one projection and call doors;
  they are rewired, not rewritten. The one-projection law (L-P1–P8) stands.
- The harness: bible chain, walker, both device-pass suites, totals-or-red,
  the armour recipe and its ownership suites for every store that remains.
- The armoured INPUT stores, as-is: `profileStore` (answers), `calendarStore`
  (markedDays), `readinessStore` (signalsByDate), `athletePreferencesStore`.

**Replaced (the ~11k the ruling names — implementation dies, door name lives):**

| File | Lines | Fate |
|---|---|---|
| `acceptedStateTransaction.ts` | 3,390 | deleted — no accepted state to transact |
| `programStore.ts` accepted/envelope machinery | ~2,900 (part) | store shrinks to non-persisted derive cache + door surface |
| `temporarySourceFactTransaction.ts` | 1,246 | body becomes append-fact + re-derive |
| `coachMutationTransaction.ts` | 951 | deleted for beta (coach cut); returns in coach rebuild on the new shell |
| `reversibleAdjustmentTransaction.ts` | 911 | replaced by reversal decisions (LR-29 by construction) |
| `injuryEpisodeTransaction.ts` | 875 | body becomes append-fact + re-derive |
| `fixtureMutationTransaction.ts` | 803 | body becomes append-decision + re-derive; `conflicted` outcome dies |
| `profileProgramTransaction.ts` | 446 | body becomes answer-write + re-derive |
| `sessionOutcomeTransaction.ts` | 485 | body becomes append-result |
| `programHydrationIngress.ts` / `acceptedStateColdStart.ts` / `programHydrationProjection.ts` / `appHydrationGate.ts` | 1,072 | deleted — boot reads inputs and derives; hydration migration ceases to exist as a category |

**Deleted from PERSISTENCE (whether or not code remains):** the program
envelope (`currentProgram` et al.), `acceptedMaterialContext` entirely
(revision, fact mirrors, `acceptedCompositionBase`, `acceptedProfileSnapshot`),
`dateOverrides`/`overrideContexts`, `weekScopedOverlays`,
`userRemovalConstraints`, `exposureContractsByWeek`, the ledger's stored
snapshots, `coachUpdatesStore`'s `activeConstraints`/`activeInjury` mirrors.
The decisions these surfaces encoded are reborn as ledger entries (§2); the
outputs are simply not stored.

**Out of scope, untouched:** the 29k coach free-text pipeline (LR-6 STOP
holds; sits out of beta per the signed cut), coach-era stores (chat history,
memory, clarifier) — frozen, declared exceptions in the structural sweep (§7),
the coach rebuild's problem.

## §2 The inputs schema — what IS a stored decision

Persistence holds exactly four classes of input. Nothing else.

1. **Profile answers** — `profileStore.onboardingData`. Unchanged, already
   armoured. The season-phase clock's `explicit_user_phase_change` entries are
   answers with dates (the anchor facts that make derivation stable — block
   number from the anchor, never re-derived from a date; the week-identity
   lesson is law here).
2. **Life-facts** — typed, dated: `markedDays` (calendar), readiness
   `signalsByDate`, injury episodes, temporary source facts
   (illness/busy-week), team days. The first two keep their armoured stores;
   episodes and source facts move from `acceptedMaterialContext` mirrors into
   their own input slices.
3. **The decision ledger** — ONE new persisted store, armour recipe applied
   once. Every athlete edit is one appended entry:
   - `id`, `occurredAt` (device clock, ISO)
   - `door` — closed union, exactly the existing vocabulary (`remove_session`,
     `move_session`, `swap_template`, `add_template`, `swap_category`,
     `add_category`, `clear_days`, `shutdown_week`, `move_team_night`,
     fixture `add`/`remove`, equipment answer, …)
   - `payload` — the already-typed plan-change/fact shape, verbatim
   - `provenance` — `athlete_tap` | `coach` | `migration` | `system_fixture`
   - Targets are named by **date + slot coordinates, never by derived session
     ids** — a derived id can drift across engine versions; a date cannot.
   - Undo = appending a typed reversal entry. No before-state is stored
     (LR-29 dies by construction).
4. **Training results** — what was done: workout logs, session feedback,
   weights/TT times. `workoutLogStore` becomes persisted (pays LR-18);
   `sessionFeedback`/`weightOverrides` move here from the program envelope.

And the sentence that replaces 11k lines:

```
visibleWeek = derive(Bible, profile, facts, decisions, results, today)
```

`derive()` gets ONE owner, assembled from what already exists and is
bible-proven: `generateProgramLocally` + `buildScheduleStateImperative` +
`resolveWeekWithConditioning` + `visibleProgramReadModel`. Its rivals are
deleted when the switchover lands (pays LR-13).

**Two structural laws, each a permanent bible cell:**

- **Boot appends nothing.** A relaunch is not a decision: hydrate, flush,
  byte-compare every persisted key — identical or red. This is evening-0's
  successor and the strongest cell in the plan.
- **The work bill equals the decision.** Every door's persisted write set is
  exactly the input stores its decision touched — evening-4's cell,
  generalised across the whole door vocabulary. A delete writes one ledger
  entry: hundreds of bytes, one store, one write.

Conflicts remain decidable at the decision level (two decisions about the same
slot), where "the same facts were re-transacted" can never masquerade as one.
There is no revision token because there is no output store to version.

## §3 The slice sequence

Slices are DEVICE-PASS boundaries (each ends athlete-visible on Sam's phone,
per L16 and standing condition 3); units within a slice are commit-scale.
Every new athlete-visible string ships PROPOSED under the copy law.

### R1 — The spine: a derived week, and the day doors (size L)

Units, in order: (1) inputs schema types + the decision ledger store, armoured
in the same unit (door, tape, quarantine, ownership suite, ratchets — one
application of the recipe); (2) `derive()` under one owner; (3) the new boot:
read inputs → derive → render, no transactions, no gate; (4) the
program-control door family (`executeProgramControlActionDurably`: delete,
move, swap, add, clear, shutdown, team-night) and the fixture doors
(add/remove game) rewired to append + re-derive. The differential harness runs
from unit 2: on acted worlds, old shell's visible week ≡ `derive()` of the
same inputs — both worlds derived and compared, the Stage B switchover
pattern. From R1 the new shell is the ONLY writer; the old machinery is
bypassed, deleted in R5, never dual-run in product.

**Sam SEES (fresh install — delete the app first, deliberately, this once):**
onboard, and his week appears. Add a pre-season game — it lands, no
"Couldn't update your week". Open the game-day sheet — Remove works. Delete a
session — **instant**, not 30 seconds. Relaunch — everything still there, and
the launch is fast. Boot-to-week and tap-to-render get measured on this build,
Release-class, and those are the first numbers we're allowed to quote.

**Pays:** evening-0, evening-2, evening-3, evening-4 on the fresh coordinate;
evening-1 structurally (boot emits no decision flood — the ring holds his
taps). Each cell that goes green owes the deletion of its declared-red entry
in the same commit.

### R2 — The migration: his phone arrives intact (size M — its own named unit, standing condition 5)

One-time envelope→inputs extraction: read the persisted old-world envelope
once, extract the inputs it contains (profile, facts, and the decisions
encoded as overlays/removal-constraints/`dateOverrides` — each becomes a
ledger entry; `dateOverrides` content migrates with `provenance: 'coach'`),
discard the outputs. Properties, each gated: **idempotent** (running twice ≡
once); **non-destructive** (the old envelope stays on disk untouched — it is
deleted in the first post-beta release, never in the release that reads it);
**conformant** — for every device-export fixture
(`samDeviceExport8Fixture`, `armedMirrorDeviceFixture`,
`samDevicePass20260805Fixture`) and for walked worlds, the old shell's visible
week ≡ `derive()` over the migrated inputs. Exports are conformance TARGETS,
never seeds — worlds are reached by acting, then persisted, then migrated.

**Sam SEES:** install OVER the top on his real phone. Everything he had is
still there — his games, his marks, his edits, his profile. Boot is instant.
Then he repeats R1's taps on his worn, real-history world.

### R3 — The fact and season doors (size M)

Phase shift (`profileProgramTransaction` successor), injury episodes,
illness/busy-week source facts, readiness accept/decline, equipment answer —
rewired to append + re-derive. The season-change failure's layer dies with the
machinery it lived in; and because boot no longer floods the ring, if anything
DOES misbehave, his export finally names it (the instrumentation-alive gap
closes structurally).

**Sam SEES:** change season phase — the week re-derives correctly, no failure.
Declare an injury, an illness, a busy week; answer readiness — each lands and
the week visibly responds.

### R4 — Results persist (size S)

Workout logs, session feedback, weights become the persisted results class
(pays LR-18 — today a logged session dies with the process).

**Sam SEES:** log a session, force-quit, relaunch — the log is still there.
That has never been true.

### R5 — The reckoning: deletion, census, coach cut, the combined pass (size M)

Delete the replaced machinery and every persisted-output surface; retire the
census units §5 lists — ruling-referenced, ratcheted, ceiling drop in the SAME
commit as each deletion; hide the coach free-text entry point for beta (§6);
land the structural sweep (§7) as a permanent ratchet; re-link the bible
(suites that drove old transaction internals move to the doors' new bodies;
totals-or-red everywhere); delete the last declared-red entries. Then THE
COMBINED DEVICE PASS — the full checklist covering the rebuild plus Stage B
stages 1+2 content (decision A, §8), short tap list, expected sights per tap,
anything off = number + what he saw + tape, no retries.

**Sam SEES:** the same app, behaving. The pass list itself — every door, worn
world, real history. This pass is the merge gate.

### R6 — Renee (size S)

Release-class measurement quoted (boot, tap latency — standing condition 2:
no dev-build numbers ever quoted); TestFlight build; Sam installs from
TestFlight first; then Renee is invited with a one-page "what to try" list.

**Sam SEES:** the TestFlight install on his own phone, then Renee's name in
TestFlight.

Sizing echo: R1 L, R2 M, R3 M, R4 S, R5 M, R6 S — consistent with the sizing
doc's ~1.5–2.5 weeks at current cadence. The path to Renee is R1→R6 with no
unit that doesn't end on his phone.

## §4 Acceptance (standing conditions 1–3)

- The five evening cells are the path-neutral specification. The suite's
  ratchet direction holds: a declared red that stops redding owes its entry's
  deletion in the greening commit; an undeclared red fails outright.
- Every slice ends with a SHORT Sam device pass (tap list with expected
  sights). Slice R1's is fresh-install; every other pass is install-over.
- Any performance claim in any report is re-measured on a Release-class build
  before being quoted. The 31.5 s/transaction figure is retired as
  diagnostics-inflated; the rebuild's numbers start from R1's Release
  measurements.
- L12 per slice: each boundary report names what catches the NEXT defect of
  its class. The standing answers here: the boot-appends-nothing cell, the
  work-bill-equals-decision cell, and the structural sweep (§7).

## §5 Census units closed by deletion (ruling-referenced, ratcheted — standing condition 4)

Closed when their machinery is deleted (R5 unless noted), each retirement
citing `SHELL_REBUILD_RULING_2026-08-05`, `declared` and the baseline moving
in the same commit as the deletion:

| Unit | Why deletion closes it |
|---|---|
| LR-3 §18 residuals on the legacy override writer | `dateOverrides` is no longer persisted; residual writers die with it |
| LR-4 mirror readers → accepted snapshot | no mirrors, no snapshot — both sides deleted |
| LR-7 G+1 derived-filler storage form | derived filler is derived, never stored |
| LR-8 `skipConstraintProjection` | the projection it skirts has one owner; the stored form dies |
| LR-13 one projection for the visible week | `derive()`'s rivals deleted at switchover (R1/R5) |
| LR-26 reversible ledger's stored snapshots | replaced by reversal decisions |
| LR-28 displaced-session workout copy | nothing displaced is stored |
| LR-29 undo from stored before-state | undo replays decisions by construction |
| LR-30 legacy v1 week contract second home | one home: derivation |
| LR-18 in-memory workoutLogStore | paid by R4 (built, not deleted) |
| LR-10 / LR-11 deletion + add-optional doors | absorbed: all doors append decisions (verify at R1, close then if true) |

Remain open, honestly: LR-6 and LR-12 (the coach rebuild era, STOP holds),
LR-5, LR-9, LR-14–17, LR-19–24 (LR-23 deferred with the coach era). Census
drops from 27 by the eleven units above (the sizing doc's "~15" counted
coach-era stored-output units that close in the coach rebuild instead); the
exact count is measured at each retirement, the detector stays the judge.

## §6 The beta coach scope cut, applied (signed in the ruling)

Beta ships typed doors and buttons only. Concretely: the free-text coach entry
point does not appear in the beta build; the typed/button doors the screens
already offer stay, routed through the decision ledger like every other door.
The 29k pipeline is neither ported nor deleted — it sits out under LR-6 and
returns in the coach rebuild on the clean shell. This is a scope cut, not a
retirement. Existing coach-made state on Sam's device migrates in R2 as
ledger entries with `provenance: 'coach'` — nothing he accepted is lost.

## §7 The structural completion gate

The rebuild's completion condition is a property, not a clean pass: **every
persisted key's schema is in the inputs schema.** A permanent bible suite
enumerates persisted keys and fails on any key not declared as profile / fact
/ decision / result — with the coach-era stores carried as a ratcheted,
dated exception list (frozen until the coach rebuild, list only shrinks).
A new persisted output cannot be added without turning this suite red, which
is exactly the review the north star demands.

## §8 Decisions for Sam (lettered; recommendation marked)

**A. The Stage B stages-1+2 device pass** (currently the unmerged branch's
merge gate) —
  a) **Fold it into R5's combined pass — RECOMMENDED.** The old shell fails on
     his phone on the very doors that pass would exercise; running it now
     burns a device evening on machinery being deleted. Stage B's engine work
     is bible-gated and shell-independent; R5's tap list labels which taps
     verify Stage B content vs shell behaviour.
  b) Run it now on the old shell before R1 starts.

**B. A boot-time derived cache** —
  a) **None for beta — RECOMMENDED.** Derivation is engine compute over a few
     KB of inputs; measure boot-to-week on R1's Release build first. If his
     phone says it's too slow, a cache comes back as an explicit north-star
     exception with a retirement plan — not before the measurement.
  b) Build a disposable memory-only warm cache from day one.

**C. The coach entry point in the beta UI** —
  a) **Hidden entirely for beta — RECOMMENDED** (matches the signed cut; no
     half-alive chat surface to explain to Renee). Any copy this changes
     ships PROPOSED.
  b) Visible but disabled with an explanatory line (needs a new signed
     sentence).

## §9 Honest risks and NOT-COVERED

- **Engine-version drift:** a ledger replayed under a newer engine can derive
  a different week — that is the DESIGN (the Bible owns programming), but it
  can surprise an athlete after an update. Beta timescale makes this
  acceptable; date+slot targeting (§2) keeps decisions attached. NOT-COVERED:
  a version-pinned derivation notice; coach-rebuild-era problem.
- **Ledger growth:** unbounded over seasons, irrelevant over Renee-weeks.
  Compaction is a named future unit. The LR-27 lesson stands guard: nothing
  appends per-boot, the boot-appends-nothing cell proves it forever.
- **New-shell bugs:** a new shell will have new bugs — but they land under
  gates that already exist (bible, walker, armour suites, the two structural
  cells), and under a completion condition a gate can check.
- **Migration is where rebuilds die:** hence R2's four gated properties and
  the untouched on-disk envelope until post-beta.
- **The 109 unreachable product files** are not migrated, ported, or
  audited — unreachable code has no claim on this plan.

---

*Written by the terminal on `feat/stage-b-stage2`, 2026-08-05, for Sam's
review. On approval, R1 begins; nothing in §3 starts before then.*
