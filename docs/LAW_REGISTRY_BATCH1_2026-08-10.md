# LAW REGISTRY — BATCH 1, THE HONEST MAP (2026-08-10)

**Sam asked the root question and the answer is a number: of 27 laws in Batch 1,
20 have NOTHING holding them.**

> *"how do we make sure all the laws we have written in the past are held up now?
> it feels like i constantly give a fix and a law or whatever and then believe you
> will remember and you never fucking do"* — Sam, 2026-08-10

He is right. This is the measurement, not a promise.

## THE NUMBER

| | count |
|---|---|
| Batch 1 rows | **27** |
| `guarded` (named check, in the chain) | **7** |
| **`UNENFORCED`** | **20** |
| guards naming a script outside `test:bible` | 0 |
| guards naming a script that does not exist | **1, caught and fixed** |

That last line is worth more than the others. The registry's first mechanical
read found a row of mine naming `test:athlete-action-walker`, **which does not
exist** — the real script is `test:action-walker`. A law "guarded" by a
nonexistent script is exactly the failure Sam described, and it survived being
typed by the person who had just looked the guard up. **Resolving the name beat
trusting it, on the first try.**

## WHAT IS ACTUALLY GUARDED (7)

| law | guard | note |
|---|---|---|
| `LAW-totals-or-red` | `test:totals-or-red-law` | **The strongest row. 174 suites arm it, and the law has its own chain script. This is the shape the others should copy.** |
| `LAW-L13-walker-accumulated` | `test:action-walker` | carries a real liveness check (`:323`) |
| `LAW-L14-domain-purity` | `test:bible` → `importBoundaryTests` | PARTIAL — gates imports, not indirect store reads |
| `LAW-LC1-brain` | `test:coach-tab-slice2` | PARTIAL — the truth gate is a PHRASE list |
| `LAW-LC2-change-card` | `test:coach-tab-slice3` | strong: "executable without a card" is unrepresentable |
| `LAW-LC3-nike-bar` | `test:coach-tab-slice3` [6] | **SOURCE ONLY, and the law is about GLASS — the keyboard matrix has never executed** |
| `LAW-LC4-parity` | `test:coach-tab-slice3` [8] | new this pass; covers **1 of 26** action types |

## THE UNENFORCED LIST — SAM PICKS WHAT GETS GUARDED FIRST (20)

**Mechanisable, and these are the ones that bit us this week:**

1. **`LAW-conservation`** — *a pure Move/Swap conserves athlete-owned session
   identities; success implies conservation.* **Rediscovered TWICE.** The
   existing suite is green and in the chain but guards **two paths, not the
   law** — and on 2026-08-10 a move onto a team night deleted a power row (8 in,
   7 out) while reporting *"Done. Session moved."*
2. **`LAW-do-not-lose-the-session`** — the Bible's statement of the same rule.
   **The coach's truth gate can NEVER catch it:** `FORBIDDEN_WHEN_NO_APPLIED` is
   a list of PHRASES, and *"Done. Session moved."* is **true** — a session did
   move. The lie is the deletion beside it, and **no phrase list can see an
   omission.** Conservation is structural; its guard must be structural.
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

**NOT BUILT, BY ORDER:** the gate over the registry, and any guard for any
UNENFORCED row. The seat: *"the first output is the honest map, because a map with
UNENFORCED rows on it is worth more than a guard built in the dark."*

**NOT HARVESTED:** 131 named ruling docs, 15 audits, 692 markers across 193
source files. **None of that is covered by this batch and none of it should be
read as covered.** Batching was the order; implying otherwise would be the same
failure one level up.

## THE RECOMMENDATION SAM IS BEING ASKED TO RULE ON

Guard `LAW-conservation` first, as a **door-level post-condition** — it is the
only row on the sheet that has already cost real content twice, it subsumes
`LAW-do-not-lose-the-session`, and it is the one the seat's item 1 priced. Then
`LAW-0-registry`'s own gate, because until the registry is enforced it is another
document that can rot — which is the disease.
