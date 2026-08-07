# R5.3 THE FREED DAY'S PRODUCER — NAMED — 2026-08-07

Answers SEAT_INBOX item on **Sam's lead** (2026-08-07): *"if a game is
removed it can be replaced by hard conditioning."* Checked FIRST, as
ordered, ahead of the `commitWeekScopedOverlay` overlay-merge probe.

**Probe only — nothing built, nothing merged.** Preserved at `a7b49764`
on `scratch/r53-pricing-7`, flag-gated (`LFA_PROBE_RELEASE`,
`LFA_PROBE_SEEDBASE`) and inert by default.

## The lead was right about the law, and it narrowed the search correctly

The content is exactly what Sam described. On the bye-build week the
released usual game day (Saturday 2026-07-18) hosts a **`Hard
Conditioning`** session — the Bible's replacement exposure for a released
fixture (:164, :4670, :4676). The suite that reds even names it:

```
bye-build hard conditioning template missing from both the rebuilt week
and the accepted week; rebuilt reads []
```

## (1) The release pathway itself is INNOCENT — identical in both worlds

Instrumented `resolveFixtureConditionedAvailability` across the whole
deletion suite in both worlds. Compared **distinct values**, not line
counts — leg (v) fails earlier and therefore makes fewer calls, so a raw
count difference would have been a measurement lie:

| | distinct release records |
|---|---|
| flags off | 52 |
| leg (v) | 46 |
| **present only in leg (v)** | **0** — a strict subset |

Every record agrees on every field:

```
byeUsualGameDay: true      usualGameDay: "Saturday"
releasedFixtures: ["2026-07-18:game:bye_usual_game_day"]
availableDates: 6 days     capacity: 6
```

The release producer, its `bye_usual_game_day` provenance, and the
`targetWeekFixtures` projection underneath it behave identically with and
without leg (v). **Not the divergence.**

## (2) The producer is the overlay's PAYLOAD, one hop downstream

```
flags off   publishedOverlayPresent: true
            workoutsByDate: ["2026-07-13:Lower Body Strength",
                             "2026-07-18:Hard Conditioning"]
            accepted week: 6 sessions, incl. Hard Conditioning

leg (v)     publishedOverlayPresent: true
            workoutsByDate: []
            accepted week: 5 sessions, Hard Conditioning GONE
```

**The overlay is still published in BOTH worlds.** That is why the earlier
seed probe read `contractSource: overlay` on both sides and the difference
could not be attributed — the premise that leg (v) removes the overlay was
wrong. What leg (v) removes is the overlay's **`workoutsByDate`**, and the
freed Saturday's `Hard Conditioning` travelled in that payload.

This closes diagnosis (b)'s open question — *"something else about leg
(v)'s publication changes the freed day"*. It is named: the workout
payload of the published week-scoped overlay. It is **not** the contract's
presence, and **not** the core-conditioning placer, which measurement had
already cleared.

## (3) The 16 deletion failures are FIXTURE debt, not 16 product regressions

All 16 run through `seedExactSundayRegression` (18 call sites). That seed
reads a `Hard Conditioning` workout out of the payload purely as a
**template to clone** into the Sunday and Saturday it then **overwrites**.
Its own comment records the ruling it now contradicts:

> Sam ruled the DERIVER correct on 2026-08-06: a freed fixture day returns
> to the athlete's own pattern, and filling it was `fixture-identity-1`'s
> bug generalised.

So the seed depends on the very filling that ruling retired. Leg (v)
stopping the fill is the ruling being obeyed; the seed reds because its
scaffolding borrowed the defect as a convenience.

This is consistent with the direction already measured elsewhere: leg (v)
takes `test:fixture-identity` from **2 red to 6/6 green** while the
deletion suite goes 24/24 → 16/24.

## NOT PROVEN — and this is the next question

Whether the empty `workoutsByDate` is leg (v)'s **intended scope** or its
scope switch reaching further than intended. The scaffold's own last
commit is titled "leg (v)'s scope switch", so this is live.

**Until that is settled the deletion price cannot be read as leg (v)'s
real cost.** If the payload emptying is unintended, most of the 24/24 →
16/24 is scaffold, not product — and the leg (v) refutation recorded
earlier was priced against a defect.

## STOP

Attribution before build, as ruled. The producer is named, so the
`commitWeekScopedOverlay` overlay-merge probe (clause (c)) **collapses
into this** exactly as the lead anticipated — the merge of an explicitly
`undefined` published field is the mechanism by which the payload empties,
and it should now be probed as one question, not two.

What the seat needs to rule on:

1. Is leg (v) meant to retire the overlay's workout payload, or only the
   `exposureContractV2` declaration? That single answer re-prices leg (v).
2. If only the declaration: the payload emptying is a scaffold defect and
   the deletion cost must be re-measured before leg (v) is called refuted.
3. `seedExactSundayRegression` depends on behaviour Sam already ruled a
   bug. It needs a template source that does not borrow the fill — its own
   fix, under the fixture-fidelity laws, like cell 19's.

## NOT COVERED

- Full `test:bible` not run; this unit committed docs and flag-gated
  probes on a scratch branch, no product code.
- Only `test:athlete-session-deletion` and `test:fixture-identity` were
  run in both worlds.
- Whether the payload emptying also affects weeks OTHER than the bye-build
  week was not measured.
- The `commitWeekScopedOverlay` merge itself was NOT opened — this probe
  names the symptom's owner, not the line that empties it.

## L12 — what catches the NEXT one of this class

The class is: **a fixture borrowing product behaviour as scaffolding, so
retiring that behaviour reds cells that are not about it.** Sixteen cells
named deletion and failed on a fixture's template read; the totals said
"leg (v) costs 8 deletion cells" and that was never true.

What would catch it: a seed that **constructs** what it needs rather than
reading it out of live product output, and — where a seed genuinely must
read product output — an explicit assertion naming that dependency, so it
fails as *"this seed depends on X"* rather than as eight unrelated
regressions. This is the same law as cell 19's, one layer up: a fixture
must not depend on a behaviour it is not testing.
