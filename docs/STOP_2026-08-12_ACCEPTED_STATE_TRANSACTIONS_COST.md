# WHERE THE 91 SECONDS GO — `test:accepted-state-transactions`, measured

**LOOP CHECK: `a-count-names-instrument` — the obvious suspect was refuted by
the first measurement, and the second measurement refuted my own fix.** Two
premises died in one unit. Both are written below rather than tidied away.

**SEAT_INBOX item 2, the line reading "NOT PAID — `test:accepted-state-
transactions` is 89.5s, the largest real unit, new since 2026-08-07, and never
looked at."** Sam's question, verbatim: *"i want to know how long that 192 tests
are taking and if it's really necessary"*.

It has been looked at now. **It is not necessary — and the reason is a product
function, not a test.**

---

## 1. WHAT IT COSTS, AND WHERE

Measured 2026-08-12, this machine, `TZ=Australia/Melbourne`.

| instrument | number | unit |
|---|---|---|
| whole suite | **91–96 s** | wall clock, three runs |
| units inside it | 43 | 23 regressions + 10 properties + 10 mutations |
| **program generation** | **12.0 s** | 43 calls, 11 distinct inputs |
| six slowest units | **84.4 s** | of ~93 s spent in test bodies |
| remaining 37 units | **< 9 s** | all but one under 4 s |

**GENERATION IS NOT THE COST.** That is the first refuted premise: 33
`seed()`/`generate()` call sites make the generator the obvious suspect, and
memoising the 43 calls down to 11 distinct ones would have saved **at most 9
seconds of 91**. The cheap, plausible fix was worth 10%.

## 2. THE SIX SLOWEST, AND THE CLIFF INSIDE THEM

| ms | unit |
|---|---|
| 18 975 | regression 13 — legacy unknown anchors remain uncredited |
| 16 812 | property — unknown legacy participation never gains anchor credit |
| 14 903 | property — no calendar mutation can bypass the gateway |
| 12 965 | property — visible projection is ledger-equivalent to gateway acceptance |
| 12 580 | property — hydration remains deterministic and idempotent |
| 8 187 | property — no contractless material week persists without Contract v2 |

Splitting `migrated()` into its two halves found a **1000× cliff in one
function**:

```
MIGRATED-SPLIT generate=12ms   canonicalise=85ms
MIGRATED-SPLIT generate=14ms   canonicalise=8ms
MIGRATED-SPLIT generate=18ms   canonicalise=15ms
MIGRATED-SPLIT generate=15ms   canonicalise=20385ms
MIGRATED-SPLIT generate=14ms   canonicalise=17942ms
```

Same function, same shape of input: 8 ms, 15 ms, 85 ms — then **20.4 s and
17.9 s**. A thousandfold spread is never a slow function. It is a loop.

## 3. THE LOOP, NAMED

A CPU profile (`node --cpu-prof`) put **~33 s of self time in one function**:
`stateSignature` at `src/rules/section18AcceptedWeekGateway.ts:1486`. It is a
full `JSON.stringify` of every workout and every exercise row in the week.

Instrumenting it directly, over one run of the suite:

> **977 034 calls · 40.2 s · 25.9 GB of JSON produced.**

To evaluate **at most 48 candidates per search** (`maxCandidates`, default 48).

**THE CAUSE.** `searchWholeWeekRepairCandidates`
(`src/rules/wholeWeekRepairEngine.ts`) bounds `assess` by `maxCandidates`. It
does **not** bound signing. The expansion loop signs **every generated child**
to test `seen` before queueing it, and the gateway's `expand` returns tens of
thousands of children per expansion. ~26 KB of JSON per call, a million calls.

## 4. THE FIX IS REAL, IT IS WORTH 42%, AND IT IS **NOT FREE**

The pre-check looks redundant: the dequeue path already skips a candidate whose
signature is `seen`. Queueing children unsigned and letting the dequeue check do
the work was tried, and it is a large win:

> **91 s → 53 s. A 42% cut in the chain's largest unit.**

**AND IT BREAKS A TRANSACTION INVARIANT.** The property *"a fixture MOVE
publishes its dependent week once and leaves the week it decided a DECLARATION
with no content"* fails with `following-week dependency was not committed in the
same snapshot`. That is an athlete-facing atomicity guarantee, not a diagnostic
count — a fixture move would publish its own week and leave the following week
uncommitted.

**So the second premise died too: "the pre-check is not load-bearing" is FALSE.**
Queueing duplicates changes which repair the search settles on. **The change is
REVERTED. Nothing in this document ships a behaviour change.**

## 5. WHAT A REAL FIX WOULD TAKE — priced, not started

Three routes, in order of how much I would trust them:

1. **Make the signature cheap instead of rare.** The key exists to de-duplicate
   candidates. It currently serialises every field of every exercise row; a
   narrower key over the fields that actually distinguish candidates would cut
   26 KB to a few hundred bytes with no change to search order. **THE RISK IS
   COLLISION** — two genuinely different weeks sharing a key means a repair is
   silently skipped — so this needs a cell proving injectivity over the
   candidate space before it is believed, not after.
2. **Keep the pre-check, drop the double work.** The dequeue recomputes a
   signature the push already computed. Memoising per candidate object is
   provably behaviour-neutral, and is worth roughly **1%** — the duplicate
   dequeue computations are a rounding error beside the 977 034.
3. **Bound the expansion.** If `expand` returns tens of thousands of children to
   evaluate 48, the generator of candidates is the thing that is wrong, not the
   consumer. This is the largest and the least understood.

**NOT STARTED, AND DELIBERATELY.** `section18AcceptedWeekGateway.ts` and
`section18CraftTier.ts` are being actively edited by another agent in this
shared checkout. Route 1 changes a correctness-critical de-duplication key
inside a file that is mid-flight, and route 3 is a redesign. **Measurement is
this unit's deliverable; the redesign is Sam's or the seat's call.**

## 6. NOT COVERED

- **No device pass.** This is chain cost, not athlete-visible behaviour — but
  see below, because it may be both.
- **WHETHER AN ATHLETE PAYS THIS IS OPEN-UNKNOWN, AND IT IS THE QUESTION WORTH
  ASKING NEXT.** `canonicaliseHydratedProgram` runs on hydration of a legacy
  program. If a real device carrying a pre-Contract-v2 program hits the same
  20-second canonicalisation, this is not a test-speed finding at all — it is a
  twenty-second launch. **Nothing here measured a device.** The two 20 s calls
  were on a migrated in-season week with one team-training day; whether that
  shape reaches a phone was not established.
- The other five slow units were not split the way `migrated()` was; they are
  attributed to the same `stateSignature` by the profile, not by per-call
  timing.
