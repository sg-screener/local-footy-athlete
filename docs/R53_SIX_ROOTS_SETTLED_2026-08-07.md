# R5.3 — THE SIX ROOTS, WORKED TO THE END OF THE QUEUE (2026-08-07)

LOOP CHECK: authority-carried-on-the-write-path-only-while-a-new-read-path-
re-derives-without-it — sighting 2 (`governedFromISO` was 1;
`activeFixtureDates` is 2, and it alone explains THREE of the six reds) —
COMPRESS proposed, not built: a census gate over the gateway's
authority-bearing inputs BY CALL SITE, both directions, the `369af59d` shape.

Sixteenth pass, run CONTINUOUSLY under the seat's standing authorisation (e).
One batched report, as ordered. Instruments and fixes at `4dcac148` on
scratch/r53-pricing-7-probe — every fix scaffold-flag-gated, inert by
default; NOTHING landed on the branch. Method throughout: file-backed tape
with in-window markers and positive controls, both arms in one worktree,
attribution on executing records, prices from measured combinations.

Root-1 detail is in docs/R53_AST_TWO_ROOTS_NAMED_2026-08-07.md; this report
carries the queue.

## THE SCOREBOARD

| # | red | root, named | outcome |
|---|---|---|---|
| 1a | accepted-state-transactions (determinism) | workout ORDER has no owner: the widened repair appends, regeneration day-orders, JSON is order-sensitive | **FIXED** — `LFA_SCAFFOLD_ORDER_OWNER`, hydration canonicalises order once (Monday-first, stable) |
| 1b | accepted-state-transactions (atomicity) | `activeFixtureDates` never reaches tier 4 at read; expiry guard degrades to a single-week check and kills cross-week fixture-linked sessions | **FIXED** — `LFA_SCAFFOLD_FIXTURE_AUTHORITY`, the host derives it from profile+markedDays |
| 2 | program-control-durable | the move door's identity oracle reads the MATERIALISED week; the athlete acts on the DERIVED week | STOPPED, then **FIXED under the seat's pre-loaded ruling** — `LFA_SCAFFOLD_DERIVED_IDENTITY`, 19/19 |
| 3 | work-bill | `presentDeclaredOffer` withdrawal classifies offers BY SHAPE; an athlete-added light conditioning session is withdrawn as surplus | STOPPED, then **FIXED under the seat's pre-loaded ruling** — `LFA_SCAFFOLD_OFFER_PROVENANCE`, 6/6 |
| 4 | action-walker:deep (L-P3) | same mechanism as 1b | **GREEN under FIXTURE_AUTHORITY alone** — bisected, 20/0 |
| 5 | session-list-combinations | same mechanism as 1b | **GREEN under FIXTURE_AUTHORITY alone** — bisected |
| 6 | device-pass-2026-08-05-evening | leg (ii)'s relocation generator placed strength ON the marked game day — it honoured a STORED contract whose anchors predate the mark | **GREEN under leg (iii)** — a world the ruled combination never ships |

With both root-1 fixes on, `accepted-state-transactions` is **43/43** under
the unit, each fix greens exactly its own failure (measured: ORDER alone
leaves 1b red, FIXAUTH alone leaves 1a red, both = 0), and the fixes alone on
the flags-off world are behaviour-neutral on the suite.

## THE MECHANISM THAT EXPLAINS THREE REDS (1b, 4, 5)

The dependent week arrives at the gateway WITH its cross-week content (the
G+1 recovery, the speed-work-bearing sessions); the expiry stage kills it in
**21/21** tier-4 resolves (`hasActiveFixtureDates=false`, caller
`scaffoldSection18TierFour`, `sessionResolver.ts:984`) and **0/3** staging
resolves. At source: the provenance guard `invalidWhen: fixture_absent
<exact date>` is exact-date ONLY when the caller supplies
`activeFixtureDates` (`derivedSessionProvenance.ts:417-426`); otherwise it
falls back to day-of-week membership in THIS week's contract — structurally
false for any cross-week dependency. `sessionResolver.ts` had ZERO
occurrences of the authority; the staging owners thread it everywhere
(`acceptedStateTransaction.ts:1849→1997`). The fix derives the authority at
the tier-4 assembly from facts the host already carries — the
`governedFromISO` treatment. The seat's reorder-on-shared-machinery clause
is exercised here, citing the bisections: roots 4 and 5 needed no fixes of
their own.

## THE PRE-RULED BUILDS (the seat's rulings arrived pre-loaded; both built
## under them, at `8696193e`)

**Root 2 — the oracle retired to the derived basis** (`LFA_SCAFFOLD_
DERIVED_IDENTITY`). `stageAthleteSessionMoveTransaction`'s source AND target
witnesses now resolve the visible week (`resolveWeekWithConditioning` over
the imperative schedule state) — the same world the sheet was rendered from.
The guard's question is unchanged; only its witness moved. Decision records
key to derived identities from here — permitted by the ruling without
migration (no real users), **flagged for Sam's device pass**.
`program-control-durable` 19/19 under the unit.

**AND THEN A WITNESS DISAGREED — the genuine STOP the authorisation names.**
The full-sweep neutrality arm caught `g1-landing-ask-flow` newly red under
DERIVED_IDENTITY, in BOTH worlds, at the TARGET witness. Bisected to the
flag alone; the failure is the door's own guard throwing against the G-1
flow. The finding, named: **the move door has TWO caller classes acting on
TWO different visible bases** — the sheet route acts on
`resolveWeekWithConditioning`'s week; the G-1 landing flow captures from the
`rebaseAcceptedEffectiveWeek` projection — and retiring the oracle to either
basis breaks the other class. A per-caller fallback would be the
"compatibility path" red-flag move and is NOT taken; the honest fix is the
recorded standing debt ("day-card door unification" — one visible basis for
every door), which is the seat's. DERIVED_IDENTITY therefore stands as
**REFUTED AS SCOPED**: it trades `program-control-durable`'s red for
`g1-landing-ask-flow`'s. Both worlds' numbers are in the price table; the
flag stays on the scaffold as the measured half-fix, OFF in any landing set
until the basis question is ruled.

**Root 3 — withdrawal reads typed placement provenance**
(`LFA_SCAFFOLD_OFFER_PROVENANCE`). The placer stamps what it places
(`triggerSignature: section18-offer:<weekStart>`, a valid
`DerivedSessionProvenance` record; `stripOffer`'s existing
conditioning-component filter removes it on withdrawal); the withdrawal
branch reaches ONLY stamped sessions. An athlete-added session never carries
the stamp, so it is structurally out of reach — the signed ruling enforced,
not changed, exactly as the seat framed it. `work-bill` 6/6 under the unit;
suite-neutral flags-off.

## STOP 1 AS ORIGINALLY FILED — the move door (root 2), kept for the record

The tapped identities, from the mismatch tape: the athlete's sheet carries
`w-coach-5:tier4-replan:2026-08-03:thursday` (the DERIVED week tier 4
re-planned, which is what the athlete sees and taps); the door's oracle
`acceptedWorkoutForDate` answers `derived-nearGame-2026-08-06` ("Lower
Hinge") from the MATERIALISED week, which does not carry the tapped-in
addition at all. The guard at `acceptedStateTransaction.ts:3164-3166` can
therefore never match, and every durable move is refused
(`athlete_move_preview_failed` at preview, the same throw at commit —
refusal sites taped).

Why it is a STOP and not a fix: re-keying the door's identity basis to
derived space changes what the athlete-move DECISION records — a decision
payload. And the honest resolution is not a door patch at all: it is the
unit's own ruled parity design (derived == materialised — the ninth-pass
parity gate, leg (iii)'s corrected grounds). Root 2 is a measured parity
violation on a walker world. The seat owns whether the parity build closes
it or the door learns the derived oracle; both forks are already the seat's.

## STOP 2 AS ORIGINALLY FILED — the offer withdrawal (root 3), kept for the
## record

The athlete's `add_category: conditioning_light` COMMITS, then the honest
visible-verification law refuses the act because the projection never shows
it: the gateway stage tape shows the added session arriving, surviving
expiry, and vanishing at `presentDeclaredOffer` with repair
`offer_withdrawn`. At source: `carriesOffer`
(`section18OfferPlacement.ts:146-149`) identifies an offer BY ROLE SHAPE
(`optional_flush`), the role derivation assigns that role to the athlete's
added light conditioning, and the withdrawal branch sheds it as a surplus
the contract does not declare.

By the offer-survival ruling's own words an offer is something the week
PRESENTS ("doing it is the athlete's choice") — an athlete-ADDED session is
not a presented offer, so the withdrawal is arguably misclassification, not
ruled behaviour. But the change lands inside `presentDeclaredOffer` and the
§18 role derivation — signed territory — so it STOPs. Fix shape offered:
authorship enters role space (athlete-authored content can never derive
`optional_flush`), which is the a-note-is-output law pointed at roles.

## ROOT 6, and the masking mechanism NAMED (the seat's 5th/6th order)

The relocation generator (`repairDisplacedStrengthCandidates`, leg (ii)
scaffold code) already excludes anchor days — but under (ii)-without-(iii)
the contract is the STORED one (`deriveWeekContract` line 405 no-ops without
leg (iii)), whose anchors predate the athlete's game mark. The candidate
arrived with Saturday = Game through all five stages; the SEARCH chose a
`displaced_strength_relocated` candidate that overwrote it. With leg (iii)
on, the derived contract carries the fixture anchor from profile+marks, the
generator excludes the day, and the suite is 5/5. **The (iii)+(iv) masking
of the pair is therefore not masking at all — it is the unit's own
convergence working**: session-list-combinations greens via FIXTURE_AUTHORITY
(shared root), device-pass-evening greens via leg (iii)'s derived contract.
Both members named, as ordered.

## THE PRICE (all 154 suites per arm, sets diffed)

| arm | failures | vs reference |
|---|---|---|
| control (flags off) | 6 | reference |
| ORDER_OWNER + FIXTURE_AUTHORITY alone | **6** | control set EXACTLY — 0 new, 0 fixed |
| ruled combination + boundary (fifteenth pass) | 10 | reference |
| LANDING SET: (ii)+(iii)+(iv)+basis+boundary+both fixes | **9** | control 6 + `program-control-durable` + `work-bill` + `action-walker:deep` |

**The landing set retires two of the combination's four reds** (the AST pair)
and leaves three:

1. `program-control-durable` — STOP 1 (below), predicted.
2. `work-bill` — STOP 2 (below), predicted.
3. `action-walker:deep` — NOT the root-4 mechanism returning. The failure
   text was diffed, per the red-count law: same L-P3 law, DIFFERENT
   coordinate (2026-08-10, Off-season world; root 4's was 2026-07-27,
   fixture-adjacent, and stays dead). The walker's own row instrument shows
   the day carrying "20 m Acceleration Reps" — real speed work the D13
   session-template composition does not represent — which is the suite's
   own ALREADY-DECLARED debt (`session_list_has_no_representation_for_
   speed_work`, "paid by the D13 session-template owner"), reached by the
   landing combination at a coordinate the declaration does not cover. The
   two honest options both belong to others: the D13 owner pays the debt
   (the same move that put power in the one list, applied to the speed
   block — signed D13 territory), or the declaration widens — which is the
   expectation-edited-to-match-the-regression trap and is NOT taken.
   Recorded as STOP 3.

## THE COMPLETE LANDING PRICE (at `8696193e`, all 154 suites per arm)

| arm | failures | vs control (6) |
|---|---|---|
| ORDER_OWNER + FIXTURE_AUTHORITY alone | **6** | identical set — 0 new, 0 fixed |
| all FOUR fixes alone (flags off) | **7** | + `g1-landing-ask-flow` — DERIVED_IDENTITY's basis collision, both worlds |
| landing set, 4 fixes | **8** | + `g1-landing-ask-flow` + `action-walker:deep` |
| **landing set, 3 fixes (no DERIVED_IDENTITY) — RECOMMENDED** | **8** | + `program-control-durable` + `action-walker:deep` |

The unit's price has moved from **5 new reds** (the ruled combination as of
this morning) to **2**, and both survivors are named and owned:

- the MOVE DOOR red — carried as `program-control-durable` (3-fix set) or as
  `g1-landing-ask-flow` (4-fix set); one red either way, and which one is the
  seat's two-bases ruling, not a build question;
- the WALKER red — the D13 speed-representation debt at an undeclared
  coordinate.

## FOR THE SEAT — what the queue ends on

1. **The two-bases question (the genuine STOP that fired):** the move door
   has two caller classes on two visible bases; DERIVED_IDENTITY is refuted
   as scoped by the g1 witness. Options, both measured: land 3 fixes and
   carry `program-control-durable` red, or rule the one-basis unification
   (the recorded door-unification debt) and DERIVED_IDENTITY re-prices after
   it. No compatibility branch was built.
2. **The D13 speed-representation debt** is load-bearing for the landing set
   at 2026-08-10, a coordinate its declaration does not cover. Pay it at the
   D13 owner, or the unit lands carrying the walker red. The declaration is
   NOT widened from this seat.
3. OFFER_PROVENANCE is built under the pre-loaded ruling and clean in every
   measured combination. Sam's vetoes stand: the completed-day display
   consequence (fifteenth pass) and, if DERIVED_IDENTITY ever lands,
   re-keyed move-decision identities — both flagged for the device pass.

## NOT COVERED

- Neither STOP's fix is designed beyond shape; nothing was built where a
  STOP applies.
- Root 2's parity claim is measured on ONE world (the durable-move walk);
  the parity gate's own byte-equal measurement remains the ruled instrument.
- Root 6's generator was not hardened against marked days independently of
  leg (iii); under the ruled combination the contract supplies the anchor,
  and a generator-level second check would be a second copy of that rule.
- The role derivation that assigns `optional_flush` to the athlete's add was
  read at the classifier (`carriesOffer`), not walked to its own deriver.
- `test:compile` outside the sweep, as standing; flags-off keeper resolves
  for 1b inferred from source (the field post-dates that arm's tape).
