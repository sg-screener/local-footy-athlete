# LAW REGISTRY — BATCH 2: THE AUDIT, AND THE REGISTRY WAS WRONG ON DAY ONE

**LOOP CHECK:** `law-recorded-but-not-held` — **sighting 4**, and this time
inside the instrument built to stop it. The registry was one day old and already
carried a misfiled law and four ghost citations. **COMPRESS: a registry row is a
CLAIM about a source, and a claim about a source is checkable by resolving it —
so the next guard to build is the one that resolves every `ruledAt` the way
`test:law-registry` already resolves every `by`.** That single check would have
caught all five of the defects below mechanically, on the day the file landed.

Seat inbox item 000(A), 2026-08-10. Sam: *"any change or fix now seems to take a
whole day for 1 little thing… i just want the most elegant solution - and if we
do that and put the right rules in THEN I SHOULD STOP HAVING TO DEAL WITH THE
SAME FUCKING PROBLEMS OVER AND OVER AND OVER AGAIN"*.

## THE NUMBER

| | before | after |
|---|---|---|
| rows | 29 | **59** |
| `guarded` | 10 | **10** |
| **`UNENFORCED`** | 19 | **49** |

**The count going UP is the correct result and it is the last time it may.** The
19 was never the truth; it was the size of the horizon the first batch happened
to look at.

## PART 1 — WHAT THE AUDIT FOUND IN THE EXISTING ROWS

Every row was read against the file and line it cites. Five defects, and the
seat had caught only the first.

1. **`LAW-liveness` CARRIED A DIFFERENT LAW THAN ITS ID NAMED** *(the seat's
   catch, confirmed)*. Its text is *"a green gate is a claim"* — the GATE law.
   The law the id names — *a terminal ENDS ITS TURN at every report and is
   STOPPED until typed at* (2026-08-09 handoff §2, Sam-forced) — **had no row at
   all.** Split: the row is renamed `LAW-green-gate-is-a-claim`, the old id is
   **retired and must never be reused**, and `LAW-terminal-is-stopped-after-a-report`
   is added.

2. **AND ITS CITATION WAS A GHOST TOO** *(not caught before; this audit)*.
   `ruledAt` read `AGENTS.md; memory law "A green gate is a claim"`. **grep over
   AGENTS.md for that phrase returns NOTHING.** The law lives in the terminal's
   private memory index and in boundary reports that cite it as ruled. **A law
   Sam cannot grep is a law Sam never ruled**, and its row now says so and asks
   for a ruling site.

3. **`LAW-totals-or-red` CITED A SECTION THAT DOES NOT CARRY IT — ON THE
   REGISTRY'S STRONGEST ROW.** It cited `AGENTS.md "Test Standard"`. That section
   is four bullets about invariant tests; **grep for "totals" over AGENTS.md
   returns ONE hit, inside a different law's worked example.** Corrected to the
   real site: `src/__tests__/support/totalsOrRed.ts`, quoting Sam 2026-08-03.
   **The best-held law in the file had the worst citation, which is exactly the
   asymmetry that makes a registry worth having.**

4. **`LAW-do-not-lose-the-session` CITED "Training Bible, Move rules". THERE IS
   NO SUCH SECTION.** `docs/LFA_PROGRAMMING_BIBLE.md` carries move guidance as
   prose bullets and has no Move rules heading.

5. **`LAW-doc-truth` and `LAW-seat-coordination` BOTH OVERCLAIMED AGENTS.md.**
   Doc-truth is mentioned there once, in passing, inside another law; it is ruled
   in the 2026-08-09 handoff §2. Seat-coordination's *"terminal-owned blockers
   live below"* half appears only in `SEAT_INBOX.md`'s own prose and was never
   ruled into AGENTS.md at all.

Also corrected: **`LAW-anchor-smallest-declaration` stated a law its source does
not state.** "Smallest declaration" appears nowhere in AGENTS.md. What the cited
section rules is *any assertion locating something by POSITION must prove every
anchor was FOUND*. Renamed `LAW-anchor-must-be-found`; the smallest-declaration
phrasing is folded in as practice rather than quoted as a ruling. And
`LAW-0-registry` still carried the *"or an explicit UNENFORCED row"* clause Sam
withdrew hours earlier.

**FIVE OF SIX DEFECTS WERE CITATIONS THAT DO NOT RESOLVE.** That is a class, and
it has a mechanical answer — see the LOOP CHECK line above.

## PART 2 — THE THIRTY LAWS WITH NO ROW

**PROCESS LAW L1–L10 (ten rows).** `docs/MASTER_PLAN_2026-07-23.md` PART 1.
Batch 1 harvested L11–L16 from AGENTS.md and stopped where AGENTS.md stops —
line 433 says L1–L10 live in the master plan, and nobody followed it. **The
registry inherited its predecessor's horizon**, which is the same failure it
exists to cure, one level up.

**THE NORTH STAR HAD NO ROW.** *"Store only decisions; derive everything else."*
`CLAUDE.md` orders it read FIRST and every boundary report states whether the
unit moved toward or away from it — **by hand, in prose, judged by the author of
the change.** The worst absence on the sheet.

**EVERY SEAT LAW.** BIBLE-FIRST, RULE-DON'T-ASK, the JUDGMENT LEDGER, the BATCH
RULE, plain coach English, VISIBLE-FIRST, the SAM CHAT rule, MOCK-FIRST, the
FORMAT LAW's LOOP CHECK line, NO-COMPLETENESS-CLAIMS, SECOND-WALL, the
LOOP-AUDIT law, sweep-not-serial, census-before-retirement, and the STANDING
DERIVATION ruling.

**THREE ENVIRONMENT LAWS**, each learned from a real loss: verify the branch
before every commit; commit before mutation-testing; never commit secrets.

**A FIFTH GHOST, FOUND IN THE SWEEP.** `LAW-sweep-not-serial` — the handoff's §6
cites *"the sweep rule"* as already existing, and describes its own violation of
it. **grep finds no statement of the rule anywhere in the repo.** Its row says
the first thing a guard would take is writing the law down.

## PART 3 — WHERE LAWS COLLAPSE (item 000(C), applied before any guard)

Sam invoked `LAW-elegant-two-options` by name. **49 guards is 49 more things to
maintain.** Four collapses are named in the rows themselves, each one structural
check standing for several laws:

1. **THE LOOP CHECK LINE IS LOAD-BEARING, NOT CEREMONY.** `LAW-loop-check-line`
   already requires every report to carry `sighting N`. Read that number and
   **`LAW-second-wall` (alternative at N≥2), `LAW-loop-audit` (compression at
   N≥3) and `LAW-coach-escalation` all become the same check.** Four laws, one
   guard.
2. **A CLAIM CARRIES A RECEIPT OR IS MARKED UNKNOWN.** `LAW-claim-needs-a-cell`,
   `LAW-doc-truth`, `LAW-no-completeness-claims` and the receipt half of
   `LAW-terminal-is-stopped-after-a-report` are one law in four dialects.
3. **SUCCESS IS DERIVED FROM THE TRANSACTION, NEVER COMPOSED BESIDE IT.**
   `LAW-L6-honest-actions`, `LAW-attributed-content-change` and
   `LAW-do-not-lose-the-session` — **this is the 2026-08-10 defect's own class**
   (*"Done. Session moved."* beside a deleted row) and the phrase-list truth gate
   provably cannot hold it.
4. **THE PERSISTED-KEY RATCHET.** `LAW-north-star` and `LAW-standing-derivation`
   are one mechanism: enumerate what reaches disk and red on a new key with no
   declared input classification. `test:stored-state-writer-audit` already
   enumerates the stores; it does not ratchet the keys.

**Also cheap and standalone:** the secret scan (`LAW-no-secrets-committed` — the
largest gap in the file between the cost of a violation and the cost of its
guard), the NOT-COVERED heading check (`LAW-L2`), and the branch-before-commit
hook (`LAW-verify-branch-before-commit`).

## WHAT IS NOT CLAIMED

**This sweep is not exhaustive and does not claim to be.** It started from the
seat's list and did not stop at it, but **131 named ruling docs remain
unharvested** and none of them is covered. The Bible's own coaching rules are not
in this file at all.

**Six rows are marked as genuinely un-mechanisable and carry a PROPOSED
RE-WORDING for Sam** rather than a quiet UNENFORCED: `LAW-L4-device-is-arbiter`,
`LAW-L10-phone-is-done`, `LAW-rule-dont-ask`, `LAW-plain-coach-english`,
`LAW-sam-chat-simplicity`, `LAW-commit-before-mutation-testing`. **`LAW-sam-chat-simplicity`
is the only row in the file with no repo footprint at all** — chat never reaches
the repo, so no repo check can see it. **That one needs Sam's call, not a
guard.**
