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
| `acceptedStateTransaction.ts:1847` | `args.markedDays` (**BEFORE**) | no |
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

**WHAT IS ACTUALLY KNOWN:** the authority for week `2026-07-20` contained
`2026-07-18` — a fixture the move had cancelled — on some calls and not others.
**Why is OPEN.** One untested hypothesis, recorded as a hypothesis:
`effectiveFixtureDatesForWeeks` adds the RECURRING anchor for any week with no
explicit `game` mark, and the athlete's profile still says `usualGameDay:
Saturday`. A moment in which the old mark is cleared and the new one is not yet
written would therefore have the recurring rule re-supply the very fixture being
moved away from. **That is a guess. It has not been measured, and this section
has already been wrong once by reasoning instead of measuring.**

**IT DOES NOT BLOCK (b) OR (c)**, which stand on their own evidence.

**(b) `UNDEFINED` IS NOT REACHABLE IN PRODUCTION.** In production the ONLY
caller of `fixtureMinimalReplan` is `acceptedStateTransaction` (verified by
import census: one non-test importer), and both of its call paths compute the
authority unconditionally. The replan's own inner type declares it **required**
(`fixtureMinimalReplan.ts:2148`, `activeFixtureDates: ReadonlySet<string>`, no
`?`). **Every `UNDEFINED` observed came from suites calling
`runSection18AcceptedWeekGateway` directly, which is the harness entering below
the door.** The optional `?` on the gateway's own input is what let it.

**(c) THE ONE REAL QUESTION, AND IT IS SMALL.** Which snapshot should the CRAFT
TIER judge a candidate week against? It judges a week that is being PROPOSED, so
the answer is almost certainly the AFTER world — but it is currently handed
whichever snapshot its call path happens to hold. **That is one decision, not
six, and it is an ownership question rather than a Sam ruling.**

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

**The regression that forced the revert is explained by this census.** The
`test:accepted-state-transactions` property that broke asserts the FOLLOWING
week's G+1 dependency after a fixture move. Attempt 1 removed the invented
neighbour and the honest one did not arrive — because on that path the craft
tier was reading a snapshot that did not contain it. **That is (c), not a reason
to keep inventing fixtures.**

## §4 THE CHANGE THAT WAS WRITTEN AND REVERTED — recorded so it is not re-tried

Making `effectiveFixtureDatesForWeeks`'s `profile` optional and removing the two
`profile ? … : undefined` guards, on the reasoning that an explicit `game` mark
is a calendar fact needing no profile.

**Reverted: measured before and after, `173101` undefined-authority calls
BOTH TIMES — identical.** The change is inert on every path any suite exercises,
because the undefined values come from §2(b)'s direct gateway calls, not from
the guarded sites. **A confident comment over an inert change is exactly the
shape this repo keeps cataloguing**, so it is not in the tree. The reasoning may
still be right; it is simply unproven, and §3 item 1 addresses the same problem
where it is actually reachable.

## §5 STATUS

- **MEASURED** — the four call sites and their snapshots; the import census
  proving one production replan caller; the required-vs-optional declarations;
  the before/after 173101 identical counts.
- **WORKING** — nothing. **The tree is unchanged by this pass.**
- **WITHDRAWN** — §2(a)'s first answer (a "before snapshot") and §3's first
  step (a required field). Both were reasoned rather than measured, and both
  were wrong. They are struck through rather than deleted so the next pass does
  not re-derive them.
- **OPEN** — why a cancelled fixture appears in an AFTER-world authority
  (§2(a)); one unmeasured hypothesis is recorded there as a hypothesis.
- **NOT INVESTIGATED** — whether `derivedSessionProvenance`'s
  `exactFixtureDatePresent` (`:417-425`), which reads the same optional set and
  falls back to a contract-shape check when it is absent, has the same
  test-only exposure. Same shape, not measured.
- **NORTH STAR: neutral.** Nothing stored, nothing derived; this reports.
