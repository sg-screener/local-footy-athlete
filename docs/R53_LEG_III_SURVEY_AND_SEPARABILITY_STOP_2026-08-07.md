# R5.3 LEG (iii) — SURVEYED FREE, but install site 2 of 3 is NOT SEPARABLE — 2026-08-07

Answers `docs/R53_COMMIT_MATERIALISATION_RULING_2026-08-07.md` (`a81cc38a`,
committed as authored) — the ruling that said **BUILD MAY START**.

**Survey done, extraction started, STOP before the surgery.** Nothing built
into `feat/r53-v3-switchover` beyond this report. The blocker is structural
and needs a ruling, not a judgement call from this terminal.

## 1. The survey — legs (iii)+(iv)+basis are BEHAVIOUR-NEUTRAL

Before extracting a line (survey-before-build), the target configuration was
measured on the scaffold across **every suite in `test:bible`** (154 suites,
`test:compile` excluded — see §4), flags-off control versus target:

| config | failures |
|---|---|
| flags off (control) | 6 |
| `LEG_III=1 LEG_IV=1 LFA_BASIS=visible` | 6 |
| **new failures introduced** | **0** |
| **failures fixed** | **0** |

The two failure sets are **identical**. Legs (iii)+(iv) with
`basis=visible` cost nothing and fix nothing across the whole suite set —
which is the green light the ruling's step 1 needed, and it also confirms
that `test:fixture-identity` is **not** fixed by leg (iii) (that remains
leg (v)'s, as the analysis predicted).

The control's 6 include 5 scaffold-only reds (`legacy-census`,
`hydration-upgrade-path`, `calendar-ownership`, `readiness-store-ownership`,
`coach-updates-ownership`) plus `fixture-identity`. **All 5 were verified to
pre-date this pass's tape** by re-running them at `1eb65683` — they are not
mine, and they do not exist on the branch, whose control is 1.

## 2. The module IS separable

`src/rules/derivedWeekContract.ts` (503 lines) lands cleanly: every import it
needs already exists on the branch — `targetWeekFixtures`,
`ownSeasonPhaseForGeneration`, `applyAthleteRemovalTypedReduction`,
`weeklyExposureContractV2`, `sessionRowCounting`. With `provenance` and
`bounded` off (the surveyed configuration) its only flag branches collapse
to constants, so the landed form is the flag-free file.

**Install site 1 of 3** — `acceptedEffectiveWeek.ts`, the read site plus the
`LFA_BASIS=visible` basis — is also separable. It passes
`userRemovalConstraints`, which the branch has. The `removalDecisions` field
that appears beside it in the scaffold belongs to the **removal-record split
ruling**, is absent from the branch, and is **not** required by leg (iii).

## 3. THE BLOCKER — install site 2 of 3 requires LEG (ii)

On the scaffold, leg (iii)'s second install site lives **inside**
`scaffoldSection18TierFour` in `sessionResolver.ts`, whose gate is:

```js
if (!scaffold.SCAFFOLD.legII && !scaffold.SCAFFOLD.legIII) return args.days;
```

That function **is leg (ii)'s tier-4 host** — the §18-as-tier-4 projection.
**The branch has no tier-4 host at all** (verified: no such function
exists). So install site 2 cannot land without landing leg (ii), which this
ruling did not authorise and which the convergence order places elsewhere.

**Install site 3 of 3** — `fixtureMinimalReplan.ts`, the publisher's own
contract-selection line — additionally needs `stripConditioningComponent`
moved from `fixtureMinimalReplan.ts:326` into `rules/sessionRowCounting`
(the branch keeps a private copy; the scaffold moved it to one owner). That
one is a small, contained refactor, not a blocker.

**Why a partial install is not an option.** The scaffold's own comment at
site 3 records what happened when only the read sites were installed: the
publisher went on composing and repairing against the STORED contract, so
the published week carried the stored contract's pattern requirements while
the deriver read the derived ones — `Lower Hinge|7` published against
`Lower Squat|8` derived, which **is** the fixture-identity residual. Landing
2 of 3 sites is a known-wrong state, so this terminal will not do it and
call it leg (iii).

## 4. STOP — the question for the seat

The ruling's step 1 assumed leg (iii) is buildable alone. **It is not, as
scaffolded.** One of these has to be ruled:

1. **Leg (iii) lands with leg (ii)'s tier-4 host** — i.e. the convergence
   order's (ii)+(iii) build together, and the "leg (iii) first" step becomes
   "(ii)+(iii)+(iv) first". The survey already covers (iii)+(iv); (ii) would
   need its own measurement.
2. **A leg-(iii)-only install is authored at the resolver** — a new,
   smaller read site that does not carry leg (ii)'s projection. That is new
   code, not an extraction, and it adds a representation the convergence is
   trying to remove.
3. **Leg (iii) lands at sites 1 and 3 only**, accepting the resolver read
   stays stored-contract — explicitly rejected above as known-wrong, and
   listed only so the option is on the record rather than silently dropped.

Recommendation, stated as a recommendation and not taken: **option 1.** It
is the convergence ruling's own pairing, it removes representations rather
than adding one, and the survey machinery to price (ii)+(iii)+(iv) is
already built and takes one run.

## NOT COVERED

- `test:compile` was excluded from the 154-suite survey: the ported fixture
  fixes hit **+2/+1** errors against the scaffold's baseline. That is a
  scaffold-type artifact, **verified** — the branch's baselines are
  identical (5/4) and `npm run test:compile` **passes on the branch**.
- Leg (ii) was NOT measured. Option 1 needs that run before it can be built.
- The parity conformance gate (ruling step 2) is NOT built — it comes after
  leg (iii) lands.
- Condition 1's re-measure stays parked, as ruled (unparks after step 2).
- No product code changed on the branch this pass.

## L12 — what catches the NEXT one of this class

The class: **a build order that assumes legs are separable because the
FLAGS are separable.** Five independent env flags read as five independent
legs; the code behind two of them shares one host function, so the flags lie
about the shape of the work.

What would catch it earlier: when a ruling orders "build leg X first",
**check X's install sites against the target branch before pricing it** —
one grep per site for whether its host exists. That is the same
executes-on-path discipline applied to code that does not exist yet: a call
site cannot be installed into a host the branch does not have, and the
scaffold hides this because the host is already there for another leg.
