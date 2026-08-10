# STOP — 42 OF 62 LAWS UNGUARDED, AND THE NEXT MOVES NEED SAM

**LOOP CHECK:** `terminal-runs-past-the-point-of-a-decision` — **sighting 2** (the
conservation order priced WRONG-UNIT after a pass had been spent on it; this).
**COMPRESS: when the remaining work splits into "needs a ruling" and "needs a file
only Sam has", the terminal stops and says so — continuing produces guards nobody
asked for while the blocking questions stay unanswered.** Disposition: **compress**,
and this document is it.

Twenty-two commits, 2026-08-10. **The chain is red by design and stays red.**

## WHAT CHANGED AFTER THIS REPORT WAS FIRST WRITTEN

**The hook that enforces this stop did not implement the exit it was offering.** Its
block text has always ended *"...or a genuine STOP report is committed"* and
**nothing ever looked for one** — so the first version of this report was committed
and the hook blocked anyway. Fixed (`4bb9b2e0`): HEAD's subject must begin
`docs(stop):`. **Sighting 2 of `reason-text-promises-a-mechanism-the-logic-lacks`,
both in that same file** — the first was the `^1\.` numbering artefact.
**COMPRESSION: whatever a gate says in its own failure text is a CLAIM, and a claim
needs a cell.** Mutations both ways: removing the exit reds 1 cell, widening it to
any commit reds 3.

**And a commit message of mine claimed an AGENTS.md edit that had not applied**
(`4bb9b2e0` → corrected in the open at `39c45afd`). No gate reads commit messages;
that is named here as a gap, not proposed as the next build. **It is the day's own
failure mode, committed by the author of the mechanism meant to catch it.**

**None of the blockers below moved.**

## THE NUMBER

| | |
|---|---|
| registry rows | **62** |
| `guarded` | **20** |
| **`UNENFORCED`** | **42** |
| rules a chain suite enforces with no registry row | **21 of 34** |

**20 → 42 OF 62 IS THE RIGHT ANSWER AND IS NOT A REGRESSION. SAM RULED THIS
PLAINLY, 2026-08-10, and it is written here so no future reader treats it as work
going backwards.** No law was added and nothing broke. The denominator grew from
28 to 62 because **the map was wrong** — a sweep found laws with no row at all
(the whole of Process Law L1–L10, the north star itself, every seat law in the
handoffs), so the honest unguarded count grew with it. A number that gets worse
because you finally measured it is the measurement working. **That growth was the
single most useful measurement of the day. Sam's rule from here: it may only
fall.**

## WHAT IS BLOCKED ON SAM, AND NOTHING SUBSTITUTES FOR IT

1. **THE TEMPLATE FILES FROM HIS PARTNER — photos AND HTML.** His own step 1 (UI
   simplification of the Day, Week and Profile screens) cannot open without them.
   **CHECKED FIRST, so this is not a question the repo could already answer:**
   `LAW-mock-first` (registry) and docs/DAY_FIRST_UI_DIRECTION_2026-08-01.md are
   the standing rulings, and MOCK-FIRST is 2-for-2 here; the templates are the
   direction doc, not an inspiration. **Verified: no template asset exists in the
   repo**, so nothing in that phase should be designed until they are in it.
2. **ONE LINE FOR `eas.json`** — Apple ID / App Store Connect app id.
   `submit.production.ios` is `{}`, verified.
3. **~~THE ACCOUNTS DECISION.~~ ANSWERED BY SAM 2026-08-10: LOCAL-ONLY FOR v1.**
   No auth is built and none gets built; everything stays on the phone. Costs
   nothing to honour — there is no auth code in the repo at all, all four paths
   absent, checked. **Recorded DECIDED in `PUBLISH_ROADMAP_2026-08-05.md` (Phase 4
   and the between-4-and-5 list); the open item is deleted, not deferred.**
4. **~~WHETHER v1 IS iPHONE-ONLY.~~ ANSWERED BY SAM 2026-08-10: YES.** Android is
   **OUT of scope for v1**, not deferred vaguely. Recorded DECIDED in the roadmap;
   the one live Android open item (`LFA_PRODUCT_ARCHITECTURE.md`, real-device
   shake-out) is marked out-of-scope-v1.
5. **SIX LAWS THAT NO SCRIPT CAN CHECK**, each with a proposed re-wording in its
   row: `LAW-L4-device-is-arbiter`, `LAW-L10-phone-is-done`, `LAW-rule-dont-ask`,
   `LAW-plain-coach-english`, `LAW-sam-chat-simplicity`,
   `LAW-commit-before-mutation-testing`. **`LAW-sam-chat-simplicity` has no repo
   footprint at all** — chat never reaches the repo, so no repo check can see it.
   Sam either accepts it is held by discipline alone, or re-words it onto a surface
   that is in the repo.

## ~~WHAT IS BLOCKED ON A CONTRADICTION IN THE ORDERS~~ — UNBLOCKED 2026-08-10

**Cut (a), the throwing power-block migration, ~~is a STOP and stays one~~ IS
CLEARED TO PROCEED.** The contradiction was real and it was the SEAT'S, not
Sam's: the order said *"replace with the clean-reset path"*, **that path does not
exist** — zero product files clear storage — so (a) was a deletion PLUS a new
door PLUS an athlete-facing telling, i.e. a BUILD, while the same batch forbade
building. **Sam's actual instruction was "kill it". The no-building-while-red
rule is the seat's own, and the seat yielded it here.**

**The order now:** build the clean-reset door and the athlete-facing sentence,
**then** delete the migration. Scoped minimally — an unreadable stored world
resets and the athlete is told once, in plain words. **No migration, no fallback,
no second attempt to salvage.**

## WHAT IS BLOCKED ON GLASS

Nothing in the coach era has been seen on a device. The scope chooser has never been
tapped; the undo toast over a coach move is OPEN-UNKNOWN; the L-C3 keyboard matrix
has never run. **When Sam's `npx expo run:ios` build lands: scope chooser first, then
the L-C3 matrix, then the coach-tab undo toast.**

## THE OPEN DEFECT THAT IS NOT ATTRIBUTED

**Sam's power row.** Five probes — the §18 weekly budget, both canonicalisation
pushes, both safety-finaliser pushes, the stack path, and a wrapper over
`finaliseWorkoutAfterMutation` covering all 73 call sites — **all counted ZERO** on
the run that loses the row. **Nothing removes it.** And the instrument that reported
*"8 rows in, 7 out"* reads a PROJECTION, so **whether the row was deleted at all is
OPEN-UNKNOWN.** The next probe is one line: stored rows beside projected rows, same
tape. **His real case is conditioning, not power, and is still not closed.**

## NOT COVERED

**42 laws still have nothing holding them, and this stop does not change that.** The
21 rules named by chain suites with no registry row are dated debt, not fixed. Cuts
(c) the V1 home screen and (d) the frozen coach tree are censused but NOT cut — (d)
needs nine source-reading suites re-aimed first. `LAW-doc-truth` and
`LAW-no-completeness-claims` are still open; the second has no measurable violation
to guard against today, which is why no cell was built for it. **No device evidence
exists for anything in this document.**
