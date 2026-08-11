# THE CRAFT VALIDATOR IS ON — and it does not just complain, it moves the session

LOOP CHECK `enforcement-deferred-then-forgotten` — sighting 4, and this unit is
the **payment** on sighting 3 rather than a new instance of it. **COMPRESS: the
header was the tell.** `weekStructureValidator.ts:5-8` announced its own
inertness in writing for a month and no gate read the announcement. Verification
item 7 (`subject: 'doc' | 'behaviour'` on registry rows, red when a behaviour
law's only consumer is a logger) would have caught this one automatically — it
is still the right next fix, and it is now one sighting better funded.

**Order:** `docs/SEAT_INBOX.md` item 1, from `docs/ATLAS_VERIFICATION_2026-08-12.md`
§1. *"`weekStructureValidator.ts` holds Sam's Section 17 craft rules and is
FINDINGS-ONLY by its own header; its three callers all just log. Put
`validateProgramWeek` into the §18 gateway's `assess` closure as a blocking tier
for `severity: 'strong'`, and close the two seams that would escape it."*

**Status: BUILT, GATED, MUTATION-TESTED. Not on a device.**

---

## §1 WHAT LANDED

**One new owner: `src/rules/section18CraftTier.ts`.** It turns a visible week
plus its contract into a Section 17 verdict, and it is the only thing in the app
that decides what "blocking craft violation" means.

**One seam: `section18AcceptedWeekGateway`'s `assess` closure.** The craft tier
now runs on the same `visibleWorkouts` the §18 evaluator judges, and a candidate
is accepted only if BOTH agree. Because generation, the nine edit doors, coach
revisions, fixture moves, taps and hydration all already converge on that
closure, **one edit retro-fitted every path at once** and no future door has to
be told.

**One new repair generator: `repairCraftViolationCandidates`.** This is the part
that makes the tier worth having. Without it the tier would only DISCLOSE — a
second opinion nobody reads, wearing a new hat. A craft finding names a day and
a session, and a Section 17 violation is nearly always a session on the wrong
DAY rather than a session that should not exist. So the repair is a MOVE: onto
an empty day when the week has one, otherwise a SWAP with another day's session.
Nothing is created or destroyed. Measured on the first week it ran against: a
six-day in-season athlete has **no** empty day, so a move-only generator produced
zero candidates and every violation fell through to disclosure — the swap is not
an optimisation, it is the only move that works on a full week.

## §2 THE FOUR RULINGS THAT DECIDE WHAT BLOCKS

1. **`strong` and above, never `soft`/`info`** — the validator's own severity
   policy (approved 2026-07-08).
2. **Only findings that name a day the week can still change.** Days before the
   contract's `governedFromISO` are FACTS. Blocking on the past makes a week
   unrepairable for a reason no repair can reach. **Findings that name no day at
   all — the weekly caps — are disclosed but never blocking: those are COUNTS,
   and counts are already the §18 evaluator's own question in its own
   vocabulary. The craft tier owns SHAPE; the contract owns COUNT.** Two
   owners, no overlap.
3. **A SESSION THE ATHLETE PLACED IS NEVER BLOCKED AND NEVER MOVED.** Found
   and disclosed, never enforced. `resolverMayDisplace` is THE ONE PREDICATE
   and every deriver in the app already asks it before replacing a day's
   content. **The first version of this tier was a deriver that did not ask,
   and it was wrong** — see §7.
4. **A craft violation may fail a CANDIDATE; it may never veto a FACT** — the
   same ruling the gateway already lives under (§18 ownership reassessment
   2026-08-05, D3). If the search can reach a week without the violation it
   takes it. If it cannot, the week publishes with the violation disclosed as
   `craft_violation_disclosed` rather than throwing. **Without this, a stored
   week built before the tier existed would stop hydrating and the app would
   refuse to open on its own history.**

An internal validator error becomes ONE blocking finding, not silence. Swallowing
it would re-create the exact failure this unit exists to end.

## §3 THE TWO ESCAPING SEAMS

- **`applyOptionalTopUps`** — CLOSED, in the shape a top-up already has.
  `withCraftSafeTopUps` runs the tier before and after the pass; a placement that
  introduces a violation is simply **not added**. A violation the week already
  had never withholds anything. The existing argument for the pass running after
  acceptance ("a top-up is incapable of affecting compliance or load") holds for
  COUNTS and does not hold for SHAPE, which is exactly how it was escaping.
- **`SAFE_PATTERN_FALLBACK` (`section18SafetyFinaliser`)** — CLOSED FOR FREE, and
  measured rather than assumed. All three of its call sites
  (`section18AcceptedWeekGateway:1248`, `programStore:906`,
  `postGenerationConstraintValidation:1265`) run *immediately before* a gateway
  entry, so its late-injected rows are inside the assessed week by construction.
  Cell C5 pins it: the result's craft verdict recomputes exactly from the
  SELECTED visible week.

## §4 THE MEASUREMENT — AND THE PART OF SAM'S QUESTION THIS DOES NOT ANSWER

**Before the wiring, across all 17 `test:qa` scenarios the Section 17 kernel
emits ZERO `strong` findings.** `test:qa` is byte-identical before and after this
unit (169 passed, 16 failed, same list). **Turning the tier on changes no
generated week today.**

That is the honest headline and it cuts both ways:

- **No regression risk on generation, and the door is now shut** for every edit,
  move, coach revision and stored week — which is where a hard lower lands on
  G-2 in real life.
- **But "the programming is shit" is NOT mainly a `strong`-tier problem.** What
  the 17 scenarios actually produce is a wall of `soft`/`info`: `5 hard days`
  on S1/S2/S11/E2/E3/S13, `0 running days` on S5/S6, `conditioning under target`
  on S5. Those are real quality complaints and this tier deliberately does not
  block on them (ruling 2 — they are counts, and the contract owns counts).
- **And the kernel is partly blind in QA**: the scenarios' strength sessions
  arrive unpopulated ("3 strength sessions need AI population"), so every
  exercise-level rule — heavy hinge + sprint, COD + heavy lower, the neural
  primer exception — has nothing to classify. **The tier's exercise-level reach
  is unmeasured on generated content and is the largest open number here.**

## §5 GATES

New suite `test:craft-tier` (`src/__tests__/section18CraftTierTests.ts`), in the
`test:bible` chain immediately after `test:section18-gateway`. **36 cells, 0
failed.** Totals-or-red armed.

**Five real mutations, each killed by the right cells:**

| Mutation | Reds |
| --- | --- |
| craft dropped from the `accepted` predicate (tier back to advisory) | C3, C6, M4, M6 |
| `repairCraftViolationCandidates` removed from `localRepairCandidates` | C3, M6 |
| `withCraftSafeTopUps` returns everything unfiltered | E1, M5 |
| the tier ignores athlete placement | G2, M8 |
| the repair generator ignores athlete placement | G4, M10 |

C1 was rewritten after the first mutation run: it originally asserted a STATUS,
and an unrelated `weekly_power_budget` repair already moved the week off
`accepted`, so it passed with the tier switched off. **A vacuous cell in the
suite that exists to prove a gate bites.** It now asserts over the result.

**Full `test:bible` sweep:** 22 of 189 red. Each was re-run on a tree with the
three product files reverted, under a printed world-identity check
(`craft symbol present in 0 product files`). **17 are pre-existing** —
`test:law-registry` (red on purpose, 32 laws UNENFORCED), `totals-or-red-law`,
`legacy-census`, `worn-world-boot`, `onboarding-field-influence`,
`action-walker`, `action-walker:deep`, `device-pass-2026-08-05`(+evening),
`fixture-identity`, `operation-ownership`, `fact-door-inputs`, `dev-e2e-seeds`,
`dev-e2e-scenario-session`, plus `test:week-validator` and `test:qa` measured
separately. **Two were caught by guards and fixed**
(`gateway-authority-census`, `repo-law-guards`). **Five were REGRESSIONS I
introduced — see §7.**

**RE-SWEEP after the §7 fix — COMPLETE, and it closes exactly.**
`SWEEP RESULT: label=craft-tier-final failures=14 of 189`
(`.sweep/fails-craft-tier-final.txt`). **All fourteen are the pre-existing set,
name for name, from the verified-clean baseline** — `legacy-census`,
`totals-or-red-law`, `worn-world-boot`, `onboarding-field-influence`,
`action-walker`, `action-walker:deep`, `device-pass-2026-08-05`(+evening),
`fixture-identity`, `operation-ownership`, `fact-door-inputs`, `dev-e2e-seeds`,
`dev-e2e-scenario-session`, `law-registry`. **ZERO new reds**, and all five
formerly-regressed suites green inside the sweep (`athlete-session-move`,
`g1-landing-ask-flow`, `placement-ownership`, `displacement-sweep`,
`athlete-door-matrix`). The baseline arm reported the same fourteen, so the two
arms agree on the whole set and differ nowhere.

## §7 THE FIVE REGRESSIONS, AND THE METHOD FAULT THAT NEARLY HID THEM

**The tier's first version blocked and relocated sessions the ATHLETE had
placed.** Five suites went from green to red:
`test:placement-ownership` (7 cells — every "SWAP/ADD/MOVE onto G-1 survives the
resolver once routed" row), `test:displacement-sweep` (2),
`test:g1-landing-ask-flow` (4), `test:athlete-session-move` (1),
`test:athlete-door-matrix` (3). **All five are athlete-door suites and the
signal was unmistakable once it could be seen: a quality gate was silently
undoing decisions.** `resolverMayDisplace` is THE ONE PREDICATE for exactly
this, its own header says a new deriver fails the sweep until it answers the
question too, and it did. Fixed at that predicate on both sides of the move —
the source and the swap target — plus the blocking filter. Cells G1-G4, M8-M10.

**THE METHOD FAULT IS THE BIGGER FINDING.** The first three comparison runs used
`git stash push` to strip the change before re-measuring, and every one of them
failed silently on a stale `.git/index.lock` left by an earlier failed pop.
**The "before" tree still contained the change, so the comparison compared the
change to itself and returned "identical — all pre-existing".** Two of those
false results were reported. The correct run used a scripted revert with a
PRINTED world-identity line (`craft symbol present in 0 product files (expect
0)`), copied from `scripts/sweep.sh`'s own mandatory preamble — and that
preamble is what caught the fourth attempt running dirty. **A comparison that
cannot prove it removed the thing being compared is not a measurement.** It is
the same shape `sweep.sh` was hardened against on 2026-08-07, in a different
tool, and the hardening only travelled because the script was copied.

## §6 THE THING THAT NEEDS SAM'S EYE

**Hydration can now MOVE a session in a week that is already on his phone.** A
stored week whose hard lower sits on G-2 will be swapped at the next launch, and
the change is disclosed in the gateway log as `craft_violation_relocated` — but
it is not attributed to the athlete, because the athlete did not ask for it. That
is the same shape as the relocations the gateway already performs at hydration,
so it is not new machinery; it is newly REACHABLE. **If a week is supposed to
stay exactly as the athlete last saw it, this is the line to change, and it is
one line.**

## NOT COVERED

- **Nothing here ran on a device or a simulator.** Every verdict is node suites.
- **The exercise-level rules are unproven on generated content** (§4) — QA
  scenarios carry unpopulated strength sessions.
- **The `soft`/`info` tier still blocks nothing**, by ruling 2. The `5 hard days`
  finding on six of seventeen scenarios is untouched by this unit.
- **The craft repair only relocates.** It never substitutes, never reduces,
  never edits rows. A violation that cannot be answered by a move is disclosed.
- **Athlete-placed sessions are never blocked and never moved** (ruling 3), so
  a week the athlete has arranged badly stays arranged badly and is only
  disclosed. That is deliberate; whether the disclosure ever reaches a SURFACE
  the athlete reads is not built and not measured.
- **Anchor days are never a source or a target** — a club night or a fixture is
  not the app's to move. A craft violation ON an anchor day therefore always
  falls through to disclosure. Not measured how often that is.
- The three advisory `log*` callers were left alone; only the module header's
  false "FINDINGS ONLY / enforcement is a later phase" claim was corrected.

**NORTH STAR:** toward. **No new stored state.** The craft verdict is DERIVED at
the gate on every assessment and stored nowhere; the only thing that persists is
the week itself, which was already stored. The unit removes a representation
rather than adding one: "what the Bible says about this week's shape" had two
answers — an advisory logger and nothing — and now has one owner that decides.
