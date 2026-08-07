# R5.3 — the tier-4 write is NAMED: the safety finaliser, ignoring a boundary the contract already carries — 2026-08-07

LOOP CHECK: a law enforced by ONE owner while its sibling owners in the same
chain never learned it — **sighting 4** of this family in the ledger
(one-predicate-four-uncounted-copies; the §18 role's five writers; week
identity's two owners; the anchor's two install doors) — **COMPRESS**, proposal
in §7.

Answers SEAT_INBOX item 1(b). **Attribution only — NOTHING BUILT.** Instrument
at `b5918f9d` on `scratch/r53-pricing-7-probe` (which now also carries the
previously unreferenced `271a7be4`), inert unless `LFA_TIER4_TAPE` names a file.

## 1. The instrument, and its controls

Both endorsed laws obeyed, by construction:

| law | how |
|---|---|
| cross-process instruments write to a FILE | `appendFileSync` to `LFA_TIER4_TAPE`; every record carries its own `pid`, so `runAllForked`'s `spawnSync` children land in the same tape |
| a zero is a claim — positive control in the SAME run and process model | `tape-init` (the channel works from THIS pid) and `tier4-entry` (the host executes in THIS suite, emitted **before every early return**) |

**Controls fired.** Full-suite run, `LFA_SCAFFOLD_LEG_II=1`:
`tape-init` **13** (one per forked scenario — every scenario that resolves a
week), `tier4-entry` **6,947**, `tier4-result` **6,947**, 13,907 records total.
Suite result **12 passed / 2 failed**, reproducing the recorded arm exactly.

No zero is relied on anywhere in this report.

## 2. The write, named — and it is a READ-TIME write

The two failures are `t4-illness_severe` and `t4-cooked_week`, both:

```
2026-07-20 "Mixed/core/High/4ex"        → "Mixed/core/Moderate/5ex"
2026-07-21 "Team Training/core/High/3ex" → "Team Training/core/Moderate/3ex"
```

The tape's five tier-4 calls made *by the test itself*, for week 1:

| test line | tier 4 INPUT (Mon) | tier 4 OUTPUT (Mon) | repairs |
|---|---|---|---|
| `:379` (`before`) | Mixed/core/**High**/4ex | Mixed/core/**High**/4ex | `weekly_power_budget` |
| `:385` (`after`) | Mixed/core/**High**/4ex | Mixed/core/**Moderate**/5ex | `obsolete_derived_work_expired`, `weekly_power_budget`, `offer_presented` |

**The input is identical in both arms.** Nothing wrote the completed days in the
store — the stored week still says `High` after the readiness commit. The
rewrite happens **at read**, inside tier 4's own projection, on its way to the
athlete's screen. Stack, from the tape:

```
scaffoldSection18TierFour   (src/utils/sessionResolver.ts:1088)
resolveWeekWithConditioning (src/utils/sessionResolver.ts:1884)
resolveFinalVisibleSection18Week (src/rules/section18AcceptedWeekGateway.ts:423)
rebaseAcceptedEffectiveWeek (src/rules/acceptedEffectiveWeek.ts:205)
acceptedWeek                (durableFactHorizonTests.ts:233) ← the test's own read
```

## 3. Which stage — the gateway stage tape

`resolveCandidate`'s normaliser chain, week 1, the failing arm:

| stage | MON 2026-07-20 | TUE 2026-07-21 |
|---|---|---|
| 0 candidate | Mixed/core/High/4ex | Team Training/core/High/3ex |
| 1 removal constraints | unchanged | unchanged |
| 2 derived expiry | unchanged | unchanged |
| **3 safety finaliser** | **Strength/core/Moderate/4ex** | **Team Training/core/Moderate/3ex** |
| 4 power budget | unchanged | unchanged |
| **5 present declared offer** | **Mixed/core/Moderate/5ex** | unchanged |

**THE WRITE: `src/rules/section18SafetyFinaliser.ts:265–278`** — the
`contract.safety.lighterStrengthRequired` branch. The intensity ternary at
`:270–274` maps `High|Maximal → Moderate`; `:276` performs the write
(`workout = { ...workout, exercises, intensity }`) and discloses it as
`strength_dose_reduced`. Reached from the gateway at
`section18AcceptedWeekGateway.ts:1311`.

**A SECOND site, in the same chain:** stage 5, `presentDeclaredOffer`
(`src/rules/section18OfferPlacement.ts`, called at
`section18AcceptedWeekGateway.ts:1355`), which placed a flush offer on Monday
2026-07-20 and says so in its own repair text — *"Presented the week's 1
declared optional flush offer on Monday."* That is Monday's `4ex → 5ex`. It is
masked in the test's failure message because the intensity write already fails
the assertion.

**The control that makes this specific rather than generic:** `t4-poor_sleep_week`
runs the identical chain and **passes** — every stage leaves both days at `High`.
Its contract's mode is `in_season_game_week` with
`lighterStrengthRequired: false`. Illness and cooked_week produce
`optional_week` with `lighterStrengthRequired: true`.

## 4. The deciding measurement: the boundary is already on the contract

The contract tier 4 conforms against, in the failing arm:

```
mode: optional_week   governedFromISO: "2026-07-24"   lighterStrengthRequired: true
```

`governedFromISO` is §18's fact-horizon boundary — *"dates before it are HISTORY:
they count toward the week's requirements and are never governed"*
(`section18EffectiveWeekEvaluator.ts:514–520`, behind
`docs/SECTION18_DELIVERED_VS_REMAINING_REASSESSMENT_2026-07-24.md`).

**2026-07-20 and 2026-07-21 are both before 2026-07-24.** The boundary is
present, correct, and carried on the very object both write sites already
receive.

Census of `governedFromISO` readers in `src` (non-test):

| file | reads | role |
|---|---|---|
| `services/api/generateProgram.ts` | 11 | generation honours it |
| `store/temporarySourceFactTransaction.ts` | 6 | the WRITE door honours it |
| `rules/weeklyExposureContractV2.ts` | 6 | the one owner that stamps it |
| `rules/section18EffectiveWeekEvaluator.ts` | 5 | the EVALUATOR honours it |
| `rules/section18SafetyFinaliser.ts` | **0** | write site 1 |
| `rules/section18OfferPlacement.ts` | **0** | write site 2 |
| `rules/section18AcceptedWeekGateway.ts` | **0** | the chain that hosts both |

## 5. Why this was invisible until leg (ii)

The write door does not depend on the normalisers respecting the boundary — it
**post-filters their output**. `temporarySourceFactTransaction.ts:565–570` keeps
only `date >= remainderBoundary.governedFromISO` in the overlay's
`workoutsByDate`, so pre-boundary days fall through to the untouched base:
*"byte-exact preservation by construction."*

Tier 4 at read has no such post-filter — the projection returns what the chain
produced. So the same over-reaching normalisers have been correct-by-accident
at one door and wrong at the other, and leg (ii) is what put a door on the
second one.

## 6. Against the seat's pre-framing (c)

The seat framed two branches. The measurement lands **between** them, and the
distinction matters:

- The write **does** name its authorising fact — `lighterStrengthRequired`,
  declared by the severe-illness fact reported Friday.
- The authorisation is **not** the defect: it is correctly bounded. The contract
  states its own history boundary and the evaluator enforces it.
- **The write site is the defect**, in (c)'s own terms — but not because it
  "cannot name" an authorisation. Because it names one, is handed that
  authorisation's boundary in the same argument, and does not read it.

So the fix shape (c) points to — *tier 4's search space excludes fact days* —
is right in outcome and would be built in the wrong place if built as a tier-4
filter: two normalisers over-reach, tier 4 is merely the door that stopped
hiding it, and a filter at the door leaves both writers wrong for the next door.

**STOP, per standing conditions.** The named site is Section-18 signed
behaviour (`src/__tests__/section18SafetyBoundaryTests.ts` pins the safety
finaliser; the offer placer implements Sam's 2026-08-06 offer-survival ruling).
Nothing was built.

## 7. The compression this sighting owes

The shape — *a law with one enforcing owner and uncounted sibling owners in the
same chain* — is at sighting 4. The repo already has the proven answer to it:
the one-door narrowing gate built at `369af59d`, which censuses writers in
**both** directions so an undeclared writer fails and a declared writer that
stopped writing also fails.

Proposal, not built: the same gate shape for the governed boundary. Enumerate
the functions in the accepted-week chain that MUTATE a week's workouts; each
must either read `governedFromISO` or carry a declared exemption. Today that
census is 4 readers and at least 2 unenumerated mutators. This is a proposal for
the seat to rule on, not a scoped unit.

## 8. NOT COVERED — stated in the three buckets

**MEASURED-DONE** (cite: this run, tape `b5918f9d`, full suite 12/2 plus two
single-scenario runs)
- The write site, the stage, and the contract's boundary value.
- The poor_sleep control, both arms.
- The reader census above.

**ATTRIBUTED-NOT-FIXED**
- `fact-horizon`'s two reds. Nothing built; no fix proposed beyond §6's
  placement argument.

**OPEN-UNKNOWN**
- Whether bounding the two writers greens `fact-horizon` — **not measured.**
- Whether it touches the other four of leg (ii)'s seven reds — **not measured**;
  they were not instrumented (worst-first, as ordered).
- Whether the same two writers over-reach on the WRITE side. The post-filter at
  `temporarySourceFactTransaction.ts:567` was read in source, **not** measured as
  behaviour, so "the write door is unaffected" is a source reading, not a run.
- Monday's `4ex → 5ex` has two contributing stages. The intensity write is
  attributed to a line; the offer placement is attributed by the placer's own
  disclosure text and the stage tape, not by a line-level tape inside it.
- Whether `governedFromISO` is the right boundary for a day that is *past but
  not Done*. Related and measured but **not chased**: the tape's `done` field —
  `hasOwnProperty(state.sessionFeedback, date)` at the tier-4 call site — is
  `false` for MON/TUE even though both were recorded Done through the real
  session-outcome transaction. Either the marks do not reach the resolver's
  state or they are not keyed as the probe assumed. Not diagnosed.
- The tape also shows tier 4 running with `today: "2026-08-07"` — the wall
  clock, not the scenario's `TODAY = 2026-07-24`. That is consistent with the
  tracked todayISO clock debt and was **not** investigated here; it does not
  affect this attribution (the boundary that decides is the contract's, not
  `today`), but it is recorded rather than dropped.
