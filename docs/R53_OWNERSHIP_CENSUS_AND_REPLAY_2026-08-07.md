# R5.3 — THE OWNERSHIP CENSUS + THE REPLAY EQUALITY BIND (2026-08-07)

# **THE DECLARATION OWNS 16 THINGS. 4 ARE RESOLVED. 12 ARE BLOCKED. V3 IS NOT CLOSED.**

LOOP CHECK: shallow-world-said-yes-and-depth-said-no — sighting 1 of this shape
in this unit and it happened **twice in this single pass** — ITERATE, and the
iteration is already law: **no claim about an accumulator is made below the
depth it accumulates to.** The Restore-witness suite (depth ≤ 5) measured *zero*
missing decision reductions and *eight* reproduced declaration fields. The deep
walker (depth 10) measured **187** and **four**. Had the seat not ordered depth 6
explicitly, this run would have reported "equality holds → retire the writer"
and been wrong twice over.

Twenty-second pass. Answers inbox item 1 (b) and (e). **NOTHING BUILT into the
branch** beyond the already-landed read half; all instruments are flag-gated on
scratch branches and inert by default.

---

## THE CLOSED CHECKLIST

The census is **saturated and now COMPLETE**: all 156 bible suites ran under it;
**44 of them produce records at all** (the other 112 never put a stored
declaration into the store), yielding **83 census records** — forked child
processes included, each writing its own record, so the spawnSync scenarios are
captured rather than lost as in harness-lies sighting 4. **16 top-level fields
from the very first suite, unchanged to the last; 278 distinct field paths.**

That 44-of-156 figure is itself worth stating rather than glossing: the
declaration is not touched by three quarters of the chain, which is why a static
census kept looking complete.

Resolution measured at **accumulated depth** (deep walker: 553 derivations,
0 derivation errors), asking of each field: *does `deriveWeekContract` reproduce
it from the base contract plus the athlete's facts and decisions?*

| # | field | reproduced / not | verdict |
|---|---|---|---|
| 1 | `protocolVersion` | 553 / 0 | **RESOLVED** |
| 2 | `authority` | 553 / 0 | **RESOLVED** |
| 3 | `source` | 553 / 0 | **RESOLVED** |
| 4 | `equipment` | 553 / 0 | **RESOLVED** |
| 5 | `authorisedReductions` | 313 / 240 | **BLOCKED — the accumulator, root named below** |
| 6 | `mainStrength` | 204 / 349 | BLOCKED — dose computed FROM the reduction stack |
| 7 | `conditioning` | 295 / 258 | BLOCKED — same |
| 8 | `sprintHighSpeed` | 307 / 246 | BLOCKED — same |
| 9 | `power` | 285 / 268 | BLOCKED — same |
| 10 | `restStress` | 195 / 358 | BLOCKED — same |
| 11 | `strengthPatterns` | 193 / 360 | BLOCKED — same |
| 12 | `anchors` | 369 / 184 | BLOCKED — **unexplained** |
| 13 | `safety` | 329 / 224 | BLOCKED — **unexplained** |
| 14 | `identity` | 519 / 34 | BLOCKED — **unexplained** (and the read half already owns most of it) |
| 15 | `migration` | 513 / 40 | BLOCKED — **unexplained** |
| 16 | `governedFromISO` | 0 / 1 | BLOCKED — **unexplained, single observation** |

**4 resolved, 12 blocked.** Items 6–11 are consistent with item 5's root (the
builder computes every dose from the reduction stack) but that is a reading, not
a separate measurement. Items 12–16 have no named root at all.

**Retiring the writer today would change 12 of 16 fields of every accumulated
week's contract.** That is the answer to the writer-retirement question, and it
is nowhere near ready.

---

## PART 1 — THE REPLAY EQUALITY BIND: **EQUALITY FAILS**

### The instrument

`reductionReplayEquality.ts` compares, on **every store write**, the week's
stored `authorisedReductions` against a stack replayed from the reversible-
adjustment ledger's `linkedTypedReductions` (active adjustments, deduped —
exactly the ledger's own merge). Measuring at the store seam rather than in
hand-built worlds is deliberate: the ordered property is equality *across acted
worlds including accumulated depth*, and hand-built worlds would sample. Every
world every suite reaches is measured instead, and the depth distribution is
reported rather than assumed.

Controls (deep walker): 468 store writes, 553 weeks compared, 5,901 adjustments
seen, 468 ledgers seen. No zero here is a bare zero.

### The result — and the depth reversal

| measure | Restore witnesses (depth ≤5) | deep walker (depth 10) |
|---|---|---|
| weeks compared | 97 | 553 |
| equal | 2 | 43 |
| stored deeper than replay | 87 | 411 |
| **replay deeper than stored** | 0 | **20** |
| **missing DECISION reductions** | **0** | **187** |
| missing POLICY reductions | 96 | 437 |

### The 187, split — because "missing" has two meanings

A stored decision-reduction the replay misses can mean the ledger never recorded
that decision, or recorded it with different numbers. Naming a decision-record
gap without splitting those would be an attribution made from a comparison
instead of from the record:

| | count |
|---|---|
| **`deletionIdentity` ABSENT from the ledger entirely** | **159** |
| identity present, target values drifted | 28 |

**THE MISSING ELEMENT, NAMED: 159 athlete-removal reductions
(`explicit_user_override`) whose `deletionIdentity` no adjustment in the ledger
records at all.** The decision happened, the week's contract carries its typed
reduction, and the ledger has no entry to replay it from.

### Three further measured findings

1. **The policy half is not a gap.** 437 missing policy reductions
   (`game_load_protection` 182, `injury_restriction` 104, `deload_policy` 71,
   `practice_match_load` 50, `spacing_safety_conflict` 16, `optional_week_mode`
   14) are minted by their owners from identity and facts — the builder
   (`weeklyExposureContractBuilders.ts:387-411`) and the gateway
   (`section18AcceptedWeekGateway.ts:425/1076`). A derived contract rebuilds
   them by construction. NOT decision-record gaps.
2. **The ledger's record is field-incomplete even where it matches.** A stored
   reduction carries `scope`, `change` and `provenance`; the linked record
   carries none of them (21 reproduced reductions, all three absent). A replayed
   stack is set-equal at best, never field-equal.
3. **The divergence runs both ways.** 20 weeks where the replay produces a
   reduction the stored stack does not have. A replay that INVENTS is a
   different defect from one that misses, and it is unattributed.

### THE EXIT, PRE-RULED

The seat's condition: *"EQUALITY FAILS → STOP with the missing element NAMED — a
decision the ledger does not record is a decision-record gap, and that comes
back to the seat (and possibly Sam) as a design question, not a patch."*

Equality fails. 159 decisions are unrecorded. **This is that STOP**, and by the
ruling's own terms it is not mine to patch.

One candidate producer, offered as a candidate and **not** as attribution:
`temporarySourceFactTransaction.ts:376` writes `linkedTypedReductions: []`
unconditionally. It is one producer among several and has not been taped on the
failing path.

---

## PART 2 — THE CENSUS INSTRUMENT

A recording **Proxy** installed at the store seam wraps every
`exposureContractV2` that enters the world from storage — overlay and
microcycle. Every read of every field is recorded with its consuming frame. A
consumer that grep cannot name still has to read the field, so the list is
complete by construction rather than by enumeration. This is what the 2026-08-06
static census could not do, and what the third-producer and accumulator
discoveries prove was needed.

**The instrument found its own defect first**, which is the only reason its
numbers are worth anything: the re-wrap guard was *checked and never set*, so
every store write wrapped an already-wrapped contract, nesting proxies and
multiplying read counts by the number of writes. It surfaced as the marker
`__censused` appearing in the census's own output. Fixed and re-smoked (257
wrapped vs 270 before; the suite still exits 0, so the proxy is
behaviour-preserving).

**Consumers, by field** (top product consumers, tests excluded): the readers are
overwhelmingly `section18EffectiveWeekEvaluator`, `section18SafetyFinaliser`,
`derivedSessionProvenance`, `coachMutationTransaction` and `programStore` — all
of which consume *a* contract and would be equally satisfied by a derived one.
**No consumer requires the STORED copy specifically.** The blockers are not
consumers; they are the deriver's inability to reproduce 12 fields.

**What the overlay actually OWNS** (`declarationDivergence`, deletion suite, 97
weeks with both an overlay and a covering microcycle): 4 fields never diverge
from the base (`protocolVersion`, `authority`, `source`, `equipment`); the other
12 diverge at least sometimes. That is the same 4/12 split the parity
measurement reaches independently, from a different direction.

---

## WHAT THIS RUN CHANGED, AND WHAT IT DID NOT

**Landed:** the read half (`8ca5ae24`) — the week's identity derives from the
athlete's facts, at all three contract-selection lines, measured free, gate
byte-identical after landing.

**Not landed and not attempted:** the writer retirement, the three content
suites, the two ratchet deletions, the parity-gate expiry, condition 1's
re-measure, cells 5/6. **(c) is not reached. V3 is not closed**, and the
measurements do not support saying otherwise.

## NOT COVERED

- Items 12–16 of the checklist have **no named root**. They are measured as
  blocked, not diagnosed.
- Items 6–11 are attributed to item 5's root by reading (the builder computes
  dose from the reduction stack), not by a separate measurement.
- The 20 "replay invents a reduction" cases are unattributed.
- `governedFromISO` has a single observation; the deletion worlds do not carry
  it, so its verdict rests on one deep-walker week.
- The census is COMPLETE (156 suites run, 44 producing records, 83 records, 16
  fields, 278 paths) — the "132 of 156" caveat in the first draft of this report
  is closed, and the count did not move.
- All three instruments are scaffold-only and must be stripped before any
  product landing — they touch `weekRebuild`, the evaluator and the hydration
  ingress.
- No device evidence. Monday's `Vertical Jump` still waits on the writer.
