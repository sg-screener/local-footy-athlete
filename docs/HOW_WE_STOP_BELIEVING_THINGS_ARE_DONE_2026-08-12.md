# HOW WE STOP BELIEVING THINGS ARE DONE — Sam already solved this once

LOOP CHECK `enforcement-deferred-then-forgotten` — **sighting 9, and this is the
sighting that names the whole class.** Every finding on 2026-08-12 is one shape:
**something was built, written down, believed, and never consumed.** This
document is the compression, and it is not a new invention — **it is Sam's own
2026-08-10 answer, pointed at features instead of laws.**

**Sam, 2026-08-12:** *"there's a lot of things that have been built in the past
that i believed were in the actual app working but maybe they were just written
down and then not included in the app - i want to stop that from happening now
otherwise we will never finish and we will continue doing the same work over and
over again and getting confused - how do we make sure this happens"*

**Sam, 2026-08-10, `lawRegistry.ts:8`:** *"how do we make sure all the laws we have
written in the past are held up now? it feels like i constantly give a fix and a
law or whatever and then believe you will remember and you never fucking do"*

**SAME QUESTION, TWO DAYS APART. He asked it about RULES and built the answer. He
is now asking it about FEATURES and the answer has not been pointed there yet.**

---

## §1 WHY THE LAW REGISTRY WORKS — copy this exactly

`src/rules/lawRegistry.ts:31-41`, verbatim:

> `guarded` names the cell/tape/gate that FAILS when the law breaks.
> `UNENFORCED` names, in one line, what a guard would take.
> There is deliberately **no third state**. *"Important, everyone knows it,
> nobody checks it"* is the state that produced this week, and a union of two
> makes it unrepresentable.

Three properties do the work, and **all three are load-bearing:**

1. **TWO STATES, NO THIRD.** There is no "built", no "should be fine", no "done
   pending tests". **The state that produced every defect found today is
   unrepresentable.**
2. **A GUARD OUTSIDE THE CHAIN COUNTS AS NO GUARD.** `chainStatus:
   'outside_chain'` — *"a check nobody runs is not a check."*
3. **THE NUMBER MAY ONLY FALL.** Measured today: **99 rows, 65 guarded, 33
   UNENFORCED.** Sam sees one number and never has to remember anything.

**This is the only thing in the repo that has actually held. Do not design a
second mechanism.**

## §2 THE MOVE — a FEATURE registry with the same two states

Every feature is exactly one of:

- **`held`** — names the test that FAILS if the feature is removed or broken.
- **`UNPROVEN`** — names, in one line, what a proof would take.

**No third state.** "Built but nothing checks it" is precisely what Sam is
describing, and it must not be writable.

**FEATURES NEED ONE FIELD LAWS DO NOT: `reachable`.** A law is held by a test. A
feature also needs a human able to GET to it. Today's census found **49 tap sites
no athlete can reach** and **two sheets mounted with no trigger** — code that
every static instrument reports as shipping. So a feature row must answer two
questions, and **a feature that is `held` but not `reachable` is not shipped:**

| | Does the code do it? | Can a person reach it? |
| --- | --- | --- |
| Held by | a named chain test | a named flow/walker step |
| Failing that | `UNPROVEN` | `UNREACHABLE` |

## §3 THE THIRD PIECE, AND IT IS THE ONE THAT WOULD HAVE SAVED SAM

**The registry protects the repo. It does not protect the CONVERSATION.** Sam
believed things were working because a document or a message said so. **So the
word "done" is retired.** Every report to him uses one of three words:

- **WORKING** — a named test fails if it breaks. Name it.
- **BUILT** — the code exists; nothing checks it. **Say this even when confident.**
- **WRITTEN** — a document says it; no code. **Say this even when the doc is good.**

**"Done", "shipped", "in", "handled" and "sorted" are banned.** They collapse
three states into one, and that collapse is the entire problem.

**THIS APPLIES TO THE SEAT'S OWN CLAIMS FIRST.** Three times on 2026-08-12 the
seat told Sam something it had not checked. See
`seat-verify-before-telling-sam` in project memory.

## §4 THE THREE DETECTORS — one per failure mode, all already scoped

| Mode | What it looks like | Detector | Status |
| --- | --- | --- | --- |
| **Written, never consumed** | a value computed every time, zero readers | `LAW-computed-must-be-consumed` — a `noUnusedWrites` gate over `contract.*` and exported rule outputs | scoped, `HOW_TO_BUILD_THIS_APP` §4 |
| **In the code, not reachable** | mounted with no trigger; a screen with no route | the walker pass `LAW-L5-no-dead-affordances` already names — *"Nothing enumerates controls"* (`lawRegistry.ts:916-923`) | UNENFORCED |
| **Claimed in prose, never built** | a ruling doc with no row | the harvest ratchet — every named ruling doc produces a row or joins a dated, shrink-only debt list | scoped, `ATLAS_VERIFICATION` §4 item 7 |

**Nine values, 49 controls and 131 unharvested ruling docs were found today by
hand. All three detectors are cheap and none exists.**

## §5 WHAT TO DO, IN ORDER

1. **Retire the word "done" today.** Costs nothing, needs no code, and it is the
   half that failed Sam personally. Starts with this seat.
2. **Build `LAW-computed-must-be-consumed`** — the widest net for the least work,
   and it catches the class that produced most of today's findings.
3. **Add the feature registry**, two states, `reachable` beside `held`, seeded
   from what is already known to be UNPROVEN. **Seed it honestly and let it be
   ugly** — the law registry opened at 32 UNENFORCED and that number is what
   made it useful.
4. **The walker pass**, so `reachable` is measured rather than asserted.
5. **The harvest ratchet**, so prose cannot hide.

**THE TEST OF WHETHER THIS WORKED:** Sam should be able to ask *"is X in the
app?"* and get a number, not a memory — **and should never again need to ask,
because the count is on the screen and can only fall.**

## NOT COVERED

- **Nothing here is built.** All five items are proposals. **This document is
  itself in state WRITTEN, and saying so is the point.**
- The law registry's own guards were spot-audited at 5 of 63 rows on 2026-08-12;
  **the other ~58 are unexamined**, and two rows are held by grepping a markdown
  file for a word. **The mechanism being copied is good, not proven.**
- No estimate is given for any of the five items. None has been priced.
- Whether a feature registry can be seeded without a census of features is
  **OPEN-UNKNOWN** — the seeding cost is the real unknown here.
