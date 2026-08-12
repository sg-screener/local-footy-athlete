# THE FIXTURE AUTHORITY, CENSUSED — the "six answers" are three things, and only one is a defect

**2026-08-12, unattended session.** Item 3's own re-scoping ordered this before
any further attempt on the ±7 invention: *"census the three gateway call paths
and explain the stale date."* **Measurement only. One code change was written
during this pass and REVERTED for producing no measurable effect — see §4.**

**It substantially DE-RISKS the ±7 fix.** The blocker recorded in
`PLUS_MINUS_7_ATTEMPT_1_BLOCKED_2026-08-12.md` §3 — *"six different answers for
one week, including UNDEFINED and including a cancelled fixture"* — is real as
an observation and **wrong as a diagnosis.** Three separate things were being
counted as one.

---

## §1 WHAT PRODUCES THE AUTHORITY — one function, four call sites

`effectiveFixtureDatesForWeeks` (`rollingHorizonRepair.ts:98`) is the only
producer. It is DETERMINISTIC given its inputs: explicit `game` marks, plus the
recurring anchor for weeks that have no explicit mark and are not `noGame`/
`rest`. It cannot itself disagree with itself.

| call site | markedDays it uses | guarded on profile |
|---|---|---|
| `acceptedStateTransaction.ts:1847` | `args.markedDays` (**the PROPOSED calendar** — `weekRebuild:492-498` passes the current one separately as `sourceMarkedDays`) | no |
| `acceptedStateTransaction.ts:2274` | `args.afterMarkedDays` (**AFTER**) | no |
| `programStore.ts:1272` | `options.markedDays` | **yes** — `undefined` without one |
| `sessionResolver.ts:1001` | `args.state.markedDays` | **yes** — `undefined` without one |

## §2 THE THREE THINGS — resolved one by one

**(a) THE "CANCELLED FIXTURE" IS STILL UNEXPLAINED. MY FIRST ANSWER HERE WAS
WRONG AND IS WITHDRAWN.**

This section first said `:1847` reads the pre-mutation calendar, so the
`2026-07-18` was a legitimate BEFORE-snapshot. **That is false.** Its enclosing
function is `buildFixtureProjection`, and its caller `weekRebuild.ts:492-498`
passes the PROPOSED calendar as `markedDays` and the current one separately as
`sourceMarkedDays`. So `:1847` reads the **AFTER** world, and a cancelled
Saturday has no business in it.

**NOW MEASURED, AND THE HYPOTHESIS HOLDS — 149 times in one suite run.**
Instrumenting the one place that adds a recurring date:

```
[rec] week=2026-07-13 ADDED recurring 2026-07-18 (explicit marks in week: [])
[rec] week=2026-07-13 ADDED recurring 2026-07-18 (explicit marks in week: ["2026-07-16"])
```

`effectiveFixtureDatesForWeeks` adds the profile's RECURRING anchor to any week
holding no explicit `game` mark, and the athlete's profile still says
`usualGameDay: Saturday`. The authority is computed at a moment when the move
has cleared the old mark and not yet written the new one — **so the recurring
rule re-supplies the very fixture being moved away from.**

**AND THAT RULE IS NOT WRONG.** For an ordinary week with no marks, the usual
Saturday IS the fixture; the `noGame`/`rest` branch directly below already
handles a real cancellation. What is wrong is WHEN it was asked: a half-applied
calendar is not a world anything should be judged against.

**SO (a) COLLAPSES INTO (c).** It is not a second defect and it is not a stale
snapshot — it is the same question of which settled world the authority
describes. My first answer named the right suspect (a snapshot boundary) for the
wrong reason, and the mechanism is now measured rather than reasoned.

**(b) `UNDEFINED` IS NOT REACHABLE IN PRODUCTION.** In production the ONLY
caller of `fixtureMinimalReplan` is `acceptedStateTransaction` (verified by
import census: one non-test importer), and both of its call paths compute the
authority unconditionally. The replan's own inner type declares it **required**
(`fixtureMinimalReplan.ts:2148`, `activeFixtureDates: ReadonlySet<string>`, no
`?`). **Every `UNDEFINED` observed came from suites calling
`runSection18AcceptedWeekGateway` directly, which is the harness entering below
the door.** The optional `?` on the gateway's own input is what let it.

**(c) THE ONE REAL QUESTION — NOW MEASURED AT THE EXACT POINT OF FAILURE.**

Which world should the CRAFT TIER judge a candidate week against? It judges a
week being PROPOSED, so it should be the settled proposed world. It is currently
handed whatever its call path holds. Re-applying attempt 1's fix in the working
tree and logging every craft evaluation of the week the broken property drives
(`2026-07-20`), with the old code's answer printed beside the new one:

```
authority=["2026-07-18","2026-07-25","2026-08-01","2026-08-08"]  prev=2026-07-18   oldPhantom=2026-07-18
authority=["2026-07-19","2026-07-25","2026-08-01"]               prev=2026-07-19   oldPhantom=2026-07-18
authority=["2026-07-19","2026-07-25"]                            prev=2026-07-19   oldPhantom=2026-07-18
authority=["2026-07-18","2026-08-01"]                            prev=2026-07-18   oldPhantom=null
authority=[]                                                     prev=null         oldPhantom=2026-07-18
authority=[]                                                     prev=null         oldPhantom=null
```

**THREE DISTINCT WORLDS REACH ONE WEEK'S CRAFT EVALUATION:** one holding the
CANCELLED Saturday (`07-18`), one holding the MOVED Sunday (`07-19` — the
correct answer), and one holding NOTHING AT ALL.

**AND THE OLD CODE WAS BLIND TO THE DIFFERENCE, WHICH IS WHY IT LOOKED STABLE.**
`oldPhantom` is `fixtureDates[0] − 7` — computed from the CONTRACT, so it
answered `2026-07-18` in five of the six calls regardless of which world the
authority described. **The ±7 did not survive because it was right. It survived
because it could not tell these worlds apart**, and one arbitrary constant
answer is easier to build a passing test on than three honest ones.

**THE EMPTY ROWS ARE THE REGRESSION.** Where the authority is `[]`, attempt 1
correctly claims no neighbour and the phantom used to supply `07-18`. That is
the behavioural gap the reverted attempt opened.

**AND THE EMPTY ROWS NOW HAVE A NAMED ROOT.** Stack-tracing every empty-authority
craft evaluation of that week:

```
assess                        section18AcceptedWeekGateway:1535
searchWholeWeekRepairCandidates
resolveCandidate              section18AcceptedWeekGateway:1467
runSection18AcceptedWeekGateway
section18TierFour             sessionResolver:973      <- computes its OWN authority
resolveWeekWithConditioning
resolveFinalVisibleSection18Week
                              section18AcceptedWeekGateway:1494  <- the outer gateway
```

**THE GATEWAY RE-ENTERS ITSELF THROUGH THE RESOLVER.** Its `assess` closure
resolves each candidate with `resolveFinalVisibleSection18Week`, which runs the
READ path, which calls the gateway again — and at `sessionResolver:1001` that
inner call **derives a FRESH `activeFixtureDates` from `args.state.markedDays`**
instead of inheriting the authority the outer transaction already established.
When that schedule state carries no marks, the inner authority is `[]`.

**THIS IS SIGHTING 3 OF THE CLASS `gatewayAuthorityInputCensusTests` WAS BUILT
FOR**, and its own header names sighting 2 as this same input: *"the staging
owners thread it everywhere; `sessionResolver` had ZERO occurrences of it."*
That was paid by GIVING the resolver the input. **The disease came back one
level down: the resolver now HAS the input and RE-DERIVES it from a different
world.** The census gate cannot see this — it checks that a call site supplies
the authority, not that it supplies the SAME one.

**SO ATTEMPT 2'S TARGET IS EXACT, AND IT IS NOT A FALLBACK: the inner resolve
must INHERIT the outer authority rather than re-derive one.** Thread
`activeFixtureDates` through `resolveFinalVisibleSection18Week` into
`section18TierFour`, and have the resolver prefer a supplied authority over a
computed one. Only then delete the ±7 — with the cells already written.

**AND THE CENSUS GATE IS OWED A THIRD CELL:** *an authority that is RE-DERIVED
downstream of one already established is the same defect as one not passed at
all.* Sighting 3 makes that a compression, not a suggestion.

## §3 WHAT THIS MEANS FOR THE ±7 FIX

The recorded prerequisite was *"make `activeFixtureDates` REQUIRED and reconcile
the paths that disagree."* After this census that reads:

1. ~~Make it REQUIRED on the gateway input.~~ **WITHDRAWN — the repo already
   has a STRONGER mechanism and I proposed this without checking.**
   `test:gateway-authority-census` (6 cells, green) scans every call site and
   fails any that neither supplies the authority nor carries a DECLARED
   exemption naming why — and it fails in the other direction too, so paying a
   debt must drop its declaration in the same commit. Every current exemption is
   a unit fixture that hand-builds a contract and has no fixture horizon to
   pass. **A required field would BREAK exactly those legitimate cells and could
   not tell "must supply" from "has none, and here is why".** The census is the
   better instrument and it already exists. Nothing is owed here.
2. **Answer (c)** — which snapshot the craft tier judges a proposed week
   against. **This is now the WHOLE of attempt 2's prerequisite**, since (1) is
   withdrawn and (b) needs nothing.
3. **Then delete the ±7**, with the cells from
   `PLUS_MINUS_7_ATTEMPT_1_BLOCKED_2026-08-12.md` §1 (which are written and were
   proven to red before the fix and green after).

**THE REGRESSION THAT FORCED THE REVERT IS A CANDIDATE FOR (c), NOT AN EXPLAINED
FACT.** The `test:accepted-state-transactions` property that broke asserts the
FOLLOWING week's G+1 dependency after a fixture move. Attempt 1 removed the
invented neighbour and the honest one did not arrive. **Whether that is because
the tier read a half-applied world is PLAUSIBLE AND UNPROVEN** — the §2(a)
measurement shows such moments exist and are frequent, but nothing here traces
that specific property's failure to one. **Attempt 2 must measure it, not assume
it.** It is in any case not an argument for continuing to invent fixtures.

## §4 THE CHANGE THAT WAS WRITTEN AND REVERTED — recorded so it is not re-tried

Making `effectiveFixtureDatesForWeeks`'s `profile` optional and removing the two
`profile ? … : undefined` guards, on the reasoning that an explicit `game` mark
is a calendar fact needing no profile.

**Reverted: measured before and after, `173101` undefined-authority calls
BOTH TIMES — identical.** The change is inert on every path any suite exercises,
because the undefined values come from §2(b)'s direct gateway calls, not from
the guarded sites. **A confident comment over an inert change is exactly the
shape this repo keeps cataloguing**, so it is not in the tree. The reasoning may
still be right; it is simply unproven, and §2(b) shows the problem it targets is
test-only, which `test:gateway-authority-census` already governs.

## §5 STATUS

- **MEASURED** — the four call sites and their snapshots; the import census
  proving one production replan caller; the required-vs-optional declarations;
  the before/after 173101 identical counts.
- **WORKING** — nothing. **The tree is unchanged by this pass.**
- **WITHDRAWN** — §2(a)'s first answer (a "before snapshot") and §3's first
  step (a required field). Both were reasoned rather than measured, and both
  were wrong. They are struck through rather than deleted so the next pass does
  not re-derive them.
- **ANSWERED BY MEASUREMENT** — §2(a): the recurring anchor re-supplies the
  fixture being moved away from, because the authority is computed while the
  calendar is half-applied. 149 occurrences in one suite run. It collapses into
  (c) rather than being a second defect.
- **MEASURED, AND IT WAS THE OPEN QUESTION** — §2(c): three distinct worlds
  (cancelled fixture / moved fixture / empty) reach one week's craft evaluation,
  and the `[]` rows are where the reverted attempt lost the neighbour the
  phantom used to supply. The ±7 looked stable only because it answered from the
  contract and could not tell the three worlds apart.
- **NOT INVESTIGATED** — whether `derivedSessionProvenance`'s
  `exactFixtureDatePresent` (`:417-425`), which reads the same optional set and
  falls back to a contract-shape check when it is absent, has the same
  test-only exposure. Same shape, not measured.
- **NORTH STAR: neutral.** Nothing stored, nothing derived; this reports.


---

## §6 ATTEMPT 2 WAS BUILT AND IT DID NOT WORK — §8 SECOND-WALL LAW FIRES

**The fix this document prescribed was implemented and REVERTED. Tree unchanged.**

Built exactly as §2(c) specified: `ScheduleState` gained
`activeFixtureDates?: ReadonlySet<string>`, `section18TierFour` preferred a
SUPPLIED authority over a re-derived one (`undefined` = "nobody told me" derives;
an empty SET is a real answer and is inherited), and the gateway's re-entrant
`assess` closure handed its own authority down through
`resolveFinalVisibleSection18Week`.

**On its own it is behaviour-preserving:** `test:accepted-state-transactions`
stayed 23/23 + 10/10 + 10/10.

**And it did NOT unblock the ±7 deletion.** With both changes applied together
the same property fails exactly as before — `properties=9/10`, *"following-week
dependency was not committed in the same snapshot"*. **The re-derived authority
was NOT the cause of that regression**, or was not the only one.

So the inheritance change has no receipt: it fixes a thing that is real (§2(c)'s
stack trace is not in doubt) but that does not produce the failure it was
prescribed for. **Shipping it would be a confident comment over a change with no
measured effect — the same standard that killed §4's change.** Reverted.

### THE LAW THAT APPLIES

**`second-wall-law` — same wall SHAPE three times now.** Attempt 1 (delete the
±7) → one red. Attempt 2 (make the input required) → withdrawn before building,
the census gate already covered it. Attempt 3 (inherit rather than re-derive) →
built, green on its own, **still one red**. Three passes have each named a
plausible cause and none has explained that property's failure.

**STOP GUESSING AT THE CAUSE AND MEASURE THE PROPERTY ITSELF.** Nothing in three
attempts has traced *why* `derivedSessionProvenance` fails to record the
following week's G+1 dependency when the neighbour is honest instead of
invented. That record is written by the replan, not by the craft tier, and every
attempt so far has assumed the craft tier's anchors are what feed it. **That
assumption has never been checked and is now the first thing to check.**

### WHAT IS BANKED AND MUST NOT BE RE-DERIVED

- The defect is REAL and reproduced by cells (`PLUS_MINUS_7_ATTEMPT_1_BLOCKED` §1).
- `UNDEFINED` authority is test-only (§2(b)).
- The gateway re-enters itself and re-derives the authority (§2(c)) — a real
  defect of the class the census gate exists for, **worth paying on its own
  merits with its own cell, and not as a prerequisite for the ±7.**
- The ±7 survives only because it answers from the contract and cannot tell
  three worlds apart (§2(c)).

## §7 THE ASSUMPTION EVERY ATTEMPT MADE IS FALSE — measured 2026-08-12

**The order's own instruction after the second-wall law fired:** *"STOP GUESSING
AND MEASURE THE PROPERTY ITSELF: the dependency record is written by the REPLAN,
not the craft tier, and every attempt so far has ASSUMED the craft tier's anchors
feed it. That assumption has never been checked and is the first thing to check."*

**IT IS CHECKED, AND IT IS FALSE. The craft tier's fabricated ±7 anchors do not
reach the dependency record by any path.**

**THE CENSUS OF WRITERS — three, and only one MINTS a source date:**

| writer | what it does with `dependency.source` |
| --- | --- |
| `sessionResolver.ts:734` (G+1 / G-1 derivation) | **MINTS it**, from `args.fixtureDate` |
| `section18AcceptedWeekGateway.ts:753` (rest distribution) | **COPIES** `crossWeekFixtureDependency.dependency.source` |
| `fixtureMinimalReplan.ts:577` (required-core relocation) | **COPIES** `fixtureDisplacement.dependency` |

`args.fixtureDate` comes from `getEffectiveGameDates` → `effectiveGameDatesAround`
— explicit calendar marks plus the in-season recurring game day. **That is the
resolver's own answer, and it is a RULE, not a fabrication:** an unmarked
in-season week really does have the usual game (§2(a) already established the
rule is correct and only its TIMING is wrong).

`section18CraftTier.ts:161`'s `previousGameDate` / `nextGameDate` feed
`validateProgramWeek` — **findings only**. There is no path from a finding to a
`dependency.source`.

**SO THE REGRESSION THAT REVERTED ATTEMPT 1 CANNOT BE WHAT IT LOOKED LIKE.**
Deleting the ±7 did not, and could not, remove the following week's dependency
record directly. Something downstream of the FINDINGS changed instead — the two
candidates, in order of cost to check:

1. **The craft tier's repair search.** Findings drive it, and it MOVES sessions.
   A different set of findings is a different set of moves, and a moved session
   is a different input to whatever later establishes the cross-week dependency.
2. **What the gateway treats as `crossWeekFixtureDependency`.** It copies a
   source it was handed; if the hand-off depends on a `g_plus1` classification
   that the fabricated neighbour was producing, the record disappears without
   anything about fixtures having changed.

**ATTEMPT 2'S FIRST ACT IS THEREFORE NOT A FIX.** It is: delete the ±7 again,
and instrument `crossWeekFixtureDependency`'s origin on the failing property —
which of the two above supplies it, and with what. **Nothing is built until that
prints.** Three attempts have each named a plausible cause and been wrong; this
one names a MEASUREMENT and the second-wall law is satisfied only by taking it.

**BANKED SO IT IS NOT RE-DERIVED: the dependency record's source is
`effectiveGameDatesAround`, in every writer, always.**

## §8 ATTEMPT 2's MEASUREMENT — the record is DERIVED in both arms; the loss is at PUBLISH

**Taken 2026-08-12, exactly as §7 prescribed: delete the ±7 again and measure,
build nothing.** The change was applied (the tier reads a supplied
`activeFixtureDates` and falls back to ±7 only when it has no authority), the
failing property reproduced, three probes run in BOTH arms, and **the change was
then reverted — nothing shipped without a receipt.**

**ARM A** = ±7 removed. **ARM B** = HEAD.

| probe | ARM A (±7 gone) | ARM B (HEAD) |
| --- | --- | --- |
| `test:craft-tier` | **36/36 green** | 36/36 green |
| the property | **FAILS** — "following-week dependency was not committed" | passes (10/10) |
| resolver MINTS the Sun 19 Jul → Mon 20 Jul `g_plus_1` record | **30×** | 23× |
| the materialiser SEES a Monday carrying that dependency | **4×** | 2× |
| `repairOptionalRestCandidates` (the gateway's dependency copier) | **0 calls** | 0 calls |

**READ THE MIDDLE TWO ROWS AGAIN. The link is derived MORE often without the ±7,
and it reaches the materialiser MORE often, and the property still fails.** Every
attempt so far has looked for a lost derivation. **There isn't one.**

**AND THE GATEWAY'S COPIER IS NOT ON THIS PATH AT ALL** — it runs only when
`restShort`, which never fires in this suite. That eliminates the second
candidate §7 named, without an argument.

**SO THE DEFECT IS DOWNSTREAM OF MATERIALISATION: what gets PUBLISHED into
`weekScopedOverlays[NEXT_WEEK]`.** The property reads exactly that
(`workoutsByDate[NEXT_WEEK]`), and the same property asserts in its other half
that the DECIDED week publishes a declaration with no content — so the publish
step is already known to make per-week decisions about content. **A different
craft-finding set changes which candidate the search accepts, and the accepted
candidate's following-Monday is published without the record even though a
Monday that carries it was derived.**

**ATTEMPT 3'S FIRST ACT — and it is again a measurement, not a fix:** instrument
the overlay publish for the following week in both arms and print which workout
is written to `workoutsByDate[NEXT_WEEK]`, with its provenance. The derivation
half of this question is now CLOSED and must not be re-opened:

**BANKED, DO NOT RE-DERIVE:**
- The ±7 does not feed `dependency.source` (§7).
- The record is derived and materialised in BOTH arms, more often without the
  ±7 (§8).
- `repairOptionalRestCandidates` is not on this path (§8).
- `test:craft-tier` is GREEN with the ±7 removed — the fix itself is not in
  question; only what the changed findings do to the published week.

## §9 THE PUBLISHER IS NARROWED TO ONE SITE — three more candidates eliminated

Same pass, same method: probe, do not argue. **Every candidate below was
eliminated by a trace that printed nothing, or printed the same thing in both
arms.**

| candidate | verdict | evidence |
| --- | --- | --- |
| `programStore`'s accepted-week repair loop | **NOT the publisher** | every call for `2026-07-20` prints `equal=true` → `continue`. 3 of 35 already carry the dependency on BOTH sides |
| `rollingHorizonDependencyClosure` | **NEVER CALLED** in this suite | 0 traces |
| `repairOptionalRestCandidates` (gateway) | **NEVER CALLED** in this suite | 0 traces, §8 |
| `sessionResolver`'s mint | **fires in both arms, MORE without the ±7** | 30 vs 23, §8 |

**WHAT IS LEFT IS ONE SITE:** `acceptedStateTransaction.ts:2951` —

    for (const projection of repair.projections)
      weekScopedOverlays[projection.weekStart] = projection.overlay;

The following week's overlay exists **iff the rolling horizon repair returned a
projection for it.** Nothing else writes it on this path.

**ATTEMPT 3'S PROBE, AND IT IS ONE PRINT:** at that loop, in both arms, print
`repair.weekStarts`, each `projection.weekStart`, and whether that projection's
Monday carries a `dependency`. If the next week is missing from `projections`
with the ±7 removed, the ±7 was **holding a week inside the repair horizon** —
which is a far more serious thing than a phantom neighbour, and it would mean the
property has been asserting horizon membership through a proxy all along.

**THE ELIMINATIONS ARE BANKED. Do not re-probe them:** the resolver mints it, the
materialiser sees it, the closure never runs, the gateway's copier never runs,
and the store's repair loop skips the day as unchanged.
