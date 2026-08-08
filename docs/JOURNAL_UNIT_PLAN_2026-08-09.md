# JOURNAL UNIT — PLAN + MEASURED DEPENDENCY LIST (2026-08-09)

LOOP CHECK: **`a-ruling-premise-is-a-claim-too` + `a-status-claim-needs-a-receipt`
— sighting 1 for this unit, and both fire against the unit's OWN kickoff doc.**
Two of its three "MUST SETTLE FIRST" items describe files deleted on 2026-07-25.
Iterate: the corrections are made in place below, in the sections that were
wrong, each with a receipt. This is the same shape the kickoff's own amendment
recorded ("the seat had repeated a stale status table … without reading the
code") — second occurrence in the same document's lifetime, so the compression
is proposed in §7, not deferred.

Nothing is built yet. This is the dependency list the V3 law requires before a
build, measured in the source at `804a7e0f` (branch `main`).

---

## §1 THE KICKOFF'S SETTLE-FIRST LIST, RE-MEASURED

The kickoff named three inherited defects the unit must settle first. **Two no
longer exist.** They were resolved by deletion four days before the base design
doc's hazard section was written into the kickoff.

| # | Kickoff claim | Measured state | Receipt |
|---|---|---|---|
| 1 | `LoggedSet` lacks `actualRpe`/`completed` while code reads and writes both; journal screens unmounted; 15 errors baseline-suppressed | **MOOT — the readers and writers are gone.** `WorkoutLoggerScreen`, `SetLoggerRow`, `useWorkoutLog`, `workoutService` and the whole `src/screens/journal/` tree were deleted. `actualRpe` appears in **no source file** (one mention, in `src/ARCHITECTURE.md:332`). The typecheck baseline's `cluster-B-logged-set-fields` owns **zero live file entries**. | `2df51650` (2026-07-25, ancestor of `main`, verified by `merge-base --is-ancestor`); `scripts/typecheck-baseline.json` `_ownership` records the deletion explicitly: *"12 baseline entries are gone because their owning FILE is gone, not because anyone fixed a type error"* |
| 2 | `src/types/domain.d.ts` beside `domain.ts` is standing drift | **MOOT — the file does not exist.** Only `src/types/domain.ts` remains (50,602 bytes). | `ls src/types/domain.d.ts` → No such file |
| 3 | LR-18: `workoutLogStore` is in-memory, logged sets don't survive relaunch | **LIVE, and already diagnosed and gated.** See §4. | `src/store/workoutLogStore.ts` (113 lines); `src/__tests__/resultsPersistOwnershipTests.ts:317` |

**What this changes about the unit.** The kickoff says *"NOT a working baseline
to extend — decide the type deliberately, fix type + implementation together."*
There is no baseline to extend and no type to fix: **this is greenfield.** The
unit does not inherit a broken logging tree, does not owe a `LoggedSet`
decision, and does not start by paying down 15 typecheck errors. That is a
material reduction in the unit's opening cost, and it is stated here rather
than discovered mid-build.

`LoggedSet`/`LoggedWorkout` still exist in `domain.ts` and are still consumed —
but only by the **progression** path (`strengthLogging.ts`,
`progressionHelpers.ts`, `strengthProgressionIntegration.ts`,
`sessionResolver.ts`), never by a logging surface. They are read-model types
now, not the abandoned logger's types.

---

## §2 THE HEADLINE: THE JOURNAL IS ALMOST ENTIRELY A READ

`SessionFeedback` is already a persisted **input** (a result — north-star class
4), keyed by date, and it already carries nearly everything the Monday card
asks for. One field is annotated, in the source, for exactly this feature:

> `/** Main-lift snapshot captured on save for future progression/diary use. */`
> `strength?: StrengthExercisePerformanceLog[];` — `src/store/programStore.ts:1727`

`SessionFeedback` (`programStore.ts:1693`) carries: `dateStr`, `completion`,
`components[]` (per-component completion + per-component skip/partial reason),
`feeling`, `difficulty`, `soreness`, `teamNightSize`, `partialReason`,
`skipReason`, `conditioning` (a performance log), `strength` (above), `notes`,
and `outcomeReceipt` (the durable mutation receipt).

**It is persisted and it is never pruned.** `partialize`
(`programStore.ts:2340-2344`) writes `sessionFeedback` into the inputs
envelope. The only removal door is `removeSessionFeedback(date)`
(`programStore.ts:2103`). So history accrues indefinitely, which is the
precondition the Journal's whole trend half depends on — **measured, not
assumed**, because a Journal built over a pruned store is a Journal that lies
about month three.

---

## §3 MEASURED DEPENDENCY LIST

Legend: **FREE** = the fact exists and is read. **DERIVE** = no new stored
state, but a new pure derivation must be written. **NEW INPUT** = genuinely new
stored state, justified as an input in §4.

### Monday card (base doc)

| Element | Verdict | Owner / receipt |
|---|---|---|
| 1. Did the work happen (completed vs planned, with reasons) | **FREE** | `SessionFeedback.completion` + `.components[]`; reasons from `FEEDBACK_SKIP_REASONS` / `FEEDBACK_PARTIAL_REASONS` (`types/sessionOutcome.ts:8-23`) |
| 2. Strength line (best top sets, arrow vs last week) | **DERIVE** | `SessionFeedback.strength` → `StrengthExercisePerformanceLog` (`utils/strengthLogging.ts`) carries `exerciseName`, `prescribedSets/RepsMin/RepsMax`, `weightKg`, `completedSets`, `actualReps`. Week-over-week comparison is new pure code. |
| 3. **Load vs your normal (ACWR-lite)** | **DERIVE — and it has NO existing input** | **Measured: zero files match `acwr\|chronicLoad\|acuteLoad\|weeklyVolume` anywhere in `src/`.** This is the one Monday-card item with no owner at all. It must be derived from exposure counts and/or `strength` volume; the *definition of load* is an open coaching question (§6). |
| 4. How you said you felt (+ observation lines) | **FREE (facts) / DERIVE (lines)** | `feeling`, `difficulty`, `soreness`, `teamNightSize` on `SessionFeedback`; readiness/illness from `useReadinessStore` (`store/readinessStore.ts:145`) and `temporarySourceFactTransaction`. Observation-line rules are new pure code + authored copy. |
| 5. Note prompt + tags | **NEW INPUT** | §4 |

### Addendum Group 1

| # | Item | Verdict | Owner / receipt |
|---|---|---|---|
| 1 | Key exposures, not completion counts | **FREE** | `countWeeklyExposures()` → `WeeklyExposureCounts` (`rules/weeklyExposureCounts.ts:223,195`) — the same §18 data that validates program edits, exactly as the addendum claims |
| 2 | What changed / what was protected | **FREE-ish** | `useDecisionLedgerStore` (`store/decisionLedgerStore.ts:98`) + `rules/section18ShortfallDisclosure.ts:132`. **Caveat measured by the LR-29 dependency list: the ledger has no vocabulary for illness/injury/readiness/phase** — so rider 1 ("no reason recorded") is not optional politeness, it is load-bearing. |
| 3 | Week status — one calm line | **DERIVE + AUTHORED COPY** | From exposure-contract satisfaction + active facts. Every candidate status is a claim the app makes → PROPOSED, batched. |
| 4 | This week's job | **DERIVE + AUTHORED COPY** | `rules/seasonPhaseOwner.ts` + `rules/seasonPhaseClock.ts` + the week's contract (`rules/weeklyExposureContract.ts`) |
| 5 | Week shape strip | **PARTIAL — the taxonomy is narrower than the addendum assumes** | Measured: the app has a **binary** `isHardDay` (`rules/sessionClassificationAdapter.ts:46`, `hardDay: 0 \| 1`) and `hardDays` counts (`weeklyExposureCounts.ts:197`). Rest/Game/Recovery come from the bucket taxonomy the day-first unit landed (`VisiblePart.bucket`, `visibleProjection.ts:134`). **There is no Moderate-vs-Easy distinction anywhere.** Build hard/rest/game/recovery from what exists; "Moderate" needs a Sam ruling or drops. |
| 6 | Post-game wording (physical, 1-5) | **NEW INPUT** | §4 |
| 7 | Extra tags (sleep, illness, travel) | **NEW INPUT** (rides the note input) | §4 |

### Addendum Group 2

| # | Item | Verdict | Owner / receipt |
|---|---|---|---|
| 8 | "Session felt different" exception | **NEW INPUT — but smaller than it looks** | The vocabulary is *adjacent* to `FEEDBACK_PARTIAL_REASONS` (`ran_out_of_time`, `felt_sore_tight`, `too_hard_today`, `equipment_unavailable`, `other`) and `FeedbackFeeling` (`very_easy`…`very_hard`). Harder/Easier-than-expected is **not** the same question as `feeling`, and conflating them would corrupt existing data. See §4. |
| 9 | Niggle history | **FREE** | Region-keyed over `injuryEpisodes` (persisted in the same inputs envelope, `programStore.ts:2346`) + `store/injuryEpisodeTransaction.ts` + tagged notes |
| 10 | Progress markers | **DERIVE** | Same source as Monday item 2 |
| 11 | Progressive data-state schedule | **DERIVE + AUTHORED COPY** | A function of how many weeks of `sessionFeedback` exist |

---

## §4 THE NEW STORED STATE, RULED AGAINST THE NORTH STAR

The north star presumes new stored state **wrong unless it is an input**. The
Journal proposes exactly three, and all three are answers the athlete gives:

1. **Free notes + tags** — an *answer*. Record-only, no constraint
   composition, never derives program state (base doc, non-negotiable).
2. **Post-game feel rating (1-5, physical)** — an *answer*. **And it needs no
   new door:** "Log Game" already routes into the existing session-outcome
   flow via `startFinished: true` (`screens/home/HomeScreen.tsx:477`,
   `useHomeScreen.ts:1931,1940`, `useDayWorkout.ts:66`). The rating is a field
   on the existing receipt-minting transaction, not a new transaction.
3. **"Session felt different" one-tap exception** — an *answer*, same door.

**All three are inputs. The unit adds zero derived state.** North-star verdict:
**TOWARD** — and unlike day-first slice 1, this one is not merely a new window:
it converts facts the app already stores but never shows into a surface, and it
retires dead machinery (below).

### Where they should live — the one real design call

**Recommendation: 2 and 3 ride `SessionFeedback`; 1 gets its own store.**

Grounds, and the precedent is in the source: `teamNightSize` faced this exact
question and was ruled onto `SessionFeedback` with the reasoning written into
the type — *"It rides `SessionFeedback` because the app already records a
completed session per date through a transaction with a receipt — which is what
made the smallest mechanism small"* (`programStore.ts:1710-1714`). The post-game
rating and the exception tap are per-session answers arriving at the same
moment through the same door; a second door for them would be a second
representation of "what the athlete said about this session."

The free note is **not** per-session — it is per-week, arrives from the Monday
card, and carries tags. It is a different fact with a different key, so it gets
its own armoured store under `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`, and it
**joins `appHydrationGate.ts:70-81` and the fresh-install reset in the same
commit** (standing law: *a new store joins the reset day one*).

### DO NOT reuse `feeling` for "harder than expected"

`FeedbackFeeling` (`very_easy`…`very_hard`) answers *how hard was it*. "Harder
than expected" answers *did it match the prescription*. An athlete can have a
`very_hard` session that was exactly as expected. Overloading one field with two
questions is the two-owners-of-one-fact defect the north star names. New field.

---

## §5 LR-18 — RULED, WITH THE RECEIPT

`workoutLogStore` is **dead code**, and the repo already knows it. A gate cell
holds the line today:

> `resultsPersistOwnershipTests.ts:317` — *"5 workoutLogStore is unpersisted
> BECAUSE no surface writes it"*. It scans all of `src/` for calls to the eight
> writer methods and asserts **zero callers**, and separately asserts the store
> has **not** gained `persist(` — *"a durable key on the athlete's phone for a
> feature that does not exist, which the north star presumes wrong."*

Measured: the only two product importers are `resetCoach.ts` (calls `.clear()`
only) and `SessionFeedbackPanel.tsx:509-512` (reads `loggedSets` to feed
`buildStrengthPerformanceLogs`). Neither is a writer, so the cell is honest.

**RULING (mine, by Sam's own logging model — say so if wrong): DELETE, do not
persist.** The base doc rules per-set entry OUT in Sam's words — *"NO per-set
data entry — 6 exercises must never mean 18-36 inputs"* — and
assume-prescribed/edit-by-exception is the replacement. A store whose only
purpose is per-set capture is a store for a feature Sam cancelled. Persisting it
would create a durable key for cancelled work; the cell above says so already.

Two things the deletion must handle, both measured, neither guessed:
- `SessionFeedbackPanel:509` reads it to pass real logged sets into
  `buildStrengthPerformanceLogs`. That read always returns empty today (nothing
  writes it), so the builder already falls back to prescribed values — which is
  precisely the assume-prescribed model. **The fallback is the design, not a
  degradation.** This must be proven by tape before the delete, not argued.
- The `resultsPersistOwnershipTests` cell 5 must be **re-pointed, not deleted** —
  it becomes the assertion that the store is gone and no surface reintroduces
  per-set capture without a ruling.

---

## §6 QUESTIONS THAT REACH SAM (and the ones that do not)

Per RULE-DON'T-ASK, everything his laws answer is ruled above. These three are
genuinely open — no Bible line, ruling or law answers them:

1. **What is "load" for ACWR-lite?** Measured: the app has no load/volume
   concept at all. Candidates: session count, hard-day count, strength tonnage
   (sets × reps × kg from `strength` logs), or exposure-weighted. This is a
   coaching definition and it drives an athlete-facing claim. **Blocking for
   Monday-card item 3 only** — the rest of the card builds without it.
2. **"Moderate" in the week-shape strip has no owner** — the app knows
   hard/not-hard, not hard/moderate/easy. Either Sam rules a moderate
   definition or the strip ships with the taxonomy that exists.
3. **All status/observation copy ships PROPOSED**, batched to one sheet per
   boundary (rider 2 + the batch rule), not per sentence.

Not asked, because his laws answer them: the rep-range question (settled in the
Bible — single middle number), where the new inputs live (§4, `teamNightSize`
precedent), LR-18 (§5), and whether notes can influence the program (they
cannot — base doc, non-negotiable).

---

## §7 THE COMPRESSION THIS UNIT OWES (loop-audit law)

**Second occurrence in one document's lifetime** of *a doc asserting built/broken
status without a code receipt* — the kickoff's own amendment retracted a
close-out for this exact reason, and §1 above retracts two more of its premises
for the same reason. The standing law already exists ("a status claim about
built work carries a code receipt AT THE CLAIM, or it says OPEN-UNKNOWN"). It
did not fire here because **the kickoff inherited its hazard section verbatim
from a design doc written 2026-07-23** — before the deletions — and inheritance
is how a stale claim launders itself past a law about claims.

**Proposed compression (needs no approval to be cheap): an inherited premise is
re-measured at the moment it is inherited, not when it is acted on.** A doc that
quotes another doc's hazard section carries the receipt or marks it
OPEN-UNKNOWN at the quote. Concretely for this repo: the settle-first list is
the *only* part of a kickoff that is a factual claim about code, so it is the
one section that never gets copied forward without a grep.

---

## §8 BUILD SHAPE — VERTICAL SLICES (L16), VISIBLE-FIRST

**Slice 1 (proposed first commit): the tab and one real card on his phone.**
- A third `Tab.Screen` block in `AppNavigator.tsx` (measured: only `ProgramTab`
  and `ProfileTab` exist today; `CoachTab` was cut by R5.7 and the file's own
  comment says restoring a tab is one block).
- The Journal tab renders **this week, read-only**, from what is already
  stored: exposures (Group 1.1), did-the-work-happen (Monday 1), how-you-felt
  facts (Monday 4, facts only), and the honest empty state for everything that
  needs weeks of history.
- **Zero new stored state in slice 1.** It is a pure reading surface, which
  makes it the cleanest possible proof of the derive-don't-store thesis and the
  fastest thing to get in front of Sam's eye.

Slices 2+ (not authorised by this plan, sized when slice 1 lands): the note
input + its store; the post-game rating and exception tap on the existing door;
observation lines; monthly review; niggle history; LR-18 deletion.

**Stop conditions for slice 1: NONE FOUND.** No decision payloads, no
signed-behaviour changes, no new doors, no new stored state. The three items
that would have been stop conditions (the logging tree, the `.d.ts` drift, the
`LoggedSet` type decision) are moot per §1.

---

## §9 NOT COVERED

- **No device evidence.** Nothing here has been seen on a phone; this repo has
  no render-level test, so any slice-1 gate will read source SHAPE and
  projection OUTPUT, exactly as the day-first slices did.
- **Nothing is built.** No product code has landed. This is a measurement pass.
- **The gate has not been run** for this unit — `main`'s declared 2 reds
  (`program-control-durable`, `fixture-identity`) stand as the baseline, and any
  slice-1 sweep must land on that set exactly or STOP.
- **The ACWR definition is unmeasured because it does not exist** — I measured
  its *absence*, which is a different and weaker claim than knowing what should
  replace it.
- **Retention is measured on the code, not on a real device envelope.** I read
  `partialize` and found no pruning; I have not confirmed a phone that has
  carried months of `sessionFeedback` without an envelope-size problem.
- **The decision ledger's coverage of "what was protected" is inherited from
  the LR-29 dependency list, not re-measured here.** That list is the receipt;
  its caveat (no vocabulary for illness/injury/readiness/phase) is load-bearing
  for rider 1 and should be re-measured when Group 1.2 is actually built.
- **`SessionFeedbackPanel`'s empty-`loggedSets` fallback is argued from "nothing
  writes the store", not yet taped.** §5 requires the tape before the delete.
- Monthly review, observation-line rules and the data-state schedule are sized
  as "DERIVE + authored copy" from their design descriptions, **not** from a
  built spike.

## §10 L12 — WHAT CATCHES THE NEXT DEFECT OF THIS CLASS

The class this unit is most likely to produce is **a Journal sentence that is
true of the data and false about the athlete** — a status line claiming work was
protected when the ledger simply had no vocabulary for why it wasn't, or an
observation line that reads as causation.

Fix-by-fix verification (a cell per sentence) would fail the same way the
sentences do. What catches the class:

1. **A causation gate over the copy sheet** — the observation-line templates are
   authored strings in one module; a gate over that module's vocabulary
   (`because`, `caused`, `due to`, `led to`) is a source scan that must, per the
   AGENTS.md source-scan law, locate the region and prove it was found, not
   merely count.
2. **An honest-absence cell**: for every derived line, a world where the
   underlying fact is *missing* must produce the "no reason recorded" state and
   never a confident sentence. This is the rider-1 law made executable, and it
   is the cell most likely to red when the ledger's vocabulary gap bites.
3. **A retention cell**: the Journal's trend half is a claim about history, so a
   world with N weeks of `sessionFeedback` must produce exactly the data state
   the schedule declares for N — including N=1, where a chart with one floating
   dot is the named failure.
