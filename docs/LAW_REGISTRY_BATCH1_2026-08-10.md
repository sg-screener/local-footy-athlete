# LAW REGISTRY — BATCH 1, THE HONEST MAP (2026-08-10)

**Sam asked the root question and the answer is a number: of 28 laws in Batch 1,
20 have NOTHING holding them — 19 after the gate below took `LAW-0-registry`.**

*(Updated the same day, twice: pricing the conservation order moved two rows from
UNENFORCED to `guarded` and added one new correctly-aimed row; then Sam's
stop-the-line ruling built `test:law-registry`, which flipped `LAW-0-registry`
and **made `UNENFORCED` a RED rather than a resting state**. The counts below are
as-measured at first publication; the live number is whatever
`npm run test:law-registry` prints.)*

> *"how do we make sure all the laws we have written in the past are held up now?
> it feels like i constantly give a fix and a law or whatever and then believe you
> will remember and you never fucking do"* — Sam, 2026-08-10

He is right. This is the measurement, not a promise.

## THE NUMBER

| | count |
|---|---|
| Batch 1 rows | **28** |
| `guarded` (named check, in the chain) | **8** → **9** with the gate |
| **`UNENFORCED`** | **20** → **19** with the gate |
| guards naming a script outside `test:bible` | 0 |
| guards naming a script that does not exist | **1, caught and fixed** |

That last line is worth more than the others. The registry's first mechanical
read found a row of mine naming `test:athlete-action-walker`, **which does not
exist** — the real script is `test:action-walker`. A law "guarded" by a
nonexistent script is exactly the failure Sam described, and it survived being
typed by the person who had just looked the guard up. **Resolving the name beat
trusting it, on the first try.**

## WHAT IS ACTUALLY GUARDED (8)

| law | guard | note |
|---|---|---|
| `LAW-totals-or-red` | `test:totals-or-red-law` | **The strongest row. 174 suites arm it, and the law has its own chain script. This is the shape the others should copy.** |
| `LAW-L13-walker-accumulated` | `test:action-walker` | carries a real liveness check (`:323`) |
| `LAW-L14-domain-purity` | `test:bible` → `importBoundaryTests` | PARTIAL — gates imports, not indirect store reads |
| `LAW-LC1-brain` | `test:coach-tab-slice2` | PARTIAL — the truth gate is a PHRASE list |
| `LAW-LC2-change-card` | `test:coach-tab-slice3` | strong: "executable without a card" is unrepresentable |
| `LAW-LC3-nike-bar` | `test:coach-tab-slice3` [6] | **SOURCE ONLY, and the law is about GLASS — the keyboard matrix has never executed** |
| `LAW-LC4-parity` | `test:coach-tab-slice3` [8] | new this pass; covers **1 of 26** action types |
| `LAW-conservation` | `test:athlete-move-occupied-content-loss` | **moved here from UNENFORCED by the pricing** — guarded at SESSION IDENTITY, with rollback; correctly passed the 2026-08-10 case |

## THE UNENFORCED LIST — SAM PICKS WHAT GETS GUARDED FIRST (20)

**Mechanisable, and these are the ones that bit us this week:**

1. **`LAW-attributed-content-change`** *(new row — the one the 2026-08-10 defect
   actually belongs to)* — *content may only leave a session for a declared
   reason, and a change the athlete did not ask for is told to them.*
   `power_removed` is **already typed and reasoned** in the canonicaliser, and
   consumed only by generation-time validation and three suites — **no
   athlete-facing surface reads it.** The reason exists and is thrown away.
   **The coach's truth gate can NEVER catch this:** `FORBIDDEN_WHEN_NO_APPLIED`
   is a list of PHRASES, and *"Done. Session moved."* is **true** — a session did
   move. The lie is the omission beside it, and **no phrase list can see a
   deletion.** Attribution is structural, so its guard can be.
2. ~~`LAW-conservation` / `LAW-do-not-lose-the-session`~~ — **CORRECTED
   2026-08-10, and this correction is the registry earning its keep.** Both rows
   first read UNENFORCED on the premise that the law had no door. **It has one:**
   `detectAthleteMoveContentLoss` runs on every move including the absorb path,
   rolls back and throws. It is guarded at **session identity**, and it correctly
   PASSED the 2026-08-10 case — the surviving object was the combined day. The
   gap was one level down, which is why row 1 above now exists. See
   docs/CONSERVATION_POSTCONDITION_PRICING_2026-08-10.md.
3. **`LAW-claim-needs-a-cell`** — grep for `DOC-TRUTH` and `OPEN-UNKNOWN` across
   `src/` returns **zero files**. The law this week leaned on hardest has no
   guard at all.
4. **`LAW-doc-truth`** — same zero. Violated and hand-repaired this pass (a suite
   header claiming cells "expected to FAIL" that now pass).
5. **`LAW-liveness`** — *a green gate is a claim.* **One** liveness check exists
   in the entire repo. Mutation testing is a per-pass habit; nothing requires it.
6. **`LAW-instrumentation-alive`** — founding case: **eight of eleven Maestro
   flows crashed on their first command for 23 days**, invisible because the only
   flow that could launch was not the one anybody ran.
7. **`LAW-not-covered-real-data-blocks`** — 21 suites PRINT their own NOT-COVERED;
   **none reads anyone else's.** The sixty-second boundary's own NOT-COVERED
   predicted the day shapes its fixtures could not hold and nothing acted on it.
8. **`LAW-anchor-smallest-declaration`** — violated and repaired by hand this
   pass: a `{0,200}` character window over JSX, widened to 600, then re-anchored.
   Nothing would have caught the widening.
9. `LAW-no-hand-built-fixtures` · 10. `LAW-L15-one-write-format` ·
11. `LAW-seat-coordination` (violated + hand-repaired 2026-08-10, `74070cf2`) ·
12. `LAW-dedup-ungates` · 13. `LAW-count-names-instrument` ·
14. `LAW-coach-no-phrase-handlers` · 15. **`LAW-0-registry`** (this registry has
no gate over it yet — deliberately, per the order)

**PROCESS laws — honestly not cell-able, and mislabelling them as "missing
guards" would inflate the backlog:** `LAW-coach-escalation`,
`LAW-elegant-two-options`, `LAW-L11-matrix-before-phone`,
`LAW-L12-verification-reviewed`, `LAW-L16-vertical-slice`. Their realistic guard
is a seat checklist. **Excluding these, the mechanisable UNENFORCED count is 15.**

## WHAT WAS BUILT AND WHAT DELIBERATELY WAS NOT

**BUILT:** `src/rules/lawRegistry.ts` — machine-readable, typed, two states and no
third (`guarded` | `UNENFORCED`), plus `AGENTS.md` **LAW ZERO** stating the rule
that takes effect immediately: *no law enters a boundary, ruling doc, source
comment or the inbox without a registry row and a guard, or an explicit
UNENFORCED row with a reason.* It subsumes the claim-in-prose-only rule.

**BUILT LATER THE SAME DAY, ON SAM'S STOP-THE-LINE RULING —** *"WHY CAN'T YOU
JUST MAKE SURE EVERY FUCKING RULE IS FOLLOWED FROM RIGHT NOW"*: the gate over the
registry, `test:law-registry`, last link in the `test:bible` chain. **It FAILS
while any row reads `UNENFORCED`, so the chain is red and stays red until every
law has a guard.** `LAW-0-registry` moved UNENFORCED → `guarded` accordingly, so
the count on this page reads **19 of 28** from that commit onward. See
`src/__tests__/lawRegistryGateTests.ts`.

**STILL NOT BUILT:** a guard for any of the remaining 19. The seat's *"the first
output is the honest map, because a map with UNENFORCED rows on it is worth more
than a guard built in the dark"* held for the map; it does not survive as a
reason to leave the map ungated.

**NOT HARVESTED:** 131 named ruling docs, 15 audits, 692 markers across 193
source files. **None of that is covered by this batch and none of it should be
read as covered.** Batching was the order; implying otherwise would be the same
failure one level up.

## THE RECOMMENDATION SAM IS BEING ASKED TO RULE ON

**SUPERSEDED BY THE PRICING, SAME DAY.** The recommendation was to guard
`LAW-conservation` first; pricing found it is **already guarded** and that the
real row is `LAW-attributed-content-change`. The revised ask, in order:

1. **XS, and alone:** capture the actual `power_removed` reason for the measured
   case. It may re-aim everything below it.
2. ~~**`LAW-0-registry`'s own gate**~~ — **DONE, and overtaken.** Sam ruled the
   gate is not step 2 of a queue but a STOP: `UNENFORCED` is red from now, and
   nothing but guards, guard-caught fixes and measurement lands while it is.
3. Only then the M-sized work of threading canonicalisation actions out of the
   mutation path (73 call sites).
