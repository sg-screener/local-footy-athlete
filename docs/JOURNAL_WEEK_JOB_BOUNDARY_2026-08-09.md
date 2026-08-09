# THIS WEEK'S JOB — boundary report (2026-08-09)

Monday card / addendum Group 1 item 4. Built under the standing authorisation;
owners measured in docs/JOURNAL_MONDAY_CARD_PLAN_2026-08-09.md §3b.

Commit: `67f80e0b`.

## ONE LINE

**"This week asks for 3 strength, 2 conditioning." — read off the contract the
Section 18 resolver already authored, and the completion verdict I first built
beside it was REFUSED BY A GATE for reading a stale tally.**

## THE CORRECTION IS THE REPORT

The first version rendered "All of it is done." / "1 strength to go." from
`achievedCount` and `unresolvedMinimumShortfall` on the **stored** contract.
`section18ShortfallCopyTests` went red on its first run with exactly the right
sentence: *"no caller reads an achieved tally off a stored contract."*

**That gate is the north star in miniature and it was right.**

- A **TARGET** is policy — a decision about what the week asks. Stable, and safe
  to read from a stored contract.
- An **ACHIEVED TALLY** is derived output. A stored one goes stale beside the
  facts it came from: the athlete trains on Thursday and the snapshot still says
  what it said on Monday. I would have put that on their screen and called it
  their week.

So the module reads targets only and carries no verdict. **Week STATUS (item 3)
is therefore not built** — it needs a freshly-derived ledger
(`ledgerFromEffectiveWorkouts` + `evaluateWeeklyExposureContract`) and belongs to
the owners the gate names. Its wording will come to Sam as its own batch, because
it is a claim about his athlete's week.

**The athlete is not left without a completion picture:** "Did the work happen"
one section down already answers it from recorded outcomes. A second verdict here
would have been two answers to one question — which is the same defect in a
different coat.

**The two withdrawn sentences were REMOVED from batch 20, not left proposed.** A
proposal for wording nothing uses wastes a ruling, and the binder says so out
loud.

## WHAT WAS RIGHT FIRST TIME

**The contract is READ, never rebuilt.** This was the trap the Monday card plan
named in advance: the week's contract already exists as a typed fact on the
microcycle (`Microcycle.exposureContractV2`), authored by the Section 18
resolver. Building a second one from the same inputs would be a second answer to
"what does this week ask of the athlete". Gated by a source sweep that forbids
any `build*ExposureContract` call here.

**The athlete's words come from their owner.** `ATHLETE_WORD_FOR_DOMAIN` was
EXPORTED from `section18ShortfallDisclosure.ts` rather than copied — a private
table in the Journal would be a rival vocabulary for the words the athlete reads,
and the two would disagree the first time either was edited. A cell asserts the
word *is* the owner's, not a copy that agrees today.

**Sam's forbidden vocabulary holds on a new surface.** A cell asserts no rendered
word is "exposure"/"exposures", enforcing `ATHLETE_FORBIDDEN_VOCABULARY` here
rather than trusting it.

**A domain with no athlete word is dropped**, never rendered by its code name —
the honest-outcome law, applied to `identity`, `migration` and `anchor_credit`.

## NORTH STAR: TOWARD

Zero new stored state. The whole section is a read over policy the resolver
already decided.

## THE GATE

- **Full `test:bible`, UNPIPED: `GATE_EXIT=1` at `test:program-control-durable`,
  1 FAIL line** — main's declared red, same assertion text.
- **Sweep: `failures=2 of 163` = the declared set EXACTLY** —
  `test:program-control-durable`, `test:fixture-identity`, at head `67f80e0b`.
- `test:compile` PASSED — no file regressed.
- New suite `test:journal-week-job` registered in `test:bible`: **24 passed, 0
  failed.**
- Copy batch 20 PROPOSED. Extraction ceiling **568 → 570** — briefly 571 before
  the withdrawn verdict sentence came out, and the comment records that.

## WHAT WOULD CATCH THE NEXT DEFECT OF THIS CLASS (L12)

The class is **a stored derivation read as a live fact**. `section18ShortfallCopyTests`
already sweeps the whole app for it, which is why it caught me — that gate is the
general instrument and it works.

What this slice adds is a LOCAL assertion at the new reader: cells [3] and [4]
require this module to touch neither tally name, and a fixture with wildly wrong
stored tallies (`achievedCount: 99`, `shortfall: 7`) proves they cannot change
what is reported. So the next person to reach for the convenient number here reds
two suites, not one.

## NOT COVERED

- **Week STATUS is not built** (above) — the section states the ask and claims
  nothing about completion.
- **NO DEVICE EVIDENCE.** No cell mounts the Journal screen.
- **DEPTH (L13): 0.** The fixture populates only the three numeric policies this
  module reads; a change to the contract's shape reaches the suite through the
  compiler, not the fixture.
- **Whether the resolver keeps a contract on the microcycle for every week an
  athlete can view is NOT asserted here.** The section renders "No plan recorded
  for this week." when it does not, which is honest — but a week that SHOULD have
  a contract and does not would look identical, and no cell can tell them apart
  from inside a unit test.

## SAM'S QUESTIONS (parked, not waited on)

1. **Week status wording** — when the derived-ledger version is built, its
   sentences come to you as their own batch.
2. **"This week asks for 3 strength, 2 conditioning."** — the ask line's shape.
   The domain words are yours already (the shortfall table); what is mine is the
   sentence around them.
