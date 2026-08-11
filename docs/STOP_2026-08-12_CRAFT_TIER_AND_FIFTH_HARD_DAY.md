# STOP — the craft rules are ON, the fifth hard day is MEASURED, and the method fault cost more than either

LOOP CHECK `a comparison that cannot prove it removed the thing being compared`
— **sighting 1, NEW.** Three regression comparisons used `git stash push` to
strip the change before re-measuring; all three failed silently on a stale
`.git/index.lock`, so the "before" tree still contained the change and each
returned *"identical — all pre-existing"*. **Two false all-clears were reported
to Sam before the fault was found.** **COMPRESS: this is the same shape
`scripts/sweep.sh` was hardened against on 2026-08-07 (sighting: a `cd` failed
silently and the sweep measured the wrong branch), and the hardening only
travelled because the script was copied.** The compression is a rule, not a
habit: **any A/B measurement must print a world-identity line proving the arm
is what it claims, before it measures.** The corrected runner does
(`craft symbol present in 0 product files (expect 0)`), and that line is what
caught the fourth attempt running dirty.

---

## WHAT SHIPPED

**`2db1b8ce` — the craft validator blocks.** `weekStructureValidator` held Sam's
Section 17 rules with a header saying FINDINGS ONLY, enforcement "a later phase
behind its own approved plan"; three callers, all loggers. It now runs inside
the §18 gateway's `assess` closure — the one place generation, the nine edit
doors, coach revisions, fixture moves, taps and hydration already converge — and
`repairCraftViolationCandidates` MOVES a badly-placed session rather than only
naming it. `test:craft-tier`, 36 cells, 5 mutations killed.
`docs/CRAFT_TIER_BOUNDARY_2026-08-12.md`.

**`a8f13d91` — the fifth hard day, measured.** Step (a) of the seat's topmost
order, and it did not skip to (b).
`docs/FIFTH_HARD_DAY_MEASUREMENT_2026-08-12.md`.

## THE TWO NUMBERS THAT MATTER

**1. The craft tier changes NO generated week today.** Zero `strong` findings
across all 17 `test:qa` scenarios; `test:qa` is byte-identical before and after
(169/16, same list). It shuts the door for edits, moves, coach revisions and
stored weeks. **The felt quality problem was never in the `strong` tier**, and
the unit's own measurement said so before it shipped.

**2. Where the quality problem actually is: EIGHT of seventeen scenarios carry a
fifth hard day, and in SEVEN of them the app put it there** —
`unavoidableAnchorCausedExcess = 0`. Exactly one (S10, three consecutive club
trainings plus a Saturday game) is genuinely forced by the club and correctly
permitted. **The arithmetic that draws that distinction runs on every assessment
and is written to a field with zero readers.**

## THE THREE THINGS THE GUARDS CAUGHT THAT I GOT WRONG

Each one is a guard doing exactly its job, and each is worth more than a green run.

1. **`governedFromISO` has exactly ONE owner inside the gateway.** My repair
   generator read it a second time. `test:gateway-authority-census` red. Fixed
   by having candidate assembly HAND the answer down — a downstream writer is
   never trusted to know the law.
2. **A boundary report opens with a LOOP CHECK.** Mine had it at the bottom.
   `test:repo-law-guards` red.
3. **A deriver asks `resolverMayDisplace` before it displaces anything.** The
   craft tier's first version blocked and MOVED sessions the athlete had
   deliberately placed, including onto G-1 through the app's own ask-flow. Five
   athlete-door suites red: `placement-ownership` (7 cells),
   `g1-landing-ask-flow` (4), `athlete-door-matrix` (3), `displacement-sweep`
   (2), `athlete-session-move` (1). **A quality gate that silently undoes a
   decision is the app overruling a person.** Fixed at that predicate on both
   sides of every move; cells G1-G4, M8-M10.

## STATE OF THE GATES

`test:craft-tier` 36/36. `test:qa` 169/16 (unchanged). `test:repo-law-guards`
34/34. `test:gateway-authority-census` 6/6. All five formerly-regressed suites
green, individually and inside the sweep.

**THE RE-SWEEP IS STILL RUNNING AT THE TIME OF THIS COMMIT** and that is stated
rather than rounded off. It had reached position ~165 of 189 and reproduced the
pre-existing red set EXACTLY — `legacy-census`, `totals-or-red-law`,
`worn-world-boot`, `onboarding-field-influence`, `action-walker`,
`device-pass-2026-08-05`(+evening), `fixture-identity`, `operation-ownership`,
`fact-door-inputs` — **with zero new entries**. The tail from
`action-walker:deep` onward (~24 suites) is UNSWEPT; in the earlier full sweep
that tail contributed only `dev-e2e-seeds`, `dev-e2e-scenario-session` and
`law-registry`, all three confirmed pre-existing against a verified-clean tree.
**`.sweep/fails-craft-tier-final.txt` is the live file; read it before trusting
this paragraph.**

## WHAT THE NEXT SEAT PICKS UP

1. **Step (b) of the fifth hard day** — flip `default_target_miss` to blocking
   when the excess is app-selected. **Priced in §4 of the measurement report and
   deliberately not started**: it turns 7 of 17 scenarios blocking at the gate
   every write door converges on, it needs `repairByStackingCandidates` taught
   this trigger or nothing improves, it needs athlete-placed hard days exempted
   by `resolverMayDisplace`, and it carries one open risk —
   `authorisedUnavoidableAnchorExcess` is an INPUT, S10 is the only observed
   non-zero, **and if that input is under-supplied, (b) blocks weeks the club
   really did force.**
2. **The game day (inbox item 2)** — the only listed defect an athlete can see
   today. `quiescentBoot.ts:337` derives the recurring fixture from
   `profile.gameDay` alone and skips `'Varies'`, so a Wednesday game is lost on
   relaunch. **Found while reading: `resolveEffectiveGameDay(usualGameDay,
   gameDay)` ALREADY EXISTS at `sessionResolver.ts:522` and already handles all
   seven days — five sites call it and boot is not one of them.** The live fix
   is that one call site; the one-owner sweep over ~140 occurrences in 34 files
   is the unit behind it.
3. Items 3-5 unchanged.

## AWAITING SAM

- **Hydration can now MOVE a session in a week already on his phone.** A stored
  week whose hard lower sits on G-2 is swapped at next launch, disclosed as
  `craft_violation_relocated`, not attributed to the athlete. **One line to
  change if a week must stay exactly as he last saw it.**
  `docs/CRAFT_TIER_BOUNDARY_2026-08-12.md` §6.

## NOT COVERED

- **Nothing in this session ran on a device or a simulator.** Every verdict is
  node suites.
- **The re-sweep tail (~24 suites) is unfinished**, as stated above.
- **The craft tier's exercise-level rules are unproven on generated content** —
  QA scenarios carry unpopulated strength sessions, so heavy-hinge-plus-sprint,
  COD-plus-heavy-lower and the neural-primer exception had nothing to classify.
  Largest open number in the craft unit.
- **The hard-day probe measures the QA harness's resolved weeks, not
  `generateProgramLocally` output.** They share `buildCoachingPlan` and the same
  contract builder, but a generated program also passes the §18 gateway and the
  top-up pass, and those were not measured.
- **The `soft`/`info` craft tier still blocks nothing**, by ruling 2. That is
  where six of the QA scenarios' complaints live.
- No mutation testing of the pre-existing red suites; whether each is red for
  the reason its name suggests is unexamined.
